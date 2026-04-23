-- Cadeau physique (Gelato) : une seule expédition par utilisateur, première adhésion
-- aux abonnements boutique mensuel (129 €) ou annuel (107 €/mois facturé annuellement).

create table if not exists public.welcome_gift_shipments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_checkout_session_id text not null,
  subscription_plan text not null,
  amount_total_cents integer,
  status text not null default 'pending'
    check (status in ('pending', 'submitted', 'failed')),
  gelato_order_id text,
  gelato_response jsonb,
  error_message text,
  shipping_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint welcome_gift_shipments_user_unique unique (user_id),
  constraint welcome_gift_shipments_session_unique unique (stripe_checkout_session_id)
);

create index if not exists welcome_gift_shipments_user_id_idx
  on public.welcome_gift_shipments (user_id);

alter table public.welcome_gift_shipments enable row level security;
