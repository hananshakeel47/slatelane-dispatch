BEGIN;

-- ============================================================
-- SlateLane CRM
-- Email Automation Foundation
-- ============================================================


-- ============================================================
-- LEAD EMAIL SETTINGS
-- ============================================================

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS email_opt_out boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
    ADD COLUMN IF NOT EXISTS unsubscribe_token uuid DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS email_bounced boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS email_complained boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_email_sent_at timestamptz;


CREATE UNIQUE INDEX IF NOT EXISTS leads_unsubscribe_token_idx
ON public.leads (unsubscribe_token);


-- ============================================================
-- EMAIL TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    name text NOT NULL,
    description text,

    subject text NOT NULL,

    html_body text NOT NULL,
    text_body text,

    active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS email_templates_active_idx
ON public.email_templates (active);


-- ============================================================
-- EMAIL SEQUENCES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_sequences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    name text NOT NULL,
    description text,

    active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS email_sequences_active_idx
ON public.email_sequences (active);


-- ============================================================
-- EMAIL SEQUENCE STEPS
--
-- delay_hours:
--
-- Step 1 = 0
-- Step 2 = 48
-- Step 3 = 96
-- etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_sequence_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    sequence_id uuid NOT NULL
        REFERENCES public.email_sequences(id)
        ON DELETE CASCADE,

    template_id uuid NOT NULL
        REFERENCES public.email_templates(id)
        ON DELETE RESTRICT,

    step_order integer NOT NULL,

    delay_hours integer NOT NULL DEFAULT 0,

    active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(sequence_id, step_order)
);


CREATE INDEX IF NOT EXISTS email_sequence_steps_sequence_idx
ON public.email_sequence_steps (sequence_id, step_order);


-- ============================================================
-- LEAD SEQUENCE ENROLLMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_sequence_enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    lead_id uuid NOT NULL
        REFERENCES public.leads(id)
        ON DELETE CASCADE,

    sequence_id uuid NOT NULL
        REFERENCES public.email_sequences(id)
        ON DELETE CASCADE,

    status text NOT NULL DEFAULT 'active',

    current_step integer NOT NULL DEFAULT 1,

    next_send_at timestamptz,

    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    stopped_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(lead_id, sequence_id)
);


CREATE INDEX IF NOT EXISTS email_enrollments_due_idx
ON public.email_sequence_enrollments (
    status,
    next_send_at
);


CREATE INDEX IF NOT EXISTS email_enrollments_lead_idx
ON public.email_sequence_enrollments (lead_id);


-- ============================================================
-- EMAIL SEND HISTORY / QUEUE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_sends (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    lead_id uuid
        REFERENCES public.leads(id)
        ON DELETE SET NULL,

    enrollment_id uuid
        REFERENCES public.email_sequence_enrollments(id)
        ON DELETE SET NULL,

    sequence_step_id uuid
        REFERENCES public.email_sequence_steps(id)
        ON DELETE SET NULL,

    resend_email_id text,

    to_email text NOT NULL,

    from_email text NOT NULL,

    subject text NOT NULL,

    status text NOT NULL DEFAULT 'queued',

    scheduled_at timestamptz,
    sent_at timestamptz,
    delivered_at timestamptz,

    bounced_at timestamptz,
    complained_at timestamptz,
    failed_at timestamptz,

    error_message text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS email_sends_status_idx
ON public.email_sends (status);


CREATE INDEX IF NOT EXISTS email_sends_lead_idx
ON public.email_sends (lead_id);


CREATE INDEX IF NOT EXISTS email_sends_resend_id_idx
ON public.email_sends (resend_email_id);


CREATE INDEX IF NOT EXISTS email_sends_created_idx
ON public.email_sends (created_at DESC);


-- ============================================================
-- SUPPRESSION TABLE
--
-- Extra protection in addition to Resend's own suppression
-- system.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_suppressions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    email text NOT NULL UNIQUE,

    reason text NOT NULL,

    source text NOT NULL DEFAULT 'slatelane',

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS email_suppressions_email_idx
ON public.email_suppressions (email);


COMMIT;