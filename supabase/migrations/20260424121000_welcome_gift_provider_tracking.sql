-- Suivi opérationnel des cadeaux chez les fournisseurs (Gelato / Printful)

alter table public.welcome_gift_shipments
  add column if not exists provider_status text,
  add column if not exists provider_last_check_at timestamptz,
  add column if not exists provider_tracking jsonb,
  add column if not exists provider_event_log jsonb not null default '[]'::jsonb;

create index if not exists welcome_gift_shipments_provider_status_idx
  on public.welcome_gift_shipments (provider_status);

create index if not exists welcome_gift_shipments_provider_last_check_idx
  on public.welcome_gift_shipments (provider_last_check_at);
