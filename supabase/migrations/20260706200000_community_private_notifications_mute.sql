-- Mute par conversation + métadonnées inbox (badges par conversation / header).

alter table public.community_private_participants
  add column if not exists notifications_muted boolean not null default false;

comment on column public.community_private_participants.notifications_muted is
  'Si true : pas de badge sur le bouton Messages global ; badge conversation conservé (style muet).';

create or replace function public.community_private_unread_message_count_for_participant(
  p_conversation_id uuid,
  p_user_id uuid,
  p_last_read_at timestamptz
)
returns integer
language sql
stable
as $$
  select coalesce(count(*)::int, 0)
  from public.community_private_messages m
  where m.conversation_id = p_conversation_id
    and m.user_id is distinct from p_user_id
    and (
      p_last_read_at is null
      or m.created_at > p_last_read_at
    );
$$;

create or replace function public.community_private_inbox_meta()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'conversation_id', p.conversation_id,
        'unread_count',
        public.community_private_unread_message_count_for_participant(
          p.conversation_id,
          p.user_id,
          p.last_read_at
        ),
        'notifications_muted', coalesce(p.notifications_muted, false)
      )
      order by p.conversation_id
    ),
    '[]'::jsonb
  )
  from public.community_private_participants p
  where p.user_id = auth.uid();
$$;

revoke all on function public.community_private_inbox_meta() from public;
grant execute on function public.community_private_inbox_meta() to authenticated;

create or replace function public.community_unread_private_message_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select sum(
        public.community_private_unread_message_count_for_participant(
          p.conversation_id,
          p.user_id,
          p.last_read_at
        )
      )::bigint
      from public.community_private_participants p
      where p.user_id = auth.uid()
        and coalesce(p.notifications_muted, false) = false
    ),
    0
  );
$$;

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
        nullif(trim(p_prof.full_name), ''),
        nullif(trim(concat_ws(' ', p_prof.first_name, p_prof.last_name)), ''),
        nullif(trim(p_prof.first_name), ''),
        nullif(split_part(p_prof.email, '@', 1), ''),
        'Utilisateur'
      ) as sender_name,
      lower(coalesce(p_prof.email, '')) = 'jean.limonta06@gmail.com' as is_support
    from public.community_private_messages m
    inner join public.community_private_participants part
      on part.conversation_id = m.conversation_id
      and part.user_id = auth.uid()
    left join public.profiles p_prof on p_prof.user_id = m.user_id
    where m.user_id is distinct from auth.uid()
      and coalesce(part.notifications_muted, false) = false
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

comment on function public.community_private_inbox_meta() is
  'Métadonnées inbox privée : non-lus par conversation + état mute (badges liste).';
