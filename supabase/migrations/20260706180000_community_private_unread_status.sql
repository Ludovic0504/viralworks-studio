-- Statut non-lus privés : compteur + dernier message (aperçu pour notification header).

create or replace function public.community_private_unread_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with unread as (
    select
      m.id as message_id,
      m.conversation_id,
      m.user_id as sender_user_id,
      m.content,
      m.created_at,
      coalesce(
        nullif(trim(p.full_name), ''),
        nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
        nullif(trim(p.first_name), ''),
        nullif(split_part(p.email, '@', 1), ''),
        'Utilisateur'
      ) as sender_name,
      lower(coalesce(p.email, '')) = 'jean.limonta06@gmail.com' as is_support
    from public.community_private_messages m
    inner join public.community_private_participants part
      on part.conversation_id = m.conversation_id
      and part.user_id = auth.uid()
    left join public.profiles p on p.user_id = m.user_id
    where m.user_id is distinct from auth.uid()
      and (
        part.last_read_at is null
        or m.created_at > part.last_read_at
      )
  ),
  counted as (
    select count(*)::int as unread_count from unread
  ),
  latest as (
    select *
    from unread
    order by created_at desc
    limit 1
  )
  select jsonb_build_object(
    'count',
    (select unread_count from counted),
    'preview',
    (
      select case
        when l.message_id is null then null
        else jsonb_build_object(
          'message_id', l.message_id,
          'conversation_id', l.conversation_id,
          'sender_user_id', l.sender_user_id,
          'sender_name', l.sender_name,
          'is_support', l.is_support,
          'content_preview', left(trim(replace(l.content, E'\n', ' ')), 140),
          'created_at', l.created_at
        )
      end
      from latest l
    )
  );
$$;

revoke all on function public.community_private_unread_status() from public;
grant execute on function public.community_private_unread_status() to authenticated;

comment on function public.community_private_unread_status() is
  'Compte les messages privés non lus et renvoie un aperçu du plus récent (header / toast).';
