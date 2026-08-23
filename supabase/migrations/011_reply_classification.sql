BEGIN;

-- ============================================================
-- SlateLane Dispatch CRM
-- Migration 011
-- Automatic Reply Classification
-- ============================================================


-- ============================================================
-- 1. CLASSIFICATION DATA ON EACH REPLY
-- ============================================================

ALTER TABLE public.email_replies
    ADD COLUMN IF NOT EXISTS classification text;

ALTER TABLE public.email_replies
    ADD COLUMN IF NOT EXISTS classification_confidence numeric(5,4);

ALTER TABLE public.email_replies
    ADD COLUMN IF NOT EXISTS classification_reason text;

ALTER TABLE public.email_replies
    ADD COLUMN IF NOT EXISTS classified_at timestamptz;

ALTER TABLE public.email_replies
    ADD COLUMN IF NOT EXISTS requires_attention boolean
        NOT NULL DEFAULT true;


-- ============================================================
-- 2. MOST RECENT CLASSIFICATION ON LEAD
-- ============================================================

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS last_reply_classification text;

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS reply_requires_attention boolean
        NOT NULL DEFAULT false;


-- ============================================================
-- 3. VALID CLASSIFICATION VALUES
-- ============================================================

ALTER TABLE public.email_replies
DROP CONSTRAINT IF EXISTS email_replies_classification_check;

ALTER TABLE public.email_replies
ADD CONSTRAINT email_replies_classification_check
CHECK (
    classification IS NULL
    OR classification IN (
        'interested',
        'need_rates',
        'call_me',
        'not_interested',
        'wrong_contact',
        'unsubscribe',
        'other'
    )
);


-- ============================================================
-- 4. CONFIDENCE VALIDATION
-- ============================================================

ALTER TABLE public.email_replies
DROP CONSTRAINT IF EXISTS email_replies_classification_confidence_check;

ALTER TABLE public.email_replies
ADD CONSTRAINT email_replies_classification_confidence_check
CHECK (
    classification_confidence IS NULL
    OR (
        classification_confidence >= 0
        AND classification_confidence <= 1
    )
);


-- ============================================================
-- 5. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    email_replies_classification_idx
ON public.email_replies (
    classification,
    received_at DESC
);


CREATE INDEX IF NOT EXISTS
    email_replies_requires_attention_idx
ON public.email_replies (
    requires_attention,
    received_at DESC
);


CREATE INDEX IF NOT EXISTS
    leads_last_reply_classification_idx
ON public.leads (
    last_reply_classification,
    last_reply_at DESC
);


-- ============================================================
-- 6. DOCUMENTATION
-- ============================================================

COMMENT ON COLUMN public.email_replies.classification IS
    'Automatic reply classification: interested, need_rates, call_me, not_interested, wrong_contact, unsubscribe, or other.';

COMMENT ON COLUMN public.email_replies.classification_confidence IS
    'Classifier confidence from 0.0000 to 1.0000.';

COMMENT ON COLUMN public.email_replies.classification_reason IS
    'Human-readable reason explaining why the reply received its classification.';

COMMENT ON COLUMN public.email_replies.requires_attention IS
    'Whether the reply should be reviewed by a SlateLane user.';

COMMENT ON COLUMN public.leads.last_reply_classification IS
    'Classification of the most recent reply received from this lead.';

COMMENT ON COLUMN public.leads.reply_requires_attention IS
    'True when the most recent reply needs manual review.';


COMMIT;