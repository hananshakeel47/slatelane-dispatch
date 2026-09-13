-- ============================================================
-- PHASE 027E
-- MATERIALIZE PROTECTED 20-CARRIER RAMP BATCH
--
-- PURPOSE
--   Convert the exact frozen Phase 027C ramp batch into a
--   standard SlateLane pilot batch.
--
-- SAFETY
--   - Exact frozen carrier snapshot only
--   - Master Sending MUST remain OFF
--   - No email is transmitted here
--   - Enrollments are created PAUSED
--   - Existing leads cause a hard stop
--   - Suppressed carriers cause a hard stop
--   - Replied-lead integrity must be clean
--   - Idempotent
-- ============================================================


-- ============================================================
-- 1. MATERIALIZATION AUDIT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_ramp_20_materialization_audit (
    id bigserial PRIMARY KEY,

    promotion_audit_id bigint
        REFERENCES public.email_ramp_20_promotion_audit(id)
        ON DELETE RESTRICT,

    prepared_batch_id uuid NOT NULL UNIQUE
        REFERENCES public.email_ramp_candidate_batches(id)
        ON DELETE RESTRICT,

    pilot_batch_id uuid NOT NULL UNIQUE
        REFERENCES public.email_pilot_batches(id)
        ON DELETE RESTRICT,

    sequence_id uuid NOT NULL
        REFERENCES public.email_sequences(id)
        ON DELETE RESTRICT,

    expected_count integer NOT NULL DEFAULT 20,

    created_leads integer NOT NULL DEFAULT 0,

    created_enrollments integer NOT NULL DEFAULT 0,

    created_pilot_members integer NOT NULL DEFAULT 0,

    sending_enabled_during_materialization boolean NOT NULL DEFAULT false,

    emails_sent boolean NOT NULL DEFAULT false,

    operator_note text,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT email_ramp_20_materialization_expected_count_check
        CHECK (expected_count = 20),

    CONSTRAINT email_ramp_20_materialization_no_send_check
        CHECK (emails_sent = false)
);


