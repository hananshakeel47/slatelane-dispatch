-- Tighten cold-outreach candidate and send-time quality gates.
-- New prospects must have current deliverable-mailbox verification, active property authority,
-- evidence of a 1-5 power-unit fleet, at least one driver, and authority age >= 14 days.
-- This migration does not change daily caps, enable sending, or send email.

CREATE OR REPLACE VIEW public.email_outreach_base_candidates AS
WITH settings AS (
    SELECT minimum_carrier_score
    FROM public.email_launch_settings
    ORDER BY id
    LIMIT 1
)
SELECT
    s.id AS carrier_id,
    s.dot_number,
    s.legal_name,
    s.email,
    s.phone,
    s.mc_number,
    s.lead_score,
    s.status_code,
    c.email_domain,
    c.email_free_provider,
    c.email_role_based,
    c.email_risk_score
FROM public.email_sendable_carriers s
JOIN public.carriers c
  ON c.id = s.id
CROSS JOIN settings cfg
WHERE s.status_code = 'A'
  AND COALESCE(s.lead_score, 0) >= COALESCE(cfg.minimum_carrier_score, 80)
  AND COALESCE(c.carrier_operation, '') = 'A'
  AND COALESCE(c.authority_status, '') = 'Active'
  AND COALESCE(NULLIF(BTRIM(c.authority_type), ''), '') ILIKE '%property%'
  AND COALESCE(
        CURRENT_DATE - COALESCE(c.motus_authority_event_date, c.authority_date),
        c.authority_age_days,
        0
      ) >= 14
  AND COALESCE(c.power_units, 0) BETWEEN 1 AND 5
  AND COALESCE(c.drivers, 0) >= 1
  AND COALESCE(c.email_risk_score, 100) < 70
  AND NOT COALESCE(c.email_disposable, false)
  AND length(split_part(lower(BTRIM(s.email)), '@', 1)) >= 2
  AND NOT EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.carrier_dot_number = s.dot_number
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.email IS NOT NULL
        AND lower(BTRIM(l.email)) = lower(BTRIM(s.email))
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.email_suppressions es
      WHERE lower(BTRIM(es.email)) = lower(BTRIM(s.email))
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.email_candidate_domain_exclusions x
      WHERE x.active = true
        AND lower(x.domain) = lower(COALESCE(c.email_domain, ''))
  );

