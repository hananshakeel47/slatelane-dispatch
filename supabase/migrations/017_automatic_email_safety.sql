BEGIN;

-- ============================================================
-- SlateLane Dispatch CRM
-- Migration 017
-- Automatic Email Safety + Emergency Auto-Pause
-- ============================================================


-- ============================================================
-- 1. SAFETY CONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_safety_config (

    id smallint PRIMARY KEY DEFAULT 1
        CHECK (id = 1),

    enabled boolean NOT NULL DEFAULT true,

    -- Rolling evaluation period
    window_hours integer NOT NULL DEFAULT 24
        CHECK (window_hours BETWEEN 1 AND 168),

    -- Ignore percentage rules until enough emails exist
    minimum_sample_size integer NOT NULL DEFAULT 20
        CHECK (minimum_sample_size >= 1),

    -- Percent thresholds
    max_bounce_rate numeric(6,2) NOT NULL DEFAULT 5.00
        CHECK (
            max_bounce_rate >= 0
            AND max_bounce_rate <= 100
        ),

    max_failure_rate numeric(6,2) NOT NULL DEFAULT 10.00
        CHECK (
            max_failure_rate >= 0
            AND max_failure_rate <= 100
        ),

    max_complaint_rate numeric(6,3) NOT NULL DEFAULT 0.300
        CHECK (
            max_complaint_rate >= 0
            AND max_complaint_rate <= 100
        ),

    -- Even one complaint is serious during a small pilot.
    max_complaints_absolute integer NOT NULL DEFAULT 1
        CHECK (max_complaints_absolute >= 1),

    updated_at timestamptz NOT NULL DEFAULT now()
);


