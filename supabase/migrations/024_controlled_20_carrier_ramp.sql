-- ============================================================
-- SlateLane Dispatch
-- Phase 024A
-- Controlled 20-Carrier Ramp Infrastructure
--
-- IMPORTANT:
-- This migration DOES NOT:
--   - enable Master Sending
--   - send any email
--   - restart an enrollment
--   - create a pilot
--   - change the current pilot from 5 to 20
--
-- It only installs:
--   1. ramp state
--   2. readiness checks
--   3. controlled promotion function
--   4. audit history
-- ============================================================

BEGIN;

-- ============================================================
-- 1. RAMP STATE ON LAUNCH SETTINGS
-- ============================================================

ALTER TABLE public.email_launch_settings
ADD COLUMN IF NOT EXISTS ramp_stage integer NOT NULL DEFAULT 1;

ALTER TABLE public.email_launch_settings
ADD COLUMN IF NOT EXISTS ramp_target integer NOT NULL DEFAULT 5;

ALTER TABLE public.email_launch_settings
ADD COLUMN IF NOT EXISTS ramp_last_promoted_at timestamptz;

ALTER TABLE public.email_launch_settings
ADD COLUMN IF NOT EXISTS ramp_last_note text;


-- Keep current installation in Stage 1 unless it was already
-- manually promoted before this migration.
UPDATE public.email_launch_settings
SET
    ramp_stage =
        CASE
            WHEN COALESCE(pilot_limit, 5) >= 20 THEN 2
            ELSE 1
        END,

    ramp_target =
        CASE
            WHEN COALESCE(pilot_limit, 5) >= 20 THEN 20
            ELSE 5
        END
WHERE TRUE;


-- ============================================================
-- 2. RAMP AUDIT HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_ramp_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    action text NOT NULL,

    from_target integer,
    to_target integer,

    success boolean NOT NULL DEFAULT false,

    reason text,

    batch_id uuid,

    snapshot jsonb,

    note text,

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
email_ramp_audit_created_at_idx
ON public.email_ramp_audit(created_at DESC);


CREATE INDEX IF NOT EXISTS
email_ramp_audit_batch_id_idx
ON public.email_ramp_audit(batch_id);


-- ============================================================
-- 3. 20-CARRIER RAMP READINESS CHECK
-- ============================================================

