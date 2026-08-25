BEGIN;

-- ============================================================
-- SlateLane Dispatch CRM
-- Migration 015
-- Controlled Real-Carrier Pilot Batches
-- ============================================================


CREATE TABLE IF NOT EXISTS public.email_pilot_batches (

    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    sequence_id uuid NOT NULL
        REFERENCES public.email_sequences(id)
        ON DELETE RESTRICT,

    status text NOT NULL DEFAULT 'prepared',

    requested_count integer NOT NULL DEFAULT 25,

    prepared_count integer NOT NULL DEFAULT 0,

    minimum_score integer NOT NULL DEFAULT 80,

    notes text,

    prepared_at timestamptz,

    armed_at timestamptz,

    cancelled_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT email_pilot_batches_status_check
        CHECK (
            status IN (
                'prepared',
                'armed',
                'cancelled',
                'completed'
            )
        ),

    CONSTRAINT email_pilot_batches_requested_count_check
        CHECK (
            requested_count >= 1
            AND requested_count <= 1000
        ),

    CONSTRAINT email_pilot_batches_prepared_count_check
        CHECK (
            prepared_count >= 0
            AND prepared_count <= 1000
        ),

    CONSTRAINT email_pilot_batches_score_check
        CHECK (
            minimum_score >= 0
            AND minimum_score <= 100
        )
);


CREATE TABLE IF NOT EXISTS public.email_pilot_members (

    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    batch_id uuid NOT NULL
        REFERENCES public.email_pilot_batches(id)
        ON DELETE CASCADE,

    carrier_id bigint NOT NULL
        REFERENCES public.carriers(id)
        ON DELETE RESTRICT,

    lead_id uuid NOT NULL
        REFERENCES public.leads(id)
        ON DELETE RESTRICT,

    enrollment_id uuid NOT NULL
        REFERENCES public.email_sequence_enrollments(id)
        ON DELETE RESTRICT,

    dot_number bigint NOT NULL,

    email text NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT email_pilot_members_batch_carrier_unique
        UNIQUE (
            batch_id,
            carrier_id
        ),

    CONSTRAINT email_pilot_members_enrollment_unique
        UNIQUE (
            enrollment_id
        )
);


CREATE INDEX IF NOT EXISTS
    email_pilot_batches_status_created_idx
ON public.email_pilot_batches (
    status,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    email_pilot_members_batch_idx
ON public.email_pilot_members (
    batch_id
);


CREATE INDEX IF NOT EXISTS
    email_pilot_members_carrier_idx
ON public.email_pilot_members (
    carrier_id
);


CREATE INDEX IF NOT EXISTS
    email_pilot_members_lead_idx
ON public.email_pilot_members (
    lead_id
);


COMMENT ON TABLE public.email_pilot_batches IS
    'Controlled SlateLane real-carrier email pilot batches.';


COMMENT ON TABLE public.email_pilot_members IS
    'Exact carriers, leads and paused sequence enrollments belonging to each pilot batch.';


COMMENT ON COLUMN public.email_pilot_batches.status IS
    'prepared = carriers selected but blocked; armed = enrollments active but still protected by global Master Sending; cancelled/completed are terminal states.';


COMMIT;