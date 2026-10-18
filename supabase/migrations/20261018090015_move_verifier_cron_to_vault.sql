BEGIN;

-- Deploy Supabase Edge Function version 5 (Vault RPC authentication) before
-- applying this migration. The cron job reads the key at runtime; no secret is
-- embedded in pg_cron metadata.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobid = 9
      AND jobname = 'slatelane-verifalia-email-verification-preflight'
  ) THEN
    RAISE EXCEPTION 'Expected verifier cron job was not found; refusing to change another job.';
  END IF;

  PERFORM cron.alter_job(
    job_id := 9,
    command := $command$
DO $slatelane$
DECLARE
  v_invocation_key text;
BEGIN
  SELECT ds.decrypted_secret
    INTO v_invocation_key
  FROM vault.decrypted_secrets AS ds
  WHERE ds.name = 'slatelane_verifier_invocation_key'
  LIMIT 1;

  IF v_invocation_key IS NULL THEN
    RAISE EXCEPTION 'Verifier invocation key is missing from Supabase Vault';
  END IF;

  PERFORM net.http_post(
    url := 'https://fqidvozbyhrxnyzzupax.supabase.co/functions/v1/verify-carrier-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-slatelane-verifier-key', v_invocation_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
END
$slatelane$;
$command$
  );
END
$migration$;

COMMIT;
