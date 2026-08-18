CREATE TABLE IF NOT EXISTS public.fmcsa_import_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    file_name text NOT NULL,
    dataset_type text NOT NULL DEFAULT 'company_census',

    status text NOT NULL DEFAULT 'uploaded',

    processed_rows bigint NOT NULL DEFAULT 0,
    imported_rows bigint NOT NULL DEFAULT 0,
    skipped_rows bigint NOT NULL DEFAULT 0,
    failed_rows bigint NOT NULL DEFAULT 0,

    error_message text,

    started_at timestamptz,
    completed_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fmcsa_import_jobs_created_idx
ON public.fmcsa_import_jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS fmcsa_import_jobs_status_idx
ON public.fmcsa_import_jobs (status);