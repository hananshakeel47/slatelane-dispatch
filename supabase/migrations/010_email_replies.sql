BEGIN;

-- ============================================================
-- SlateLane Dispatch CRM
-- Migration 010
-- Inbound Replies + Automatic Sequence Stop
-- ============================================================


-- ============================================================
-- 1. LEAD REPLY STATE
-- ============================================================

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS has_replied boolean NOT NULL DEFAULT false;

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS reply_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS last_reply_at timestamptz;

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS last_reply_from text;

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS last_reply_subject text;


-- ============================================================
-- 2. OUTBOUND EMAIL THREADING / REPLY MATCHING
-- ============================================================

ALTER TABLE public.email_sends
    ADD COLUMN IF NOT EXISTS message_id text;

ALTER TABLE public.email_sends
    ADD COLUMN IF NOT EXISTS reply_to_address text;


-- ============================================================
-- 3. INBOUND REPLIES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_replies (

    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    lead_id uuid NOT NULL
        REFERENCES public.leads(id)
        ON DELETE CASCADE,

    resend_received_email_id text NOT NULL,

    message_id text,

    from_email text NOT NULL,

    to_email text NOT NULL,

    subject text,

    text_body text,

    html_body text,

    raw_headers jsonb,

    attachment_count integer NOT NULL DEFAULT 0,

    received_at timestamptz NOT NULL DEFAULT now(),

    created_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 4. DUPLICATE PROTECTION
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
    email_replies_resend_received_email_id_uidx
ON public.email_replies (
    resend_received_email_id
);


-- ============================================================
-- 5. FAST LEAD CONVERSATION LOOKUPS
-- ============================================================

CREATE INDEX IF NOT EXISTS
    email_replies_lead_id_received_at_idx
ON public.email_replies (
    lead_id,
    received_at DESC
);


-- ============================================================
-- 6. MESSAGE-ID LOOKUPS
-- ============================================================

CREATE INDEX IF NOT EXISTS
    email_replies_message_id_idx
ON public.email_replies (
    message_id
)
WHERE message_id IS NOT NULL;


CREATE INDEX IF NOT EXISTS
    email_sends_message_id_idx
ON public.email_sends (
    message_id
)
WHERE message_id IS NOT NULL;


-- ============================================================
-- 7. REPLIED LEADS INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS
    leads_has_replied_idx
ON public.leads (
    has_replied,
    last_reply_at DESC
);


-- ============================================================
-- 8. DOCUMENTATION
-- ============================================================

COMMENT ON COLUMN public.leads.has_replied IS
    'True after SlateLane detects an inbound email reply from this lead.';

COMMENT ON COLUMN public.leads.reply_count IS
    'Number of inbound replies recorded for this lead.';

COMMENT ON COLUMN public.leads.last_reply_at IS
    'Timestamp of the most recent inbound reply.';

COMMENT ON COLUMN public.email_sends.message_id IS
    'RFC Message-ID captured from Resend for outbound email threading and reply matching.';

COMMENT ON COLUMN public.email_sends.reply_to_address IS
    'Lead-specific Resend inbound address used as Reply-To.';

COMMENT ON TABLE public.email_replies IS
    'Inbound carrier replies received through Resend and matched to SlateLane leads.';


COMMIT;