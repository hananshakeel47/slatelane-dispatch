-- ============================================================
-- SLATELANE CRM
-- MIGRATION 019
-- PRE-SEND EMAIL VERIFICATION + RISK FILTERING
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ADD EMAIL VERIFICATION FIELDS TO CARRIERS
-- ============================================================

ALTER TABLE public.carriers
ADD COLUMN IF NOT EXISTS email_verification_status text
DEFAULT 'unchecked';

ALTER TABLE public.carriers
ADD COLUMN IF NOT EXISTS email_risk_score integer
DEFAULT 0;

ALTER TABLE public.carriers
ADD COLUMN IF NOT EXISTS email_verification_reason text;

ALTER TABLE public.carriers
ADD COLUMN IF NOT EXISTS email_domain text;

ALTER TABLE public.carriers
ADD COLUMN IF NOT EXISTS email_role_based boolean
DEFAULT false;

ALTER TABLE public.carriers
ADD COLUMN IF NOT EXISTS email_disposable boolean
DEFAULT false;

ALTER TABLE public.carriers
ADD COLUMN IF NOT EXISTS email_free_provider boolean
DEFAULT false;

ALTER TABLE public.carriers
ADD COLUMN IF NOT EXISTS email_verification_checked_at timestamptz;


-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_carriers_email_verification_status
ON public.carriers(email_verification_status);

CREATE INDEX IF NOT EXISTS idx_carriers_email_risk_score
ON public.carriers(email_risk_score);

CREATE INDEX IF NOT EXISTS idx_carriers_email_domain
ON public.carriers(email_domain);

CREATE INDEX IF NOT EXISTS idx_carriers_email_verification_checked_at
ON public.carriers(email_verification_checked_at);


