alter table public.profiles
  drop constraint if exists profiles_preferred_locale_check;

alter table public.profiles
  add constraint profiles_preferred_locale_check
  check (preferred_locale in ('fr', 'en', 'es', 'de', 'pt', 'it'));

comment on column public.profiles.preferred_locale is
  'Langue d''interface préférée (fr, en, es, de, pt, it).';
