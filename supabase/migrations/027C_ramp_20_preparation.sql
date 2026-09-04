-- ============================================================
-- PHASE 027C
-- 20-CARRIER RAMP PREPARATION
--
-- PURPOSE
--   1. Build a safe preview of future 20-carrier candidates.
--   2. Verify the current 5-carrier pilot has completed safely.
--   3. Verify automation / reply protection remains healthy.
--   4. Provide a protected operator-only promotion function.
--
-- IMPORTANT
--   - Does NOT send email.
--   - Does NOT create enrollments.
--   - Does NOT create a pilot batch.
--   - Does NOT enable Master Sending.
--   - Does NOT modify the current running pilot.
-- ============================================================

BEGIN;


-- ============================================================
-- 1. PROMOTION AUDIT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_ramp_promotion_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    from_limit integer,
    to_limit integer NOT NULL,

    action text NOT NULL,

    operator_note text,

    readiness_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

    settings_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
email_ramp_promotion_audit_created_at_idx
ON public.email_ramp_promotion_audit(created_at DESC);


-- ============================================================
-- 2. FUTURE 20-CARRIER CANDIDATE PREVIEW
--
-- IMPORTANT:
-- This is READ-ONLY.
--
-- A carrier is excluded if:
--   - authority is not active
--   - email is missing
--   - score is below current production minimum
--   - carrier already exists as a lead by DOT
--   - carrier already exists as a lead by email
--
-- This intentionally favors NEW prospects for the next batch.
-- ============================================================

CREATE OR REPLACE VIEW public.email_ramp_20_candidate_preview
AS

WITH settings AS (

    SELECT
        minimum_carrier_score

    FROM public.email_launch_settings

    ORDER BY id

    LIMIT 1
)

SELECT

    c.dot_number,
    c.legal_name,
    c.email,
    c.phone,
    c.mc_number,
    c.lead_score,
    c.status_code

FROM public.carriers c

CROSS JOIN settings s

WHERE

    -- Must have active authority.
    c.status_code = 'A'

    -- Must have a usable email.
    AND NULLIF(
        BTRIM(c.email),
        ''
    ) IS NOT NULL

    -- Must meet current production score requirement.
    AND COALESCE(
        c.lead_score,
        0
    ) >= COALESCE(
        s.minimum_carrier_score,
        80
    )

    -- Do not select an existing lead with the same DOT.
    AND NOT EXISTS (

        SELECT 1

        FROM public.leads l

        WHERE
            l.carrier_dot_number =
            c.dot_number
    )

    -- Do not select an existing lead with the same email.
    AND NOT EXISTS (

        SELECT 1

        FROM public.leads l

        WHERE
            l.email IS NOT NULL

            AND LOWER(
                BTRIM(l.email)
            ) =
            LOWER(
                BTRIM(c.email)
            )
    )

ORDER BY

    c.lead_score DESC NULLS LAST,
    c.dot_number ASC

LIMIT 100;


-- ============================================================
-- 3. PHASE 027C PREFLIGHT
--
-- Returns the complete readiness state for promotion from
-- the current 5-carrier stage to the future 20-carrier stage.
-- ============================================================

CREATE OR REPLACE FUNCTION public.email_ramp_20_preflight()
RETURNS jsonb

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = public, cron

AS $$

DECLARE

    v_current_pilot_limit integer := 0;
    v_daily_send_cap integer := 0;
    v_max_batch_size integer := 0;
    v_sending_enabled boolean := false;
    v_pilot_mode boolean := false;

    v_ramp_stage integer := 0;
    v_ramp_target integer := 0;
    v_ready_for_20 boolean := false;
    v_ramp_reason text := null;

    v_latest_pilot_status text := null;
    v_latest_pilot_id uuid := null;

    v_unsafe_replied_leads integer := 0;

    v_processor_cron_active integer := 0;
    v_completion_watcher_active integer := 0;

    v_candidate_count integer := 0;

    v_ready_to_promote boolean := false;

    v_reason text := null;

