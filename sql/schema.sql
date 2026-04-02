create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'helper_role') then
    create type helper_role as enum ('super_admin', 'admin', 'helper');
  end if;

  if not exists (select 1 from pg_type where typname = 'approval_status') then
    create type approval_status as enum ('pending', 'approved', 'rejected', 'suspended');
  end if;

  if not exists (select 1 from pg_type where typname = 'license_key_type') then
    create type license_key_type as enum ('temp', 'standard');
  end if;

  if not exists (select 1 from pg_type where typname = 'license_status') then
    create type license_status as enum ('unused', 'active', 'expired', 'revoked');
  end if;

  if not exists (select 1 from pg_type where typname = 'activation_status') then
    create type activation_status as enum ('active', 'mismatch', 'revoked');
  end if;
end
$$;

create table if not exists public.helpers (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  telegram_username text,
  full_name text not null,
  role helper_role not null default 'helper',
  approval_status approval_status not null default 'pending',
  approved_by uuid references public.helpers(id),
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.license_keys (
  id uuid primary key default gen_random_uuid(),
  key_code text not null unique,
  signed_payload jsonb not null,
  product_code text not null,
  key_type license_key_type not null,
  duration_value integer not null check (duration_value > 0),
  duration_unit text not null check (duration_unit in ('hours', 'days', 'months', 'years')),
  hwid text not null,
  generated_by_helper_id uuid not null references public.helpers(id),
  generated_at timestamptz not null default timezone('utc', now()),
  status license_status not null default 'unused',
  activated_at timestamptz,
  expires_at timestamptz not null,
  notes text
);

create table if not exists public.activations (
  id uuid primary key default gen_random_uuid(),
  license_key_id uuid not null references public.license_keys(id) on delete cascade,
  hwid text not null,
  activated_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  app_version text,
  device_name text,
  status activation_status not null default 'active'
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  actor_id text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_settings (
  id uuid primary key default gen_random_uuid(),
  admin_telegram_user_id bigint not null unique,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bot_sessions (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  flow text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.get_helper_generation_stats()
returns table (
  id uuid,
  full_name text,
  telegram_username text,
  status approval_status,
  total_generated bigint,
  temp_count bigint,
  standard_count bigint,
  last_generated_time timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    h.id,
    h.full_name,
    h.telegram_username,
    h.approval_status as status,
    count(lk.id) as total_generated,
    count(lk.id) filter (where lk.key_type = 'temp') as temp_count,
    count(lk.id) filter (where lk.key_type = 'standard') as standard_count,
    max(lk.generated_at) as last_generated_time
  from public.helpers h
  left join public.license_keys lk on lk.generated_by_helper_id = h.id
  group by h.id, h.full_name, h.telegram_username, h.approval_status
  order by max(lk.generated_at) desc nulls last, h.created_at desc;
$$;

create index if not exists idx_helpers_status on public.helpers(approval_status);
create index if not exists idx_helpers_role on public.helpers(role);
create index if not exists idx_license_keys_generated_by on public.license_keys(generated_by_helper_id);
create index if not exists idx_license_keys_status on public.license_keys(status);
create index if not exists idx_license_keys_type on public.license_keys(key_type);
create index if not exists idx_license_keys_hwid on public.license_keys(hwid);
create index if not exists idx_license_keys_generated_at on public.license_keys(generated_at desc);
create index if not exists idx_activations_license on public.activations(license_key_id);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_type, actor_id);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists helpers_set_updated_at on public.helpers;
create trigger helpers_set_updated_at
before update on public.helpers
for each row
execute function public.set_updated_at();

drop trigger if exists bot_sessions_set_updated_at on public.bot_sessions;
create trigger bot_sessions_set_updated_at
before update on public.bot_sessions
for each row
execute function public.set_updated_at();

alter table public.helpers enable row level security;
alter table public.license_keys enable row level security;
alter table public.activations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.admin_settings enable row level security;
alter table public.bot_sessions enable row level security;

create policy "service_role_all_helpers"
on public.helpers
for all
to service_role
using (true)
with check (true);

create policy "service_role_all_license_keys"
on public.license_keys
for all
to service_role
using (true)
with check (true);

create policy "service_role_all_activations"
on public.activations
for all
to service_role
using (true)
with check (true);

create policy "service_role_all_audit_logs"
on public.audit_logs
for all
to service_role
using (true)
with check (true);

create policy "service_role_all_admin_settings"
on public.admin_settings
for all
to service_role
using (true)
with check (true);

create policy "service_role_all_bot_sessions"
on public.bot_sessions
for all
to service_role
using (true)
with check (true);
