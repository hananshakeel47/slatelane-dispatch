-- ============================================================
-- PHASE 027D
-- Protected 5 -> 20 Production Ramp Transition Gate
--
-- IMPORTANT:
-- This migration does NOT:
--   - enable Master Sending
--   - change pilot limit
--   - change daily send cap
--   - arm the prepared 20-carrier batch
--   - create enrollments
--   - send email
--
-- It only exposes a strict readiness gate.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.email_ramp_20_transition_gate()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    preflight jsonb;
    ready boolean := false;
    reason_text text;
BEGIN

    -- Reuse the existing Phase 027C safety/preflight system.
    preflight := public.email_ramp_20_preflight();

    ready :=
        COALESCE(
            (preflight ->> 'ready_to_promote')::boolean,
            false
        );

    reason_text :=
        COALESCE(
            preflight ->> 'reason',
            CASE
                WHEN ready THEN 'all_transition_checks_passed'
                ELSE 'transition_not_ready'
            END
        );

    RETURN jsonb_build_object(

        'phase',
        '027D-protected-5-to-20-transition',

        'gate_status',
        CASE
            WHEN ready THEN 'READY'
            ELSE 'LOCKED'
        END,

        'ready_to_promote',
        ready,

        'reason',
        reason_text,

        'pilot',
        COALESCE(
            preflight -> 'pilot',
            '{}'::jsonb
        ),

        'safety',
        COALESCE(
            preflight -> 'safety',
            '{}'::jsonb
        ),

        'prepared_capacity',
        COALESCE(
            preflight -> 'future_batch',
            '{}'::jsonb
        ),

        'current_stage',
        COALESCE(
            preflight -> 'current_stage',
            '{}'::jsonb
        ),

        'existing_protection',
        COALESCE(
            preflight -> 'protection',
            '{}'::jsonb
        ),

        'transition_protection',
        jsonb_build_object(
            'changes_capacity', false,
            'changes_daily_cap', false,
            'arms_prepared_batch', false,
            'creates_enrollments', false,
            'enables_master_sending', false,
            'sends_email', false
        ),

        'next_action',
        CASE
            WHEN ready THEN
                'Protected promotion may be authorized.'
            ELSE
                'No promotion allowed. Wait for current pilot to reach terminal state.'
        END,

        'checked_at',
        now()
    );

END;
$$;


COMMENT ON FUNCTION public.email_ramp_20_transition_gate()
IS
'Phase 027D protected 5-to-20 transition readiness gate. Read-only. Does not enable sending, modify capacity, arm batches, create enrollments or transmit email.';


REVOKE ALL
ON FUNCTION public.email_ramp_20_transition_gate()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.email_ramp_20_transition_gate()
TO service_role;


COMMIT;