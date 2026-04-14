-- Communauté VWS: salon public + conversations privées + médias.

create extension if not exists "pgcrypto";

create table if not exists public.community_public_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  attachment_url text null,
  attachment_type text null,
  attachment_size bigint null,
  attachment_name text null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_private_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_private_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.community_private_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(conversation_id, user_id)
);

create table if not exists public.community_private_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.community_private_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  attachment_url text null,
  attachment_type text null,
  attachment_size bigint null,
  attachment_name text null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_private_hidden (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.community_private_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  unique(conversation_id, user_id)
);

create index if not exists idx_community_public_messages_created_at
  on public.community_public_messages(created_at);
create index if not exists idx_community_public_messages_user_id
  on public.community_public_messages(user_id);
create index if not exists idx_community_private_messages_conversation_created
  on public.community_private_messages(conversation_id, created_at);
create index if not exists idx_community_private_participants_user
  on public.community_private_participants(user_id);
create index if not exists idx_community_private_hidden_user
  on public.community_private_hidden(user_id);

alter table public.community_public_messages enable row level security;
alter table public.community_private_conversations enable row level security;
alter table public.community_private_participants enable row level security;
alter table public.community_private_messages enable row level security;
alter table public.community_private_hidden enable row level security;

drop policy if exists "community_public_messages_select_all" on public.community_public_messages;
create policy "community_public_messages_select_all"
  on public.community_public_messages for select
  to authenticated
  using (true);

drop policy if exists "community_public_messages_insert_own" on public.community_public_messages;
create policy "community_public_messages_insert_own"
  on public.community_public_messages for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "community_public_messages_delete_own" on public.community_public_messages;
create policy "community_public_messages_delete_own"
  on public.community_public_messages for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "community_private_conversations_select_participant" on public.community_private_conversations;
create policy "community_private_conversations_select_participant"
  on public.community_private_conversations for select
  to authenticated
  using (
    exists (
      select 1 from public.community_private_participants p
      where p.conversation_id = id and p.user_id = auth.uid()
    )
  );

drop policy if exists "community_private_conversations_insert_authenticated" on public.community_private_conversations;
create policy "community_private_conversations_insert_authenticated"
  on public.community_private_conversations for insert
  to authenticated
  with check (true);

drop policy if exists "community_private_conversations_update_participant" on public.community_private_conversations;
create policy "community_private_conversations_update_participant"
  on public.community_private_conversations for update
  to authenticated
  using (
    exists (
      select 1 from public.community_private_participants p
      where p.conversation_id = id and p.user_id = auth.uid()
    )
  );

drop policy if exists "community_private_participants_select_participant" on public.community_private_participants;
create policy "community_private_participants_select_participant"
  on public.community_private_participants for select
  to authenticated
  using (
    exists (
      select 1 from public.community_private_participants self
      where self.conversation_id = conversation_id and self.user_id = auth.uid()
    )
  );

drop policy if exists "community_private_participants_insert_self_or_new" on public.community_private_participants;
create policy "community_private_participants_insert_self_or_new"
  on public.community_private_participants for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.community_private_participants self
      where self.conversation_id = conversation_id and self.user_id = auth.uid()
    )
  );

drop policy if exists "community_private_messages_select_participant" on public.community_private_messages;
create policy "community_private_messages_select_participant"
  on public.community_private_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.community_private_participants p
      where p.conversation_id = conversation_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "community_private_messages_insert_own" on public.community_private_messages;
create policy "community_private_messages_insert_own"
  on public.community_private_messages for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.community_private_participants p
      where p.conversation_id = conversation_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "community_private_messages_delete_own" on public.community_private_messages;
create policy "community_private_messages_delete_own"
  on public.community_private_messages for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "community_private_hidden_select_own" on public.community_private_hidden;
create policy "community_private_hidden_select_own"
  on public.community_private_hidden for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "community_private_hidden_insert_own" on public.community_private_hidden;
create policy "community_private_hidden_insert_own"
  on public.community_private_hidden for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "community_private_hidden_delete_own" on public.community_private_hidden;
create policy "community_private_hidden_delete_own"
  on public.community_private_hidden for delete
  to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', true)
on conflict (id) do nothing;

drop policy if exists "community_media_public_read" on storage.objects;
create policy "community_media_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'community-media');

drop policy if exists "community_media_upload_own" on storage.objects;
create policy "community_media_upload_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "community_media_delete_own" on storage.objects;
create policy "community_media_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
