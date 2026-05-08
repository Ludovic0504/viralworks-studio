-- Notifie l'admin lors d'une nouvelle inscription (auth.users INSERT)
-- via un appel HTTP asynchrone à une Edge Function (pg_net).

do $$
begin
  -- Secret DB (Vault) utilisé pour authentifier l'appel hook -> Edge Function.
  begin
    perform vault.create_secret('ADMIN_SIGNUP_NOTIFY_TOKEN', 'bf58acb1074440e39f122d485f49b0b6');
  exception when others then
    perform vault.update_secret('ADMIN_SIGNUP_NOTIFY_TOKEN', 'bf58acb1074440e39f122d485f49b0b6');
  end;
end $$;

create or replace function public.notify_admin_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  token text;
  url text;
  payload jsonb;
begin
  select (vault.read_secret('ADMIN_SIGNUP_NOTIFY_TOKEN')).secret into token;

  url := 'https://wuvtfhletxieocetzppo.supabase.co/functions/v1/admin-signup-notify';
  payload := jsonb_build_object(
    'type', 'signup',
    'user', jsonb_build_object(
      'id', new.id,
      'email', new.email,
      'created_at', new.created_at
    )
  );

  perform net.http_post(
    url,
    payload,
    jsonb_build_object('Content-Type','application/json','x-hook-secret', coalesce(token,''))
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_admin_on_signup on auth.users;
create trigger trg_notify_admin_on_signup
after insert on auth.users
for each row execute function public.notify_admin_on_signup();

