BEGIN;

-- ============================================================
-- SlateLane Dispatch CRM
-- Migration 014
-- Production Email Launch Controls
-- ============================================================


CREATE TABLE IF NOT EXISTS public.email_launch_settings (

    id integer PRIMARY KEY DEFAULT 1,

    sending_enabled boolean NOT NULL DEFAULT false,

    daily_send_cap integer NOT NULL DEFAULT 25,

    max_batch_size integer NOT NULL DEFAULT 10,

    sending_hour_start integer NOT NULL DEFAULT 9,

    sending_hour_end integer NOT NULL DEFAULT 17,

    sending_timezone text NOT NULL DEFAULT 'America/Chicago',

    minimum_carrier_score integer NOT NULL DEFAULT 80,

    require_active_authority boolean NOT NULL DEFAULT true,

    require_email boolean NOT NULL DEFAULT true,

    skip_replied boolean NOT NULL DEFAULT true,

    skip_bounced boolean NOT NULL DEFAULT true,

    skip_complained boolean NOT NULL DEFAULT true,

    skip_opted_out boolean NOT NULL DEFAULT true,

    pilot_mode boolean NOT NULL DEFAULT true,

    pilot_limit integer NOT NULL DEFAULT 25,

    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT email_launch_settings_singleton
        CHECK (id = 1),

    CONSTRAINT email_launch_settings_daily_cap_check
        CHECK (
            daily_send_cap >= 0
            AND daily_send_cap <= 10000
        ),

    CONSTRAINT email_launch_settings_batch_check
        CHECK (
            max_batch_size >= 1
            AND max_batch_size <= 100
        ),

    CONSTRAINT email_launch_settings_hours_check
        CHECK (
            sending_hour_start >= 0
            AND sending_hour_start <= 23
            AND sending_hour_end >= 1
            AND sending_hour_end <= 24
            AND sending_hour_start < sending_hour_end
        ),

    CONSTRAINT email_launch_settings_score_check
        CHECK (
            minimum_carrier_score >= 0
            AND minimum_carrier_score <= 100
        ),

    CONSTRAINT email_launch_settings_pilot_limit_check
        CHECK (
            pilot_limit >= 1
            AND pilot_limit <= 1000
        )
);


-- ============================================================
-- DEFAULT / SINGLETON CONFIG
-- IMPORTANT: SENDING STARTS OFF
-- ============================================================

INSERT INTO public.email_launch_settings (
    id,
    sending_enabled,
    daily_send_cap,
    max_batch_size,
    sending_hour_start,
    sending_hour_end,
    sending_timezone,
    minimum_carrier_score,
    require_active_authority,
    require_email,
    skip_replied,
    skip_bounced,
    skip_complained,
    skip_opted_out,
    pilot_mode,
    pilot_limit,
    notes
)
VALUES (
    1,
    false,
    25,
    10,
    9,
    17,
    'America/Chicago',
    80,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    25,
    'Production controls installed. Real carrier sending disabled until pilot approval.'
)
ON CONFLICT (id)
DO NOTHING;


-- ============================================================
-- INDEX FOR DAILY SEND COUNTING
-- ============================================================

CREATE INDEX IF NOT EXISTS
    email_sends_created_at_idx
ON public.email_sends (
    created_at DESC
);


COMMENT ON TABLE public.email_launch_settings IS
    'Global safety and launch controls for SlateLane production email automation.';

COMMENT ON COLUMN public.email_launch_settings.sending_enabled IS
    'Master switch. False prevents automated campaign sending.';

COMMENT ON COLUMN public.email_launch_settings.daily_send_cap IS
    'Maximum number of automated emails allowed per operational day.';

COMMENT ON COLUMN public.email_launch_settings.max_batch_size IS
    'Maximum emails processed during a single scheduler execution.';

COMMENT ON COLUMN public.email_launch_settings.pilot_mode IS
    'Restricts outreach while SlateLane is in controlled production pilot mode.';

COMMENT ON COLUMN public.email_launch_settings.pilot_limit IS
    'Maximum carrier population allowed for a controlled pilot campaign.';


COMMIT;