-- ============================================================
-- SLATELANE DISPATCH CRM
-- PHASE 019B
-- Production Email Send Eligibility Guard
-- ============================================================

BEGIN;

-- ============================================================
-- 1. FUNCTION:
--    Determine whether a carrier is safe for outbound email
-- ============================================================

CREATE OR REPLACE FUNCTION public.carrier_email_send_eligibility(
    p_carrier_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_carrier record;
    v_allowed boolean := false;
    v_reason text := null;
BEGIN

    SELECT
        id,
        dot_number,
        email,
        email_health_status,
        email_verification_status,
        email_risk_score,
        email_role_based,
        email_disposable,
        email_verification_checked_at
    INTO v_carrier
    FROM public.carriers
    WHERE id = p_carrier_id
    LIMIT 1;


    -- --------------------------------------------------------
    -- Carrier not found
    -- --------------------------------------------------------

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'allowed', false,
            'reason', 'carrier_not_found',
            'carrier_id', p_carrier_id
        );
    END IF;


    -- --------------------------------------------------------
    -- Missing email
    -- --------------------------------------------------------

    IF v_carrier.email IS NULL
       OR trim(v_carrier.email) = '' THEN

        v_reason := 'missing_email';

    -- --------------------------------------------------------
    -- Existing known email-health block
    -- --------------------------------------------------------

    ELSIF coalesce(v_carrier.email_health_status, 'unknown')
          IN (
              'bounced',
              'complained',
              'opted_out',
              'suppressed'
          ) THEN

        v_reason := 'blocked_email_health';

    -- --------------------------------------------------------
    -- Email has not been checked
    -- --------------------------------------------------------

    ELSIF v_carrier.email_verification_checked_at IS NULL THEN

        v_reason := 'email_not_verified';

    -- --------------------------------------------------------
    -- Verification explicitly rejected the email
    -- --------------------------------------------------------

    ELSIF coalesce(v_carrier.email_verification_status, '')
          IN (
              'blocked',
              'invalid',
              'risky',
              'missing'
          ) THEN

        v_reason :=
            'verification_' ||
            coalesce(
                v_carrier.email_verification_status,
                'unknown'
            );

    -- --------------------------------------------------------
    -- Disposable email
    -- --------------------------------------------------------

    ELSIF coalesce(v_carrier.email_disposable, false) = true THEN

        v_reason := 'disposable_email';

    -- --------------------------------------------------------
    -- Very high risk
    -- --------------------------------------------------------

    ELSIF coalesce(v_carrier.email_risk_score, 100) >= 70 THEN

        v_reason := 'email_risk_too_high';

    -- --------------------------------------------------------
    -- Everything passed
    -- --------------------------------------------------------

    ELSE

        v_allowed := true;
        v_reason := 'eligible';

    END IF;


    RETURN jsonb_build_object(
        'success', true,
        'allowed', v_allowed,
        'reason', v_reason,

        'carrier_id', v_carrier.id,
        'dot_number', v_carrier.dot_number,
        'email', v_carrier.email,

        'email_health_status',
            coalesce(
                v_carrier.email_health_status,
                'unknown'
            ),

        'verification_status',
            v_carrier.email_verification_status,

        'risk_score',
            v_carrier.email_risk_score,

        'role_based',
            coalesce(
                v_carrier.email_role_based,
                false
            ),

        'disposable',
            coalesce(
                v_carrier.email_disposable,
                false
            ),

        'checked_at',
            v_carrier.email_verification_checked_at
    );

END;
$$;


-- ============================================================
-- 2. SIMPLE BOOLEAN HELPER
-- ============================================================

CREATE OR REPLACE FUNCTION public.carrier_email_is_sendable(
    p_carrier_id bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        coalesce(
            (
                public.carrier_email_send_eligibility(
                    p_carrier_id
                )->>'allowed'
            )::boolean,
            false
        );
$$;


-- ============================================================
-- 3. INDEXES
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
    idx_carriers_email_verification_checked
ON public.carriers (
    email_verification_checked_at
);


CREATE INDEX IF NOT EXISTS
    idx_carriers_email_health_status
ON public.carriers (
    email_health_status
);


-- ============================================================
-- 4. ELIGIBLE CARRIER VIEW
--
-- Useful later for:
-- Pilot selection
-- Automated campaigns
-- Carrier targeting
-- Reporting
-- ============================================================

CREATE OR REPLACE VIEW public.email_sendable_carriers
AS

SELECT
    c.*
FROM public.carriers c

WHERE
    c.email IS NOT NULL

    AND trim(c.email) <> ''

    AND c.email_verification_checked_at IS NOT NULL

    AND coalesce(
        c.email_verification_status,
        ''
    ) NOT IN (
        'blocked',
        'invalid',
        'risky',
        'missing'
    )

    AND coalesce(
        c.email_health_status,
        'unknown'
    ) NOT IN (
        'bounced',
        'complained',
        'opted_out',
        'suppressed'
    )

    AND coalesce(
        c.email_disposable,
        false
    ) = false

    AND coalesce(
        c.email_risk_score,
        100
    ) < 70;


COMMIT;