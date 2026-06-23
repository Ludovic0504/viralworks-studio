-- Traductions à la demande des messages communauté (cache partagé, affichage par utilisateur).

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'preferred_locale'
  ) then
    alter table public.profiles
      add column preferred_locale text;
  end if;
end $$;

update public.profiles
set preferred_locale = 'fr'
where preferred_locale is null
   or btrim(preferred_locale) = ''
   or preferred_locale not in ('fr', 'en', 'es');

alter table public.profiles
  alter column preferred_locale set default 'fr';

alter table public.profiles
  alter column preferred_locale set not null;

alter table public.profiles
  drop constraint if exists profiles_preferred_locale_check;

alter table public.profiles
  add constraint profiles_preferred_locale_check
  check (preferred_locale in ('fr', 'en', 'es'));

comment on column public.profiles.preferred_locale is
  'Langue préférée pour l''interface et les traductions de messages (fr, en, es).';

create table if not exists public.community_message_translations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  message_scope text not null check (message_scope in ('public', 'private')),
  conversation_id uuid null references public.community_private_conversations(id) on delete cascade,
  target_lang text not null check (target_lang in ('fr', 'en', 'es')),
  translated_text text not null,
  created_at timestamptz not null default now(),
  constraint community_message_translations_scope_conv check (
    (message_scope = 'public' and conversation_id is null)
    or (message_scope = 'private' and conversation_id is not null)
  ),
  unique (message_id, message_scope, target_lang)
);

create index if not exists idx_community_msg_translations_lookup
  on public.community_message_translations (message_id, message_scope, target_lang);

create index if not exists idx_community_msg_translations_conversation
  on public.community_message_translations (conversation_id)
  where conversation_id is not null;

alter table public.community_message_translations enable row level security;

drop policy if exists "community_message_translations_select_authenticated"
  on public.community_message_translations;
create policy "community_message_translations_select_authenticated"
  on public.community_message_translations for select
  to authenticated
  using (true);

comment on table public.community_message_translations is
  'Cache des traductions de messages publics/privés par langue cible.';