-- ============================================================
-- 3. DISPOSABLE EMAIL DOMAIN TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_disposable_domains (
    domain text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 4. SEED COMMON DISPOSABLE EMAIL DOMAINS
-- ============================================================

INSERT INTO public.email_disposable_domains(domain)
VALUES

('10minutemail.com'),
('10minutemail.net'),
('20minutemail.com'),
('dispostable.com'),
('dropmail.me'),
('emailondeck.com'),
('fakeinbox.com'),
('guerrillamail.com'),
('guerrillamail.net'),
('guerrillamail.org'),
('maildrop.cc'),
('mailinator.com'),
('mailnesia.com'),
('mintemail.com'),
('moakt.com'),
('mytemp.email'),
('sharklasers.com'),
('spam4.me'),
('temp-mail.org'),
('tempail.com'),
('tempmail.com'),
('tempmail.net'),
('tempmailaddress.com'),
('temporarymail.com'),
('throwawaymail.com'),
('trashmail.com'),
('trashmail.net'),
('yopmail.com'),
('yopmail.fr'),
('yopmail.net')

ON CONFLICT (domain) DO NOTHING;


-- ============================================================
-- 5. EMAIL VERIFICATION FUNCTION
--
-- Risk score:
-- 0   = excellent
-- 100 = dangerous / blocked
--
-- Status:
-- verified_format
-- caution
-- risky
-- invalid
-- missing
-- blocked
-- ============================================================

CREATE OR REPLACE FUNCTION public.evaluate_carrier_email(
    p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE

    v_email text;
    v_local text;
    v_domain text;

    v_risk integer := 0;

    v_role_based boolean := false;
    v_disposable boolean := false;
    v_free_provider boolean := false;

    v_status text := 'unchecked';
    v_reason text := '';

BEGIN

    -- --------------------------------------------------------
    -- NORMALIZE
    -- --------------------------------------------------------

    v_email := lower(trim(coalesce(p_email, '')));


    -- --------------------------------------------------------
    -- MISSING EMAIL
    -- --------------------------------------------------------

    IF v_email = '' THEN

        RETURN jsonb_build_object(
            'status', 'missing',
            'risk_score', 100,
            'reason', 'No email address is available.',
            'domain', NULL,
            'role_based', false,
            'disposable', false,
            'free_provider', false
        );

    END IF;


    -- --------------------------------------------------------
    -- BASIC FORMAT VALIDATION
    -- --------------------------------------------------------

    IF v_email !~*
       '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$'
    THEN

        RETURN jsonb_build_object(
            'status', 'invalid',
            'risk_score', 100,
            'reason', 'Email address has invalid syntax.',
            'domain', NULL,
            'role_based', false,
            'disposable', false,
            'free_provider', false
        );

    END IF;


    -- --------------------------------------------------------
    -- SPLIT EMAIL
    -- --------------------------------------------------------

    v_local := split_part(v_email, '@', 1);
    v_domain := split_part(v_email, '@', 2);


    -- --------------------------------------------------------
    -- LENGTH CHECKS
    -- --------------------------------------------------------

    IF length(v_email) > 254
       OR length(v_local) > 64
       OR length(v_domain) > 253
    THEN

        RETURN jsonb_build_object(
            'status', 'invalid',
            'risk_score', 100,
            'reason', 'Email address exceeds valid length limits.',
            'domain', v_domain,
            'role_based', false,
            'disposable', false,
            'free_provider', false
        );

    END IF;


    -- --------------------------------------------------------
    -- DISPOSABLE DOMAIN CHECK
    -- --------------------------------------------------------

    SELECT EXISTS (
        SELECT 1
        FROM public.email_disposable_domains d
        WHERE d.domain = v_domain
    )
    INTO v_disposable;


    IF v_disposable THEN

        v_risk := 95;
        v_reason := 'Disposable or temporary email domain detected.';

    END IF;


    -- --------------------------------------------------------
    -- ROLE-BASED EMAIL CHECK
    -- --------------------------------------------------------

    IF v_local IN (

        'admin',
        'administrator',
        'billing',
        'bookkeeping',
        'careers',
        'contact',
        'customerservice',
        'dispatch',
        'dispatcher',
        'finance',
        'hello',
        'help',
        'hr',
        'info',
        'inquiries',
        'jobs',
        'mail',
        'office',
        'operations',
        'ops',
        'orders',
        'payables',
        'receiving',
        'sales',
        'service',
        'support',
        'team'

    )
    THEN

        v_role_based := true;

        v_risk := greatest(v_risk, 30);

        IF v_reason = '' THEN
            v_reason :=
            'Role-based company email address detected.';
        ELSE
            v_reason :=
            v_reason ||
            ' Role-based company email address also detected.';
        END IF;

    END IF;


    -- --------------------------------------------------------
    -- FREE PROVIDER CHECK
    --
    -- Free email is NOT blocked.
    -- We only give it a small risk adjustment.
    -- --------------------------------------------------------

    IF v_domain IN (

        'gmail.com',
        'googlemail.com',
        'outlook.com',
        'hotmail.com',
        'live.com',
        'msn.com',
        'yahoo.com',
        'ymail.com',
        'aol.com',
        'icloud.com',
        'me.com',
        'proton.me',
        'protonmail.com'

    )
    THEN

        v_free_provider := true;

        v_risk := greatest(v_risk, 10);

        IF v_reason = '' THEN
            v_reason :=
            'Valid format using a consumer email provider.';
        END IF;

    END IF;


    -- --------------------------------------------------------
    -- SUSPICIOUS LOCAL PARTS
    -- --------------------------------------------------------

    IF v_local LIKE '%test%'
       OR v_local LIKE '%fake%'
       OR v_local LIKE '%sample%'
       OR v_local LIKE '%example%'
    THEN

        v_risk := greatest(v_risk, 65);

        IF v_reason = '' THEN
            v_reason :=
            'Potential test or placeholder email address.';
        ELSE
            v_reason :=
            v_reason ||
            ' Potential test or placeholder address detected.';
        END IF;

    END IF;


    -- --------------------------------------------------------
    -- EXAMPLE / DOCUMENTATION DOMAINS
    -- --------------------------------------------------------

    IF v_domain IN (
        'example.com',
        'example.net',
        'example.org',
        'localhost'
    )
    THEN

        v_risk := 100;

        v_reason :=
        'Reserved or non-production email domain.';

    END IF;


    -- --------------------------------------------------------
    -- DETERMINE STATUS
    -- --------------------------------------------------------

    IF v_risk >= 90 THEN

        v_status := 'risky';

    ELSIF v_risk >= 40 THEN

        v_status := 'risky';

    ELSIF v_risk >= 20 THEN

        v_status := 'caution';

    ELSE

        v_status := 'verified_format';

    END IF;


    -- --------------------------------------------------------
    -- DEFAULT CLEAN RESULT
    -- --------------------------------------------------------

    IF v_reason = '' THEN

        v_reason :=
        'Email passed local syntax and risk checks.';

    END IF;


    RETURN jsonb_build_object(

        'status',
        v_status,

        'risk_score',
        v_risk,

        'reason',
        v_reason,

        'domain',
        v_domain,

        'role_based',
        v_role_based,

        'disposable',
        v_disposable,

        'free_provider',
        v_free_provider

    );

END;
$$;


-- ============================================================
-- 6. FUNCTION TO VERIFY ONE CARRIER
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_carrier_email(
    p_carrier_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE

    v_email text;
    v_result jsonb;
    v_health text;

BEGIN

    SELECT
        email,
        email_health_status
    INTO
        v_email,
        v_health

    FROM public.carriers

    WHERE id = p_carrier_id;


    IF NOT FOUND THEN

        RETURN jsonb_build_object(
            'success', false,
            'reason', 'carrier_not_found'
        );

    END IF;


    v_result :=
        public.evaluate_carrier_email(v_email);


    -- --------------------------------------------------------
    -- EXISTING PHASE 018 HEALTH STATUS HAS HIGHEST PRIORITY
    -- --------------------------------------------------------

    IF v_health IN (
        'bounced',
        'complained',
        'opted_out',
        'suppressed'
    )
    THEN

        v_result :=
            jsonb_set(
                v_result,
                '{status}',
                '"blocked"'
            );

        v_result :=
            jsonb_set(
                v_result,
                '{risk_score}',
                '100'
            );

        v_result :=
            jsonb_set(
                v_result,
                '{reason}',
                to_jsonb(
                    'Blocked by existing email health status: '
                    || v_health
                )
            );

    END IF;


    UPDATE public.carriers
    SET

        email_verification_status =
            v_result->>'status',

        email_risk_score =
            (v_result->>'risk_score')::integer,

        email_verification_reason =
            v_result->>'reason',

        email_domain =
            v_result->>'domain',

        email_role_based =
            coalesce(
                (v_result->>'role_based')::boolean,
                false
            ),

        email_disposable =
            coalesce(
                (v_result->>'disposable')::boolean,
                false
            ),

        email_free_provider =
            coalesce(
                (v_result->>'free_provider')::boolean,
                false
            ),

        email_verification_checked_at =
            now()

    WHERE id = p_carrier_id;


    RETURN jsonb_build_object(
        'success', true,
        'carrier_id', p_carrier_id,
        'result', v_result
    );

END;
$$;


-- ============================================================
-- 7. BATCH VERIFICATION FUNCTION
--
-- Run repeatedly to safely process your ~200k carriers.
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_carrier_email_batch(
    p_limit integer DEFAULT 10000
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE

    v_row record;
    v_processed integer := 0;
    v_verified integer := 0;
    v_caution integer := 0;
    v_risky integer := 0;
    v_blocked integer := 0;
    v_invalid integer := 0;
    v_missing integer := 0;

    v_result jsonb;
    v_status text;

BEGIN

    p_limit :=
        greatest(
            1,
            least(coalesce(p_limit, 10000), 25000)
        );


    FOR v_row IN

        SELECT id
        FROM public.carriers

        WHERE email_verification_checked_at IS NULL

        ORDER BY id

        LIMIT p_limit

    LOOP

        v_result :=
            public.verify_carrier_email(v_row.id);

        v_status :=
            v_result->'result'->>'status';


        v_processed :=
            v_processed + 1;


        CASE v_status

            WHEN 'verified_format'
                THEN v_verified := v_verified + 1;

            WHEN 'caution'
                THEN v_caution := v_caution + 1;

            WHEN 'risky'
                THEN v_risky := v_risky + 1;

            WHEN 'blocked'
                THEN v_blocked := v_blocked + 1;

            WHEN 'invalid'
                THEN v_invalid := v_invalid + 1;

            WHEN 'missing'
                THEN v_missing := v_missing + 1;

            ELSE
                NULL;

        END CASE;

    END LOOP;


    RETURN jsonb_build_object(

        'success', true,

        'processed',
        v_processed,

        'verified_format',
        v_verified,

        'caution',
        v_caution,

        'risky',
        v_risky,

        'blocked',
        v_blocked,

        'invalid',
        v_invalid,

        'missing',
        v_missing

    );

END;
$$;


-- ============================================================
-- 8. SENDABILITY FUNCTION
--
-- This will be used by Pilot Launch in Phase 019B.
-- ============================================================

CREATE OR REPLACE FUNCTION public.carrier_email_is_sendable(
    p_carrier_id bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$

    SELECT

        CASE

            WHEN email IS NULL
                OR trim(email) = ''
                THEN false

            WHEN email_health_status IN (
                'bounced',
                'complained',
                'opted_out',
                'suppressed'
            )
                THEN false

            WHEN email_verification_status IN (
                'blocked',
                'invalid',
                'missing',
                'risky'
            )
                THEN false

            WHEN email_risk_score >= 60
                THEN false

            ELSE true

        END

    FROM public.carriers

    WHERE id = p_carrier_id;

$$;


-- ============================================================
-- 9. VERIFICATION SUMMARY VIEW
-- ============================================================

CREATE OR REPLACE VIEW public.carrier_email_verification_summary
AS

SELECT

    coalesce(
        email_verification_status,
        'unchecked'
    ) AS status,

    count(*) AS carriers,

    round(
        avg(
            coalesce(
                email_risk_score,
                0
            )
        ),
        2
    ) AS average_risk_score

FROM public.carriers

GROUP BY
    coalesce(
        email_verification_status,
        'unchecked'
    );


-- ============================================================
-- 10. FORCE EXISTING PHASE 018 BAD EMAILS TO BLOCKED
-- ============================================================

UPDATE public.carriers

SET

    email_verification_status =
        'blocked',

    email_risk_score =
        100,

    email_verification_reason =
        'Blocked by existing email health status: '
        || email_health_status,

    email_verification_checked_at =
        now()

WHERE email_health_status IN (
    'bounced',
    'complained',
    'opted_out',
    'suppressed'
);


COMMIT;