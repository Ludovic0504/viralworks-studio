-- Secteur d'activité (studio) : stockage sur le profil + mise à jour par l'utilisateur connecté.
-- Après application : PostgREST recharge son cache (sinon erreur « schema cache » tant que le cache n'est pas à jour).

alter table public.profiles
  add column if not exists secteur text;

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
