create extension if not exists pgcrypto;

create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  telegram_username text,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  telegram_user_id bigint not null,
  hwid text not null,
  email text not null,
  amount_kobo integer not null,
  currency text not null default 'NGN',
  status text not null default 'pending_payment',
  paystack_reference text unique,
  paystack_access_code text,
  paystack_authorization_url text,
  paystack_paid_at timestamptz,
  paystack_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  telegram_user_id bigint not null,
  hwid text not null,
  kind text not null,
  expires_at timestamptz,
  license_key text not null unique,
  payload jsonb not null,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bot_state (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  state text not null default 'idle',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_telegram_user_id on public.orders (telegram_user_id);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_orders_hwid on public.orders (hwid);
create index if not exists idx_licenses_telegram_user_id on public.licenses (telegram_user_id);
create index if not exists idx_licenses_hwid on public.licenses (hwid);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_buyers_updated_at on public.buyers;
create trigger trg_buyers_updated_at
before update on public.buyers
for each row
execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

drop trigger if exists trg_bot_state_updated_at on public.bot_state;
create trigger trg_bot_state_updated_at
before update on public.bot_state
for each row
execute function public.set_updated_at();
