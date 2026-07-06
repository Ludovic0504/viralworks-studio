-- Corrige la politique INSERT : conversation_id ambigu dans la sous-requête participants.
drop policy if exists "community_private_messages_insert_own" on public.community_private_messages;

create policy "community_private_messages_insert_own"
  on public.community_private_messages for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      exists (
        select 1
        from public.community_private_participants p
        where p.conversation_id = community_private_messages.conversation_id
          and p.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.community_private_conversations c
        where c.id = community_private_messages.conversation_id
          and (c.user_a = auth.uid() or c.user_b = auth.uid())
      )
    )
  );