CREATE OR REPLACE FUNCTION public.carrier_email_send_eligibility(p_carrier_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_carrier public.carriers%ROWTYPE;
    v_email text;
    v_suppressed boolean := false;
    v_verify_result jsonb;
    v_external_status text;
    v_external_classification text;
    v_external_expires_at timestamptz;
    v_authority_event_date date;
    v_authority_age_days integer;
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
            'retryable', false,
            'carrier_id', p_carrier_id
        );
    END IF;

    v_email := lower(trim(COALESCE(v_carrier.email, '')));

    IF v_email = '' THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'missing_email',
            'retryable', false,
            'carrier_id', p_carrier_id
        );
    END IF;

    -- One-character mailbox names are held for manual review rather than automated outreach.
    IF length(split_part(v_email, '@', 1)) < 2 THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'email_local_part_requires_review',
            'retryable', false,
            'carrier_id', p_carrier_id,
            'email', v_email
        );
    END IF;

    -- Refresh the local syntax/risk check if it has never run.
    IF COALESCE(v_carrier.email_verification_status, 'unchecked') = 'unchecked'
       OR v_carrier.email_verification_checked_at IS NULL THEN
        BEGIN
            v_verify_result := public.verify_carrier_email(p_carrier_id);
        EXCEPTION
            WHEN OTHERS THEN
                RETURN jsonb_build_object(
                    'allowed', false,
                    'reason', 'email_verification_error',
                    'retryable', true,
                    'carrier_id', p_carrier_id,
                    'email', v_email,
                    'error', SQLERRM
                );
        END;

        SELECT *
        INTO v_carrier
        FROM public.carriers
        WHERE id = p_carrier_id
        LIMIT 1;
    END IF;

    IF COALESCE(v_carrier.email_verification_status, '') <> 'verified_format' THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'email_verification_blocked',
            'retryable', false,
            'carrier_id', p_carrier_id,
            'email', v_email,
            'verification_status', v_carrier.email_verification_status,
            'verification_reason', v_carrier.email_verification_reason,
            'risk_score', v_carrier.email_risk_score
        );
    END IF;

    IF COALESCE(v_carrier.email_risk_score, 100) >= 70
       OR COALESCE(v_carrier.email_disposable, false) THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'email_risk_too_high',
            'retryable', false,
            'carrier_id', p_carrier_id,
            'email', v_email,
            'risk_score', v_carrier.email_risk_score
        );
    END IF;

    IF COALESCE(v_carrier.email_health_status, 'unknown') IN (
        'bounced', 'complained', 'opted_out', 'suppressed'
    ) THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'blocked_email_health',
            'retryable', false,
            'carrier_id', p_carrier_id,
            'email', v_email,
            'email_health_status', v_carrier.email_health_status
        );
    END IF;

    IF COALESCE(v_carrier.client, false) THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'existing_client',
            'retryable', false,
            'carrier_id', p_carrier_id,
            'email', v_email
        );
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.email_suppressions s
        WHERE lower(trim(s.email)) = v_email
    )
    INTO v_suppressed;

    IF v_suppressed THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'suppressed_email',
            'retryable', false,
            'carrier_id', p_carrier_id,
            'email', v_email
        );
    END IF;

    -- Confirm current for-hire property-carrier authority before dispatch outreach.
    IF COALESCE(v_carrier.status_code, '') <> 'A'
       OR COALESCE(v_carrier.carrier_operation, '') <> 'A'
       OR COALESCE(v_carrier.authority_status, '') <> 'Active' THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'carrier_authority_not_active',
            'retryable', false,
            'carrier_id', p_carrier_id,
            'dot_number', v_carrier.dot_number,
            'email', v_email
        );
    END IF;

    IF NULLIF(BTRIM(v_carrier.authority_type), '') IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'carrier_authority_type_missing',
            'retryable', true,
            'carrier_id', p_carrier_id,
            'dot_number', v_carrier.dot_number,
            'email', v_email
        );
    END IF;

    IF v_carrier.authority_type NOT ILIKE '%property%' THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'carrier_not_property_authority',
            'retryable', false,
            'carrier_id', p_carrier_id,
            'dot_number', v_carrier.dot_number,
            'authority_type', v_carrier.authority_type,
            'email', v_email
        );
    END IF;

    v_authority_event_date := COALESCE(
        v_carrier.motus_authority_event_date,
        v_carrier.authority_date
    );

    IF v_authority_event_date IS NOT NULL THEN
        v_authority_age_days := CURRENT_DATE - v_authority_event_date;
    ELSE
        v_authority_age_days := v_carrier.authority_age_days;
    END IF;

    IF v_authority_age_days IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'carrier_authority_age_unknown',
            'retryable', true,
            'carrier_id', p_carrier_id,
            'dot_number', v_carrier.dot_number,
            'email', v_email
        );
    END IF;

    IF v_authority_age_days < 14 THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'carrier_authority_too_new',
            'retryable', true,
            'carrier_id', p_carrier_id,
            'dot_number', v_carrier.dot_number,
            'authority_age_days', v_authority_age_days,
            'minimum_authority_age_days', 14,
            'email', v_email
        );
    END IF;

    IF COALESCE(v_carrier.power_units, 0) > 5 THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'carrier_outside_target_fleet_size',
            'retryable', false,
            'carrier_id', p_carrier_id,
            'dot_number', v_carrier.dot_number,
            'power_units', v_carrier.power_units,
            'email', v_email
        );
    END IF;

    IF COALESCE(v_carrier.power_units, 0) < 1
       OR COALESCE(v_carrier.drivers, 0) < 1 THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'carrier_fleet_data_missing',
            'retryable', true,
            'carrier_id', p_carrier_id,
            'dot_number', v_carrier.dot_number,
            'power_units', v_carrier.power_units,
            'drivers', v_carrier.drivers,
            'email', v_email
        );
    END IF;

    -- A syntax check is not proof that the mailbox is deliverable.
    -- Require the latest Verifalia result for this exact address to be fresh and deliverable.
    SELECT
        v.status,
        v.classification,
        v.expires_at
    INTO
        v_external_status,
        v_external_classification,
        v_external_expires_at
    FROM public.email_verifalia_latest v
    WHERE v.carrier_id = v_carrier.id
      AND lower(trim(COALESCE(v.email_normalized, ''))) = v_email
    LIMIT 1;

    IF NOT FOUND
       OR v_external_expires_at IS NULL
       OR v_external_expires_at <= now() THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'external_verification_missing_or_expired',
            'retryable', true,
            'carrier_id', v_carrier.id,
            'dot_number', v_carrier.dot_number,
            'email', v_email
        );
    END IF;

    IF lower(COALESCE(v_external_status, '')) <> 'deliverable'
       OR lower(COALESCE(v_external_classification, '')) <> 'deliverable' THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'external_verification_not_deliverable',
            'retryable', false,
            'carrier_id', v_carrier.id,
            'dot_number', v_carrier.dot_number,
            'verification_status', v_external_status,
            'verification_classification', v_external_classification,
            'email', v_email
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'reason', 'eligible',
        'retryable', false,
        'carrier_id', v_carrier.id,
        'dot_number', v_carrier.dot_number,
        'email', v_email,
        'authority_age_days', v_authority_age_days,
        'verification_status', v_external_status,
        'verification_classification', v_external_classification,
        'verification_expires_at', v_external_expires_at,
        'risk_score', v_carrier.email_risk_score
    );
END;
$function$;
