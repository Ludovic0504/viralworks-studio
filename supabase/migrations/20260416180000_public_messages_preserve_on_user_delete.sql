-- Conserver les messages publics quand un compte auth est supprimé (désinscription).
-- Avant : user_id -> auth.users ON DELETE CASCADE supprimait les messages.
-- Après : ON DELETE SET NULL + libellé figé au moment de l'envoi pour l'affichage.

alter table public.community_public_messages
  add column if not exists author_display_name text;

-- Renseigner les messages existants à partir du profil (si encore présent).
update public.community_public_messages m
set author_display_name = coalesce(
  nullif(trim(p.full_name), ''),
  nullif(trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.last_name), ''))), ''),
  nullif(split_part(p.email::text, '@', 1), ''),
  'Ancien membre'
)
from public.profiles p
where p.user_id = m.user_id
  and (m.author_display_name is null or trim(m.author_display_name) = '');

-- FK : ne plus cascader la suppression du compte sur les messages.
alter table public.community_public_messages
  drop constraint if exists community_public_messages_user_id_fkey;

alter table public.community_public_messages
  alter column user_id drop not null;

alter table public.community_public_messages
  add constraint community_public_messages_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;
