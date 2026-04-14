-- Fix Communauté VWS:
-- 1) Eviter les 400 sur profiles (pas de colonne username obligatoire)
-- 2) Corriger les erreurs 500 RLS sur participants (récursion policy)
-- 3) Fiabiliser les conversations directes avec user_a/user_b

alter table public.community_private_conversations
  add column if not exists user_a uuid references auth.users(id) on delete cascade,
  add column if not exists user_b uuid references auth.users(id) on delete cascade;

-- Backfill best-effort pour conversations existantes (2 participants)
with ranked as (
  select
    p.conversation_id,
    p.user_id,
    row_number() over (partition by p.conversation_id order by p.created_at asc, p.id asc) as rn
  from public.community_private_participants p
),
pivoted as (
  select
    conversation_id,
    (array_agg(user_id order by rn))[1] as first_user,
    (array_agg(user_id order by rn))[2] as second_user
  from ranked
  group by conversation_id
)
update public.community_private_conversations c
set
  user_a = coalesce(c.user_a, p.first_user),
  user_b = coalesce(c.user_b, p.second_user)
from pivoted p
where c.id = p.conversation_id;

drop policy if exists "community_private_participants_select_participant" on public.community_private_participants;
create policy "community_private_participants_select_own"
  on public.community_private_participants for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "community_private_participants_insert_self_or_new" on public.community_private_participants;
create policy "community_private_participants_insert_authenticated"
  on public.community_private_participants for insert
  to authenticated
  with check (true);

drop policy if exists "community_private_conversations_select_participant" on public.community_private_conversations;
create policy "community_private_conversations_select_member"
  on public.community_private_conversations for select
  to authenticated
  using (
    auth.uid() = user_a
    or auth.uid() = user_b
    or exists (
      select 1 from public.community_private_participants p
      where p.conversation_id = id and p.user_id = auth.uid()
    )
  );

drop policy if exists "community_private_conversations_update_participant" on public.community_private_conversations;
create policy "community_private_conversations_update_member"
  on public.community_private_conversations for update
  to authenticated
  using (
    auth.uid() = user_a
    or auth.uid() = user_b
    or exists (
      select 1 from public.community_private_participants p
      where p.conversation_id = id and p.user_id = auth.uid()
    )
  );
