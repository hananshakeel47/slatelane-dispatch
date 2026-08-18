BEGIN;

CREATE TABLE IF NOT EXISTS public.email_webhook_events (
    svix_id text PRIMARY KEY,

    event_type text NOT NULL,

    resend_email_id text,

    payload jsonb NOT NULL,

    received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_webhook_events_resend_idx
ON public.email_webhook_events (resend_email_id);

CREATE INDEX IF NOT EXISTS email_webhook_events_type_idx
ON public.email_webhook_events (event_type);

CREATE INDEX IF NOT EXISTS email_webhook_events_received_idx
ON public.email_webhook_events (received_at DESC);

COMMIT;