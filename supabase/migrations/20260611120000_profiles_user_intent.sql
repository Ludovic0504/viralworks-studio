-- Intent utilisateur dérivé du secteur (onboarding SectorModal).

alter table public.profiles
  add column if not exists user_intent text;

comment on column public.profiles.user_intent is
  'Intent onboarding : ecommerce, artisan ou ugc.';

alter table public.profiles
  drop constraint if exists profiles_user_intent_check;

alter table public.profiles
  add constraint profiles_user_intent_check
  check (user_intent is null or user_intent in ('ecommerce', 'artisan', 'ugc'));
