BEGIN;

-- ============================================================
-- SlateLane Dispatch CRM
-- Migration 012
-- Reply Handling / Sales Action Queue
-- ============================================================


-- ============================================================
-- 1. HANDLING STATE
-- ============================================================

ALTER TABLE public.email_replies
    ADD COLUMN IF NOT EXISTS handled boolean
        NOT NULL DEFAULT false;

ALTER TABLE public.email_replies
    ADD COLUMN IF NOT EXISTS handled_at timestamptz;

ALTER TABLE public.email_replies
    ADD COLUMN IF NOT EXISTS handled_action text;

ALTER TABLE public.email_replies
    ADD COLUMN IF NOT EXISTS handled_note text;


-- ============================================================
-- 2. VALID ACTIONS
-- ============================================================

ALTER TABLE public.email_replies
DROP CONSTRAINT IF EXISTS email_replies_handled_action_check;

ALTER TABLE public.email_replies
ADD CONSTRAINT email_replies_handled_action_check
CHECK (
    handled_action IS NULL
    OR handled_action IN (
        'handled',
        'call_lead',
        'sent_rates',
        'interested',
        'not_interested',
        'wrong_contact',
        'unsubscribe'
    )
);


-- ============================================================
-- 3. PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    email_replies_attention_handled_idx
ON public.email_replies (
    requires_attention,
    handled,
    received_at DESC
);


CREATE INDEX IF NOT EXISTS
    email_replies_handled_action_idx
ON public.email_replies (
    handled_action,
    handled_at DESC
);


-- ============================================================
-- 4. DOCUMENTATION
-- ============================================================

COMMENT ON COLUMN public.email_replies.handled IS
    'True after a SlateLane user has reviewed and handled this reply.';

COMMENT ON COLUMN public.email_replies.handled_at IS
    'Timestamp when the reply was handled.';

COMMENT ON COLUMN public.email_replies.handled_action IS
    'Action taken by a SlateLane user after reviewing the reply.';

COMMENT ON COLUMN public.email_replies.handled_note IS
    'Optional internal note about how the reply was handled.';


COMMIT;