ALTER TABLE
    public.email_ramp_20_materialization_audit
ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 2. MAIN MATERIALIZATION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.materialize_email_ramp_20_batch(
    p_operator_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$

DECLARE

    -- --------------------------------------------------------
    -- Promotion / prepared batch
    -- --------------------------------------------------------

    v_promotion_id bigint;

    v_prepared_batch_id uuid;

    v_existing_pilot_batch_id uuid;

    v_existing_created_leads integer := 0;

    v_existing_created_enrollments integer := 0;

    v_existing_created_members integer := 0;


    -- --------------------------------------------------------
    -- Launch settings
    -- --------------------------------------------------------

    v_sending_enabled boolean;

    v_pilot_mode boolean;

    v_pilot_limit integer;

    v_daily_send_cap integer;

    v_max_batch_size integer;

    v_minimum_score integer;


    -- --------------------------------------------------------
    -- Safety
    -- --------------------------------------------------------

    v_unsafe_replied_leads integer := 0;

    v_unfinished_pilot_batches integer := 0;

    v_member_count integer := 0;

    v_unique_dot_count integer := 0;

    v_unique_email_count integer := 0;

    v_joined_carrier_count integer := 0;

    v_existing_lead_count integer := 0;

    v_suppressed_count integer := 0;


    -- --------------------------------------------------------
    -- Sequence / output batch
    -- --------------------------------------------------------

    v_active_sequence_count integer := 0;

    v_sequence_id uuid;

    v_pilot_batch_id uuid;


    -- --------------------------------------------------------
    -- Per-carrier creation
    -- --------------------------------------------------------

    v_lead_id uuid;

    v_enrollment_id uuid;

    v_created_leads integer := 0;

    v_created_enrollments integer := 0;

    v_created_members integer := 0;

    v_now timestamptz := now();

    r record;

BEGIN

    -- ========================================================
    -- GLOBAL TRANSACTION LOCK
    -- ========================================================

    PERFORM pg_advisory_xact_lock(
        hashtext(
            'slatelane-phase-027e-materialize-ramp-20'
        )
    );


    -- ========================================================
    -- FIND THE EXACT PROMOTED PREPARED BATCH
    -- ========================================================

    SELECT
        erpa.id,
        erpa.prepared_batch_id

    INTO
        v_promotion_id,
        v_prepared_batch_id

    FROM public.email_ramp_20_promotion_audit erpa

    WHERE
        erpa.gate_status = 'READY'

        AND erpa.new_pilot_limit >= 20

    ORDER BY
        erpa.promoted_at DESC

    LIMIT 1;


    IF v_prepared_batch_id IS NULL THEN

        RAISE EXCEPTION
            '027E blocked: no READY Phase 027D promotion audit was found.';

    END IF;


    -- ========================================================
    -- IDEMPOTENCY
    --
    -- If this exact frozen batch was already materialized,
    -- return the existing result.
    -- ========================================================

    SELECT
        ema.pilot_batch_id,
        ema.created_leads,
        ema.created_enrollments,
        ema.created_pilot_members

    INTO
        v_existing_pilot_batch_id,
        v_existing_created_leads,
        v_existing_created_enrollments,
        v_existing_created_members

    FROM public.email_ramp_20_materialization_audit ema

    WHERE
        ema.prepared_batch_id = v_prepared_batch_id

    LIMIT 1;


    IF v_existing_pilot_batch_id IS NOT NULL THEN

        RETURN jsonb_build_object(

            'success',
            true,

            'phase',
            '027E-protected-20-materialization',

            'already_materialized',
            true,

            'prepared_batch_id',
            v_prepared_batch_id,

            'pilot_batch_id',
            v_existing_pilot_batch_id,

            'created_leads',
            v_existing_created_leads,

            'created_enrollments',
            v_existing_created_enrollments,

            'created_pilot_members',
            v_existing_created_members,

            'emails_sent',
            false,

            'message',
            'This exact protected 20-carrier batch was already materialized.'

        );

    END IF;


    -- ========================================================
    -- VERIFY PREPARED BATCH IS STILL AVAILABLE
    -- ========================================================

    PERFORM 1

    FROM public.email_ramp_candidate_batches ercb

    WHERE
        ercb.id = v_prepared_batch_id

        AND ercb.ramp_target = 20

        AND ercb.status = 'prepared'

        AND ercb.cancelled_at IS NULL

        AND ercb.consumed_at IS NULL;


    IF NOT FOUND THEN

        RAISE EXCEPTION
            '027E blocked: promoted ramp batch % is not an available prepared batch.',
            v_prepared_batch_id;

    END IF;


    -- ========================================================
    -- READ CURRENT PRODUCTION SETTINGS
    -- ========================================================

    SELECT
        els.sending_enabled,
        els.pilot_mode,
        els.pilot_limit,
        els.daily_send_cap,
        els.max_batch_size,
        els.minimum_carrier_score

    INTO
        v_sending_enabled,
        v_pilot_mode,
        v_pilot_limit,
        v_daily_send_cap,
        v_max_batch_size,
        v_minimum_score

    FROM public.email_launch_settings els

    ORDER BY
        els.id

    LIMIT 1;


    IF NOT FOUND THEN

        RAISE EXCEPTION
            '027E blocked: email_launch_settings does not exist.';

    END IF;


    -- ========================================================
    -- MASTER SENDING MUST STILL BE OFF
    -- ========================================================

    IF COALESCE(
        v_sending_enabled,
        false
    ) = true THEN

        RAISE EXCEPTION
            '027E blocked: Master Sending is ON. Materialization requires Master Sending OFF.';

    END IF;


    -- ========================================================
    -- VERIFY 20-CARRIER PROMOTION STATE
    -- ========================================================

    IF COALESCE(
        v_pilot_mode,
        false
    ) = false THEN

        RAISE EXCEPTION
            '027E blocked: pilot_mode is not enabled.';

    END IF;


    IF COALESCE(
        v_pilot_limit,
        0
    ) < 20 THEN

        RAISE EXCEPTION
            '027E blocked: pilot_limit is %, expected at least 20.',
            v_pilot_limit;

    END IF;


    IF COALESCE(
        v_daily_send_cap,
        0
    ) < 20 THEN

        RAISE EXCEPTION
            '027E blocked: daily_send_cap is %, expected at least 20.',
            v_daily_send_cap;

    END IF;


    IF COALESCE(
        v_max_batch_size,
        0
    ) < 5 THEN

        RAISE EXCEPTION
            '027E blocked: max_batch_size is %, expected at least 5.',
            v_max_batch_size;

    END IF;


    -- ========================================================
    -- REPLY SAFETY CHECK
    -- ========================================================

    SELECT
        COALESCE(
            MAX(
                eri.replied_leads_still_running
            ),
            0
        )

    INTO
        v_unsafe_replied_leads

    FROM public.email_reply_integrity_status eri;


    IF v_unsafe_replied_leads > 0 THEN

        RAISE EXCEPTION
            '027E blocked: % replied lead(s) are still running.',
            v_unsafe_replied_leads;

    END IF;


    -- ========================================================
    -- ONLY ONE UNFINISHED PILOT AT A TIME
    -- ========================================================

    SELECT
        COUNT(*)::integer

    INTO
        v_unfinished_pilot_batches

    FROM public.email_pilot_batches epb

    WHERE
        epb.status IN (
            'prepared',
            'armed'
        );


    IF v_unfinished_pilot_batches > 0 THEN

        RAISE EXCEPTION
            '027E blocked: % unfinished pilot batch(es) already exist.',
            v_unfinished_pilot_batches;

    END IF;


    -- ========================================================
    -- VERIFY EXACT FROZEN 20
    -- ========================================================

    SELECT
        COUNT(*)::integer,

        COUNT(
            DISTINCT ercm.carrier_dot_number
        )::integer,

        COUNT(
            DISTINCT LOWER(
                BTRIM(
                    ercm.email
                )
            )
        )::integer

    INTO
        v_member_count,
        v_unique_dot_count,
        v_unique_email_count

    FROM public.email_ramp_candidate_members ercm

    WHERE
        ercm.batch_id = v_prepared_batch_id;


    IF v_member_count <> 20 THEN

        RAISE EXCEPTION
            '027E blocked: prepared batch contains % members instead of 20.',
            v_member_count;

    END IF;


    IF v_unique_dot_count <> 20 THEN

        RAISE EXCEPTION
            '027E blocked: prepared batch does not contain 20 unique DOT numbers. Found %.',
            v_unique_dot_count;

    END IF;


    IF v_unique_email_count <> 20 THEN

        RAISE EXCEPTION
            '027E blocked: prepared batch does not contain 20 unique emails. Found %.',
            v_unique_email_count;

    END IF;


    -- ========================================================
    -- VERIFY ALL SNAPSHOT MEMBERS STILL MAP TO CARRIERS
    -- ========================================================

    SELECT
        COUNT(*)::integer

    INTO
        v_joined_carrier_count

    FROM public.email_ramp_candidate_members ercm

    JOIN public.carriers c
        ON c.dot_number::text =
           ercm.carrier_dot_number

    WHERE
        ercm.batch_id =
            v_prepared_batch_id;


    IF v_joined_carrier_count <> 20 THEN

        RAISE EXCEPTION
            '027E blocked: only % of 20 frozen members map to the carriers table.',
            v_joined_carrier_count;

    END IF;


    -- ========================================================
    -- HARD DUPLICATE LEAD PROTECTION
    --
    -- Same behavior as original controlled pilot:
    -- prepared carrier must not already exist as a lead.
    -- ========================================================

    SELECT
        COUNT(
            DISTINCT l.id
        )::integer

    INTO
        v_existing_lead_count

    FROM public.email_ramp_candidate_members ercm

    JOIN public.leads l
        ON (
            l.carrier_dot_number::text =
                ercm.carrier_dot_number

            OR

            LOWER(
                BTRIM(
                    COALESCE(
                        l.email,
                        ''
                    )
                )
            ) =
            LOWER(
                BTRIM(
                    COALESCE(
                        ercm.email,
                        ''
                    )
                )
            )
        )

    WHERE
        ercm.batch_id =
            v_prepared_batch_id;


    IF v_existing_lead_count > 0 THEN

        RAISE EXCEPTION
            '027E blocked: % frozen candidate(s) already exist as leads. No duplicate outreach was created.',
            v_existing_lead_count;

    END IF;


    -- ========================================================
    -- SUPPRESSION PROTECTION
    -- ========================================================

    SELECT
        COUNT(*)::integer

    INTO
        v_suppressed_count

    FROM public.email_ramp_candidate_members ercm

    JOIN public.email_suppressions es
        ON LOWER(
            BTRIM(
                es.email
            )
        ) =
        LOWER(
            BTRIM(
                ercm.email
            )
        )

    WHERE
        ercm.batch_id =
            v_prepared_batch_id;


    IF v_suppressed_count > 0 THEN

        RAISE EXCEPTION
            '027E blocked: % frozen candidate email(s) are suppressed.',
            v_suppressed_count;

    END IF;


    -- ========================================================
    -- SELECT EXACTLY ONE ACTIVE SEQUENCE
    -- ========================================================

    SELECT
        COUNT(*)::integer

    INTO
        v_active_sequence_count

    FROM public.email_sequences es

    WHERE
        es.active = true;


    IF v_active_sequence_count <> 1 THEN

        RAISE EXCEPTION
            '027E blocked: expected exactly 1 active email sequence, found %.',
            v_active_sequence_count;

    END IF;


    SELECT
        es.id

    INTO
        v_sequence_id

    FROM public.email_sequences es

    WHERE
        es.active = true

    ORDER BY
        es.created_at DESC

    LIMIT 1;


    -- ========================================================
    -- CREATE NEW 20-CARRIER PILOT BATCH
    --
    -- IMPORTANT:
    -- still PREPARED, not ARMED.
    -- ========================================================

    INSERT INTO public.email_pilot_batches (

        sequence_id,

        status,

        requested_count,

        prepared_count,

        minimum_score,

        notes,

        updated_at

    )

    VALUES (

        v_sequence_id,

        'prepared',

        20,

        0,

        v_minimum_score,

        COALESCE(
            NULLIF(
                BTRIM(
                    p_operator_note
                ),
                ''
            ),
            'Phase 027E protected 20-carrier ramp materialization. Master Sending remained OFF.'
        ),

        v_now

    )

    RETURNING id
    INTO v_pilot_batch_id;


    -- ========================================================
    -- MATERIALIZE EXACT FROZEN MEMBERS
    -- ========================================================

    FOR r IN

        SELECT

            ercm.id
                AS ramp_member_id,

            ercm.carrier_dot_number,

            ercm.legal_name,

            ercm.email,

            ercm.phone,

            ercm.mc_number,

            ercm.lead_score,

            ercm.status_code,

            ercm.carrier_snapshot,

            c.id
                AS carrier_id,

            c.dot_number
                AS live_dot_number

        FROM public.email_ramp_candidate_members ercm

        JOIN public.carriers c
            ON c.dot_number::text =
               ercm.carrier_dot_number

        WHERE
            ercm.batch_id =
                v_prepared_batch_id

        ORDER BY

            ercm.lead_score DESC
                NULLS LAST,

            ercm.carrier_dot_number::bigint ASC

    LOOP


        -- ----------------------------------------------------
        -- CREATE LEAD
        -- ----------------------------------------------------

        INSERT INTO public.leads (

            name,

            company_name,

            email,

            phone,

            message,

            carrier_dot_number,

            mc_number,

            source,

            status,

            notes,

            updated_at

        )

        VALUES (

            COALESCE(
                NULLIF(
                    BTRIM(
                        r.legal_name
                    ),
                    ''
                ),
                'Carrier ' ||
                r.carrier_dot_number
            ),

            COALESCE(
                NULLIF(
                    BTRIM(
                        r.legal_name
                    ),
                    ''
                ),
                'Carrier ' ||
                r.carrier_dot_number
            ),

            LOWER(
                BTRIM(
                    r.email
                )
            ),

            NULLIF(
                BTRIM(
                    COALESCE(
                        r.phone,
                        ''
                    )
                ),
                ''
            ),

            'Real carrier prospect selected from the protected Phase 027C 20-carrier ramp snapshot.',

            r.live_dot_number,

            NULLIF(
                BTRIM(
                    COALESCE(
                        r.mc_number,
                        ''
                    )
                ),
                ''
            ),

            'fmcsa_ramp_20',

            'new',

            'Materialized from protected ramp batch ' ||
            v_prepared_batch_id::text ||
            ' into pilot batch ' ||
            v_pilot_batch_id::text ||
            '.',

            v_now

        )

        RETURNING id
        INTO v_lead_id;


        v_created_leads :=
            v_created_leads + 1;


        -- ----------------------------------------------------
        -- CREATE PAUSED ENROLLMENT
        --
        -- NO EMAIL CAN SEND FROM THIS PHASE.
        -- ----------------------------------------------------

        INSERT INTO public.email_sequence_enrollments (

            lead_id,

            sequence_id,

            status,

            current_step,

            next_send_at,

            updated_at

        )

        VALUES (

            v_lead_id,

            v_sequence_id,

            'paused',

            1,

            NULL,

            v_now

        )

        RETURNING id
        INTO v_enrollment_id;


        v_created_enrollments :=
            v_created_enrollments + 1;


        -- ----------------------------------------------------
        -- CONNECT TO STANDARD PILOT INFRASTRUCTURE
        -- ----------------------------------------------------

        INSERT INTO public.email_pilot_members (

            batch_id,

            carrier_id,

            lead_id,

            enrollment_id,

            dot_number,

            email

        )

        VALUES (

            v_pilot_batch_id,

            r.carrier_id,

            v_lead_id,

            v_enrollment_id,

            r.live_dot_number,

            LOWER(
                BTRIM(
                    r.email
                )
            )

        );


        v_created_members :=
            v_created_members + 1;


    END LOOP;


    -- ========================================================
    -- HARD FINAL COUNT ASSERTIONS
    -- ========================================================

    IF v_created_leads <> 20 THEN

        RAISE EXCEPTION
            '027E failed: created % leads instead of 20.',
            v_created_leads;

    END IF;


    IF v_created_enrollments <> 20 THEN

        RAISE EXCEPTION
            '027E failed: created % enrollments instead of 20.',
            v_created_enrollments;

    END IF;


    IF v_created_members <> 20 THEN

        RAISE EXCEPTION
            '027E failed: created % pilot members instead of 20.',
            v_created_members;

    END IF;


    -- ========================================================
    -- FINALIZE STANDARD PILOT BATCH
    -- ========================================================

    UPDATE public.email_pilot_batches

    SET
        prepared_count = 20,

        prepared_at = v_now,

        updated_at = v_now

    WHERE
        id = v_pilot_batch_id;


    -- ========================================================
    -- CONSUME THE FROZEN RAMP BATCH
    --
    -- This stops prepare_email_ramp_20_batch() from treating
    -- the already-materialized batch as an unused batch.
    -- ========================================================

    UPDATE public.email_ramp_candidate_batches

    SET
        status = 'consumed',

        consumed_at = v_now

    WHERE
        id = v_prepared_batch_id

        AND status = 'prepared'

        AND consumed_at IS NULL;


    IF NOT FOUND THEN

        RAISE EXCEPTION
            '027E failed: prepared ramp batch could not be consumed safely.';

    END IF;


    -- ========================================================
    -- WRITE MATERIALIZATION AUDIT
    -- ========================================================

    INSERT INTO public.email_ramp_20_materialization_audit (

        promotion_audit_id,

        prepared_batch_id,

        pilot_batch_id,

        sequence_id,

        expected_count,

        created_leads,

        created_enrollments,

        created_pilot_members,

        sending_enabled_during_materialization,

        emails_sent,

        operator_note

    )

    VALUES (

        v_promotion_id,

        v_prepared_batch_id,

        v_pilot_batch_id,

        v_sequence_id,

        20,

        v_created_leads,

        v_created_enrollments,

        v_created_members,

        false,

        false,

        COALESCE(
            NULLIF(
                BTRIM(
                    p_operator_note
                ),
                ''
            ),
            'Phase 027E protected materialization'
        )

    );


    -- ========================================================
    -- ENRICH THE EXISTING 027D PROMOTION AUDIT
    -- ========================================================

    UPDATE public.email_ramp_20_promotion_audit

    SET metadata =
        COALESCE(
            metadata,
            '{}'::jsonb
        )
        ||
        jsonb_build_object(

            'phase_027e_materialized',
            true,

            'materialized_at',
            v_now,

            'pilot_batch_id',
            v_pilot_batch_id,

            'leads_created',
            v_created_leads,

            'enrollments_created',
            v_created_enrollments,

            'pilot_members_created',
            v_created_members,

            'batch_armed',
            false,

            'email_sent',
            false

        )

    WHERE
        id = v_promotion_id;


    -- ========================================================
    -- RETURN RESULT
    -- ========================================================

    RETURN jsonb_build_object(

        'success',
        true,

        'phase',
        '027E-protected-20-materialization',

        'prepared_batch_id',
        v_prepared_batch_id,

        'pilot_batch_id',
        v_pilot_batch_id,

        'sequence_id',
        v_sequence_id,

        'created_leads',
        v_created_leads,

        'created_enrollments',
        v_created_enrollments,

        'created_pilot_members',
        v_created_members,

        'pilot_status',
        'prepared',

        'enrollment_status',
        'paused',

        'master_sending',
        false,

        'emails_sent',
        false,

        'next_phase',
        '027F guarded 20-carrier launch',

        'message',
        'Exact protected 20-carrier snapshot materialized safely. No email was sent.'

    );

END;

$function$;


-- ============================================================
-- 3. MATERIALIZATION STATUS VIEW
-- ============================================================

CREATE OR REPLACE VIEW public.email_ramp_20_materialization_status
AS

WITH latest AS (

    SELECT
        ema.*

    FROM public.email_ramp_20_materialization_audit ema

    ORDER BY
        ema.created_at DESC

    LIMIT 1

)

SELECT

    l.id
        AS materialization_id,

    l.prepared_batch_id,

    l.pilot_batch_id,

    l.sequence_id,

    l.created_at
        AS materialized_at,

    epb.status
        AS pilot_status,

    epb.requested_count,

    epb.prepared_count,

    (
        SELECT
            COUNT(*)::integer

        FROM public.email_pilot_members epm

        WHERE
            epm.batch_id =
                l.pilot_batch_id
    )
        AS pilot_members,

    (
        SELECT
            COUNT(*)::integer

        FROM public.email_pilot_members epm

        JOIN public.email_sequence_enrollments ese
            ON ese.id =
               epm.enrollment_id

        WHERE
            epm.batch_id =
                l.pilot_batch_id

            AND ese.status =
                'paused'
    )
        AS paused_enrollments,

    (
        SELECT
            COUNT(*)::integer

        FROM public.email_pilot_members epm

        JOIN public.email_sequence_enrollments ese
            ON ese.id =
               epm.enrollment_id

        WHERE
            epm.batch_id =
                l.pilot_batch_id

            AND ese.status =
                'active'
    )
        AS active_enrollments,

    l.created_leads,

    l.created_enrollments,

    l.created_pilot_members,

    l.sending_enabled_during_materialization,

    l.emails_sent,

    CASE

        WHEN
            epb.status = 'prepared'

            AND epb.requested_count = 20

            AND epb.prepared_count = 20

            AND (
                SELECT COUNT(*)
                FROM public.email_pilot_members epm
                WHERE epm.batch_id = l.pilot_batch_id
            ) = 20

            AND (
                SELECT COUNT(*)
                FROM public.email_pilot_members epm
                JOIN public.email_sequence_enrollments ese
                    ON ese.id = epm.enrollment_id
                WHERE
                    epm.batch_id = l.pilot_batch_id
                    AND ese.status = 'paused'
            ) = 20

            AND l.emails_sent = false

        THEN true

        ELSE false

    END
        AS ready_for_guarded_launch

FROM latest l

JOIN public.email_pilot_batches epb
    ON epb.id =
       l.pilot_batch_id;


-- ============================================================
-- 4. PRIVILEGES
-- ============================================================

REVOKE ALL
ON FUNCTION public.materialize_email_ramp_20_batch(text)
FROM PUBLIC;


REVOKE ALL
ON FUNCTION public.materialize_email_ramp_20_batch(text)
FROM anon;


REVOKE ALL
ON FUNCTION public.materialize_email_ramp_20_batch(text)
FROM authenticated;


GRANT EXECUTE
ON FUNCTION public.materialize_email_ramp_20_batch(text)
TO service_role;


GRANT SELECT
ON public.email_ramp_20_materialization_audit
TO service_role;


GRANT SELECT
ON public.email_ramp_20_materialization_status
TO service_role;


-- ============================================================
-- END PHASE 027E MIGRATION
-- ============================================================