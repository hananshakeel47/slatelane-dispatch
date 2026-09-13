-- ============================================================
-- PHASE 027D-3
-- Automatic Promotion Readiness +
-- Prepared 20-Carrier Batch Activation Protection
--
-- PURPOSE
-- ------------------------------------------------------------
-- The existing pilot completion watcher automatically detects
-- when the current 5-carrier pilot reaches terminal state.
--
-- This phase creates the final PRE-ACTIVATION gate between:
--
--     5-carrier pilot
--             ↓
--     pilot terminal
--             ↓
--     transition gate READY
--             ↓
--     prepared 20-carrier batch verified
--             ↓
--     capacity promotion allowed
--
-- IMPORTANT:
-- This migration DOES NOT:
--   - send email
--   - enable Master Sending
--   - create enrollments
--   - activate prepared carriers
--   - modify pilot state
--   - change send limits
--
-- It only proves whether activation would be safe.
-- ============================================================

BEGIN;


-- ============================================================
-- 1. FINAL 20-CARRIER ACTIVATION PREFLIGHT
-- ============================================================

CREATE OR REPLACE FUNCTION public.email_ramp_20_activation_preflight()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transition jsonb;

    v_transition_ready boolean := false;
    v_transition_reason text := 'unknown';

    v_sending_enabled boolean;
    v_daily_send_cap integer;
    v_max_batch_size integer;
    v_pilot_mode boolean;
    v_pilot_limit integer;

    v_batch_id uuid;
    v_batch_status text;
    v_ramp_target integer;
    v_prepared_count integer;
    v_cancelled_at timestamptz;

    v_batch_ready boolean := false;
    v_launch_state_safe boolean := false;
    v_ready boolean := false;

    v_reason text;
BEGIN

    -- --------------------------------------------------------
    -- A. Run authoritative Phase 027D transition gate
    -- --------------------------------------------------------

    v_transition :=
        public.email_ramp_20_transition_gate();

    v_transition_ready :=
        COALESCE(
            (v_transition ->> 'ready_to_promote')::boolean,
            false
        );

    v_transition_reason :=
        COALESCE(
            v_transition ->> 'reason',
            'transition_gate_not_ready'
        );


    -- --------------------------------------------------------
    -- B. Read current production launch state
    -- --------------------------------------------------------

    SELECT
        sending_enabled,
        daily_send_cap,
        max_batch_size,
        pilot_mode,
        pilot_limit
    INTO
        v_sending_enabled,
        v_daily_send_cap,
        v_max_batch_size,
        v_pilot_mode,
        v_pilot_limit
    FROM public.email_launch_settings
    ORDER BY id
    LIMIT 1;


    IF NOT FOUND THEN

        RETURN jsonb_build_object(
            'success', false,
            'phase', '027D3-automatic-promotion-readiness',
            'ready_for_activation', false,
            'reason', 'email_launch_settings_missing'
        );

    END IF;


    -- --------------------------------------------------------
    -- C. Read latest non-cancelled prepared 20-carrier batch
    -- --------------------------------------------------------

    SELECT
        batch_id,
        status,
        ramp_target,
        prepared_count,
        cancelled_at
    INTO
        v_batch_id,
        v_batch_status,
        v_ramp_target,
        v_prepared_count,
        v_cancelled_at
    FROM public.email_ramp_20_prepared_status
    WHERE
        cancelled_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;


    -- --------------------------------------------------------
    -- D. Verify prepared batch
    -- --------------------------------------------------------

    v_batch_ready :=
        v_batch_id IS NOT NULL
        AND COALESCE(v_batch_status, '') = 'prepared'
        AND COALESCE(v_ramp_target, 0) = 20
        AND COALESCE(v_prepared_count, 0) = 20
        AND v_cancelled_at IS NULL;


    -- --------------------------------------------------------
    -- E. Verify launch configuration remains protected
    --
    -- We REQUIRE the system to still be at the old 5-carrier
    -- capacity here. This prevents stale or partially modified
    -- configuration from being promoted.
    -- --------------------------------------------------------

    v_launch_state_safe :=
        COALESCE(v_sending_enabled, false) = false
        AND COALESCE(v_pilot_mode, false) = true
        AND COALESCE(v_pilot_limit, 0) = 5
        AND COALESCE(v_daily_send_cap, 0) = 5;


    -- --------------------------------------------------------
    -- F. Final readiness
    -- --------------------------------------------------------

    v_ready :=
        v_transition_ready
        AND v_batch_ready
        AND v_launch_state_safe;


    -- --------------------------------------------------------
    -- G. Human-readable blocking reason
    -- --------------------------------------------------------

    IF NOT v_transition_ready THEN

        v_reason :=
            v_transition_reason;

    ELSIF NOT v_batch_ready THEN

        v_reason :=
            'prepared_20_carrier_batch_not_ready';

    ELSIF COALESCE(v_sending_enabled, false) = true THEN

        v_reason :=
            'master_sending_unexpectedly_enabled';

    ELSIF COALESCE(v_pilot_mode, false) = false THEN

        v_reason :=
            'pilot_mode_unexpectedly_disabled';

    ELSIF COALESCE(v_pilot_limit, 0) <> 5 THEN

        v_reason :=
            'unexpected_pilot_limit';

    ELSIF COALESCE(v_daily_send_cap, 0) <> 5 THEN

        v_reason :=
            'unexpected_daily_send_cap';

    ELSE

        v_reason :=
            'ready_for_guarded_20_carrier_activation';

    END IF;


    -- --------------------------------------------------------
    -- H. Return complete operational state
    -- --------------------------------------------------------

    RETURN jsonb_build_object(

        'success',
        true,

        'phase',
        '027D3-automatic-promotion-readiness',

        'gate_status',
        CASE
            WHEN v_ready THEN 'READY'
            ELSE 'LOCKED'
        END,

        'ready_for_activation',
        v_ready,

        'reason',
        v_reason,

        'current_pilot_transition',
        jsonb_build_object(
            'ready', v_transition_ready,
            'reason', v_transition_reason,
            'gate', v_transition
        ),

        'prepared_batch',
        jsonb_build_object(
            'batch_id', v_batch_id,
            'status', v_batch_status,
            'target', v_ramp_target,
            'prepared_count', v_prepared_count,
            'cancelled', v_cancelled_at IS NOT NULL,
            'ready', v_batch_ready
        ),

        'current_launch_state',
        jsonb_build_object(
            'master_sending', v_sending_enabled,
            'pilot_mode', v_pilot_mode,
            'pilot_limit', v_pilot_limit,
            'daily_send_cap', v_daily_send_cap,
            'max_batch_size', v_max_batch_size,
            'protected_state_valid', v_launch_state_safe
        ),

        'activation_protection',
        jsonb_build_object(
            'sends_email', false,
            'creates_leads', false,
            'creates_enrollments', false,
            'activates_batch', false,
            'changes_capacity', false,
            'changes_daily_cap', false,
            'enables_master_sending', false
        ),

        'next_action',
        CASE
            WHEN v_ready THEN
                'Protected 20-carrier activation may proceed.'
            ELSE
                'No activation allowed. Continue current protected state.'
        END,

        'checked_at',
        now()
    );

