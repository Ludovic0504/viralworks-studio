-- Copie prénom/nom depuis auth.users.raw_user_meta_data vers public.profiles à l'inscription.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_first_name text := nullif(trim(new.raw_user_meta_data->>'first_name'), '');
  v_last_name text := nullif(trim(new.raw_user_meta_data->>'last_name'), '');
  v_full_name text := nullif(trim(new.raw_user_meta_data->>'full_name'), '');
begin
  if v_full_name is null and (v_first_name is not null or v_last_name is not null) then
    v_full_name := nullif(trim(concat_ws(' ', v_first_name, v_last_name)), '');
  end if;

  insert into public.profiles (user_id, email, role, first_name, last_name, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    'user',
    v_first_name,
    v_last_name,
    v_full_name
  )
  on conflict (user_id) do update set
    email = coalesce(excluded.email, profiles.email),
    first_name = coalesce(excluded.first_name, profiles.first_name),
    last_name = coalesce(excluded.last_name, profiles.last_name),
    full_name = coalesce(excluded.full_name, profiles.full_name);

  return new;
exception
  when others then
    raise warning '[handle_new_user] Erreur pour user_id %: % - %',
      new.id, sqlstate, sqlerrm;
    return new;
end;
$$;

-- Rattrapage : comptes déjà créés avec métadonnées Auth mais profil vide.
update public.profiles p
set
  first_name = coalesce(
    p.first_name,
    nullif(trim(u.raw_user_meta_data->>'first_name'), '')
  ),
  last_name = coalesce(
    p.last_name,
    nullif(trim(u.raw_user_meta_data->>'last_name'), '')
  ),
  full_name = coalesce(
    p.full_name,
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(
      trim(
        concat_ws(
          ' ',
          nullif(trim(u.raw_user_meta_data->>'first_name'), ''),
          nullif(trim(u.raw_user_meta_data->>'last_name'), '')
        )
      ),
      ''
    )
  ),
  updated_at = now()
from auth.users u
where u.id = p.user_id
  and (
    p.first_name is null
    or p.last_name is null
    or p.full_name is null
  )
  and (
    nullif(trim(u.raw_user_meta_data->>'first_name'), '') is not null
    or nullif(trim(u.raw_user_meta_data->>'last_name'), '') is not null
    or nullif(trim(u.raw_user_meta_data->>'full_name'), '') is not null
  );
