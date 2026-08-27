BEGIN;

-- ============================================================
-- SLATELANE
-- PHASE 019B PART 2
-- VERIFIED PILOT + FINAL SEND GUARD
-- ============================================================


-- ============================================================
-- 1. REBUILD SENDABLE CARRIER VIEW
--
-- Production policy:
-- Only "verified_format" addresses may enter a real pilot.
--
-- caution / risky / missing / invalid / blocked addresses
-- remain excluded.
-- ============================================================

DROP VIEW IF EXISTS public.email_sendable_carriers;


CREATE VIEW public.email_sendable_carriers AS
SELECT
    c.id,
    c.dot_number,
    c.mc_number,
    c.legal_name,
    c.dba_name,
    c.owner_name,
    c.phone,
    c.email,
    c.state,

    c.status_code,
    c.authority_status,

    c.power_units,
    c.drivers,

    c.lead_score,
    c.dispatcher_probability,

    c.contacted,
    c.client,

    c.email_health_status,
    c.email_health_reason,

    c.email_verification_status,
    c.email_risk_score,
    c.email_verification_reason,

    c.email_role_based,
    c.email_disposable,
    c.email_free_provider,

    c.email_verification_checked_at

FROM public.carriers c

WHERE
    c.email IS NOT NULL

    AND trim(c.email) <> ''

    -- --------------------------------------------------------
    -- STRICT FIRST-PILOT RULE
    -- --------------------------------------------------------
    AND c.email_verification_status = 'verified_format'

    -- hard upper safety limit
    AND COALESCE(c.email_risk_score, 100) < 70

    -- --------------------------------------------------------
    -- EMAIL HEALTH
    -- --------------------------------------------------------
    AND COALESCE(
        c.email_health_status,
        'unknown'
    ) NOT IN (
        'bounced',
        'complained',
        'opted_out',
        'suppressed'
    )

    -- --------------------------------------------------------
    -- CRM STATE
    -- --------------------------------------------------------
    AND COALESCE(
        c.contacted,
        false
    ) = false

    AND COALESCE(
        c.client,
        false
    ) = false;


-- ============================================================
-- 2. INDEXES FOR PILOT / SEND CHECKING
-- ============================================================

CREATE INDEX IF NOT EXISTS
idx_carriers_email_verification_status
ON public.carriers (
    email_verification_status
);


CREATE INDEX IF NOT EXISTS
idx_carriers_email_risk_score
ON public.carriers (
    email_risk_score
);


CREATE INDEX IF NOT EXISTS
idx_carriers_verified_send_selection
ON public.carriers (
    lead_score DESC,
    dispatcher_probability DESC
)
WHERE
    email_verification_status = 'verified_format'
    AND email IS NOT NULL;


-- ============================================================
-- 3. STRICT LAST-SECOND ELIGIBILITY FUNCTION
--
-- This function is intentionally evaluated from CURRENT data.
--
-- Even if a carrier was eligible during pilot preparation,
-- this function can stop the send later if:
--
-- - carrier bounced
-- - carrier complained
-- - carrier opted out
-- - carrier became suppressed
-- - verification became unsafe
-- - email changed
-- ============================================================

CREATE OR REPLACE FUNCTION
public.carrier_email_send_eligibility(
    p_carrier_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE

    v_carrier public.carriers%ROWTYPE;

    v_email text;

    v_suppressed boolean := false;

BEGIN

    SELECT *
    INTO v_carrier
    FROM public.carriers
    WHERE id = p_carrier_id
    LIMIT 1;


    IF NOT FOUND THEN

        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'carrier_not_found',
            'carrier_id', p_carrier_id
        );

    END IF;


    v_email :=
        lower(
            trim(
                COALESCE(
                    v_carrier.email,
                    ''
                )
            )
        );


    -- ========================================================
    -- EMAIL REQUIRED
    -- ========================================================

    IF v_email = '' THEN

        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'missing_email',
            'carrier_id', p_carrier_id
        );

    END IF;


    -- ========================================================
    -- STRICT VERIFICATION REQUIREMENT
    -- ========================================================

    IF COALESCE(
        v_carrier.email_verification_status,
        ''
    ) <> 'verified_format' THEN

        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'email_not_verified',
            'carrier_id', p_carrier_id,
            'email', v_email,
            'verification_status',
            v_carrier.email_verification_status
        );

    END IF;


    -- ========================================================
    -- RISK SCORE
    -- ========================================================

    IF COALESCE(
        v_carrier.email_risk_score,
        100
    ) >= 70 THEN

        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'email_risk_too_high',
            'carrier_id', p_carrier_id,
            'email', v_email,
            'risk_score',
            v_carrier.email_risk_score
        );

    END IF;


    -- ========================================================
    -- EMAIL HEALTH
    -- ========================================================

    IF COALESCE(
        v_carrier.email_health_status,
        'unknown'
    ) IN (
        'bounced',
        'complained',
        'opted_out',
        'suppressed'
    ) THEN

        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'blocked_email_health',
            'carrier_id', p_carrier_id,
            'email', v_email,
            'email_health_status',
            v_carrier.email_health_status
        );

    END IF;


    -- ========================================================
    -- CRM PROTECTION
    -- ========================================================

    IF COALESCE(
        v_carrier.client,
        false
    ) = true THEN

        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'existing_client',
            'carrier_id', p_carrier_id,
            'email', v_email
        );

    END IF;


    -- ========================================================
    -- GLOBAL SUPPRESSION LIST
    -- ========================================================

    SELECT EXISTS (
        SELECT 1
        FROM public.email_suppressions s
        WHERE lower(
            trim(
                s.email
            )
        ) = v_email
    )
    INTO v_suppressed;


    IF v_suppressed THEN

        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'suppressed_email',
            'carrier_id', p_carrier_id,
            'email', v_email
        );

    END IF;


    -- ========================================================
    -- PASSED
    -- ========================================================

    RETURN jsonb_build_object(
        'allowed', true,
        'reason', 'eligible',
        'carrier_id', p_carrier_id,
        'email', v_email,
        'verification_status',
        v_carrier.email_verification_status,
        'risk_score',
        v_carrier.email_risk_score
    );

END;
$$;


COMMIT;