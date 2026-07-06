-- Dernier message par conversation (aperçu sidebar) sans charger tout l'historique.
create or replace function public.community_last_private_messages_by_conversations(p_ids uuid[])
returns table(conversation_id uuid, content text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (m.conversation_id)
    m.conversation_id,
    m.content,
    m.created_at
  from public.community_private_messages m
  where m.conversation_id = any(p_ids)
  order by m.conversation_id, m.created_at desc;
$$;

revoke all on function public.community_last_private_messages_by_conversations(uuid[]) from public;
grant execute on function public.community_last_private_messages_by_conversations(uuid[]) to service_role;

comment on function public.community_last_private_messages_by_conversations(uuid[]) is
  'Dernier message brut par conversation (service role / Edge Functions uniquement).';
