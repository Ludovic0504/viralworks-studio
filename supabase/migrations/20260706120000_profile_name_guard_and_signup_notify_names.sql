-- Bloque les mises à jour directes de prénom/nom via le client Supabase (contournement du filtre).
-- La Edge Function `update-user-profile` active le drapeau session avant d'écrire.

create or replace function public.set_profile_name_write_flag()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('vws.allow_profile_name_write', '1', true);
end;
$$;

revoke all on function public.set_profile_name_write_flag() from public;
grant execute on function public.set_profile_name_write_flag() to service_role;

create or replace function public.profiles_guard_direct_name_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.first_name is not distinct from old.first_name
     and new.last_name is not distinct from old.last_name
     and new.full_name is not distinct from old.full_name then
    return new;
  end if;

  if coalesce(current_setting('vws.allow_profile_name_write', true), '') = '1' then
    return new;
  end if;

  raise exception 'NAME_UPDATE_BLOCKED'
    using message = 'Les prénom/nom doivent être modifiés via le profil dans l''application.';
end;
$$;

drop trigger if exists trg_profiles_guard_direct_name_updates on public.profiles;
create trigger trg_profiles_guard_direct_name_updates
  before update on public.profiles
  for each row
  execute function public.profiles_guard_direct_name_updates();

-- Notification admin : inclure prénom/nom à l'inscription.
create or replace function public.notify_admin_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  token text := 'bf58acb1074440e39f122d485f49b0b6';
  url text;
  payload jsonb;
  v_first_name text := nullif(trim(new.raw_user_meta_data->>'first_name'), '');
  v_last_name text := nullif(trim(new.raw_user_meta_data->>'last_name'), '');
  v_full_name text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), '')
  );
begin
  if v_full_name is null and (v_first_name is not null or v_last_name is not null) then
    v_full_name := nullif(trim(concat_ws(' ', v_first_name, v_last_name)), '');
  end if;

  url := 'https://wuvtfhletxieocetzppo.supabase.co/functions/v1/admin-signup-notify';
  payload := jsonb_build_object(
    'type', 'signup',
    'user', jsonb_build_object(
      'id', new.id,
      'email', new.email,
      'created_at', new.created_at,
      'first_name', v_first_name,
      'last_name', v_last_name,
      'full_name', v_full_name
    )
  );

  perform net.http_post(
    url,
    payload,
    '{}'::jsonb,
    jsonb_build_object('Content-Type','application/json','x-hook-secret', token),
    10000
  );

  return new;
end;
$$;