CREATE OR REPLACE FUNCTION public.email_ramp_readiness(
    p_target integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_settings public.email_launch_settings%ROWTYPE;

    v_auto_paused boolean := false;
    v_sends integer := 0;
    v_bounces integer := 0;
    v_failures integer := 0;
    v_complaints integer := 0;

    v_batch_id uuid := NULL;
    v_batch_status text := NULL;
    v_batch_created_at timestamptz := NULL;

    v_member_count integer := 0;
    v_active_enrollments integer := 0;
    v_completed_enrollments integer := 0;
    v_stopped_enrollments integer := 0;
    v_terminal_enrollments integer := 0;

    v_emails_recorded integer := 0;
    v_delivered integer := 0;
    v_batch_bounces integer := 0;
    v_batch_failures integer := 0;

    v_ready boolean := false;
    v_reason text := NULL;
BEGIN

    -- --------------------------------------------------------
    -- SETTINGS
    -- --------------------------------------------------------

    SELECT *
    INTO v_settings
    FROM public.email_launch_settings
    ORDER BY id
    LIMIT 1;


    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'ready', false,
            'reason', 'launch_settings_missing',
            'target', p_target
        );
    END IF;


    -- --------------------------------------------------------
    -- GLOBAL EMAIL SAFETY
    -- --------------------------------------------------------

    SELECT
        COALESCE(auto_paused, false),
        COALESCE(sends_in_window, 0),
        COALESCE(bounces_in_window, 0),
        COALESCE(failures_in_window, 0),
        COALESCE(complaints_in_window, 0)
    INTO
        v_auto_paused,
        v_sends,
        v_bounces,
        v_failures,
        v_complaints
    FROM public.email_safety_status
    LIMIT 1;


    -- --------------------------------------------------------
    -- LATEST PILOT
    -- --------------------------------------------------------

    SELECT
        id,
        status,
        created_at
    INTO
        v_batch_id,
        v_batch_status,
        v_batch_created_at
    FROM public.email_pilot_batches
    ORDER BY created_at DESC
    LIMIT 1;


    -- --------------------------------------------------------
    -- CURRENT PILOT MEMBERS / ENROLLMENTS
    -- --------------------------------------------------------

    IF v_batch_id IS NOT NULL THEN

        SELECT COUNT(*)
        INTO v_member_count
        FROM public.email_pilot_members
        WHERE batch_id = v_batch_id;


        SELECT COUNT(*)
        INTO v_active_enrollments
        FROM public.email_sequence_enrollments ese
        JOIN public.email_pilot_members epm
            ON epm.enrollment_id = ese.id
        WHERE epm.batch_id = v_batch_id
          AND ese.status = 'active';


        SELECT COUNT(*)
        INTO v_completed_enrollments
        FROM public.email_sequence_enrollments ese
        JOIN public.email_pilot_members epm
            ON epm.enrollment_id = ese.id
        WHERE epm.batch_id = v_batch_id
          AND ese.status = 'completed';


        SELECT COUNT(*)
        INTO v_stopped_enrollments
        FROM public.email_sequence_enrollments ese
        JOIN public.email_pilot_members epm
            ON epm.enrollment_id = ese.id
        WHERE epm.batch_id = v_batch_id
          AND ese.status = 'stopped';


        v_terminal_enrollments :=
            v_completed_enrollments +
            v_stopped_enrollments;


        -- ----------------------------------------------------
        -- SEND RESULTS FOR THIS PILOT
        -- ----------------------------------------------------

        SELECT
            COUNT(es.id),

            COUNT(es.id)
                FILTER (
                    WHERE es.delivered_at IS NOT NULL
                ),

            COUNT(es.id)
                FILTER (
                    WHERE es.bounced_at IS NOT NULL
                ),

            COUNT(es.id)
                FILTER (
                    WHERE es.failed_at IS NOT NULL
                )

        INTO
            v_emails_recorded,
            v_delivered,
            v_batch_bounces,
            v_batch_failures

        FROM public.email_pilot_members epm

        LEFT JOIN public.email_sends es
            ON es.lead_id = epm.lead_id

        WHERE epm.batch_id = v_batch_id;

    END IF;


    -- ========================================================
    -- READINESS DECISION
    -- ========================================================

    IF p_target <> 20 THEN

        v_reason := 'phase_024_only_supports_target_20';


    ELSIF v_settings.sending_enabled THEN

        v_reason := 'master_sending_must_be_off';


    ELSIF NOT v_settings.pilot_mode THEN

        v_reason := 'pilot_mode_must_be_on';


    ELSIF v_auto_paused THEN

        v_reason := 'global_safety_auto_paused';


    ELSIF v_batch_id IS NULL THEN

        v_reason := 'no_previous_pilot_found';


    ELSIF v_member_count < 5 THEN

        v_reason := 'five_carrier_validation_pilot_required';


    ELSIF v_active_enrollments > 0 THEN

        v_reason := 'current_pilot_still_running';


    ELSIF v_terminal_enrollments < v_member_count THEN

        v_reason := 'current_pilot_not_terminal';


    ELSIF v_batch_bounces > 0 THEN

        v_reason := 'pilot_contains_bounce';


    ELSIF v_batch_failures > 0 THEN

        v_reason := 'pilot_contains_failure';


    ELSIF v_complaints > 0 THEN

        v_reason := 'complaints_detected';


    ELSE

        v_ready := true;
        v_reason := 'ready_for_20_carrier_ramp';

    END IF;


    RETURN jsonb_build_object(

        'success', true,

        'ready', v_ready,

        'reason', v_reason,

        'target', p_target,

        'current_ramp_stage',
            COALESCE(
                v_settings.ramp_stage,
                1
            ),

        'current_ramp_target',
            COALESCE(
                v_settings.ramp_target,
                5
            ),

        'master_sending',
            v_settings.sending_enabled,

        'pilot_mode',
            v_settings.pilot_mode,

        'pilot_limit',
            v_settings.pilot_limit,

        'daily_send_cap',
            v_settings.daily_send_cap,

        'max_batch_size',
            v_settings.max_batch_size,

        'safety',
            jsonb_build_object(

                'auto_paused',
                    v_auto_paused,

                'sends_in_window',
                    v_sends,

                'bounces_in_window',
                    v_bounces,

                'failures_in_window',
                    v_failures,

                'complaints_in_window',
                    v_complaints
            ),

        'latest_pilot',
            jsonb_build_object(

                'batch_id',
                    v_batch_id,

                'status',
                    v_batch_status,

                'created_at',
                    v_batch_created_at,

                'members',
                    v_member_count,

                'active_enrollments',
                    v_active_enrollments,

                'completed_enrollments',
                    v_completed_enrollments,

                'stopped_enrollments',
                    v_stopped_enrollments,

                'terminal_enrollments',
                    v_terminal_enrollments,

                'emails_recorded',
                    v_emails_recorded,

                'delivered',
                    v_delivered,

                'bounces',
                    v_batch_bounces,

                'failures',
                    v_batch_failures
            )
    );

