BEGIN;

-- ============================================================
-- SlateLane CRM
-- FMCSA Company Census Upgrade
--
-- IMPORTANT:
-- This migration upgrades the EXISTING carriers table.
-- It does NOT delete existing CRM fields or existing data.
-- ============================================================


-- ============================================================
-- FMCSA AUTHORITY / IDENTIFICATION
-- ============================================================

ALTER TABLE public.carriers
    ADD COLUMN IF NOT EXISTS mx_number text,
    ADD COLUMN IF NOT EXISTS ff_number text;


-- ============================================================
-- FMCSA OPERATING STATUS
-- ============================================================

ALTER TABLE public.carriers
    ADD COLUMN IF NOT EXISTS status_code text,
    ADD COLUMN IF NOT EXISTS carrier_operation text,
    ADD COLUMN IF NOT EXISTS business_type text;


-- ============================================================
-- CONTACT INFORMATION
-- ============================================================

ALTER TABLE public.carriers
    ADD COLUMN IF NOT EXISTS cell_phone text;


-- ============================================================
-- PHYSICAL ADDRESS
-- Existing:
-- state
-- city
-- ============================================================

ALTER TABLE public.carriers
    ADD COLUMN IF NOT EXISTS street text,
    ADD COLUMN IF NOT EXISTS zip text,
    ADD COLUMN IF NOT EXISTS county text;


-- ============================================================
-- FLEET / DRIVER INFORMATION
--
-- Existing:
-- power_units
-- drivers
-- equipment
-- ============================================================

ALTER TABLE public.carriers
    ADD COLUMN IF NOT EXISTS truck_units integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bus_units integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_cdl integer DEFAULT 0;


-- ============================================================
-- SAFETY INFORMATION
-- ============================================================

ALTER TABLE public.carriers
    ADD COLUMN IF NOT EXISTS safety_rating text,
    ADD COLUMN IF NOT EXISTS safety_rating_date date,
    ADD COLUMN IF NOT EXISTS review_date date;


-- ============================================================
-- HAZMAT / CARGO
-- ============================================================

ALTER TABLE public.carriers
    ADD COLUMN IF NOT EXISTS hazmat boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS cargo jsonb DEFAULT '{}'::jsonb;


-- ============================================================
-- FMCSA CENSUS DATES
--
-- IMPORTANT:
-- These are NOT the same thing as authority_date.
-- authority_date/authority_age will later come from MOTUS.
-- ============================================================

ALTER TABLE public.carriers
    ADD COLUMN IF NOT EXISTS add_date date,
    ADD COLUMN IF NOT EXISTS mcs150_date date;


-- ============================================================
-- CRM / FMCSA SYNC INFORMATION
-- ============================================================

ALTER TABLE public.carriers
    ADD COLUMN IF NOT EXISTS lead_status text DEFAULT 'new',
    ADD COLUMN IF NOT EXISTS last_fmcsa_sync timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();


-- ============================================================
-- DATA DEFAULTS
-- ============================================================

UPDATE public.carriers
SET
    truck_units = COALESCE(truck_units, 0),
    bus_units = COALESCE(bus_units, 0),
    total_cdl = COALESCE(total_cdl, 0),
    hazmat = COALESCE(hazmat, false),
    cargo = COALESCE(cargo, '{}'::jsonb),
    lead_status = COALESCE(lead_status, 'new')
WHERE
    truck_units IS NULL
    OR bus_units IS NULL
    OR total_cdl IS NULL
    OR hazmat IS NULL
    OR cargo IS NULL
    OR lead_status IS NULL;


-- ============================================================
-- USDOT MUST BE UNIQUE
--
-- Multiple NULL values are allowed by PostgreSQL.
-- Duplicate real DOT numbers are NOT allowed.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS carriers_dot_number_unique_idx
ON public.carriers (dot_number);


-- ============================================================
-- SEARCH INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS carriers_legal_name_idx
ON public.carriers (legal_name);

CREATE INDEX IF NOT EXISTS carriers_mc_number_idx
ON public.carriers (mc_number);

CREATE INDEX IF NOT EXISTS carriers_state_idx
ON public.carriers (state);

CREATE INDEX IF NOT EXISTS carriers_city_idx
ON public.carriers (city);

CREATE INDEX IF NOT EXISTS carriers_status_code_idx
ON public.carriers (status_code);

CREATE INDEX IF NOT EXISTS carriers_power_units_idx
ON public.carriers (power_units);

CREATE INDEX IF NOT EXISTS carriers_drivers_idx
ON public.carriers (drivers);

CREATE INDEX IF NOT EXISTS carriers_lead_score_idx
ON public.carriers (lead_score DESC);

CREATE INDEX IF NOT EXISTS carriers_email_idx
ON public.carriers (email);

CREATE INDEX IF NOT EXISTS carriers_authority_age_idx
ON public.carriers (authority_age);


COMMIT;