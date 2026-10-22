begin;

create table if not exists public.carrier_portal_upload_intents (
  id uuid primary key default gen_random_uuid(),
  portal_access_id uuid not null references public.carrier_portal_access(id) on delete cascade,
  onboarding_id uuid not null references public.carrier_onboardings(id) on delete cascade,
  email text not null check (email = lower(btrim(email))),
  document_type text not null check (document_type = any (array[
    'w9','authority','coi','factoring_agreement','factoring_noa','limited_power_of_attorney'
  ])),
  storage_path text not null unique,
  file_name text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 15728640),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finalized_at timestamptz
);

create index if not exists carrier_portal_upload_intents_access_expiry_idx
  on public.carrier_portal_upload_intents (portal_access_id, expires_at desc);

alter table public.carrier_portal_upload_intents enable row level security;
revoke all on table public.carrier_portal_upload_intents from anon, authenticated;
grant all on table public.carrier_portal_upload_intents to service_role;

commit;