END;
$$;


-- ============================================================
-- 4. CONTROLLED PROMOTION TO 20
--
-- IMPORTANT:
--
-- Even when this is used later:
--
--   sending_enabled remains FALSE
--
-- Promotion changes capacity only.
-- It DOES NOT authorize sending.
-- ============================================================

CREATE OR REPLACE FUNCTION public.promote_email_ramp_to_20(
    p_confirmation text,
    p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_readiness jsonb;

    v_ready boolean := false;

    v_reason text;

    v_old_target integer := 5;

    v_batch_id uuid := NULL;

    v_result jsonb;
BEGIN

    -- --------------------------------------------------------
    -- EXACT MANUAL CONFIRMATION
    -- --------------------------------------------------------

    IF UPPER(
        TRIM(
            COALESCE(
                p_confirmation,
                ''
            )
        )
    ) <> 'PROMOTE TO 20'
    THEN

        RETURN jsonb_build_object(
            'success', false,
            'promoted', false,
            'reason', 'confirmation_required',
            'required_confirmation', 'PROMOTE TO 20'
        );

    END IF;


    -- --------------------------------------------------------
    -- READINESS CHECK
    -- --------------------------------------------------------

    v_readiness :=
        public.email_ramp_readiness(20);


    v_ready :=
        COALESCE(
            (v_readiness ->> 'ready')::boolean,
            false
        );


    v_reason :=
        v_readiness ->> 'reason';


    v_batch_id :=
        NULLIF(
            v_readiness
                -> 'latest_pilot'
                ->> 'batch_id',
            ''
        )::uuid;


    SELECT
        COALESCE(
            ramp_target,
            pilot_limit,
            5
        )
    INTO v_old_target
    FROM public.email_launch_settings
    ORDER BY id
    LIMIT 1;


    -- --------------------------------------------------------
    -- BLOCK UNSAFE PROMOTION
    -- --------------------------------------------------------

    IF NOT v_ready THEN

        INSERT INTO public.email_ramp_audit (
            action,
            from_target,
            to_target,
            success,
            reason,
            batch_id,
            snapshot,
            note
        )
        VALUES (
            'promote_to_20',
            v_old_target,
            20,
            false,
            v_reason,
            v_batch_id,
            v_readiness,
            p_note
        );


        RETURN jsonb_build_object(
            'success', false,
            'promoted', false,
            'reason', v_reason,
            'readiness', v_readiness
        );

    END IF;


    -- --------------------------------------------------------
    -- MARK PREVIOUS ARMED PILOT COMPLETE
    --
    -- Only allowed because readiness already confirmed:
    -- active enrollments = 0
    -- all members terminal
    -- no bounce/failure incident
    -- --------------------------------------------------------

    IF v_batch_id IS NOT NULL THEN

        UPDATE public.email_pilot_batches
        SET
            status = 'completed',
            updated_at = now()

        WHERE id = v_batch_id
          AND status = 'armed';

    END IF;


    -- --------------------------------------------------------
    -- PROMOTE CONTROLLED CAPACITY
    --
    -- MASTER SENDING EXPLICITLY STAYS OFF.
    -- --------------------------------------------------------

    UPDATE public.email_launch_settings
    SET
        sending_enabled = false,

        pilot_mode = true,

        pilot_limit = 20,

        max_batch_size = 20,

        daily_send_cap = 20,

        ramp_stage = 2,

        ramp_target = 20,

        ramp_last_promoted_at = now(),

        ramp_last_note =
            COALESCE(
                NULLIF(
                    TRIM(p_note),
                    ''
                ),
                'Phase 024 controlled promotion from 5-carrier validation to 20-carrier ramp.'
            ),

        updated_at = now();


    -- --------------------------------------------------------
    -- AUDIT SUCCESS
    -- --------------------------------------------------------

    INSERT INTO public.email_ramp_audit (
        action,
        from_target,
        to_target,
        success,
        reason,
        batch_id,
        snapshot,
        note
    )
    VALUES (
        'promote_to_20',
        v_old_target,
        20,
        true,
        'controlled_ramp_promoted',
        v_batch_id,
        v_readiness,
        p_note
    );


    v_result :=
        jsonb_build_object(

            'success', true,

            'promoted', true,

            'reason',
                'controlled_ramp_promoted',

            'previous_target',
                v_old_target,

            'new_target',
                20,

            'ramp_stage',
                2,

            'pilot_limit',
                20,

            'daily_send_cap',
                20,

            'max_batch_size',
                20,

            'master_sending_changed',
                false,

            'master_sending',
                false,

            'pilot_created',
                false,

            'email_sent',
                false,

            'previous_batch_completed',
                v_batch_id,

            'message',
                '20-carrier ramp capacity prepared. Master Sending remains OFF.'
        );


    RETURN v_result;

END;
$$;


-- ============================================================
-- 5. READ-ONLY RAMP STATUS VIEW
-- ============================================================

CREATE OR REPLACE VIEW public.email_ramp_status
AS

SELECT

    els.id,

    els.ramp_stage,

    els.ramp_target,

    els.pilot_limit,

    els.daily_send_cap,

    els.max_batch_size,

    els.sending_enabled,

    els.pilot_mode,

    els.ramp_last_promoted_at,

    els.ramp_last_note,

    readiness.payload AS readiness,

    COALESCE(
        (
            readiness.payload
            ->> 'ready'
        )::boolean,
        false
    ) AS ready_for_20,

    readiness.payload
        ->> 'reason'
        AS readiness_reason

FROM public.email_launch_settings els

CROSS JOIN LATERAL (

    SELECT
        public.email_ramp_readiness(20)
            AS payload

) readiness;


-- ============================================================
-- 6. PERMISSIONS
-- ============================================================

REVOKE ALL
ON FUNCTION public.promote_email_ramp_to_20(text, text)
FROM PUBLIC;


REVOKE ALL
ON FUNCTION public.email_ramp_readiness(integer)
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.email_ramp_readiness(integer)
TO service_role;


GRANT EXECUTE
ON FUNCTION public.promote_email_ramp_to_20(text, text)
TO service_role;


GRANT SELECT
ON public.email_ramp_status
TO service_role;


GRANT SELECT, INSERT
ON public.email_ramp_audit
TO service_role;


COMMIT;