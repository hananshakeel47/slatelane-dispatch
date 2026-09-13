BEGIN;

-- ============================================================
-- PHASE 027F-B
-- FINAL GUARDED 20-CARRIER GO-LIVE
--
-- PURPOSE:
--   - Validate the exact armed 20-carrier pilot.
--   - Refuse launch if ANY safety invariant is broken.
--   - Refuse launch if unrelated active enrollments exist.
--   - Schedule the 20 enrollments in protected batches.
--   - Enable Master Sending only after every check passes.
--
-- IMPORTANT:
--   This function itself sends ZERO email.
--   Existing processor cron performs actual sending.
-- ============================================================


-- ============================================================
-- 1. FINAL LAUNCH AUDIT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_ramp_20_final_launch_audit (
    id bigserial PRIMARY KEY,

    prepared_batch_id uuid NOT NULL,
    pilot_batch_id uuid NOT NULL,
    sequence_id uuid NOT NULL,

    scheduled_enrollments integer NOT NULL,

    first_send_at timestamptz NOT NULL,
    last_send_at timestamptz NOT NULL,

    daily_send_cap integer NOT NULL,
    max_batch_size integer NOT NULL,
    pilot_limit integer NOT NULL,
    pilot_mode boolean NOT NULL,

    sending_enabled_before boolean NOT NULL,
    sending_enabled_after boolean NOT NULL,

    unsafe_replied_leads integer NOT NULL DEFAULT 0,
    unrelated_active_enrollments integer NOT NULL DEFAULT 0,

    launched_at timestamptz NOT NULL DEFAULT now(),

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);


CREATE UNIQUE INDEX IF NOT EXISTS
email_ramp_20_final_launch_audit_pilot_batch_uidx
ON public.email_ramp_20_final_launch_audit (
    pilot_batch_id
);


-- ============================================================
-- 2. GUARDED FINAL LAUNCH FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.launch_email_ramp_20_guarded()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$

DECLARE

    v_prepared_batch_id uuid;
    v_pilot_batch_id uuid;
    v_sequence_id uuid;

    v_pilot_status text;

    v_total integer := 0;
    v_active integer := 0;
    v_paused integer := 0;
    v_stopped integer := 0;
    v_completed integer := 0;
    v_scheduled_before integer := 0;

    v_ready boolean := false;

    v_master_before boolean := false;
    v_pilot_mode boolean := false;

    v_daily_send_cap integer := 0;
    v_max_batch_size integer := 0;
    v_pilot_limit integer := 0;

    v_send_hour_start integer := 9;
    v_send_hour_end integer := 17;
    v_timezone text := 'America/Chicago';

    v_unsafe_replied integer := 0;

    v_global_active integer := 0;
    v_batch_active integer := 0;
    v_unrelated_active integer := 0;

    v_bad_leads integer := 0;

    v_processor_cron integer := 0;
    v_completion_cron integer := 0;

    v_existing_audit_id bigint;

    v_local_now timestamp without time zone;
    v_local_start timestamp without time zone;
    v_local_end timestamp without time zone;

    v_launch_at timestamptz;

    v_batch_count integer := 0;
    v_spread interval;

    v_scheduled integer := 0;

    v_first_send timestamptz;
    v_last_send timestamptz;

