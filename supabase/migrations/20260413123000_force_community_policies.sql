-- Force correct RLS policies for Community VWS.
-- This migration removes recursive participant checks and reinstalls safe policies.

alter table public.community_private_conversations
  add column if not exists user_a uuid references auth.users(id) on delete cascade,
  add column if not exists user_b uuid references auth.users(id) on delete cascade;

drop policy if exists "community_private_conversations_select_participant" on public.community_private_conversations;
drop policy if exists "community_private_conversations_select_member" on public.community_private_conversations;
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
drop policy if exists "community_private_conversations_update_member" on public.community_private_conversations;
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

drop policy if exists "community_private_participants_select_participant" on public.community_private_participants;
drop policy if exists "community_private_participants_select_own" on public.community_private_participants;
create policy "community_private_participants_select_own"
  on public.community_private_participants for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "community_private_participants_insert_self_or_new" on public.community_private_participants;
drop policy if exists "community_private_participants_insert_authenticated" on public.community_private_participants;
create policy "community_private_participants_insert_authenticated"
  on public.community_private_participants for insert
  to authenticated
  with check (true);
