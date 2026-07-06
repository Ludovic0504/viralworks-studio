-- Aligne le token x-hook-secret de notify_admin_on_signup sur AUTH_HOOK_SECRET
-- (hook Before User Created + admin-signup-notify).

create or replace function public.notify_admin_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  token text := 'v1,whsec_EHS+c0NtIDTi44+wb2ZlsjKP7prCrBG3z1k9d7kzBIsCWYsc6yIbzsCUDvpX/Rakv2XPgzqfJnFoqjdx';
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
