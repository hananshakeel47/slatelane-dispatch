-- ============================================================
-- PHASE 027D-2
-- Guarded 5 -> 20 Production Capacity Promotion
--
-- This function is intentionally strict.
--
-- It WILL:
--   - require the Phase 027D transition gate to be READY
--   - raise pilot_limit from 5 to 20
--   - raise daily_send_cap from 5 to 20
--
-- It WILL NOT:
--   - enable Master Sending
--   - create leads
--   - create enrollments
--   - transmit email
--   - bypass reply protection
--   - bypass pilot completion
-- ============================================================

BEGIN;


CREATE OR REPLACE FUNCTION public.promote_email_capacity_to_20(
    p_operator_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_gate jsonb;
    v_ready boolean := false;
    v_reason text;

    v_old_pilot_limit integer;
    v_old_daily_cap integer;
    v_old_sending_enabled boolean;

    v_new_pilot_limit integer;
    v_new_daily_cap integer;
    v_new_sending_enabled boolean;
BEGIN

    -- --------------------------------------------------------
    -- 1. Re-run the authoritative transition gate
    -- --------------------------------------------------------

    v_gate :=
        public.email_ramp_20_transition_gate();

    v_ready :=
        COALESCE(
            (v_gate ->> 'ready_to_promote')::boolean,
            false
        );

    v_reason :=
        COALESCE(
            v_gate ->> 'reason',
            'transition_gate_failed'
        );


    -- --------------------------------------------------------
    -- 2. Refuse promotion unless gate is READY
    -- --------------------------------------------------------

    IF NOT v_ready THEN

        RETURN jsonb_build_object(
            'success', false,
            'phase', '027D2-guarded-5-to-20-promotion',
            'promoted', false,
            'gate_status', COALESCE(v_gate ->> 'gate_status', 'LOCKED'),
            'reason', v_reason,
            'message',
                'Capacity promotion refused because the protected transition gate is not READY.',
            'current_gate', v_gate
        );

    END IF;


    -- --------------------------------------------------------
    -- 3. Lock current launch settings row
    -- --------------------------------------------------------

    SELECT
        pilot_limit,
        daily_send_cap,
        sending_enabled
    INTO
        v_old_pilot_limit,
        v_old_daily_cap,
        v_old_sending_enabled
    FROM public.email_launch_settings
    ORDER BY id
    LIMIT 1
    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'email_launch_settings row not found';
    END IF;


    -- --------------------------------------------------------
    -- 4. Require exact expected starting state
    -- --------------------------------------------------------

    IF COALESCE(v_old_pilot_limit, 0) <> 5 THEN

        RETURN jsonb_build_object(
            'success', false,
            'phase', '027D2-guarded-5-to-20-promotion',
            'promoted', false,
            'reason', 'unexpected_current_pilot_limit',
            'current_pilot_limit', v_old_pilot_limit,
            'expected_pilot_limit', 5
        );

    END IF;


    IF COALESCE(v_old_daily_cap, 0) <> 5 THEN

        RETURN jsonb_build_object(
            'success', false,
            'phase', '027D2-guarded-5-to-20-promotion',
            'promoted', false,
            'reason', 'unexpected_current_daily_send_cap',
            'current_daily_send_cap', v_old_daily_cap,
            'expected_daily_send_cap', 5
        );

    END IF;


    -- --------------------------------------------------------
    -- 5. Critical protection:
    -- promotion must NEVER enable sending
    -- --------------------------------------------------------

    IF COALESCE(v_old_sending_enabled, false) = true THEN

        RETURN jsonb_build_object(
            'success', false,
            'phase', '027D2-guarded-5-to-20-promotion',
            'promoted', false,
            'reason', 'master_sending_must_be_off',
            'message',
                'Promotion refused because sending_enabled is unexpectedly TRUE.'
        );

    END IF;


    -- --------------------------------------------------------
    -- 6. Promote CAPACITY ONLY
    -- --------------------------------------------------------

    UPDATE public.email_launch_settings
    SET
        pilot_limit = 20,
        daily_send_cap = 20,
        sending_enabled = false
    WHERE id = (
        SELECT id
        FROM public.email_launch_settings
        ORDER BY id
        LIMIT 1
    );


    -- --------------------------------------------------------
    -- 7. Read back authoritative state
    -- --------------------------------------------------------

    SELECT
        pilot_limit,
        daily_send_cap,
        sending_enabled
    INTO
        v_new_pilot_limit,
        v_new_daily_cap,
        v_new_sending_enabled
    FROM public.email_launch_settings
    ORDER BY id
    LIMIT 1;


    -- --------------------------------------------------------
    -- 8. Return immutable audit-style result
    -- --------------------------------------------------------

    RETURN jsonb_build_object(

        'success', true,

        'phase',
        '027D2-guarded-5-to-20-promotion',

        'promoted',
        true,

        'operator_note',
        NULLIF(trim(p_operator_note), ''),

        'previous_state',
        jsonb_build_object(
            'pilot_limit', v_old_pilot_limit,
            'daily_send_cap', v_old_daily_cap,
            'master_sending', v_old_sending_enabled
        ),

        'new_state',
        jsonb_build_object(
            'pilot_limit', v_new_pilot_limit,
            'daily_send_cap', v_new_daily_cap,
            'master_sending', v_new_sending_enabled
        ),

        'protection',
        jsonb_build_object(
            'master_sending_enabled', false,
            'creates_leads', false,
            'creates_enrollments', false,
            'sends_email', false,
            'bypasses_reply_protection', false
        ),

        'message',
        'Capacity promoted from 5 to 20. Master Sending remains OFF.',

        'promoted_at',
        now()
    );

END;
$$;


COMMENT ON FUNCTION public.promote_email_capacity_to_20(text)
IS
'Phase 027D-2 protected capacity promotion. Requires transition gate READY. Changes pilot_limit and daily_send_cap from 5 to 20 while explicitly keeping Master Sending OFF.';


REVOKE ALL
ON FUNCTION public.promote_email_capacity_to_20(text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.promote_email_capacity_to_20(text)
TO service_role;


COMMIT;