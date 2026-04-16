-- Autorise les utilisateurs authentifiés à lire les profils nécessaires
-- à la liste des utilisateurs de la communauté VWS / conversations privées.

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);
