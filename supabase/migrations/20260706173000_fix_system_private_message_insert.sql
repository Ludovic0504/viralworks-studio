-- Insertion / fermeture des quick replies en une seule transaction (le flag session
-- ne survit pas entre deux appels HTTP distincts du client service_role).

create or replace function public.insert_system_private_message(
  p_conversation_id uuid,
  p_user_id uuid,
  p_content text,
  p_onboarding_step smallint,
  p_quick_reply_options jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_now timestamptz := now();
begin
  perform set_config('vws.system_private_message_write', '1', true);

  insert into public.community_private_messages (
    conversation_id,
    user_id,
    content,
    onboarding_step,
    quick_reply_options
  ) values (
    p_conversation_id,
    p_user_id,
    p_content,
    p_onboarding_step,
    p_quick_reply_options
  )
  returning id into v_id;

  update public.community_private_conversations
  set updated_at = v_now
  where id = p_conversation_id;

  return v_id;
end;
$$;

revoke all on function public.insert_system_private_message(uuid, uuid, text, smallint, jsonb) from public;
grant execute on function public.insert_system_private_message(uuid, uuid, text, smallint, jsonb) to service_role;

create or replace function public.close_message_quick_replies(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('vws.system_private_message_write', '1', true);

  update public.community_private_messages
  set quick_replies_closed_at = now()
  where id = p_message_id
    and quick_replies_closed_at is null;
end;
$$;

revoke all on function public.close_message_quick_replies(uuid) from public;
grant execute on function public.close_message_quick_replies(uuid) to service_role;

-- Rattrapage : messages de bienvenue déjà envoyés sans métadonnées quick replies.
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
