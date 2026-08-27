BEGIN;

-- ============================================================
-- PHASE 020
-- FINAL SEND-TIME SAFETY GATE
-- ============================================================


-- ------------------------------------------------------------
-- AUDIT TABLE
--
-- Keeps a permanent record whenever an enrollment is prevented
-- from sending by the last-moment safety check.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.email_send_safety_blocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    enrollment_id uuid
        REFERENCES public.email_sequence_enrollments(id)
        ON DELETE SET NULL,

    lead_id uuid
        REFERENCES public.leads(id)
        ON DELETE SET NULL,

    carrier_id bigint
        REFERENCES public.carriers(id)
        ON DELETE SET NULL,

    dot_number bigint,

    email text,

    reason text NOT NULL,

    eligibility jsonb,

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_email_send_safety_blocks_created_at
ON public.email_send_safety_blocks(created_at DESC);


CREATE INDEX IF NOT EXISTS
    idx_email_send_safety_blocks_enrollment
ON public.email_send_safety_blocks(enrollment_id);


CREATE INDEX IF NOT EXISTS
    idx_email_send_safety_blocks_lead
ON public.email_send_safety_blocks(lead_id);



-- ============================================================
-- FINAL ELIGIBILITY FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.email_enrollment_send_eligibility(
    p_enrollment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_enrollment public.email_sequence_enrollments%ROWTYPE;
    v_lead public.leads%ROWTYPE;
    v_carrier public.carriers%ROWTYPE;

    v_carrier_eligibility jsonb;

    v_email text;
    v_reason text;

    v_auto_paused boolean := false;
BEGIN

    -- --------------------------------------------------------
    -- LOAD ENROLLMENT
    -- --------------------------------------------------------

    SELECT *
    INTO v_enrollment
    FROM public.email_sequence_enrollments
    WHERE id = p_enrollment_id;


    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'enrollment_not_found',
            'enrollment_id', p_enrollment_id
        );
    END IF;


    -- --------------------------------------------------------
    -- ENROLLMENT MUST STILL BE ACTIVE
    -- --------------------------------------------------------

    IF v_enrollment.status <> 'active' THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'enrollment_not_active',
            'enrollment_id', v_enrollment.id,
            'status', v_enrollment.status
        );
    END IF;


    -- --------------------------------------------------------
    -- LOAD LEAD
    -- --------------------------------------------------------

    SELECT *
    INTO v_lead
    FROM public.leads
    WHERE id = v_enrollment.lead_id;


    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'lead_not_found',
            'enrollment_id', v_enrollment.id,
            'lead_id', v_enrollment.lead_id
        );
    END IF;


    v_email := lower(trim(coalesce(v_lead.email, '')));


    -- --------------------------------------------------------
    -- EMAIL REQUIRED
    -- --------------------------------------------------------

    IF v_email = '' THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'missing_email',
            'enrollment_id', v_enrollment.id,
            'lead_id', v_lead.id
        );
    END IF;


    -- --------------------------------------------------------
    -- LEAD-LEVEL STOP CONDITIONS
    -- --------------------------------------------------------

    IF coalesce(v_lead.email_opt_out, false) THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'lead_opted_out',
            'enrollment_id', v_enrollment.id,
            'lead_id', v_lead.id,
            'email', v_email
        );
    END IF;


    IF coalesce(v_lead.email_bounced, false) THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'lead_bounced',
            'enrollment_id', v_enrollment.id,
            'lead_id', v_lead.id,
            'email', v_email
        );
    END IF;


    IF coalesce(v_lead.email_complained, false) THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'lead_complained',
            'enrollment_id', v_enrollment.id,
            'lead_id', v_lead.id,
            'email', v_email
        );
    END IF;


    -- --------------------------------------------------------
    -- SUPPRESSION LIST
    -- --------------------------------------------------------

    IF EXISTS (
        SELECT 1
        FROM public.email_suppressions s
        WHERE lower(trim(s.email)) = v_email
    ) THEN

        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'email_suppressed',
            'enrollment_id', v_enrollment.id,
            'lead_id', v_lead.id,
            'email', v_email
        );

    END IF;


    -- --------------------------------------------------------
    -- GLOBAL SAFETY CENTER
    -- --------------------------------------------------------

    SELECT coalesce(auto_paused, false)
    INTO v_auto_paused
    FROM public.email_safety_status
    LIMIT 1;


    IF coalesce(v_auto_paused, false) THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'global_safety_auto_paused',
            'enrollment_id', v_enrollment.id,
            'lead_id', v_lead.id,
            'email', v_email
        );
    END IF;


    -- --------------------------------------------------------
    -- FIND ORIGINAL FMCSA CARRIER
    -- --------------------------------------------------------

    IF v_lead.carrier_dot_number IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'carrier_dot_missing',
            'enrollment_id', v_enrollment.id,
            'lead_id', v_lead.id,
            'email', v_email
        );
    END IF;


    SELECT *
    INTO v_carrier
    FROM public.carriers
    WHERE dot_number = v_lead.carrier_dot_number
    LIMIT 1;


    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'carrier_not_found',
            'enrollment_id', v_enrollment.id,
            'lead_id', v_lead.id,
            'dot_number', v_lead.carrier_dot_number,
            'email', v_email
        );
    END IF;


    -- --------------------------------------------------------
    -- USE PHASE 019 STRICT CARRIER ELIGIBILITY ENGINE
    -- --------------------------------------------------------

    SELECT public.carrier_email_send_eligibility(v_carrier.id)
    INTO v_carrier_eligibility;


    IF NOT coalesce(
        (v_carrier_eligibility ->> 'allowed')::boolean,
        false
    ) THEN

        RETURN jsonb_build_object(
            'allowed', false,
            'reason', coalesce(
                v_carrier_eligibility ->> 'reason',
                'carrier_email_ineligible'
            ),
            'enrollment_id', v_enrollment.id,
            'lead_id', v_lead.id,
            'carrier_id', v_carrier.id,
            'dot_number', v_carrier.dot_number,
            'email', v_email,
            'carrier_eligibility', v_carrier_eligibility
        );

    END IF;


    -- --------------------------------------------------------
    -- EMAIL MUST STILL MATCH ORIGINAL CARRIER
    -- --------------------------------------------------------

    IF lower(trim(coalesce(v_carrier.email, ''))) <> v_email THEN

        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'lead_carrier_email_mismatch',
            'enrollment_id', v_enrollment.id,
            'lead_id', v_lead.id,
            'carrier_id', v_carrier.id,
            'dot_number', v_carrier.dot_number,
            'lead_email', v_email,
            'carrier_email', lower(trim(coalesce(v_carrier.email, '')))
        );

    END IF;


    -- --------------------------------------------------------
    -- PASSED
    -- --------------------------------------------------------

    RETURN jsonb_build_object(
        'allowed', true,
        'reason', 'eligible',
        'enrollment_id', v_enrollment.id,
        'lead_id', v_lead.id,
        'carrier_id', v_carrier.id,
        'dot_number', v_carrier.dot_number,
        'email', v_email,
        'carrier_eligibility', v_carrier_eligibility
    );

