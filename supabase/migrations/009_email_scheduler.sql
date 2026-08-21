BEGIN;

-- ============================================================
-- SlateLane CRM
-- Automatic Email Sequence Scheduler
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ============================================================
-- Remove previous scheduler if migration is rerun
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM cron.job
        WHERE jobname = 'slatelane-email-sequence-processor'
    ) THEN
        PERFORM cron.unschedule(
            'slatelane-email-sequence-processor'
        );
    END IF;
END
$$;


-- ============================================================
-- Run every 15 minutes
--
-- This calls:
--
-- https://www.slatelanedispatch.com/api/email/process
--
-- The secret is read from Supabase Vault.
-- ============================================================

SELECT cron.schedule(
    'slatelane-email-sequence-processor',

    '*/15 * * * *',

    $cron$

    SELECT net.http_post(

        url :=
            'https://www.slatelanedispatch.com/api/email/process',

        headers :=
            jsonb_build_object(
                'Content-Type',
                'application/json',

                'Authorization',
                'Bearer ' ||
                (
                    SELECT decrypted_secret
                    FROM vault.decrypted_secrets
                    WHERE name = 'slatelane_email_process_secret'
                    LIMIT 1
                )
            ),

        body :=
            jsonb_build_object(
                'limit',
                25
            ),

        timeout_milliseconds :=
            30000

    ) AS request_id;

    $cron$
);

COMMIT;