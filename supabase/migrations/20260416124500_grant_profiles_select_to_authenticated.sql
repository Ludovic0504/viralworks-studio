-- Assure que les rôles PostgREST peuvent lire les profils (en plus des policies RLS).
-- Utile si des privilèges ont été révoqués par erreur.

grant select on table public.profiles to authenticated;
grant select on table public.profiles to anon;
