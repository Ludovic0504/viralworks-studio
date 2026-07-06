-- Censure messages communauté : bloquer la lecture directe du contenu brut côté client.
-- La lecture passe par les Edge Functions (community-read-messages) qui renvoient du texte censuré.

-- Messages publics : plus de SELECT pour les utilisateurs connectés.
drop policy if exists "community_public_messages_select_all" on public.community_public_messages;

-- Messages privés : plus de SELECT direct (participants passent par l'Edge Function).
drop policy if exists "community_private_messages_select_participant" on public.community_private_messages;

-- Traductions : cache lisible uniquement côté serveur (évite fuite via traductions non censurées).
drop policy if exists "community_message_translations_select_authenticated"
  on public.community_message_translations;

-- Indicateur « nouveau message public » sans exposer le contenu.
create or replace function public.community_has_new_public_message_since(p_since timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_public_messages m
    where p_since is null or m.created_at > p_since
    limit 1
  );
$$;

revoke all on function public.community_has_new_public_message_since(timestamptz) from public;
grant execute on function public.community_has_new_public_message_since(timestamptz) to authenticated;

comment on function public.community_has_new_public_message_since(timestamptz) is
  'Retourne true si un message public existe après p_since (null = au moins un message). Ne expose pas le contenu.';
