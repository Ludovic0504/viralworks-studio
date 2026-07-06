-- Le trigger BEFORE UPDATE annulait aussi les backfills SQL (onboarding_step / quick_reply_options).

create or replace function public.guard_community_private_message_system_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('vws.system_private_message_write', true), '') = '1' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.quick_reply_options := null;
    new.onboarding_step := null;
    new.quick_replies_closed_at := null;
  elsif tg_op = 'UPDATE' then
    new.quick_reply_options := old.quick_reply_options;
    new.onboarding_step := old.onboarding_step;
    new.quick_replies_closed_at := old.quick_replies_closed_at;
  end if;

  return new;
end;
$$;

-- Rattrapage (après correction du trigger).
update public.community_private_messages m
set
  onboarding_step = 1,
  quick_reply_options = '["Instagram","Skool","Groupe Facebook","Google/autre","Par recommandation","Autres"]'::jsonb
from public.community_welcome_flow w
where w.step1_message_id = m.id
  and m.onboarding_step is null;

update public.community_private_messages m
set
  onboarding_step = 2,
  quick_reply_options = '["Créer des visuels","Créer des vidéos","Éditer des vidéos","Autres"]'::jsonb
from public.community_welcome_flow w
where w.step2_message_id = m.id
  and m.onboarding_step is null;

update public.community_private_messages m
set
  onboarding_step = 1,
  quick_reply_options = '["Instagram","Skool","Groupe Facebook","Google/autre","Par recommandation","Autres"]'::jsonb
where m.onboarding_step is null
  and m.user_id = (
    select p.user_id from public.profiles p
    where lower(p.email) = 'jean.limonta06@gmail.com'
    limit 1
  )
  and m.content like 'Salut 👋%'
  and not exists (
    select 1 from public.community_private_messages m2
    where m2.conversation_id = m.conversation_id
      and m2.onboarding_step = 1
      and m2.id <> m.id
  );