END;
$$;



-- ============================================================
-- STOP AN UNSAFE ENROLLMENT
-- ============================================================

CREATE OR REPLACE FUNCTION public.block_unsafe_email_enrollment(
    p_enrollment_id uuid,
    p_reason text,
    p_eligibility jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_enrollment public.email_sequence_enrollments%ROWTYPE;
    v_lead public.leads%ROWTYPE;
    v_carrier public.carriers%ROWTYPE;
BEGIN

    SELECT *
    INTO v_enrollment
    FROM public.email_sequence_enrollments
    WHERE id = p_enrollment_id;


    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason', 'enrollment_not_found'
        );
    END IF;


    SELECT *
    INTO v_lead
    FROM public.leads
    WHERE id = v_enrollment.lead_id;


    IF v_lead.carrier_dot_number IS NOT NULL THEN

        SELECT *
        INTO v_carrier
        FROM public.carriers
        WHERE dot_number = v_lead.carrier_dot_number
        LIMIT 1;

    END IF;


    -- --------------------------------------------------------
    -- STOP THE SEQUENCE
    -- --------------------------------------------------------

    UPDATE public.email_sequence_enrollments
    SET
        status = 'stopped',
        next_send_at = NULL,
        stopped_at = coalesce(stopped_at, now()),
        updated_at = now()
    WHERE id = p_enrollment_id
      AND status IN ('active', 'paused');


    -- --------------------------------------------------------
    -- PERMANENT AUDIT RECORD
    -- --------------------------------------------------------

    INSERT INTO public.email_send_safety_blocks (
        enrollment_id,
        lead_id,
        carrier_id,
        dot_number,
        email,
        reason,
        eligibility
    )
    VALUES (
        v_enrollment.id,
        v_lead.id,
        v_carrier.id,
        v_lead.carrier_dot_number,
        lower(trim(v_lead.email)),
        coalesce(p_reason, 'send_time_safety_block'),
        p_eligibility
    );


    RETURN jsonb_build_object(
        'success', true,
        'blocked', true,
        'enrollment_id', v_enrollment.id,
        'reason', p_reason
    );

END;
$$;



-- ============================================================
-- PERMISSIONS
-- ============================================================

REVOKE ALL
ON FUNCTION public.email_enrollment_send_eligibility(uuid)
FROM PUBLIC;


REVOKE ALL
ON FUNCTION public.block_unsafe_email_enrollment(uuid, text, jsonb)
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.email_enrollment_send_eligibility(uuid)
TO service_role;


GRANT EXECUTE
ON FUNCTION public.block_unsafe_email_enrollment(uuid, text, jsonb)
TO service_role;


COMMIT;