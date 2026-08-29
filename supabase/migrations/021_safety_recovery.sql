BEGIN;


-- ============================================================
-- PHASE 021
-- SAFE RECOVERY + CONTROLLED RELAUNCH
-- ============================================================


-- ============================================================
-- 1. RECOVERY AUDIT HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_safety_recovery_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    event_type TEXT NOT NULL,

    previous_pause_reason TEXT,

    note TEXT,

    snapshot JSONB NOT NULL
        DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    email_safety_recovery_events_created_idx
ON public.email_safety_recovery_events (
    created_at DESC
);


-- ============================================================
-- 2. RECOVERY READINESS CHECK
--
-- This function NEVER resets the safety lock.
--
-- It only answers:
-- "Is SlateLane safe enough to allow a manual reset?"
-- ============================================================

CREATE OR REPLACE FUNCTION
public.email_safety_recovery_readiness()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE

    v_auto_paused BOOLEAN := false;

    v_pause_reason TEXT;

    v_paused_at TIMESTAMPTZ;

    v_last_evaluated_at TIMESTAMPTZ;


    v_sends INTEGER := 0;

    v_bounces INTEGER := 0;

    v_failures INTEGER := 0;

    v_complaints INTEGER := 0;


    v_bounce_rate NUMERIC := 0;

    v_failure_rate NUMERIC := 0;

    v_complaint_rate NUMERIC := 0;


    v_active_enrollments INTEGER := 0;

    v_unfinished_pilots INTEGER := 0;


    /*
     * These match the protection limits currently
     * used by SlateLane Safety Center.
     */

    v_bounce_limit NUMERIC := 0.05;

    v_failure_limit NUMERIC := 0.10;

    v_complaint_limit NUMERIC := 0.003;


    v_ready BOOLEAN := false;

    v_reason TEXT := 'unknown';

BEGIN


    -- --------------------------------------------------------
    -- Refresh current safety metrics first.
    -- --------------------------------------------------------

    PERFORM public.evaluate_email_safety();


    -- --------------------------------------------------------
    -- Load current safety status.
    -- --------------------------------------------------------

    SELECT

        COALESCE(auto_paused, false),

        pause_reason,

        paused_at,

        last_evaluated_at,

        COALESCE(sends_in_window, 0),

        COALESCE(bounces_in_window, 0),

        COALESCE(failures_in_window, 0),

        COALESCE(complaints_in_window, 0)

    INTO

        v_auto_paused,

        v_pause_reason,

        v_paused_at,

        v_last_evaluated_at,

        v_sends,

        v_bounces,

        v_failures,

        v_complaints

    FROM public.email_safety_status

    ORDER BY
        last_evaluated_at DESC
        NULLS LAST

    LIMIT 1;


    -- --------------------------------------------------------
    -- Calculate rolling rates.
    -- --------------------------------------------------------

    IF v_sends > 0 THEN

        v_bounce_rate :=
            v_bounces::NUMERIC
            /
            v_sends::NUMERIC;


        v_failure_rate :=
            v_failures::NUMERIC
            /
            v_sends::NUMERIC;


        v_complaint_rate :=
            v_complaints::NUMERIC
            /
            v_sends::NUMERIC;

    ELSE

        v_bounce_rate := 0;

        v_failure_rate := 0;

        v_complaint_rate := 0;

    END IF;


    -- --------------------------------------------------------
    -- Count active sequence enrollments.
    --
    -- Recovery should NOT reset the safety lock while an old
    -- campaign is still actively queued.
    -- --------------------------------------------------------

    SELECT COUNT(*)

    INTO v_active_enrollments

    FROM public.email_sequence_enrollments

    WHERE status = 'active';


    -- --------------------------------------------------------
    -- Count unfinished pilots.
    --
    -- A new recovery launch should start from a clean pilot,
    -- not silently resume an old prepared/armed pilot.
    -- --------------------------------------------------------

    SELECT COUNT(*)

    INTO v_unfinished_pilots

    FROM public.email_pilot_batches

    WHERE status IN (
        'prepared',
        'armed'
    );


    -- ========================================================
    -- READINESS DECISION
    -- ========================================================

    IF NOT v_auto_paused THEN

        v_ready := false;

        v_reason :=
            'safety_not_currently_paused';


    ELSIF v_active_enrollments > 0 THEN

        v_ready := false;

        v_reason :=
            'active_enrollments_must_be_stopped';


    ELSIF v_unfinished_pilots > 0 THEN

        v_ready := false;

        v_reason :=
            'unfinished_pilot_must_be_cancelled';


    ELSIF v_bounce_rate > v_bounce_limit THEN

        v_ready := false;

        v_reason :=
            'bounce_rate_still_too_high';


    ELSIF v_failure_rate > v_failure_limit THEN

        v_ready := false;

        v_reason :=
            'failure_rate_still_too_high';


    ELSIF v_complaint_rate > v_complaint_limit THEN

        v_ready := false;

        v_reason :=
            'complaint_rate_still_too_high';


    ELSE

        v_ready := true;

        v_reason :=
            'ready_for_manual_recovery';

    END IF;


    -- ========================================================
    -- RESULT
    -- ========================================================

    RETURN jsonb_build_object(

        'success',
        true,

        'ready',
        v_ready,

        'reason',
        v_reason,


        'auto_paused',
        v_auto_paused,

        'pause_reason',
        v_pause_reason,

        'paused_at',
        v_paused_at,

        'last_evaluated_at',
        v_last_evaluated_at,


        'sends',
        v_sends,

        'bounces',
        v_bounces,

        'failures',
        v_failures,

        'complaints',
        v_complaints,


        'bounce_rate',
        ROUND(
            v_bounce_rate * 100,
            2
        ),

        'bounce_limit',
        ROUND(
            v_bounce_limit * 100,
            2
        ),


        'failure_rate',
        ROUND(
            v_failure_rate * 100,
            2
        ),

        'failure_limit',
        ROUND(
            v_failure_limit * 100,
            2
        ),


        'complaint_rate',
        ROUND(
            v_complaint_rate * 100,
            3
        ),

        'complaint_limit',
        ROUND(
            v_complaint_limit * 100,
            3
        ),


        'active_enrollments',
        v_active_enrollments,

        'unfinished_pilots',
        v_unfinished_pilots

    );