BEGIN

    -- ========================================================
    -- A. LOAD CURRENT ARMED STATE
    -- ========================================================

    SELECT
        prepared_batch_id,
        pilot_batch_id,
        sequence_id,
        pilot_status,

        total_enrollments,
        active_enrollments,
        paused_enrollments,
        stopped_enrollments,
        completed_enrollments,
        scheduled_enrollments,

        master_sending,
        daily_send_cap,
        max_batch_size,
        pilot_mode,
        pilot_limit,

        unsafe_replied_leads,
        ready_for_final_launch

    INTO
        v_prepared_batch_id,
        v_pilot_batch_id,
        v_sequence_id,
        v_pilot_status,

        v_total,
        v_active,
        v_paused,
        v_stopped,
        v_completed,
        v_scheduled_before,

        v_master_before,
        v_daily_send_cap,
        v_max_batch_size,
        v_pilot_mode,
        v_pilot_limit,

        v_unsafe_replied,
        v_ready

    FROM public.email_ramp_20_armed_status

    LIMIT 1;


    IF v_pilot_batch_id IS NULL THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: no armed 20-carrier pilot was found.';

    END IF;


    -- ========================================================
    -- B. IDEMPOTENCY
    -- ========================================================

    SELECT id
    INTO v_existing_audit_id

    FROM public.email_ramp_20_final_launch_audit

    WHERE pilot_batch_id =
        v_pilot_batch_id

    LIMIT 1;


    IF v_existing_audit_id IS NOT NULL THEN

        RETURN jsonb_build_object(

            'success',
            true,

            'phase',
            '027F-B-final-guarded-go-live',

            'already_launched',
            true,

            'pilot_batch_id',
            v_pilot_batch_id,

            'audit_id',
            v_existing_audit_id,

            'message',
            'This exact 20-carrier pilot has already passed 027F-B.'

        );

    END IF;


    -- ========================================================
    -- C. EXACT ARMED STATE ASSERTIONS
    -- ========================================================

    IF v_pilot_status <> 'armed' THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: pilot status is %, expected armed.',
        v_pilot_status;

    END IF;


    IF v_total <> 20 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: expected exactly 20 enrollments, found %.',
        v_total;

    END IF;


    IF v_active <> 20 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: expected 20 active enrollments, found %.',
        v_active;

    END IF;


    IF v_paused <> 0 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: % pilot enrollment(s) are still paused.',
        v_paused;

    END IF;


    IF v_stopped <> 0 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: % pilot enrollment(s) are stopped.',
        v_stopped;

    END IF;


    IF v_completed <> 0 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: % pilot enrollment(s) are already completed.',
        v_completed;

    END IF;


    IF v_scheduled_before <> 0 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: % enrollment(s) were already scheduled before final launch.',
        v_scheduled_before;

    END IF;


    IF COALESCE(v_ready, false) IS NOT TRUE THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: 027F-A does not report ready_for_final_launch=true.';

    END IF;


    -- ========================================================
    -- D. MASTER SENDING MUST STILL BE OFF
    -- ========================================================

    IF COALESCE(v_master_before, false) IS TRUE THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: Master Sending was already ON before guarded launch.';

    END IF;


    -- ========================================================
    -- E. CAPACITY MUST REMAIN EXACTLY 20 / 5
    -- ========================================================

    IF COALESCE(v_pilot_mode, false) IS NOT TRUE THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: Pilot Mode is OFF.';

    END IF;


    IF v_pilot_limit <> 20 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: pilot_limit is %, expected 20.',
        v_pilot_limit;

    END IF;


    IF v_daily_send_cap <> 20 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: daily_send_cap is %, expected 20.',
        v_daily_send_cap;

    END IF;


    IF v_max_batch_size <> 5 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: max_batch_size is %, expected 5.',
        v_max_batch_size;

    END IF;


    -- ========================================================
    -- F. REPLY AUTO-STOP SAFETY
    -- ========================================================

    SELECT
        COALESCE(
            replied_leads_still_running,
            0
        )

    INTO v_unsafe_replied

    FROM public.email_reply_integrity_status

    LIMIT 1;


    IF v_unsafe_replied > 0 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: % replied lead(s) are still running.',
        v_unsafe_replied;

    END IF;


    -- ========================================================
    -- G. ENSURE EXACTLY THESE 20 ARE ACTIVE GLOBALLY
    --
    -- This prevents Master Sending from accidentally releasing
    -- unrelated active enrollments.
    -- ========================================================

    SELECT COUNT(*)
    INTO v_global_active

    FROM public.email_sequence_enrollments

    WHERE status = 'active';


    SELECT COUNT(*)
    INTO v_batch_active

    FROM public.email_sequence_enrollments ese

    INNER JOIN public.email_pilot_members epm
        ON epm.enrollment_id =
           ese.id

    WHERE epm.batch_id =
          v_pilot_batch_id

      AND ese.status =
          'active';


    SELECT COUNT(*)
    INTO v_unrelated_active

    FROM public.email_sequence_enrollments ese

    WHERE ese.status =
          'active'

      AND NOT EXISTS (

          SELECT 1

          FROM public.email_pilot_members epm

          WHERE epm.batch_id =
                v_pilot_batch_id

            AND epm.enrollment_id =
                ese.id

      );


    IF v_batch_active <> 20 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: armed pilot contains % active enrollments instead of 20.',
        v_batch_active;

    END IF;


    IF v_global_active <> 20 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: database contains % total active enrollments. Expected exactly the 20 guarded pilot enrollments.',
        v_global_active;

    END IF;


    IF v_unrelated_active <> 0 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: % unrelated active enrollment(s) exist.',
        v_unrelated_active;

    END IF;


    -- ========================================================
    -- H. LAST-SECOND LEAD SAFETY
    -- ========================================================

    SELECT COUNT(*)
    INTO v_bad_leads

    FROM public.email_pilot_members epm

    INNER JOIN public.leads l
        ON l.id =
           epm.lead_id

    WHERE epm.batch_id =
          v_pilot_batch_id

      AND (

          COALESCE(
              l.email_opt_out,
              false
          ) = true

          OR

          COALESCE(
              l.email_bounced,
              false
          ) = true

          OR

          COALESCE(
              l.email_complained,
              false
          ) = true

          OR

          COALESCE(
              l.has_replied,
              false
          ) = true

      );


    IF v_bad_leads > 0 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: % pilot lead(s) became ineligible before launch.',
        v_bad_leads;

    END IF;


    -- ========================================================
    -- I. VERIFY PROCESSOR + COMPLETION WATCHER
    -- ========================================================

    SELECT COUNT(*)
    INTO v_processor_cron

    FROM cron.job

    WHERE jobname =
          'slatelane-email-sequence-processor'

      AND active =
          true;


    SELECT COUNT(*)
    INTO v_completion_cron

    FROM cron.job

    WHERE jobname =
          'slatelane-pilot-completion-watcher'

      AND active =
          true;


    IF v_processor_cron <> 1 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: email sequence processor cron is not active.';

    END IF;


    IF v_completion_cron <> 1 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: pilot completion watcher is not active.';

    END IF;


    -- ========================================================
    -- J. LOAD CURRENT SEND WINDOW
    -- ========================================================

    SELECT
        COALESCE(
            sending_hour_start,
            9
        ),

        COALESCE(
            sending_hour_end,
            17
        ),

        COALESCE(
            NULLIF(
                BTRIM(
                    sending_timezone
                ),
                ''
            ),
            'America/Chicago'
        )

    INTO
        v_send_hour_start,
        v_send_hour_end,
        v_timezone

    FROM public.email_launch_settings

    ORDER BY id

    LIMIT 1;


    -- ========================================================
    -- K. DETERMINE FIRST SAFE SEND TIME
    -- ========================================================

    v_batch_count :=
        CEIL(
            20.0 /
            GREATEST(
                v_max_batch_size,
                1
            )
        )::integer;


    v_spread :=
        GREATEST(
            v_batch_count - 1,
            0
        )
        * INTERVAL '15 minutes';


    v_local_now :=
        now()
        AT TIME ZONE
        v_timezone;


    v_local_start :=
        date_trunc(
            'day',
            v_local_now
        )
        +
        make_interval(
            hours =>
            v_send_hour_start
        );


    v_local_end :=
        date_trunc(
            'day',
            v_local_now
        )
        +
        make_interval(
            hours =>
            v_send_hour_end
        );


    -- Before today's send window.
    IF v_local_now < v_local_start THEN

        v_launch_at :=
            v_local_start
            AT TIME ZONE
            v_timezone;


    -- Too late today to safely complete all protected batches.
    ELSIF (
        v_local_now +
        v_spread
    ) >= v_local_end THEN

        v_launch_at :=
            (
                date_trunc(
                    'day',
                    v_local_now
                )
                +
                INTERVAL '1 day'
                +
                make_interval(
                    hours =>
                    v_send_hour_start
                )
            )
            AT TIME ZONE
            v_timezone;


    -- Inside current send window.
    ELSE

        v_launch_at :=
            now()
            +
            INTERVAL '1 minute';

    END IF;


    -- ========================================================
    -- L. SCHEDULE EXACTLY 20
    --
    -- 1-5     = first slot
    -- 6-10    = +15 minutes
    -- 11-15   = +30 minutes
    -- 16-20   = +45 minutes
    -- ========================================================

    WITH ranked AS (

        SELECT

            ese.id,

            ROW_NUMBER() OVER (
                ORDER BY
                    epm.id
            ) AS rn

        FROM public.email_pilot_members epm

        INNER JOIN public.email_sequence_enrollments ese
            ON ese.id =
               epm.enrollment_id

        WHERE epm.batch_id =
              v_pilot_batch_id

          AND ese.status =
              'active'

          AND ese.next_send_at
              IS NULL

    ),

    scheduled AS (

        UPDATE public.email_sequence_enrollments ese

        SET

            next_send_at =
                v_launch_at
                +
                (
                    FLOOR(
                        (
                            ranked.rn -
                            1
                        )::numeric
                        /
                        GREATEST(
                            v_max_batch_size,
                            1
                        )
                    )::integer
                    *
                    INTERVAL '15 minutes'
                ),

            updated_at =
                now()

        FROM ranked

        WHERE ese.id =
              ranked.id

        RETURNING
            ese.id,
            ese.next_send_at

    )

    SELECT

        COUNT(*),

        MIN(
            next_send_at
        ),

        MAX(
            next_send_at
        )

    INTO

        v_scheduled,

        v_first_send,

        v_last_send

    FROM scheduled;


    IF v_scheduled <> 20 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: expected to schedule 20 enrollments but scheduled %. All changes rolled back.',
        v_scheduled;

    END IF;


    -- ========================================================
    -- M. FINAL REPLY SAFETY CHECK
    -- ========================================================

    SELECT
        COALESCE(
            replied_leads_still_running,
            0
        )

    INTO v_unsafe_replied

    FROM public.email_reply_integrity_status

    LIMIT 1;


    IF v_unsafe_replied > 0 THEN

        RAISE EXCEPTION
        '027F-B BLOCKED AT FINAL GATE: % replied lead(s) are unsafe. Entire launch rolled back.',
        v_unsafe_replied;

    END IF;


    -- ========================================================
    -- N. ENABLE MASTER SENDING
    --
    -- This occurs LAST.
    -- ========================================================

    UPDATE public.email_launch_settings

    SET sending_enabled =
        true

    WHERE id = (

        SELECT id

        FROM public.email_launch_settings

        ORDER BY id

        LIMIT 1

    )

    AND sending_enabled =
        false;


    IF NOT FOUND THEN

        RAISE EXCEPTION
        '027F-B BLOCKED: Master Sending could not be transitioned from OFF to ON. Entire launch rolled back.';

    END IF;


    -- ========================================================
    -- O. WRITE FINAL AUDIT
    -- ========================================================

    INSERT INTO public.email_ramp_20_final_launch_audit (

        prepared_batch_id,
        pilot_batch_id,
        sequence_id,

        scheduled_enrollments,

        first_send_at,
        last_send_at,

        daily_send_cap,
        max_batch_size,
        pilot_limit,
        pilot_mode,

        sending_enabled_before,
        sending_enabled_after,

        unsafe_replied_leads,
        unrelated_active_enrollments,

        metadata

    )

    VALUES (

        v_prepared_batch_id,
        v_pilot_batch_id,
        v_sequence_id,

        v_scheduled,

        v_first_send,
        v_last_send,

        v_daily_send_cap,
        v_max_batch_size,
        v_pilot_limit,
        v_pilot_mode,

        false,
        true,

        v_unsafe_replied,
        v_unrelated_active,

        jsonb_build_object(

            'phase',
            '027F-B',

            'transition',
            'armed_to_guarded_live',

            'target',
            20,

            'emails_sent_by_function',
            false,

            'processor_responsible_for_send',
            true,

            'pilot_mode_preserved',
            true,

            'daily_send_cap',
            v_daily_send_cap,

            'max_batch_size',
            v_max_batch_size,

            'sending_timezone',
            v_timezone

        )

    );


    -- ========================================================
    -- P. SUCCESS
    -- ========================================================

    RETURN jsonb_build_object(

        'success',
        true,

        'phase',
        '027F-B-final-guarded-go-live',

        'pilot_batch_id',
        v_pilot_batch_id,

        'prepared_batch_id',
        v_prepared_batch_id,

        'sequence_id',
        v_sequence_id,

        'pilot_status',
        v_pilot_status,

        'scheduled_enrollments',
        v_scheduled,

        'first_send_at',
        v_first_send,

        'last_send_at',
        v_last_send,

        'daily_send_cap',
        v_daily_send_cap,

        'max_batch_size',
        v_max_batch_size,

        'pilot_limit',
        v_pilot_limit,

        'pilot_mode',
        v_pilot_mode,

        'master_sending',
        true,

        'unsafe_replied_leads',
        v_unsafe_replied,

        'unrelated_active_enrollments',
        v_unrelated_active,

        'emails_sent_by_this_function',
        false,

        'message',
        '027F-B passed. Exact guarded 20-carrier pilot is LIVE and scheduled for the existing protected processor.'

    );

END;

$function$;


-- ============================================================
-- 3. LOCK FUNCTION TO SERVICE / DATABASE OWNER
-- ============================================================

REVOKE ALL
ON FUNCTION public.launch_email_ramp_20_guarded()
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.launch_email_ramp_20_guarded()
TO service_role;


COMMIT;