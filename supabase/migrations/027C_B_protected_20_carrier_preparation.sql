-- ============================================================
-- PHASE 027C-B
-- PROTECTED 20-CARRIER BATCH PREPARATION
--
-- PURPOSE
--   Freeze a safe candidate list for the future 20-carrier
--   production ramp.
--
-- THIS PHASE DOES NOT:
--   - send email
--   - enable Master Sending
--   - create leads
--   - create sequence enrollments
--   - create email_pilot_members
--   - change the current 5-carrier pilot
--   - change email_launch_settings
-- ============================================================

BEGIN;


-- ============================================================
-- 1. PREPARATION BATCH
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_ramp_candidate_batches (

    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    ramp_target integer NOT NULL
        DEFAULT 20,

    status text NOT NULL
        DEFAULT 'prepared',

    prepared_count integer NOT NULL
        DEFAULT 0,

    operator_note text,

    created_at timestamptz NOT NULL
        DEFAULT now(),

    cancelled_at timestamptz,

    consumed_at timestamptz,

    CONSTRAINT email_ramp_candidate_batches_target_check
        CHECK (ramp_target > 0),

    CONSTRAINT email_ramp_candidate_batches_status_check
        CHECK (
            status IN (
                'prepared',
                'cancelled',
                'consumed'
            )
        )
);


CREATE INDEX IF NOT EXISTS
email_ramp_candidate_batches_created_idx
ON public.email_ramp_candidate_batches (
    created_at DESC
);


-- ============================================================
-- 2. PREPARED CARRIER SNAPSHOTS
--
-- We intentionally store a snapshot rather than relying on
-- live carrier rows so the exact candidate set is preserved.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_ramp_candidate_members (

    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    batch_id uuid NOT NULL
        REFERENCES public.email_ramp_candidate_batches(id)
        ON DELETE CASCADE,

    carrier_dot_number text NOT NULL,

    legal_name text,

    email text NOT NULL,

    phone text,

    mc_number text,

    lead_score numeric,

    status_code text,

    carrier_snapshot jsonb NOT NULL
        DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL
        DEFAULT now(),

    UNIQUE (
        batch_id,
        carrier_dot_number
    )
);


CREATE UNIQUE INDEX IF NOT EXISTS
email_ramp_candidate_members_batch_email_uidx

ON public.email_ramp_candidate_members (
    batch_id,
    LOWER(email)
);


CREATE INDEX IF NOT EXISTS
email_ramp_candidate_members_batch_idx

ON public.email_ramp_candidate_members (
    batch_id
);


-- ============================================================
-- 3. CURRENT PREPARED BATCH VIEW
-- ============================================================

CREATE OR REPLACE VIEW
public.email_ramp_20_prepared_status
AS

WITH latest_batch AS (

    SELECT *

    FROM public.email_ramp_candidate_batches

    ORDER BY created_at DESC

    LIMIT 1
)

SELECT

    lb.id AS batch_id,

    lb.status,

    lb.ramp_target,

    lb.prepared_count,

    lb.operator_note,

    lb.created_at,

    lb.cancelled_at,

    lb.consumed_at,

    COUNT(erm.id)::integer
        AS actual_member_count,

    CASE

        WHEN
            lb.status = 'prepared'
            AND COUNT(erm.id) = lb.ramp_target

        THEN true

        ELSE false

    END AS batch_complete

FROM latest_batch lb

LEFT JOIN
    public.email_ramp_candidate_members erm

    ON erm.batch_id = lb.id

GROUP BY

    lb.id,
    lb.status,
    lb.ramp_target,
    lb.prepared_count,
    lb.operator_note,
    lb.created_at,
    lb.cancelled_at,
    lb.consumed_at;


-- ============================================================
-- 4. PREPARE NEXT 20 CARRIERS
--
-- IMPORTANT:
-- This preparation is allowed while the current 5-carrier
-- pilot is still running.
--
-- It does NOT promote capacity.
-- ============================================================

CREATE OR REPLACE FUNCTION
public.prepare_email_ramp_20_batch(
    p_operator_note text DEFAULT NULL
)

RETURNS jsonb

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = public

AS $$

DECLARE

    v_existing_batch_id uuid;

    v_existing_count integer := 0;

    v_candidate_count integer := 0;

    v_unsafe_replied_leads integer := 0;

    v_batch_id uuid;

    v_inserted integer := 0;