END;
$$;


-- ============================================================
-- 3. PROTECTED MANUAL RESET
--
-- IMPORTANT:
--
-- This does NOT:
--   - enable Master Sending
--   - arm a pilot
--   - resume enrollments
--   - send an email
--
-- It only clears the GLOBAL safety lock after all recovery
-- requirements pass.
-- ============================================================

CREATE OR REPLACE FUNCTION
public.reset_email_safety_after_recovery(
    p_confirmation TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE

    v_confirmation TEXT;

    v_readiness JSONB;

    v_ready BOOLEAN := false;

    v_reason TEXT;

    v_previous_pause_reason TEXT;

BEGIN


    v_confirmation :=
        upper(
            trim(
                COALESCE(
                    p_confirmation,
                    ''
                )
            )
        );


    -- --------------------------------------------------------
    -- Require explicit confirmation.
    -- --------------------------------------------------------

    IF v_confirmation <> 'RESET SAFETY' THEN

        RETURN jsonb_build_object(

            'success',
            false,

            'reset',
            false,

            'reason',
            'confirmation_required',

            'message',
            'Type RESET SAFETY exactly.'

        );

    END IF;


    -- --------------------------------------------------------
    -- Evaluate recovery readiness.
    -- --------------------------------------------------------

    v_readiness :=
        public.email_safety_recovery_readiness();


    v_ready :=
        COALESCE(
            (
                v_readiness
                ->>
                'ready'
            )::BOOLEAN,
            false
        );


    v_reason :=
        COALESCE(
            v_readiness
            ->>
            'reason',
            'unknown'
        );


    SELECT pause_reason

    INTO v_previous_pause_reason

    FROM public.email_safety_status

    ORDER BY
        last_evaluated_at DESC
        NULLS LAST

    LIMIT 1;


    -- --------------------------------------------------------
    -- Block unsafe reset attempts and record them.
    -- --------------------------------------------------------

    IF NOT v_ready THEN


        INSERT INTO
        public.email_safety_recovery_events (
            event_type,
            previous_pause_reason,
            note,
            snapshot
        )
        VALUES (
            'reset_blocked',
            v_previous_pause_reason,
            p_note,
            v_readiness
        );


        RETURN jsonb_build_object(

            'success',
            false,

            'reset',
            false,

            'reason',
            v_reason,

            'message',
            'Safety recovery requirements have not passed.',

            'readiness',
            v_readiness

        );

    END IF;


    -- --------------------------------------------------------
    -- Record successful recovery before changing state.
    -- --------------------------------------------------------

    INSERT INTO
    public.email_safety_recovery_events (
        event_type,
        previous_pause_reason,
        note,
        snapshot
    )
    VALUES (
        'reset',
        v_previous_pause_reason,
        p_note,
        v_readiness
    );


    -- --------------------------------------------------------
    -- Clear ONLY automatic safety lock.
    --
    -- Master Sending remains controlled separately.
    -- --------------------------------------------------------

    UPDATE public.email_safety_status

    SET

        auto_paused = false,

        pause_reason = NULL,

        paused_at = NULL,

        last_evaluated_at = now();


    RETURN jsonb_build_object(

        'success',
        true,

        'reset',
        true,

        'reason',
        'safety_lock_cleared',

        'message',
        'Global Safety Center lock was cleared. Master Sending was not enabled.',

        'master_sending_changed',
        false,

        'readiness',
        v_readiness

    );

END;
$$;


-- ============================================================
-- 4. PERMISSIONS
--
-- Recovery functions should not be callable directly by
-- anonymous/public clients.
-- ============================================================

REVOKE ALL
ON FUNCTION
public.email_safety_recovery_readiness()
FROM PUBLIC;


REVOKE ALL
ON FUNCTION
public.reset_email_safety_after_recovery(
    TEXT,
    TEXT
)
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION
public.email_safety_recovery_readiness()
TO service_role;


GRANT EXECUTE
ON FUNCTION
public.reset_email_safety_after_recovery(
    TEXT,
    TEXT
)
TO service_role;


COMMIT;