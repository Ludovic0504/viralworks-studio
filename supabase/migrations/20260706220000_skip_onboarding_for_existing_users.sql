-- Exclure rétroactivement l'onboarding auto pour comptes existants et contacts support manuels.

update public.community_welcome_flow wf
set completed_at = coalesce(wf.completed_at, now())
from public.profiles p
where wf.user_id = p.user_id
  and p.created_at < timestamptz '2026-07-06T17:00:00+00';

with support_account as (
  select p.user_id
  from public.profiles p
  where lower(coalesce(p.email, '')) = 'jean.limonta06@gmail.com'
  limit 1
),
manual_support_conversations as (
  select distinct
    part.user_id as member_user_id,
    m.conversation_id
  from public.community_private_messages m
  inner join public.community_private_participants part
    on part.conversation_id = m.conversation_id
  inner join support_account s
    on m.user_id = s.user_id
  where m.onboarding_step is null
    and part.user_id is distinct from m.user_id
)
insert into public.community_welcome_flow (user_id, conversation_id, completed_at)
select member_user_id, conversation_id, now()
from manual_support_conversations
on conflict (user_id) do update
  set
    completed_at = coalesce(public.community_welcome_flow.completed_at, excluded.completed_at),
    conversation_id = excluded.conversation_id;