END;
$$;


COMMENT ON FUNCTION public.email_ramp_20_activation_preflight()
IS
'Phase 027D-3 final pre-activation safety gate for the protected transition from 5-carrier pilot capacity to prepared 20-carrier capacity. Read-only and incapable of sending email or activating carriers.';


REVOKE ALL
ON FUNCTION public.email_ramp_20_activation_preflight()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.email_ramp_20_activation_preflight()
TO service_role;


-- ============================================================
-- 2. READABLE STATUS VIEW
-- ============================================================

CREATE OR REPLACE VIEW public.email_ramp_20_activation_status
AS

SELECT
    result ->> 'gate_status'
        AS gate_status,

    COALESCE(
        (result ->> 'ready_for_activation')::boolean,
        false
    )
        AS ready_for_activation,

    result ->> 'reason'
        AS reason,

    result -> 'prepared_batch' ->> 'batch_id'
        AS prepared_batch_id,

    COALESCE(
        (result -> 'prepared_batch' ->> 'prepared_count')::integer,
        0
    )
        AS prepared_count,

    COALESCE(
        (result -> 'current_launch_state' ->> 'pilot_limit')::integer,
        0
    )
        AS pilot_limit,

    COALESCE(
        (result -> 'current_launch_state' ->> 'daily_send_cap')::integer,
        0
    )
        AS daily_send_cap,

    COALESCE(
        (result -> 'current_launch_state' ->> 'master_sending')::boolean,
        false
    )
        AS master_sending,

    result ->> 'next_action'
        AS next_action,

    result ->> 'checked_at'
        AS checked_at

FROM (
    SELECT
        public.email_ramp_20_activation_preflight()
            AS result
) x;


COMMENT ON VIEW public.email_ramp_20_activation_status
IS
'Phase 027D-3 operational view showing whether protected 20-carrier activation is currently allowed.';


COMMIT;