BEGIN


    -- --------------------------------------------------------
    -- CURRENT LAUNCH SETTINGS
    -- --------------------------------------------------------

    SELECT

        COALESCE(
            els.pilot_limit,
            0
        ),

        COALESCE(
            els.daily_send_cap,
            0
        ),

        COALESCE(
            els.max_batch_size,
            0
        ),

        COALESCE(
            els.sending_enabled,
            false
        ),

        COALESCE(
            els.pilot_mode,
            false
        )

    INTO

        v_current_pilot_limit,
        v_daily_send_cap,
        v_max_batch_size,
        v_sending_enabled,
        v_pilot_mode

    FROM public.email_launch_settings els

    ORDER BY els.id

    LIMIT 1;


    -- --------------------------------------------------------
    -- CURRENT RAMP READINESS
    -- --------------------------------------------------------

    SELECT

        COALESCE(
            ers.ramp_stage,
            0
        ),

        COALESCE(
            ers.ramp_target,
            0
        ),

        COALESCE(
            ers.ready_for_20,
            false
        ),

        ers.readiness_reason

    INTO

        v_ramp_stage,
        v_ramp_target,
        v_ready_for_20,
        v_ramp_reason

    FROM public.email_ramp_status ers

    LIMIT 1;


    -- --------------------------------------------------------
    -- LATEST PILOT
    -- --------------------------------------------------------

    SELECT

        epb.id,
        epb.status

    INTO

        v_latest_pilot_id,
        v_latest_pilot_status

    FROM public.email_pilot_batches epb

    ORDER BY epb.created_at DESC

    LIMIT 1;


    -- --------------------------------------------------------
    -- REPLY AUTO-STOP SAFETY
    -- --------------------------------------------------------

    SELECT

        COALESCE(
            eris.replied_leads_still_running,
            0
        )

    INTO

        v_unsafe_replied_leads

    FROM public.email_reply_integrity_status eris

    LIMIT 1;


    -- --------------------------------------------------------
    -- EMAIL PROCESSOR CRON
    -- --------------------------------------------------------

    SELECT COUNT(*)

    INTO v_processor_cron_active

    FROM cron.job

    WHERE

        jobname =
        'slatelane-email-sequence-processor'

        AND active = true;


    -- --------------------------------------------------------
    -- PILOT COMPLETION WATCHER
    -- --------------------------------------------------------

    SELECT COUNT(*)

    INTO v_completion_watcher_active

    FROM cron.job

    WHERE

        jobname =
        'slatelane-pilot-completion-watcher'

        AND active = true;


    -- --------------------------------------------------------
    -- FUTURE CANDIDATE SUPPLY
    -- --------------------------------------------------------

    SELECT COUNT(*)

    INTO v_candidate_count

    FROM public.email_ramp_20_candidate_preview;


    -- ========================================================
    -- FINAL GATE
    -- ========================================================

    v_ready_to_promote :=

        COALESCE(
            v_ready_for_20,
            false
        )

        AND COALESCE(
            v_latest_pilot_status,
            ''
        ) IN (
            'completed',
            'complete'
        )

        AND v_unsafe_replied_leads = 0

        AND v_processor_cron_active > 0

        AND v_completion_watcher_active > 0

        AND v_candidate_count >= 20;


    -- ========================================================
    -- HUMAN-READABLE REASON
    -- ========================================================

    v_reason :=

        CASE

            WHEN COALESCE(
                v_latest_pilot_status,
                ''
            ) NOT IN (
                'completed',
                'complete'
            )
            THEN
                'current_pilot_still_running'


            WHEN COALESCE(
                v_ready_for_20,
                false
            ) = false
            THEN
                COALESCE(
                    v_ramp_reason,
                    'ramp_readiness_not_passed'
                )


            WHEN v_unsafe_replied_leads > 0
            THEN
                'unsafe_replied_leads'


            WHEN v_processor_cron_active = 0
            THEN
                'email_processor_cron_inactive'


            WHEN v_completion_watcher_active = 0
            THEN
                'pilot_completion_watcher_inactive'


            WHEN v_candidate_count < 20
            THEN
                'insufficient_eligible_carriers'


            ELSE
                'ready_for_20_carrier_promotion'

        END;


    RETURN jsonb_build_object(

        'phase',
        '027C-20-carrier-ramp-preparation',

        'ready_to_promote',
        v_ready_to_promote,

        'reason',
        v_reason,

        'current_stage',
        jsonb_build_object(

            'ramp_stage',
            v_ramp_stage,

            'ramp_target',
            v_ramp_target,

            'pilot_limit',
            v_current_pilot_limit,

            'daily_send_cap',
            v_daily_send_cap,

            'max_batch_size',
            v_max_batch_size,

            'pilot_mode',
            v_pilot_mode,

            'master_sending',
            v_sending_enabled

        ),

        'pilot',
        jsonb_build_object(

            'batch_id',
            v_latest_pilot_id,

            'status',
            v_latest_pilot_status,

            'ready_for_20',
            v_ready_for_20,

            'ramp_reason',
            v_ramp_reason

        ),

        'safety',
        jsonb_build_object(

            'unsafe_replied_leads',
            v_unsafe_replied_leads,

            'processor_cron_active',
            v_processor_cron_active > 0,

            'completion_watcher_active',
            v_completion_watcher_active > 0

        ),

        'future_batch',
        jsonb_build_object(

            'target',
            20,

            'eligible_candidates',
            v_candidate_count,

            'candidate_supply_ready',
            v_candidate_count >= 20

        ),

        'protection',
        jsonb_build_object(

            'creates_batch',
            false,

            'creates_enrollments',
            false,

            'sends_email',
            false,

            'enables_master_sending',
            false

        )

    );

