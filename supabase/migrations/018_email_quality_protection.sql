-- ============================================================
-- SlateLane Dispatch CRM
-- Migration 018
-- Email Quality Protection / Bounce Intelligence
-- ============================================================

BEGIN;


-- ============================================================
-- 1. ADD EMAIL HEALTH FIELDS TO CARRIERS
-- ============================================================

ALTER TABLE public.carriers
ADD COLUMN IF NOT EXISTS email_health_status text
NOT NULL DEFAULT 'unknown';

ALTER TABLE public.carriers
ADD COLUMN IF NOT EXISTS email_health_reason text;

ALTER TABLE public.carriers
ADD COLUMN IF NOT EXISTS email_health_updated_at timestamptz;

ALTER TABLE public.carriers
ADD COLUMN IF NOT EXISTS email_last_bounced_at timestamptz;

ALTER TABLE public.carriers
ADD COLUMN IF NOT EXISTS email_last_complained_at timestamptz;


-- ============================================================
-- 2. VALID EMAIL HEALTH STATUSES
-- ============================================================

ALTER TABLE public.carriers
DROP CONSTRAINT IF EXISTS carriers_email_health_status_check;

ALTER TABLE public.carriers
ADD CONSTRAINT carriers_email_health_status_check
CHECK (
    email_health_status IN (
        'unknown',
        'healthy',
        'bounced',
        'complained',
        'opted_out',
        'suppressed'
    )
);


-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_carriers_email_lower
ON public.carriers (lower(trim(email)));

CREATE INDEX IF NOT EXISTS idx_carriers_email_health_status
ON public.carriers (email_health_status);

CREATE INDEX IF NOT EXISTS idx_carriers_email_health_updated_at
ON public.carriers (email_health_updated_at DESC);


-- ============================================================
-- 4. HELPER FUNCTION
-- Convert suppression reason into carrier email health status.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_email_health_status_from_reason(
    p_reason text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    normalized_reason text;
BEGIN

    normalized_reason := lower(trim(coalesce(p_reason, '')));

    -- Complaint / spam report
    IF normalized_reason LIKE '%complain%'
       OR normalized_reason LIKE '%spam%'
    THEN
        RETURN 'complained';
    END IF;


    -- Hard bounce / bounce / invalid mailbox
    IF normalized_reason LIKE '%bounce%'
       OR normalized_reason LIKE '%invalid%'
       OR normalized_reason LIKE '%mailbox%'
       OR normalized_reason LIKE '%recipient%'
    THEN
        RETURN 'bounced';
    END IF;


    -- Unsubscribe / opt out
    IF normalized_reason LIKE '%unsubscribe%'
       OR normalized_reason LIKE '%opt_out%'
       OR normalized_reason LIKE '%opt-out%'
       OR normalized_reason LIKE '%opted%'
    THEN
        RETURN 'opted_out';
    END IF;


    -- Any other suppression
    RETURN 'suppressed';

END;
$$;


-- ============================================================
-- 5. FUNCTION:
-- When an email enters email_suppressions,
-- automatically mark matching carrier email as unsafe.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_carrier_email_health_from_suppression()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_status text;
BEGIN

    IF NEW.email IS NULL
       OR trim(NEW.email) = ''
    THEN
        RETURN NEW;
    END IF;


    new_status :=
        public.get_email_health_status_from_reason(
            NEW.reason
        );


    UPDATE public.carriers
    SET
        email_health_status = new_status,

        email_health_reason = coalesce(
            NEW.reason,
            'Email suppression'
        ),

        email_health_updated_at = now(),

        email_last_bounced_at =
            CASE
                WHEN new_status = 'bounced'
                    THEN now()
                ELSE email_last_bounced_at
            END,

        email_last_complained_at =
            CASE
                WHEN new_status = 'complained'
                    THEN now()
                ELSE email_last_complained_at
            END

    WHERE
        email IS NOT NULL

        AND lower(trim(email)) =
            lower(trim(NEW.email));


    RETURN NEW;

END;
$$;


-- ============================================================
-- 6. CREATE TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS
trigger_sync_carrier_email_health_from_suppression
ON public.email_suppressions;


CREATE TRIGGER
trigger_sync_carrier_email_health_from_suppression

AFTER INSERT OR UPDATE OF
    email,
    reason

ON public.email_suppressions

FOR EACH ROW

EXECUTE FUNCTION
public.sync_carrier_email_health_from_suppression();


-- ============================================================
-- 7. BACKFILL EXISTING SUPPRESSED EMAILS
--
-- This processes emails that bounced / complained /
-- unsubscribed before Migration 018 existed.
-- ============================================================

WITH suppression_ranked AS (

    SELECT DISTINCT ON (
        lower(trim(email))
    )

        lower(trim(email)) AS normalized_email,

        reason,

        public.get_email_health_status_from_reason(
            reason
        ) AS health_status

    FROM public.email_suppressions

    WHERE
        email IS NOT NULL

        AND trim(email) <> ''

    ORDER BY

        lower(trim(email)),

        CASE
            WHEN public.get_email_health_status_from_reason(reason)
                = 'complained'
                THEN 4

            WHEN public.get_email_health_status_from_reason(reason)
                = 'bounced'
                THEN 3

            WHEN public.get_email_health_status_from_reason(reason)
                = 'opted_out'
                THEN 2

            ELSE 1
        END DESC

)

UPDATE public.carriers AS c

SET
    email_health_status =
        s.health_status,

    email_health_reason =
        coalesce(
            s.reason,
            'Existing email suppression'
        ),

    email_health_updated_at =
        now(),

    email_last_bounced_at =
        CASE
            WHEN s.health_status = 'bounced'
                THEN coalesce(
                    c.email_last_bounced_at,
                    now()
                )

            ELSE c.email_last_bounced_at
        END,

    email_last_complained_at =
        CASE
            WHEN s.health_status = 'complained'
                THEN coalesce(
                    c.email_last_complained_at,
                    now()
                )

            ELSE c.email_last_complained_at
        END

FROM suppression_ranked AS s

WHERE
    c.email IS NOT NULL

    AND lower(trim(c.email)) =
        s.normalized_email;


-- ============================================================
-- 8. EMAIL QUALITY SUMMARY VIEW
-- ============================================================

CREATE OR REPLACE VIEW
public.carrier_email_quality_summary
AS

SELECT

    email_health_status,

    count(*)::bigint AS carriers

FROM public.carriers

WHERE
    email IS NOT NULL
    AND trim(email) <> ''

GROUP BY
    email_health_status;


-- ============================================================
-- 9. UNSAFE EMAIL VIEW
--
-- Easy inspection from Monitoring / admin tools later.
-- ============================================================

CREATE OR REPLACE VIEW
public.unsafe_carrier_emails
AS

SELECT

    id,
    dot_number,
    mc_number,
    legal_name,
    dba_name,
    email,

    email_health_status,
    email_health_reason,

    email_health_updated_at,
    email_last_bounced_at,
    email_last_complained_at

FROM public.carriers

WHERE
    email IS NOT NULL

    AND email_health_status IN (
        'bounced',
        'complained',
        'opted_out',
        'suppressed'
    );


COMMIT;