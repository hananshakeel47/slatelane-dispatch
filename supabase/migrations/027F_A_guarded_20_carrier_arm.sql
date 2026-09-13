-- ============================================================
-- PHASE 027F-A
-- GUARDED 20-CARRIER ARM
--
-- PURPOSE
--   - Arm the exact 20-carrier batch created in Phase 027E
--   - Convert the 20 enrollments from paused -> active
--   - Keep every enrollment NOT DUE
--   - Keep Master Sending OFF
--   - Send ZERO emails
--
-- NEXT PHASE
--   027F-B = final guarded go-live
-- ============================================================

BEGIN;


-- ============================================================
-- 1. ARM AUDIT TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_ramp_20_arm_audit (
    id bigserial PRIMARY KEY,

    prepared_batch_id uuid NOT NULL,
    pilot_batch_id uuid NOT NULL UNIQUE,
    sequence_id uuid,

    previous_pilot_status text,
    new_pilot_status text NOT NULL,

    paused_before integer NOT NULL DEFAULT 0,
    active_before integer NOT NULL DEFAULT 0,

    activated_enrollments integer NOT NULL DEFAULT 0,

    sending_enabled boolean NOT NULL DEFAULT false,
    daily_send_cap integer,
    max_batch_size integer,
    pilot_mode boolean,
    pilot_limit integer,

    operator_note text,

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    armed_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 2. GUARDED ARM FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.arm_email_ramp_20_batch(
    p_operator_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$

DECLARE

    v_materialization record;
    v_settings record;

    v_pilot_status text;

    v_member_count integer := 0;
    v_enrollment_count integer := 0;

    v_paused_before integer := 0;
    v_active_before integer := 0;

    v_activated integer := 0;

    v_unsafe_replied_leads integer := 0;

    v_existing_audit_id bigint;

BEGIN

    -- ========================================================
    -- LOAD PHASE 027E MATERIALIZATION
    -- ========================================================

    SELECT *
    INTO v_materialization
    FROM public.email_ramp_20_materialization_status
    LIMIT 1;


    IF NOT FOUND THEN

        RAISE EXCEPTION
            '027F-A blocked: no Phase 027E materialized batch exists.';

    END IF;


    -- ========================================================
    -- REQUIRE GUARDED-LAUNCH READINESS
    -- ========================================================

    IF COALESCE(
        v_materialization.ready_for_guarded_launch,
        false
    ) = false THEN

        RAISE EXCEPTION
            '027F-A blocked: materialized batch is not ready_for_guarded_launch.';

    END IF;


    IF COALESCE(
        v_materialization.prepared_count,
        0
    ) <> 20 THEN

        RAISE EXCEPTION
            '027F-A blocked: expected prepared_count=20, found %.',
            COALESCE(
                v_materialization.prepared_count,
                0
            );

    END IF;


    IF COALESCE(
        v_materialization.pilot_members,
        0
    ) <> 20 THEN

        RAISE EXCEPTION
            '027F-A blocked: expected pilot_members=20, found %.',
            COALESCE(
                v_materialization.pilot_members,
                0
            );

    END IF;


    IF COALESCE(
        v_materialization.created_enrollments,
        0
    ) <> 20 THEN

        RAISE EXCEPTION
            '027F-A blocked: expected 20 created enrollments, found %.',
            COALESCE(
                v_materialization.created_enrollments,
                0
            );

    END IF;


    -- ========================================================
    -- LOAD PRODUCTION SETTINGS
    -- ========================================================

    SELECT
        sending_enabled,
        daily_send_cap,
        max_batch_size,
        pilot_mode,
        pilot_limit

    INTO v_settings

    FROM public.email_launch_settings

    ORDER BY id

    LIMIT 1;


    IF NOT FOUND THEN

        RAISE EXCEPTION
            '027F-A blocked: email_launch_settings row does not exist.';

    END IF;


    -- ========================================================
    -- MASTER SENDING MUST BE OFF
    -- ========================================================

    IF COALESCE(
        v_settings.sending_enabled,
        false
    ) = true THEN

        RAISE EXCEPTION
            '027F-A blocked: Master Sending is already enabled.';

    END IF;


    -- ========================================================
    -- VERIFY 20-CARRIER RAMP SETTINGS
    -- ========================================================

    IF COALESCE(
        v_settings.daily_send_cap,
        0
    ) <> 20 THEN

        RAISE EXCEPTION
            '027F-A blocked: daily_send_cap must equal 20. Current value=%',
            COALESCE(
                v_settings.daily_send_cap,
                0
            );

    END IF;


    IF COALESCE(
        v_settings.max_batch_size,
        0
    ) <> 5 THEN

        RAISE EXCEPTION
            '027F-A blocked: max_batch_size must equal 5. Current value=%',
            COALESCE(
                v_settings.max_batch_size,
                0
            );

    END IF;


    IF COALESCE(
        v_settings.pilot_mode,
        false
    ) = false THEN

        RAISE EXCEPTION
            '027F-A blocked: pilot_mode must remain enabled.';

    END IF;


    IF COALESCE(
        v_settings.pilot_limit,
        0
    ) <> 20 THEN

        RAISE EXCEPTION
            '027F-A blocked: pilot_limit must equal 20. Current value=%',
            COALESCE(
                v_settings.pilot_limit,
                0
            );

    END IF;


    -- ========================================================
    -- REPLY SAFETY
    -- ========================================================

    SELECT
        COALESCE(
            replied_leads_still_running,
            0
        )

    INTO v_unsafe_replied_leads

    FROM public.email_reply_integrity_status

    LIMIT 1;


    IF COALESCE(
        v_unsafe_replied_leads,
        0
    ) > 0 THEN

        RAISE EXCEPTION
            '027F-A blocked: % replied lead(s) are still running.',
            v_unsafe_replied_leads;

    END IF;


    -- ========================================================
    -- LOCK TARGET PILOT BATCH
    -- ========================================================

    SELECT status
    INTO v_pilot_status
    FROM public.email_pilot_batches
    WHERE id = v_materialization.pilot_batch_id
    FOR UPDATE;


    IF NOT FOUND THEN

        RAISE EXCEPTION
            '027F-A blocked: materialized pilot batch was not found.';

    END IF;


    -- ========================================================
    -- VERIFY EXACT PILOT MEMBERS
    -- ========================================================

    SELECT COUNT(*)
    INTO v_member_count

    FROM public.email_pilot_members

    WHERE batch_id = v_materialization.pilot_batch_id
      AND enrollment_id IS NOT NULL;


    IF v_member_count <> 20 THEN

        RAISE EXCEPTION
            '027F-A blocked: expected exactly 20 pilot members with enrollments, found %.',
            v_member_count;

    END IF;


    -- ========================================================
    -- VERIFY ALL 20 ENROLLMENTS EXIST
    -- ========================================================

    SELECT COUNT(*)
    INTO v_enrollment_count

    FROM public.email_sequence_enrollments ese

    INNER JOIN public.email_pilot_members epm
        ON epm.enrollment_id = ese.id

    WHERE epm.batch_id =
        v_materialization.pilot_batch_id;


    IF v_enrollment_count <> 20 THEN

        RAISE EXCEPTION
            '027F-A blocked: expected exactly 20 mapped enrollments, found %.',
            v_enrollment_count;

    END IF;


    -- ========================================================
    -- COUNT CURRENT ENROLLMENT STATES
    -- ========================================================

    SELECT

        COUNT(*) FILTER (
            WHERE ese.status = 'paused'
        ),

        COUNT(*) FILTER (
            WHERE ese.status = 'active'
        )

    INTO
        v_paused_before,
        v_active_before

    FROM public.email_sequence_enrollments ese

    INNER JOIN public.email_pilot_members epm
        ON epm.enrollment_id = ese.id

    WHERE epm.batch_id =
        v_materialization.pilot_batch_id;


    -- ========================================================
    -- IDEMPOTENCY
    -- ALREADY ARMED = RETURN SUCCESS SAFELY
    -- ========================================================

    IF
        v_pilot_status = 'armed'
        AND v_active_before = 20
        AND v_paused_before = 0

    THEN

        RETURN jsonb_build_object(

            'phase',
            '027F-A-guarded-20-carrier-arm',

            'success',
            true,

            'already_armed',
            true,

            'pilot_batch_id',
            v_materialization.pilot_batch_id,

            'prepared_batch_id',
            v_materialization.prepared_batch_id,

            'active_enrollments',
            v_active_before,

            'paused_enrollments',
            v_paused_before,

            'master_sending',
            false,

            'emails_sent',
            false,

            'ready_for_final_launch',
            true,

            'next_phase',
            '027F-B-final-guarded-go-live'

        );

    END IF;


    -- ========================================================
    -- PILOT MUST CURRENTLY BE PREPARED
    -- ========================================================

    IF v_pilot_status <> 'prepared' THEN

        RAISE EXCEPTION
            '027F-A blocked: expected pilot status prepared, found %.',
            v_pilot_status;

    END IF;


    -- ========================================================
    -- ALL 20 MUST STILL BE PAUSED
    -- ========================================================

    IF
        v_paused_before <> 20
        OR v_active_before <> 0
    THEN

        RAISE EXCEPTION
            '027F-A blocked: expected paused=20 active=0; found paused=% active=%.',
            v_paused_before,
            v_active_before;

    END IF;


    -- ========================================================
    -- ARM ENROLLMENTS
    --
    -- IMPORTANT:
    -- status becomes active,
    -- BUT next_send_at remains NULL.
    --
    -- Therefore they are NOT DUE and CANNOT SEND.
    -- ========================================================

    UPDATE public.email_sequence_enrollments ese

    SET
        status = 'active',

        next_send_at = NULL,

        started_at = COALESCE(
            started_at,
            now()
        ),

        completed_at = NULL,

        stopped_at = NULL,

        updated_at = now()

    WHERE ese.id IN (

        SELECT epm.enrollment_id

        FROM public.email_pilot_members epm

        WHERE epm.batch_id =
            v_materialization.pilot_batch_id

          AND epm.enrollment_id IS NOT NULL

    )

    AND ese.status = 'paused';


    GET DIAGNOSTICS
        v_activated = ROW_COUNT;


    IF v_activated <> 20 THEN

        RAISE EXCEPTION
            '027F-A failed: expected to activate 20 enrollments, activated %.',
            v_activated;

    END IF;


    -- ========================================================
    -- ARM PILOT BATCH
    -- ========================================================

    UPDATE public.email_pilot_batches

    SET status = 'armed'

    WHERE id =
        v_materialization.pilot_batch_id

      AND status = 'prepared';


    IF NOT FOUND THEN

        RAISE EXCEPTION
            '027F-A failed: pilot batch could not be moved prepared -> armed.';

    END IF;


    -- ========================================================
    -- HARD ASSERTION:
    -- MASTER SENDING MUST STILL BE OFF
    -- ========================================================

    IF EXISTS (

        SELECT 1

        FROM public.email_launch_settings

        WHERE sending_enabled = true

    ) THEN

        RAISE EXCEPTION
            '027F-A safety failure: Master Sending unexpectedly became enabled.';

    END IF;


    -- ========================================================
    -- AUDIT
    -- ========================================================

    INSERT INTO public.email_ramp_20_arm_audit (

        prepared_batch_id,
        pilot_batch_id,
        sequence_id,

        previous_pilot_status,
        new_pilot_status,

        paused_before,
        active_before,

        activated_enrollments,

        sending_enabled,
        daily_send_cap,
        max_batch_size,
        pilot_mode,
        pilot_limit,

        operator_note,

        metadata

    )

    VALUES (

        v_materialization.prepared_batch_id,
        v_materialization.pilot_batch_id,
        v_materialization.sequence_id,

        v_pilot_status,
        'armed',

        v_paused_before,
        v_active_before,

        v_activated,

        false,
        v_settings.daily_send_cap,
        v_settings.max_batch_size,
        v_settings.pilot_mode,
        v_settings.pilot_limit,

        NULLIF(
            BTRIM(
                COALESCE(
                    p_operator_note,
                    ''
                )
            ),
            ''
        ),

        jsonb_build_object(

            'phase',
            '027F-A',

            'protected_arm',
            true,

            'emails_sent',
            false,

            'next_send_at_set',
            false,

            'master_sending_changed',
            false,

            'exact_carrier_count',
            20

        )

    )

    ON CONFLICT (
        pilot_batch_id
    )
    DO NOTHING;


    -- ========================================================
    -- FINAL RESULT
    -- ========================================================

    RETURN jsonb_build_object(

        'phase',
        '027F-A-guarded-20-carrier-arm',

        'success',
        true,

        'pilot_batch_id',
        v_materialization.pilot_batch_id,

        'prepared_batch_id',
        v_materialization.prepared_batch_id,

        'previous_pilot_status',
        v_pilot_status,

        'new_pilot_status',
        'armed',

        'activated_enrollments',
        v_activated,

        'active_enrollments',
        20,

        'paused_enrollments',
        0,

        'daily_send_cap',
        v_settings.daily_send_cap,

        'max_batch_size',
        v_settings.max_batch_size,

        'pilot_limit',
        v_settings.pilot_limit,

        'master_sending',
        false,

        'next_send_at',
        NULL,

        'emails_sent',
        false,

        'ready_for_final_launch',
        true,

        'next_phase',
        '027F-B-final-guarded-go-live'

    );

END;

$function$;


-- ============================================================
-- 3. ARMED STATUS VIEW
-- ============================================================

CREATE OR REPLACE VIEW public.email_ramp_20_armed_status
AS

WITH latest_arm AS (

    SELECT *
    FROM public.email_ramp_20_arm_audit
    ORDER BY armed_at DESC
    LIMIT 1

),

settings AS (

    SELECT
        sending_enabled,
        daily_send_cap,
        max_batch_size,
        pilot_mode,
        pilot_limit

    FROM public.email_launch_settings

    ORDER BY id
    LIMIT 1

),

reply_state AS (

    SELECT
        COALESCE(
            MAX(
                replied_leads_still_running
            ),
            0
        )::integer
        AS unsafe_replied_leads

    FROM public.email_reply_integrity_status

),

enrollment_state AS (

    SELECT

        la.pilot_batch_id,

        COUNT(*)::integer
            AS total_enrollments,

        COUNT(*) FILTER (
            WHERE ese.status = 'active'
        )::integer
            AS active_enrollments,

        COUNT(*) FILTER (
            WHERE ese.status = 'paused'
        )::integer
            AS paused_enrollments,

        COUNT(*) FILTER (
            WHERE ese.status = 'stopped'
        )::integer
            AS stopped_enrollments,

        COUNT(*) FILTER (
            WHERE ese.status = 'completed'
        )::integer
            AS completed_enrollments,

        COUNT(*) FILTER (
            WHERE ese.next_send_at IS NOT NULL
        )::integer
            AS scheduled_enrollments

    FROM latest_arm la

    INNER JOIN public.email_pilot_members epm
        ON epm.batch_id = la.pilot_batch_id

    INNER JOIN public.email_sequence_enrollments ese
        ON ese.id = epm.enrollment_id

    GROUP BY
        la.pilot_batch_id

)

SELECT

    la.id
        AS arm_audit_id,

    la.prepared_batch_id,

    la.pilot_batch_id,

    pb.sequence_id,

    pb.status
        AS pilot_status,

    es.total_enrollments,

    es.active_enrollments,

    es.paused_enrollments,

    es.stopped_enrollments,

    es.completed_enrollments,

    es.scheduled_enrollments,

    s.sending_enabled
        AS master_sending,

    s.daily_send_cap,

    s.max_batch_size,

    s.pilot_mode,

    s.pilot_limit,

    rs.unsafe_replied_leads,

    (
        pb.status = 'armed'

        AND es.total_enrollments = 20

        AND es.active_enrollments = 20

        AND es.paused_enrollments = 0

        AND es.scheduled_enrollments = 0

        AND COALESCE(
            s.sending_enabled,
            false
        ) = false

        AND s.daily_send_cap = 20

        AND s.max_batch_size = 5

        AND s.pilot_mode = true

        AND s.pilot_limit = 20

        AND rs.unsafe_replied_leads = 0

    )
        AS ready_for_final_launch,

    la.armed_at

FROM latest_arm la

INNER JOIN public.email_pilot_batches pb
    ON pb.id = la.pilot_batch_id

CROSS JOIN settings s

CROSS JOIN reply_state rs

INNER JOIN enrollment_state es
    ON es.pilot_batch_id = la.pilot_batch_id;


-- ============================================================
-- 4. PERMISSIONS
-- ============================================================

GRANT EXECUTE
ON FUNCTION public.arm_email_ramp_20_batch(text)
TO service_role;


GRANT SELECT
ON public.email_ramp_20_armed_status
TO service_role;


GRANT SELECT
ON public.email_ramp_20_arm_audit
TO service_role;


COMMIT;