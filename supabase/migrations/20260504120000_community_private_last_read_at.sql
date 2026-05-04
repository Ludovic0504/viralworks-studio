-- Suivi des non-lus : last_read_at par participant (conversation + user)

alter table public.community_private_participants
  add column if not exists last_read_at timestamptz null;

create index if not exists idx_community_private_participants_user_conversation
  on public.community_private_participants (user_id, conversation_id);

drop policy if exists "community_private_participants_update_own" on public.community_private_participants;
create policy "community_private_participants_update_own"
  on public.community_private_participants for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Comptage des messages non lus (autres que l’utilisateur, après last_read_at)
create or replace function public.community_unread_private_message_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select count(*)::bigint
      from public.community_private_messages m
      inner join public.community_private_participants p
        on p.conversation_id = m.conversation_id
        and p.user_id = auth.uid()
      where m.user_id is distinct from auth.uid()
        and (
          p.last_read_at is null
          or m.created_at > p.last_read_at
        )
    ),
    0
  );
$$;

revoke all on function public.community_unread_private_message_count() from public;
grant execute on function public.community_unread_private_message_count() to authenticated;
