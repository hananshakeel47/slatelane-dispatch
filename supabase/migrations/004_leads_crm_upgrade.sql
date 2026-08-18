BEGIN;

-- ============================================================
-- SlateLane CRM
-- Leads table upgrade
--
-- Preserves existing website contact-form leads.
-- Adds FMCSA carrier → lead functionality.
-- ============================================================

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS company_name text,
    ADD COLUMN IF NOT EXISTS carrier_dot_number bigint,
    ADD COLUMN IF NOT EXISTS mc_number text,
    ADD COLUMN IF NOT EXISTS source text DEFAULT 'website',
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'new',
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Existing contact form records become website leads.
UPDATE public.leads
SET source = 'website'
WHERE source IS NULL OR source = '';

UPDATE public.leads
SET status = 'new'
WHERE status IS NULL OR status = '';

UPDATE public.leads
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

ALTER TABLE public.leads
    ALTER COLUMN source SET DEFAULT 'website',
    ALTER COLUMN status SET DEFAULT 'new',
    ALTER COLUMN created_at SET DEFAULT now(),
    ALTER COLUMN updated_at SET DEFAULT now();

-- One FMCSA carrier should only become one lead.
-- PostgreSQL UNIQUE still allows multiple NULL values,
-- so website leads are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS leads_carrier_dot_number_unique_idx
ON public.leads (carrier_dot_number);

CREATE INDEX IF NOT EXISTS leads_status_idx
ON public.leads (status);

CREATE INDEX IF NOT EXISTS leads_source_idx
ON public.leads (source);

CREATE INDEX IF NOT EXISTS leads_created_at_idx
ON public.leads (created_at DESC);

CREATE INDEX IF NOT EXISTS leads_company_name_idx
ON public.leads (company_name);

CREATE INDEX IF NOT EXISTS leads_email_idx
ON public.leads (email);

COMMIT;