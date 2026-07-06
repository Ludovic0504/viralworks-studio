-- Onboarding privé : quick replies, suivi du flux de bienvenue, triggers HTTP.

-- Métadonnées optionnelles sur les messages privés (support / réponses utilisateur).
alter table public.community_private_messages
  add column if not exists quick_reply_options jsonb null,
  add column if not exists quick_replies_closed_at timestamptz null,
  add column if not exists response_method text null
    constraint community_private_messages_response_method_check
    check (response_method is null or response_method in ('button', 'text')),
  add column if not exists onboarding_step smallint null
    constraint community_private_messages_onboarding_step_check
    check (onboarding_step is null or onboarding_step in (1, 2));

comment on column public.community_private_messages.quick_reply_options is
  'Labels des boutons de réponse rapide (messages support onboarding).';
comment on column public.community_private_messages.quick_replies_closed_at is
  'Date de fermeture des quick replies après réponse utilisateur.';
comment on column public.community_private_messages.response_method is
  'Mode de réponse utilisateur : button ou text.';
comment on column public.community_private_messages.onboarding_step is
  'Étape onboarding support (1 = source, 2 = objectif).';

-- Idempotence : un seul flux de bienvenue par utilisateur.
create table if not exists public.community_welcome_flow (
  user_id uuid primary key references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.community_private_conversations(id) on delete cascade,
  step1_message_id uuid null references public.community_private_messages(id) on delete set null,
  step2_message_id uuid null references public.community_private_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

alter table public.community_welcome_flow enable row level security;

-- Drapeau session pour écritures système (messages support avec métadonnées).
create or replace function public.set_system_private_message_write_flag()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('vws.system_private_message_write', '1', true);
end;
$$;

revoke all on function public.set_system_private_message_write_flag() from public;
grant execute on function public.set_system_private_message_write_flag() to service_role;

create or replace function public.guard_community_private_message_system_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('vws.system_private_message_write', true), '') <> '1' then
    new.quick_reply_options := null;
    new.onboarding_step := null;

    if tg_op = 'INSERT' then
      new.quick_replies_closed_at := null;
    elsif new.quick_replies_closed_at is distinct from old.quick_replies_closed_at then
      new.quick_replies_closed_at := old.quick_replies_closed_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_community_private_message_system_fields
  on public.community_private_messages;
create trigger trg_guard_community_private_message_system_fields
  before insert or update on public.community_private_messages
  for each row
  execute function public.guard_community_private_message_system_fields();

-- Envoi du message de bienvenue (fire-and-forget via pg_net).
create or replace function public.notify_welcome_private_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  token text := 'v1,whsec_EHS+c0NtIDTi44+wb2ZlsjKP7prCrBG3z1k9d7kzBIsCWYsc6yIbzsCUDvpX/Rakv2XPgzqfJnFoqjdx';
  url text;
  payload jsonb;
begin
  url := 'https://wuvtfhletxieocetzppo.supabase.co/functions/v1/welcome-private-message';
  payload := jsonb_build_object(
    'type', 'signup',
    'user', jsonb_build_object(
      'id', new.id,
      'email', new.email,
      'created_at', new.created_at
    )
  );

  perform net.http_post(
    url,
    payload,
    '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', token),
    10000
  );

  return new;
exception
  when others then
    raise warning '[notify_welcome_private_message] % - %', sqlstate, sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_notify_welcome_private_message on auth.users;
create trigger trg_notify_welcome_private_message
  after insert on auth.users
  for each row
  execute function public.notify_welcome_private_message();

-- Suivi onboarding après réponse utilisateur en messagerie privée.
create or replace function public.trigger_onboarding_private_followup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  token text := 'v1,whsec_EHS+c0NtIDTi44+wb2ZlsjKP7prCrBG3z1k9d7kzBIsCWYsc6yIbzsCUDvpX/Rakv2XPgzqfJnFoqjdx';
  url text;
  payload jsonb;
begin
  url := 'https://wuvtfhletxieocetzppo.supabase.co/functions/v1/onboarding-private-followup';
  payload := jsonb_build_object(
    'type', 'private_message',
    'message', jsonb_build_object(
      'id', new.id,
      'conversation_id', new.conversation_id,
      'user_id', new.user_id,
      'response_method', new.response_method,
      'created_at', new.created_at
    )
  );

  perform net.http_post(
    url,
    payload,
    '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', token),
    10000
  );

  return new;
exception
  when others then
    raise warning '[trigger_onboarding_private_followup] % - %', sqlstate, sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_onboarding_private_followup on public.community_private_messages;
create trigger trg_onboarding_private_followup
  after insert on public.community_private_messages
  for each row
  execute function public.trigger_onboarding_private_followup();

-- Une seule étape onboarding par conversation (idempotence).
create unique index if not exists community_private_messages_onboarding_step_unique
  on public.community_private_messages (conversation_id, onboarding_step)
  where onboarding_step is not null;
