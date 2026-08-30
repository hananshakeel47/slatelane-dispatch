-- ============================================================
-- SLATELANE DISPATCH
-- PHASE 023 — CONTROLLED PRODUCTION RAMP
--
-- Goal:
--   Move from the successful 5-carrier recovery pilot
--   into a carefully controlled 20-send/day production ramp.
--
-- IMPORTANT:
--   Master Sending intentionally remains OFF.
--   This migration sends ZERO emails.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Configure conservative production ramp
-- ------------------------------------------------------------

UPDATE public.email_launch_settings
SET
    -- MASTER SENDING REMAINS OFF
    sending_enabled = false,

    -- Production ramp limits
    daily_send_cap = 20,
    max_batch_size = 2,

    -- Carrier quality requirement
    minimum_carrier_score = 80,

    -- Mandatory carrier requirements
    require_active_authority = true,
    require_email = true,

    -- Automatic exclusions
    skip_replied = true,
    skip_bounced = true,
    skip_complained = true,
    skip_opted_out = true,

    -- Continue operating under pilot protection
    pilot_mode = true,
    pilot_limit = 20,

    notes =
        'Phase 023 controlled production ramp. '
        'Daily cap 20. Processor batch 2. Minimum carrier score 80. '
        'Pilot mode remains enabled. '
        'Replied, bounced, complained and opted-out leads excluded. '
        'Master Sending intentionally remains OFF until final ramp authorization.',

    updated_at = now()

WHERE id = (
    SELECT id
    FROM public.email_launch_settings
    ORDER BY id
    LIMIT 1
);

-- ------------------------------------------------------------
-- 2. Safety assertion
--
-- Abort migration if Master Sending somehow became enabled.
-- ------------------------------------------------------------

DO $$
DECLARE
    v_enabled boolean;
BEGIN
    SELECT sending_enabled
    INTO v_enabled
    FROM public.email_launch_settings
    ORDER BY id
    LIMIT 1;

    IF COALESCE(v_enabled, false) = true THEN
        RAISE EXCEPTION
            'PHASE 023 ABORTED: Master Sending must remain OFF.';
    END IF;
END;
$$;

COMMIT;


-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT
    id,
    sending_enabled,
    daily_send_cap,
    max_batch_size,
    minimum_carrier_score,
    require_active_authority,
    require_email,
    skip_replied,
    skip_bounced,
    skip_complained,
    skip_opted_out,
    pilot_mode,
    pilot_limit,
    sending_hour_start,
    sending_hour_end,
    sending_timezone,
    updated_at
FROM public.email_launch_settings
ORDER BY id
LIMIT 1;


-- ============================================================
-- SAFETY STATUS
-- ============================================================

SELECT
    auto_paused,
    pause_reason,
    sends_in_window,
    bounces_in_window,
    failures_in_window,
    complaints_in_window,
    safety_enabled,
    max_bounce_rate,
    max_failure_rate,
    max_complaint_rate,
    last_evaluated_at
FROM public.email_safety_status;


-- ============================================================
-- CURRENT PILOT STATUS
-- We check this before preparing the next carrier group.
-- ============================================================

SELECT
    id,
    status,
    requested_count,
    prepared_count,
    minimum_score,
    prepared_at,
    armed_at,
    cancelled_at,
    created_at
FROM public.email_pilot_batches
ORDER BY created_at DESC
LIMIT 5;


-- ============================================================
-- CURRENT SEQUENCE ENROLLMENTS
-- ============================================================

SELECT
    status,
    COUNT(*) AS total
FROM public.email_sequence_enrollments
GROUP BY status
ORDER BY status;