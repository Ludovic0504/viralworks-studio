-- Tracking des clics depuis les bios réseaux sociaux (/go/:source)
create table if not exists public.link_clicks (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  clicked_at timestamptz not null default now(),
  user_agent text,
  ip text
);

create index if not exists link_clicks_source_clicked_at_idx
  on public.link_clicks (source, clicked_at desc);

alter table public.link_clicks enable row level security;

-- Aucune policy pour anon/authenticated : insert réservé au service_role (API Vercel).
