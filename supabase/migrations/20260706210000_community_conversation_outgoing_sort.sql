-- Tri inbox : dernier envoi utilisateur + message entrant support (sans réordonner sur messages reçus des autres).

create or replace function public.community_private_conversation_activity_meta(p_ids uuid[])
returns table (
  conversation_id uuid,
  last_outgoing_at timestamptz,
  has_incoming_from_support boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select auth.uid() as user_id
  ),
  support as (
    select p.user_id
    from public.profiles p
    where lower(coalesce(p.email, '')) = 'jean.limonta06@gmail.com'
    limit 1
  )
  select
    c.id as conversation_id,
    (
      select max(m.created_at)
      from public.community_private_messages m
      where m.conversation_id = c.id
        and m.user_id = (select user_id from viewer)
    ) as last_outgoing_at,
    exists (
      select 1
      from public.community_private_messages m
      where m.conversation_id = c.id
        and m.user_id is distinct from (select user_id from viewer)
        and m.user_id = (select user_id from support)
    ) as has_incoming_from_support
  from public.community_private_conversations c
  where c.id = any(p_ids)
    and exists (
      select 1
      from public.community_private_participants part
      where part.conversation_id = c.id
        and part.user_id = (select user_id from viewer)
    );
$$;

revoke all on function public.community_private_conversation_activity_meta(uuid[]) from public;
grant execute on function public.community_private_conversation_activity_meta(uuid[]) to authenticated;
grant execute on function public.community_private_conversation_activity_meta(uuid[]) to service_role;

comment on function public.community_private_conversation_activity_meta(uuid[]) is
  'Métadonnées de tri inbox : dernier message envoyé par le viewer + présence d''un message support.';
