BEGIN;

ALTER TABLE public.carriers
    ADD COLUMN IF NOT EXISTS authority_date date,
    ADD COLUMN IF NOT EXISTS authority_age integer,

    ADD COLUMN IF NOT EXISTS authority_docket text,
    ADD COLUMN IF NOT EXISTS authority_type text,
    ADD COLUMN IF NOT EXISTS authority_status text,
    ADD COLUMN IF NOT EXISTS authority_reason text,

    ADD COLUMN IF NOT EXISTS authority_age_days integer,

    ADD COLUMN IF NOT EXISTS authority_enriched_at timestamptz;

CREATE INDEX IF NOT EXISTS carriers_authority_status_idx
ON public.carriers (authority_status);

CREATE INDEX IF NOT EXISTS carriers_authority_type_idx
ON public.carriers (authority_type);

CREATE INDEX IF NOT EXISTS carriers_authority_age_days_idx
ON public.carriers (authority_age_days);

CREATE INDEX IF NOT EXISTS carriers_authority_date_idx
ON public.carriers (authority_date DESC);

COMMIT;