BEGIN


    -- ========================================================
    -- IDEMPOTENCY
    --
    -- If a prepared 20-carrier batch already exists,
    -- return it instead of creating another one.
    -- ========================================================

    SELECT

        id,
        prepared_count

    INTO

        v_existing_batch_id,
        v_existing_count

    FROM public.email_ramp_candidate_batches

    WHERE

        status = 'prepared'

        AND ramp_target = 20

    ORDER BY created_at DESC

    LIMIT 1;


    IF v_existing_batch_id IS NOT NULL THEN

        RETURN jsonb_build_object(

            'success',
            true,

            'phase',
            '027C-B',

            'already_prepared',
            true,

            'batch_id',
            v_existing_batch_id,

            'prepared_count',
            v_existing_count,

            'target',
            20,

            'email_sent',
            false,

            'leads_created',
            false,

            'enrollments_created',
            false,

            'master_sending_changed',
            false

        );

    END IF;


    -- ========================================================
    -- REPLY SAFETY CHECK
    -- ========================================================

    SELECT

        COALESCE(
            replied_leads_still_running,
            0
        )

    INTO v_unsafe_replied_leads

    FROM public.email_reply_integrity_status

    LIMIT 1;


    IF v_unsafe_replied_leads > 0 THEN

        RAISE EXCEPTION
            'Preparation blocked: % replied lead(s) are still running.',
            v_unsafe_replied_leads;

    END IF;


    -- ========================================================
    -- VERIFY CANDIDATE SUPPLY
    -- ========================================================

    SELECT COUNT(*)

    INTO v_candidate_count

    FROM public.email_ramp_20_candidate_preview;


    IF v_candidate_count < 20 THEN

        RAISE EXCEPTION
            'Preparation blocked: only % eligible carrier candidates available.',
            v_candidate_count;

    END IF;


    -- ========================================================
    -- CREATE PREPARATION BATCH
    -- ========================================================

    INSERT INTO public.email_ramp_candidate_batches (

        ramp_target,
        status,
        operator_note

    )

    VALUES (

        20,
        'prepared',

        NULLIF(
            BTRIM(
                COALESCE(
                    p_operator_note,
                    ''
                )
            ),
            ''
        )

    )

    RETURNING id
    INTO v_batch_id;


    -- ========================================================
    -- FREEZE TOP 20 CANDIDATES
    -- ========================================================

    INSERT INTO public.email_ramp_candidate_members (

        batch_id,

        carrier_dot_number,

        legal_name,

        email,

        phone,

        mc_number,

        lead_score,

        status_code,

        carrier_snapshot

    )

    SELECT

        v_batch_id,

        erp.dot_number::text,

        erp.legal_name,

        erp.email,

        erp.phone,

        erp.mc_number,

        erp.lead_score,

        erp.status_code,

        jsonb_build_object(

            'dot_number',
            erp.dot_number,

            'legal_name',
            erp.legal_name,

            'email',
            erp.email,

            'phone',
            erp.phone,

            'mc_number',
            erp.mc_number,

            'lead_score',
            erp.lead_score,

            'status_code',
            erp.status_code,

            'snapshot_at',
            now()

        )

    FROM public.email_ramp_20_candidate_preview erp

    ORDER BY

        erp.lead_score DESC NULLS LAST,

        erp.dot_number ASC

    LIMIT 20;


    GET DIAGNOSTICS
        v_inserted = ROW_COUNT;


    -- ========================================================
    -- HARD SAFETY ASSERTION
    -- ========================================================

    IF v_inserted <> 20 THEN

        RAISE EXCEPTION
            'Preparation failed: expected 20 candidates but inserted %.',
            v_inserted;

    END IF;


    -- ========================================================
    -- UPDATE BATCH COUNT
    -- ========================================================

    UPDATE public.email_ramp_candidate_batches

    SET prepared_count = v_inserted

    WHERE id = v_batch_id;


    -- ========================================================
    -- RETURN PROTECTED RESULT
    -- ========================================================

    RETURN jsonb_build_object(

        'success',
        true,

        'phase',
        '027C-B-protected-20-carrier-preparation',

        'batch_id',
        v_batch_id,

        'prepared_count',
        v_inserted,

        'target',
        20,

        'message',
        '20 carriers safely staged for future ramp.',

        'protection',
        jsonb_build_object(

            'email_sent',
            false,

            'leads_created',
            false,

            'enrollments_created',
            false,

            'pilot_members_created',
            false,

            'master_sending_changed',
            false,

            'current_pilot_changed',
            false

        )

    );

END;

$$;


-- ============================================================
-- 5. CANCEL A PREPARED BATCH
-- ============================================================

CREATE OR REPLACE FUNCTION
public.cancel_email_ramp_candidate_batch(
    p_batch_id uuid,
    p_operator_note text DEFAULT NULL
)

RETURNS jsonb

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = public

AS $$

DECLARE

    v_status text;

BEGIN


    SELECT status

    INTO v_status

    FROM public.email_ramp_candidate_batches

    WHERE id = p_batch_id;


    IF v_status IS NULL THEN

        RAISE EXCEPTION
            'Candidate batch not found.';

    END IF;


    IF v_status <> 'prepared' THEN

        RAISE EXCEPTION
            'Only prepared candidate batches may be cancelled. Current status: %',
            v_status;

    END IF;


    UPDATE public.email_ramp_candidate_batches

    SET

        status = 'cancelled',

        cancelled_at = now(),

        operator_note =
            COALESCE(
                NULLIF(
                    BTRIM(
                        COALESCE(
                            p_operator_note,
                            ''
                        )
                    ),
                    ''
                ),
                operator_note
            )

    WHERE id = p_batch_id;


    RETURN jsonb_build_object(

        'success',
        true,

        'batch_id',
        p_batch_id,

        'status',
        'cancelled',

        'email_sent',
        false

    );

END;

$$;


-- ============================================================
-- 6. PERMISSIONS
-- ============================================================

REVOKE ALL
ON FUNCTION
public.prepare_email_ramp_20_batch(text)
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION
public.prepare_email_ramp_20_batch(text)
TO service_role;


REVOKE ALL
ON FUNCTION
public.cancel_email_ramp_candidate_batch(uuid, text)
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION
public.cancel_email_ramp_candidate_batch(uuid, text)
TO service_role;


GRANT SELECT
ON public.email_ramp_candidate_batches
TO service_role;


GRANT SELECT
ON public.email_ramp_candidate_members
TO service_role;


GRANT SELECT
ON public.email_ramp_20_prepared_status
TO service_role;


COMMIT;