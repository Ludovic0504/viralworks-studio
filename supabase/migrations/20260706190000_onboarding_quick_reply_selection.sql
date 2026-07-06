-- Sélection visuelle des réponses rapides (sans message utilisateur dupliqué) + étape 3.

alter table public.community_private_messages
  add column if not exists quick_reply_selected text null;

alter table public.community_welcome_flow
  add column if not exists step1_answer text null,
  add column if not exists step1_answer_method text null,
  add column if not exists step2_answer text null,
  add column if not exists step2_answer_method text null,
  add column if not exists step3_message_id uuid null
    references public.community_private_messages(id) on delete set null;

alter table public.community_private_messages
  drop constraint if exists community_private_messages_onboarding_step_check;

alter table public.community_private_messages
  add constraint community_private_messages_onboarding_step_check
  check (onboarding_step is null or onboarding_step in (1, 2, 3));

create or replace function public.insert_system_private_message(
  p_conversation_id uuid,
  p_user_id uuid,
  p_content text,
  p_onboarding_step smallint,
  p_quick_reply_options jsonb default null
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
    new.quick_reply_selected := null;
  elsif tg_op = 'UPDATE' then
    new.quick_reply_options := old.quick_reply_options;
    new.onboarding_step := old.onboarding_step;
    new.quick_replies_closed_at := old.quick_replies_closed_at;
    new.quick_reply_selected := old.quick_reply_selected;
  end if;

  return new;
end;
$$;

create or replace function public.set_onboarding_quick_reply_selected(
  p_message_id uuid,
  p_user_id uuid,
  p_label text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message record;
begin
  select m.id, m.conversation_id, m.user_id, m.onboarding_step
  into v_message
  from public.community_private_messages m
  where m.id = p_message_id;

  if v_message.id is null then
    raise exception 'MESSAGE_NOT_FOUND';
  end if;

  if v_message.onboarding_step is null or v_message.onboarding_step not in (1, 2) then
    raise exception 'NOT_ONBOARDING_MESSAGE';
  end if;

  if not exists (
    select 1
    from public.community_private_participants p
    where p.conversation_id = v_message.conversation_id
      and p.user_id = p_user_id
  ) then
    raise exception 'NOT_PARTICIPANT';
  end if;

  if exists (
    select 1
    from public.profiles pr
    where pr.user_id = v_message.user_id
      and lower(coalesce(pr.email, '')) = 'jean.limonta06@gmail.com'
  ) then
    perform set_config('vws.system_private_message_write', '1', true);

    update public.community_private_messages
    set quick_reply_selected = nullif(trim(p_label), '')
    where id = p_message_id
      and quick_reply_selected is null;
  else
    raise exception 'INVALID_MESSAGE_AUTHOR';
  end if;
end;
$$;

revoke all on function public.set_onboarding_quick_reply_selected(uuid, uuid, text) from public;
grant execute on function public.set_onboarding_quick_reply_selected(uuid, uuid, text) to service_role;