END;

$$;


-- ============================================================
-- 4. PROTECTED PROMOTION FUNCTION
--
-- This function may ONLY be used after 027C preflight passes.
--
-- It changes CAPACITY ONLY.
--
-- It explicitly leaves sending_enabled = FALSE.
--
-- It DOES NOT:
--   - send email
--   - create leads
--   - create enrollments
--   - prepare a pilot batch
-- ============================================================

CREATE OR REPLACE FUNCTION public.promote_email_ramp_to_20(
    p_operator_note text DEFAULT NULL
)

RETURNS jsonb

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = public, cron

AS $$

DECLARE

    v_gate jsonb;

    v_ready boolean := false;

    v_old_limit integer := 0;

    v_new_settings jsonb;

BEGIN


    -- --------------------------------------------------------
    -- CHECK THE GATE FIRST
    -- --------------------------------------------------------

    v_gate :=
        public.email_ramp_20_preflight();


    v_ready :=
        COALESCE(
            (
                v_gate ->
                'ready_to_promote'
            )::text::boolean,
            false
        );


    IF v_ready = false THEN

        RAISE EXCEPTION
            '20-carrier promotion is locked. Reason: %',
            COALESCE(
                v_gate ->> 'reason',
                'unknown'
            );

    END IF;


    -- --------------------------------------------------------
    -- RECORD CURRENT LIMIT
    -- --------------------------------------------------------

    SELECT

        COALESCE(
            pilot_limit,
            0
        )

    INTO v_old_limit

    FROM public.email_launch_settings

    ORDER BY id

    LIMIT 1;


    -- --------------------------------------------------------
    -- PROMOTE CAPACITY
    --
    -- MASTER SENDING REMAINS OFF.
    -- --------------------------------------------------------

    UPDATE public.email_launch_settings

    SET

        pilot_limit = 20,

        daily_send_cap = 20,

        max_batch_size = 2,

        pilot_mode = true,

        sending_enabled = false

    WHERE id = (

        SELECT id

        FROM public.email_launch_settings

        ORDER BY id

        LIMIT 1

    );


    -- --------------------------------------------------------
    -- POST-PROMOTION SETTINGS SNAPSHOT
    -- --------------------------------------------------------

    SELECT jsonb_build_object(

        'pilot_limit',
        pilot_limit,

        'daily_send_cap',
        daily_send_cap,

        'max_batch_size',
        max_batch_size,

        'pilot_mode',
        pilot_mode,

        'sending_enabled',
        sending_enabled

    )

    INTO v_new_settings

    FROM public.email_launch_settings

    ORDER BY id

    LIMIT 1;


    -- --------------------------------------------------------
    -- IMMUTABLE AUDIT RECORD
    -- --------------------------------------------------------

    INSERT INTO public.email_ramp_promotion_audit (

        from_limit,
        to_limit,
        action,
        operator_note,
        readiness_snapshot,
        settings_snapshot

    )

    VALUES (

        v_old_limit,
        20,
        'PROMOTE_TO_20',
        NULLIF(
            BTRIM(
                COALESCE(
                    p_operator_note,
                    ''
                )
            ),
            ''
        ),
        v_gate,
        v_new_settings

    );


    RETURN jsonb_build_object(

        'success',
        true,

        'phase',
        '027C-20-carrier-ramp-preparation',

        'message',
        'Capacity promoted to 20. Master Sending remains OFF.',

        'previous_limit',
        v_old_limit,

        'new_limit',
        20,

        'settings',
        v_new_settings,

        'email_sent',
        false,

        'pilot_created',
        false

    );

END;

$$;


-- ============================================================
-- 5. PERMISSIONS
-- ============================================================

REVOKE ALL
ON FUNCTION public.email_ramp_20_preflight()
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.email_ramp_20_preflight()
TO service_role;


REVOKE ALL
ON FUNCTION public.promote_email_ramp_to_20(text)
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.promote_email_ramp_to_20(text)
TO service_role;


GRANT SELECT
ON public.email_ramp_20_candidate_preview
TO service_role;


GRANT SELECT, INSERT
ON public.email_ramp_promotion_audit
TO service_role;


COMMIT;