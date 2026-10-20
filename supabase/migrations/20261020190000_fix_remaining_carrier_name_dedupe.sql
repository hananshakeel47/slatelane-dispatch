-- Replace carrier-name identity checks in the dormant capacity-manager workflow.
-- DOT is the durable identity for FMCSA candidates. Same-name carriers with
-- different DOT numbers must remain eligible as distinct carriers.
-- This changes only the function definition; it does not run the function,
-- create enrollments, or send email.

BEGIN;

DO $migration$
DECLARE
  v_definition text;
  v_source text;
  v_old_predicate text := $old$WHERE lower(btrim(l.name)) = lower(btrim(COALESCE(p.legal_name, 'Carrier ' || p.dot_number::text)))$old$;
  v_new_predicate text := $new$WHERE l.carrier_dot_number = p.dot_number$new$;
  v_matches integer;
BEGIN
  SELECT p.prosrc, pg_get_functiondef(p.oid)
    INTO v_source, v_definition
  FROM pg_proc p
  WHERE p.oid = 'public.run_daily_outreach_capacity_manager(boolean)'::regprocedure;

  IF v_source IS NULL OR v_definition IS NULL THEN
    RAISE EXCEPTION 'run_daily_outreach_capacity_manager(boolean) is missing; refusing to patch.';
  END IF;

  v_matches := (length(v_source) - length(replace(v_source, v_old_predicate, '')))
               / length(v_old_predicate);

  IF v_matches <> 3 THEN
    RAISE EXCEPTION 'Expected 3 name-based carrier identity checks, found %; refusing to patch.', v_matches;
  END IF;

  -- Patch the live definition rather than replacing unrelated function logic
  -- with a copied snapshot from an earlier point in time.
  v_definition := replace(v_definition, v_old_predicate, v_new_predicate);
  EXECUTE v_definition;

  SELECT p.prosrc
    INTO v_source
  FROM pg_proc p
  WHERE p.oid = 'public.run_daily_outreach_capacity_manager(boolean)'::regprocedure;

  v_matches := (length(v_source) - length(replace(v_source, v_old_predicate, '')))
               / length(v_old_predicate);

  IF v_matches <> 0 THEN
    RAISE EXCEPTION 'Carrier identity postflight failed: % name-based checks remain.', v_matches;
  END IF;

  v_matches := (length(v_source) - length(replace(v_source, v_new_predicate, '')))
               / length(v_new_predicate);

  IF v_matches <> 3 THEN
    RAISE EXCEPTION 'Carrier identity postflight failed: expected 3 DOT checks, found %.', v_matches;
  END IF;
END
$migration$;

COMMIT;
