-- Connexions réseaux sociaux (tokens écrits uniquement via service_role / Edge Functions)

create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null
    check (provider in ('instagram', 'facebook', 'tiktok', 'youtube')),
  provider_user_id text not null,
  username text null,
  display_name text null,
  avatar_url text null,
  access_token text null,
  refresh_token text null,
  token_expires_at timestamptz null,
  scopes text[] null,
  status text not null default 'connected'
    check (status in ('connected', 'expired', 'revoked')),
  metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_connections_user_provider_unique unique (user_id, provider)
);

create index if not exists idx_social_connections_user
  on public.social_connections(user_id);

create index if not exists idx_social_connections_provider
  on public.social_connections(provider);

alter table public.social_connections enable row level security;

revoke all on table public.social_connections from anon, authenticated;
grant all on table public.social_connections to service_role;

-- Colonnes publiques seulement (pas access_token / refresh_token)
grant select (
  id,
  user_id,
  provider,
  provider_user_id,
  username,
  display_name,
  avatar_url,
  status,
  metadata,
  connected_at,
  updated_at,
  token_expires_at
) on table public.social_connections to authenticated;

grant delete on table public.social_connections to authenticated;

drop policy if exists "social_connections_select_own" on public.social_connections;
create policy "social_connections_select_own"
  on public.social_connections
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "social_connections_delete_own" on public.social_connections;
create policy "social_connections_delete_own"
  on public.social_connections
  for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.social_connections is
  'Comptes sociaux liés. Tokens écrits uniquement via Edge Functions (service_role).';