INSERT INTO public.email_safety_config (
    id,
    enabled,
    window_hours,
    minimum_sample_size,
    max_bounce_rate,
    max_failure_rate,
    max_complaint_rate,
    max_complaints_absolute
)
VALUES (
    1,
    true,
    24,
    20,
    5.00,
    10.00,
    0.300,
    1
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 2. CURRENT SAFETY STATE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_safety_state (

    id smallint PRIMARY KEY DEFAULT 1
        CHECK (id = 1),

    auto_paused boolean NOT NULL DEFAULT false,

    pause_reason text,

    paused_at timestamptz,

    last_evaluated_at timestamptz,

    sends_in_window bigint NOT NULL DEFAULT 0,

    bounces_in_window bigint NOT NULL DEFAULT 0,

    failures_in_window bigint NOT NULL DEFAULT 0,

    complaints_in_window bigint NOT NULL DEFAULT 0,

    bounce_rate numeric(8,3) NOT NULL DEFAULT 0,

    failure_rate numeric(8,3) NOT NULL DEFAULT 0,

    complaint_rate numeric(8,4) NOT NULL DEFAULT 0,

    reset_at timestamptz,

    reset_note text,

    updated_at timestamptz NOT NULL DEFAULT now()
);


INSERT INTO public.email_safety_state (
    id
)
VALUES (
    1
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 3. SAFETY EVENT HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_safety_events (

    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    event_type text NOT NULL,

    reason text,

    sends_in_window bigint NOT NULL DEFAULT 0,

    bounces_in_window bigint NOT NULL DEFAULT 0,

    failures_in_window bigint NOT NULL DEFAULT 0,

    complaints_in_window bigint NOT NULL DEFAULT 0,

    bounce_rate numeric(8,3),

    failure_rate numeric(8,3),

    complaint_rate numeric(8,4),

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_email_safety_events_created_at
ON public.email_safety_events (
    created_at DESC
);


-- ============================================================
-- 4. SAFETY EVALUATION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.evaluate_email_safety()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE

    cfg public.email_safety_config%ROWTYPE;

    previous_state public.email_safety_state%ROWTYPE;

    v_window_start timestamptz;

    v_sends bigint := 0;
    v_bounces bigint := 0;
    v_failures bigint := 0;
    v_complaints bigint := 0;

    v_bounce_rate numeric := 0;
    v_failure_rate numeric := 0;
    v_complaint_rate numeric := 0;

    v_triggered boolean := false;
    v_reason text := null;

    v_launch_table text := null;
    v_master_was_enabled boolean := false;

BEGIN

    -- --------------------------------------------------------
    -- LOAD CONFIG
    -- --------------------------------------------------------

    SELECT *
    INTO cfg
    FROM public.email_safety_config
    WHERE id = 1;


    SELECT *
    INTO previous_state
    FROM public.email_safety_state
    WHERE id = 1;


    v_window_start :=
        now()
        - make_interval(
            hours => cfg.window_hours
        );


    -- --------------------------------------------------------
    -- COUNT SENDS
    -- --------------------------------------------------------

    SELECT COUNT(*)
    INTO v_sends
    FROM public.email_sends
    WHERE created_at >= v_window_start;


    -- --------------------------------------------------------
    -- COUNT BOUNCES
    -- --------------------------------------------------------

    SELECT COUNT(*)
    INTO v_bounces
    FROM public.email_sends
    WHERE created_at >= v_window_start
      AND lower(
            coalesce(
                status,
                ''
            )
          ) = 'bounced';


    -- --------------------------------------------------------
    -- COUNT FAILURES
    -- --------------------------------------------------------

    SELECT COUNT(*)
    INTO v_failures
    FROM public.email_sends
    WHERE created_at >= v_window_start
      AND lower(
            coalesce(
                status,
                ''
            )
          ) = 'failed';


    -- --------------------------------------------------------
    -- COUNT UNIQUE COMPLAINTED EMAILS
    -- --------------------------------------------------------

    SELECT COUNT(
        DISTINCT resend_email_id
    )
    INTO v_complaints
    FROM public.email_webhook_events
    WHERE received_at >= v_window_start
      AND lower(event_type) = 'email.complained';


    -- --------------------------------------------------------
    -- CALCULATE RATES
    -- --------------------------------------------------------

    IF v_sends > 0 THEN

        v_bounce_rate :=
            round(
                (
                    v_bounces::numeric
                    /
                    v_sends::numeric
                ) * 100,
                3
            );


        v_failure_rate :=
            round(
                (
                    v_failures::numeric
                    /
                    v_sends::numeric
                ) * 100,
                3
            );


        v_complaint_rate :=
            round(
                (
                    v_complaints::numeric
                    /
                    v_sends::numeric
                ) * 100,
                4
            );

    END IF;


    -- --------------------------------------------------------
    -- DETERMINE WHETHER SAFETY MUST TRIP
    -- --------------------------------------------------------

    IF cfg.enabled THEN

        -- Complaint protection is intentionally strict.

        IF
            v_complaints >=
            cfg.max_complaints_absolute
        THEN

            v_triggered := true;

            v_reason :=
                'complaint_limit_exceeded';


        ELSIF
            v_sends >=
                cfg.minimum_sample_size
            AND
            v_bounce_rate >=
                cfg.max_bounce_rate
        THEN

            v_triggered := true;

            v_reason :=
                'bounce_rate_exceeded';


        ELSIF
            v_sends >=
                cfg.minimum_sample_size
            AND
            v_failure_rate >=
                cfg.max_failure_rate
        THEN

            v_triggered := true;

            v_reason :=
                'failure_rate_exceeded';


        ELSIF
            v_sends >=
                cfg.minimum_sample_size
            AND
            v_complaint_rate >=
                cfg.max_complaint_rate
        THEN

            v_triggered := true;

            v_reason :=
                'complaint_rate_exceeded';

        END IF;

    END IF;


    -- --------------------------------------------------------
    -- UPDATE STATE METRICS
    -- --------------------------------------------------------

    UPDATE public.email_safety_state

    SET
        last_evaluated_at = now(),

        sends_in_window =
            v_sends,

        bounces_in_window =
            v_bounces,

        failures_in_window =
            v_failures,

        complaints_in_window =
            v_complaints,

        bounce_rate =
            v_bounce_rate,

        failure_rate =
            v_failure_rate,

        complaint_rate =
            v_complaint_rate,

        updated_at =
            now()

    WHERE id = 1;


    -- --------------------------------------------------------
    -- IF DANGEROUS:
    -- FIND EXISTING LAUNCH CONTROL TABLE AUTOMATICALLY
    -- --------------------------------------------------------

    IF v_triggered THEN

        SELECT c1.table_name
        INTO v_launch_table

        FROM information_schema.columns c1

        INNER JOIN information_schema.columns c2
            ON c2.table_schema =
                c1.table_schema
           AND c2.table_name =
                c1.table_name

        WHERE
            c1.table_schema =
                'public'

            AND c1.column_name =
                'sending_enabled'

            AND c2.column_name =
                'pilot_mode'

        ORDER BY
            CASE
                WHEN c1.table_name
                    LIKE '%launch%'
                    THEN 0
                WHEN c1.table_name
                    LIKE '%control%'
                    THEN 1
                ELSE 2
            END,

            c1.table_name

        LIMIT 1;


        IF v_launch_table IS NULL THEN

            RAISE EXCEPTION
                'Could not locate SlateLane launch controls table.';

        END IF;


        -- ----------------------------------------------------
        -- WAS MASTER SENDING ACTUALLY ON?
        -- ----------------------------------------------------

        EXECUTE format(
            '
            SELECT EXISTS (
                SELECT 1
                FROM public.%I
                WHERE sending_enabled IS TRUE
            )
            ',
            v_launch_table
        )
        INTO v_master_was_enabled;


        -- ----------------------------------------------------
        -- HARD AUTO-PAUSE
        -- ----------------------------------------------------

        EXECUTE format(
            '
            UPDATE public.%I
            SET sending_enabled = false
            WHERE sending_enabled IS TRUE
            ',
            v_launch_table
        );


        -- ----------------------------------------------------
        -- LATCH SAFETY STATE
        -- ----------------------------------------------------

        UPDATE public.email_safety_state

        SET
            auto_paused = true,

            pause_reason =
                v_reason,

            paused_at =
                CASE
                    WHEN auto_paused IS FALSE
                    THEN now()
                    ELSE paused_at
                END,

            updated_at =
                now()

        WHERE id = 1;


        -- ----------------------------------------------------
        -- INSERT ONE INCIDENT EVENT
        -- Do not create the same event every 15 minutes.
        -- ----------------------------------------------------

        IF
            previous_state.auto_paused IS FALSE
            OR
            previous_state.pause_reason
                IS DISTINCT FROM
                v_reason
        THEN

            INSERT INTO public.email_safety_events (

                event_type,

                reason,

                sends_in_window,

                bounces_in_window,

                failures_in_window,

                complaints_in_window,

                bounce_rate,

                failure_rate,

                complaint_rate,

                metadata

            )
            VALUES (

                'automatic_pause',

                v_reason,

                v_sends,

                v_bounces,

                v_failures,

                v_complaints,

                v_bounce_rate,

                v_failure_rate,

                v_complaint_rate,

                jsonb_build_object(
                    'launch_table',
                    v_launch_table,
                    'master_was_enabled',
                    v_master_was_enabled,
                    'window_hours',
                    cfg.window_hours
                )

            );

        END IF;

    END IF;


    -- --------------------------------------------------------
    -- RESPONSE
    -- --------------------------------------------------------

    RETURN jsonb_build_object(

        'success',
        true,

        'safety_enabled',
        cfg.enabled,

        'triggered',
        v_triggered,

        'reason',
        v_reason,

        'sends',
        v_sends,

        'bounces',
        v_bounces,

        'failures',
        v_failures,

        'complaints',
        v_complaints,

        'bounce_rate',
        v_bounce_rate,

        'failure_rate',
        v_failure_rate,

        'complaint_rate',
        v_complaint_rate,

        'minimum_sample_size',
        cfg.minimum_sample_size,

        'max_bounce_rate',
        cfg.max_bounce_rate,

        'max_failure_rate',
        cfg.max_failure_rate,

        'max_complaint_rate',
        cfg.max_complaint_rate

    );

END;
$$;


-- ============================================================
-- 5. MANUAL SAFETY RESET
--
-- IMPORTANT:
-- This DOES NOT turn Master Sending back ON.
--
-- It only acknowledges/clears the safety incident.
-- Master Sending must still be enabled manually afterwards.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reset_email_safety_pause(
    p_note text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE

    previous_reason text;

BEGIN

    SELECT pause_reason
    INTO previous_reason
    FROM public.email_safety_state
    WHERE id = 1;


    UPDATE public.email_safety_state

    SET
        auto_paused =
            false,

        pause_reason =
            null,

        paused_at =
            null,

        reset_at =
            now(),

        reset_note =
            p_note,

        updated_at =
            now()

    WHERE id = 1;


    INSERT INTO public.email_safety_events (

        event_type,
        reason,
        metadata

    )
    VALUES (

        'manual_reset',

        previous_reason,

        jsonb_build_object(
            'note',
            p_note
        )

    );


    RETURN jsonb_build_object(

        'success',
        true,

        'message',
        'Safety incident cleared. Master Sending remains unchanged.'

    );

END;
$$;


-- ============================================================
-- 6. SAFETY DASHBOARD VIEW
-- ============================================================

CREATE OR REPLACE VIEW public.email_safety_status AS

SELECT

    s.auto_paused,

    s.pause_reason,

    s.paused_at,

    s.last_evaluated_at,

    s.sends_in_window,

    s.bounces_in_window,

    s.failures_in_window,

    s.complaints_in_window,

    s.bounce_rate,

    s.failure_rate,

    s.complaint_rate,

    c.enabled AS safety_enabled,

    c.window_hours,

    c.minimum_sample_size,

    c.max_bounce_rate,

    c.max_failure_rate,

    c.max_complaint_rate,

    c.max_complaints_absolute,

    s.reset_at,

    s.updated_at

FROM public.email_safety_state s

CROSS JOIN public.email_safety_config c

WHERE
    s.id = 1
    AND c.id = 1;


COMMENT ON VIEW public.email_safety_status IS
    'Current SlateLane automatic outbound email safety status.';


-- ============================================================
-- 7. UPDATE PRODUCTION SCHEDULER
--
-- Evaluate safety FIRST.
-- Then call the existing email processor.
--
-- If safety trips, Master Sending becomes OFF before
-- /api/email/process is called.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


DO $$
BEGIN

    IF EXISTS (
        SELECT 1
        FROM cron.job
        WHERE jobname =
            'slatelane-email-sequence-processor'
    )
    THEN

        PERFORM cron.unschedule(
            'slatelane-email-sequence-processor'
        );

    END IF;

END
$$;


SELECT cron.schedule(

    'slatelane-email-sequence-processor',

    '*/15 * * * *',

    $cron$

    DO $job$

    BEGIN

        -- ----------------------------------------------
        -- SAFETY FIRST
        -- ----------------------------------------------

        PERFORM
            public.evaluate_email_safety();


        -- ----------------------------------------------
        -- THEN NORMAL EMAIL PROCESSOR
        -- ----------------------------------------------

        PERFORM net.http_post(

            url :=
                'https://www.slatelanedispatch.com/api/email/process',

            headers :=
                jsonb_build_object(

                    'Content-Type',
                    'application/json',

                    'Authorization',
                    'Bearer ' ||
                    (
                        SELECT decrypted_secret

                        FROM vault.decrypted_secrets

                        WHERE name =
                            'slatelane_email_process_secret'

                        LIMIT 1
                    )

                ),

            body :=
                jsonb_build_object(
                    'limit',
                    25
                ),

            timeout_milliseconds :=
                30000

        );

    END

    $job$;

    $cron$

);


COMMIT;