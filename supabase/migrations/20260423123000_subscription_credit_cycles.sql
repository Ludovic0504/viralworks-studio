-- Allocation mensuelle des crédits pour l'abonnement annuel

create table if not exists public.subscription_credit_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_subscription_id text not null unique,
  plan_key text not null check (plan_key in ('monthly', 'yearly')),
  monthly_credit_amount integer not null default 30,
  granted_months integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_credit_cycles_user_id_idx
  on public.subscription_credit_cycles (user_id);

alter table public.subscription_credit_cycles enable row level security;
