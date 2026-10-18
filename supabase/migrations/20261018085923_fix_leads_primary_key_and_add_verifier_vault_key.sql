BEGIN;

-- Carrier names are labels, not durable identities. Every existing relation
-- already references leads.id, and the UUID id already has a unique index.
DO $migration$
DECLARE
  v_pk_columns text;
BEGIN
  SELECT string_agg(a.attname, ',' ORDER BY k.ordinality)
    INTO v_pk_columns
  FROM pg_constraint c
  CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ordinality)
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid
   AND a.attnum = k.attnum
  WHERE c.conrelid = 'public.leads'::regclass
    AND c.contype = 'p';

  IF v_pk_columns IS DISTINCT FROM 'id' THEN
    ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_pkey;

    IF EXISTS (
      SELECT 1
      FROM pg_class
      WHERE relname = 'leads_id_unique_idx'
        AND relnamespace = 'public'::regnamespace
        AND relkind = 'i'
    ) THEN
      ALTER TABLE public.leads
        ADD CONSTRAINT leads_pkey PRIMARY KEY USING INDEX leads_id_unique_idx;
    ELSE
      ALTER TABLE public.leads
        ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
    END IF;
  END IF;
END
$migration$;

-- Create a new high-entropy verifier invocation key inside Vault. The value is
-- never returned by this migration or stored in pg_cron command text.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets
    WHERE name = 'slatelane_verifier_invocation_key'
  ) THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'slatelane_verifier_invocation_key',
      'Rotated invocation key for verify-carrier-emails; cron reads it from Vault and the Edge Function validates it through a restricted RPC.'
    );
  END IF;
END
$migration$;

CREATE OR REPLACE FUNCTION public.verify_slatelane_verifier_invocation_key(
  p_candidate_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_expected text;
BEGIN
  IF p_candidate_key IS NULL OR length(p_candidate_key) < 32 THEN
    RETURN false;
  END IF;

  SELECT ds.decrypted_secret
    INTO v_expected
  FROM vault.decrypted_secrets AS ds
  WHERE ds.name = 'slatelane_verifier_invocation_key'
  LIMIT 1;

  RETURN v_expected IS NOT NULL AND p_candidate_key = v_expected;
END
$function$;

REVOKE ALL ON FUNCTION public.verify_slatelane_verifier_invocation_key(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_slatelane_verifier_invocation_key(text)
  TO service_role;

COMMIT;
