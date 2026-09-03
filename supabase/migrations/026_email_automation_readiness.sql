BEGIN;

-- ============================================================
-- PHASE 026A
-- SlateLane Email Automation Readiness Gate
-- ============================================================


-- ============================================================
-- 1. READINESS AUDIT TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_automation_readiness_audit (
    id BIGSERIAL PRIMARY KEY,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    automation_healthy BOOLEAN,
    ready_to_scale BOOLEAN,
    snapshot JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS
    idx_email_automation_readiness_audit_checked_at
ON public.email_automation_readiness_audit (checked_at DESC);


-- ============================================================
-- 2. MAIN READINESS FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.email_automation_readiness(
    p_write_audit BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE

    -- Scheduler state
    v_processor_active BOOLEAN := false;
    v_completion_active BOOLEAN := false;

    v_processor_last_status TEXT;
    v_completion_last_status TEXT;

    -- Safety
    v_safety JSONB := '{}'::jsonb;
    v_safety_success BOOLEAN := false;
    v_safety_triggered BOOLEAN := false;
    v_safety_reason TEXT;

    -- Launch settings
    v_launch JSONB := '{}'::jsonb;

    -- Pilot
    v_pilot_id UUID;
    v_pilot_status TEXT;

    v_pilot_members INTEGER := 0;
    v_active INTEGER := 0;
    v_paused INTEGER := 0;
    v_completed INTEGER := 0;
    v_stopped INTEGER := 0;

    v_terminal INTEGER := 0;

    v_earliest_next_send TIMESTAMPTZ;
    v_latest_next_send TIMESTAMPTZ;

    -- Send statistics
    v_sent_24h INTEGER := 0;
    v_delivered_24h INTEGER := 0;
    v_bounced_24h INTEGER := 0;
    v_failed_24h INTEGER := 0;

    -- Protection
    v_unsafe_active INTEGER := 0;

    -- Final result
    v_automation_healthy BOOLEAN := false;
    v_ready_to_scale BOOLEAN := false;

    v_blockers TEXT[] := ARRAY[]::TEXT[];

    v_result JSONB;

BEGIN

    -- ========================================================
    -- CURRENT LAUNCH SETTINGS
    -- ========================================================

    SELECT to_jsonb(s)
    INTO v_launch
    FROM public.email_launch_settings s
    ORDER BY
        s.updated_at DESC NULLS LAST,
        s.created_at DESC NULLS LAST
    LIMIT 1;


    -- ========================================================
    -- SAFETY SYSTEM
    -- ========================================================

    BEGIN

        SELECT public.evaluate_email_safety()
        INTO v_safety;

    EXCEPTION
        WHEN OTHERS THEN

            v_safety := jsonb_build_object(
                'success', false,
                'reason', 'safety_function_error',
                'error', SQLERRM
            );

    END;


    v_safety_success :=
        COALESCE((v_safety ->> 'success')::BOOLEAN, false);

    v_safety_triggered :=
        COALESCE((v_safety ->> 'triggered')::BOOLEAN, false);

    v_safety_reason :=
        v_safety ->> 'reason';


    -- ========================================================
    -- EMAIL PROCESSOR SCHEDULER
    -- ========================================================

    SELECT EXISTS (
        SELECT 1
        FROM cron.job
        WHERE jobname = 'slatelane-email-sequence-processor'
          AND active = true
    )
    INTO v_processor_active;


    BEGIN

        SELECT jrd.status
        INTO v_processor_last_status
        FROM cron.job_run_details jrd
        WHERE jrd.jobid = (
            SELECT jobid
            FROM cron.job
            WHERE jobname = 'slatelane-email-sequence-processor'
            LIMIT 1
        )
        ORDER BY jrd.start_time DESC
        LIMIT 1;

    EXCEPTION
        WHEN OTHERS THEN
            v_processor_last_status := NULL;
    END;


    -- ========================================================
    -- PILOT COMPLETION WATCHER
    -- ========================================================

    SELECT EXISTS (
        SELECT 1
        FROM cron.job
        WHERE jobname = 'slatelane-pilot-completion-watcher'
          AND active = true
    )
    INTO v_completion_active;


    BEGIN

        SELECT jrd.status
        INTO v_completion_last_status
        FROM cron.job_run_details jrd
        WHERE jrd.jobid = (
            SELECT jobid
            FROM cron.job
            WHERE jobname = 'slatelane-pilot-completion-watcher'
            LIMIT 1
        )
        ORDER BY jrd.start_time DESC
        LIMIT 1;

    EXCEPTION
        WHEN OTHERS THEN
            v_completion_last_status := NULL;
    END;


    -- ========================================================
    -- LATEST PILOT
    -- ========================================================

    SELECT
        epb.id,
        epb.status
    INTO
        v_pilot_id,
        v_pilot_status
    FROM public.email_pilot_batches epb
    ORDER BY epb.created_at DESC
    LIMIT 1;


    -- ========================================================
    -- PILOT MEMBER / ENROLLMENT STATE
    -- ========================================================

    IF v_pilot_id IS NOT NULL THEN

        SELECT COUNT(*)
        INTO v_pilot_members
        FROM public.email_pilot_members
        WHERE batch_id = v_pilot_id;


        SELECT

            COUNT(*) FILTER (
                WHERE ese.status = 'active'
            ),

            COUNT(*) FILTER (
                WHERE ese.status = 'paused'
            ),

            COUNT(*) FILTER (
                WHERE ese.status = 'completed'
            ),

            COUNT(*) FILTER (
                WHERE ese.status = 'stopped'
            ),

            MIN(ese.next_send_at) FILTER (
                WHERE ese.status = 'active'
            ),

            MAX(ese.next_send_at) FILTER (
                WHERE ese.status = 'active'
            )

        INTO
            v_active,
            v_paused,
            v_completed,
            v_stopped,
            v_earliest_next_send,
            v_latest_next_send

        FROM public.email_pilot_members epm

        JOIN public.email_sequence_enrollments ese
            ON ese.id = epm.enrollment_id

        WHERE epm.batch_id = v_pilot_id;

    END IF;


    v_terminal :=
        COALESCE(v_completed, 0)
        +
        COALESCE(v_stopped, 0);


    -- ========================================================
    -- UNSAFE ACTIVE ENROLLMENT CHECK
    -- ========================================================

    BEGIN

        SELECT COUNT(*)
        INTO v_unsafe_active

        FROM public.email_sequence_enrollments ese

        JOIN public.leads l
            ON l.id = ese.lead_id

        WHERE ese.status = 'active'

          AND (
                COALESCE(l.email_opt_out, false) = true
             OR COALESCE(l.email_bounced, false) = true
             OR COALESCE(l.email_complained, false) = true
          );

    EXCEPTION
        WHEN OTHERS THEN

            -- Fail closed.
            v_unsafe_active := -1;

    END;


    -- ========================================================
    -- LAST 24 HOURS EMAIL HEALTH
    -- ========================================================

    SELECT

        COUNT(*) FILTER (
            WHERE sent_at IS NOT NULL
        ),

        COUNT(*) FILTER (
            WHERE delivered_at IS NOT NULL
        ),

        COUNT(*) FILTER (
            WHERE bounced_at IS NOT NULL
        ),

        COUNT(*) FILTER (
            WHERE failed_at IS NOT NULL
        )

    INTO
        v_sent_24h,
        v_delivered_24h,
        v_bounced_24h,
        v_failed_24h

    FROM public.email_sends

    WHERE created_at >= now() - INTERVAL '24 hours';


    -- ========================================================
    -- BUILD BLOCKER LIST
    -- ========================================================

    IF NOT v_processor_active THEN

        v_blockers :=
            array_append(
                v_blockers,
                'email_sequence_processor_not_active'
            );

    END IF;


    IF NOT v_completion_active THEN

        v_blockers :=
            array_append(
                v_blockers,
                'pilot_completion_watcher_not_active'
            );

    END IF;


    IF NOT v_safety_success THEN

        v_blockers :=
            array_append(
                v_blockers,
                'email_safety_check_failed'
            );

    END IF;


    IF v_safety_triggered THEN

        v_blockers :=
            array_append(
                v_blockers,
                COALESCE(
                    'email_safety_triggered:' || v_safety_reason,
                    'email_safety_triggered'
                )
            );

    END IF;


    IF v_unsafe_active <> 0 THEN

        v_blockers :=
            array_append(
                v_blockers,
                'unsafe_active_enrollments_detected'
            );

    END IF;


    -- ========================================================
    -- AUTOMATION HEALTH
    -- ========================================================

    v_automation_healthy :=
           v_processor_active
       AND v_completion_active
       AND v_safety_success
       AND NOT v_safety_triggered
       AND v_unsafe_active = 0;


    -- ========================================================
    -- SCALE READINESS
    -- ========================================================

    IF v_pilot_id IS NULL THEN

        v_blockers :=
            array_append(
                v_blockers,
                'no_pilot_found'
            );

    ELSIF v_pilot_status <> 'completed' THEN

        v_blockers :=
            array_append(
                v_blockers,
                'pilot_not_completed'
            );

    END IF;


    IF v_active > 0 THEN

        v_blockers :=
            array_append(
                v_blockers,
                'pilot_has_active_enrollments'
            );

    END IF;


    IF v_paused > 0 THEN

        v_blockers :=
            array_append(
                v_blockers,
                'pilot_has_paused_enrollments'
            );

    END IF;


    v_ready_to_scale :=
           v_automation_healthy
       AND v_pilot_id IS NOT NULL
       AND v_pilot_status = 'completed'
       AND v_active = 0
       AND v_paused = 0;


    -- ========================================================
    -- FINAL JSON
    -- ========================================================

    v_result := jsonb_build_object(

        'phase',
            '026A-email-automation-readiness',

        'checkedAt',
            now(),

        'automationHealthy',
            v_automation_healthy,

        'readyToScale',
            v_ready_to_scale,

        'blockers',
            to_jsonb(v_blockers),


        -- Scheduler state
        'schedulers',
            jsonb_build_object(

                'emailProcessor',
                    jsonb_build_object(
                        'active',
                            v_processor_active,
                        'lastStatus',
                            v_processor_last_status
                    ),

                'pilotCompletionWatcher',
                    jsonb_build_object(
                        'active',
                            v_completion_active,
                        'lastStatus',
                            v_completion_last_status
                    )
            ),


        -- Safety state
        'safety',
            v_safety,


        -- Launch settings
        'launchSettings',
            COALESCE(
                v_launch,
                '{}'::jsonb
            ),


        -- Pilot state
        'pilot',
            jsonb_build_object(

                'batchId',
                    v_pilot_id,

                'status',
                    v_pilot_status,

                'members',
                    v_pilot_members,

                'active',
                    v_active,

                'paused',
                    v_paused,

                'completed',
                    v_completed,

                'stopped',
                    v_stopped,

                'terminal',
                    v_terminal,

                'earliestNextFollowUp',
                    v_earliest_next_send,

                'latestNextFollowUp',
                    v_latest_next_send
            ),


        -- Protection checks
        'protection',
            jsonb_build_object(

                'unsafeActiveEnrollments',
                    v_unsafe_active
            ),


        -- Recent delivery health
        'last24Hours',
            jsonb_build_object(

                'sent',
                    v_sent_24h,

                'delivered',
                    v_delivered_24h,

                'bounced',
                    v_bounced_24h,

                'failed',
                    v_failed_24h

            )

    );


    -- ========================================================
    -- OPTIONAL IMMUTABLE AUDIT
    -- ========================================================

    IF p_write_audit THEN

        INSERT INTO public.email_automation_readiness_audit (
            automation_healthy,
            ready_to_scale,
            snapshot
        )
        VALUES (
            v_automation_healthy,
            v_ready_to_scale,
            v_result
        );

    END IF;


    RETURN v_result;

END;
$$;


-- ============================================================
-- 3. CONVENIENCE VIEW
-- ============================================================

CREATE OR REPLACE VIEW public.email_automation_readiness_status
AS

SELECT
    public.email_automation_readiness(false) AS status;


-- ============================================================
-- 4. SECURITY
-- ============================================================

REVOKE ALL
ON FUNCTION public.email_automation_readiness(BOOLEAN)
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.email_automation_readiness(BOOLEAN)
TO service_role;


GRANT SELECT, INSERT
ON public.email_automation_readiness_audit
TO service_role;


GRANT SELECT
ON public.email_automation_readiness_status
TO service_role;


COMMIT;