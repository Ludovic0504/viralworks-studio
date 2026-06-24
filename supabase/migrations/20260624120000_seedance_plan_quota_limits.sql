-- Quota Seedance par plan : limite passée par l'Edge Function (Pro 5 / Studio 15).

drop function if exists public.increment_seedance_count(uuid);

create or replace function public.increment_seedance_count(p_user_id uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_limit integer := coalesce(p_limit, 15);
begin
  if v_limit < 1 then
    raise exception 'SEEDANCE_QUOTA_EXCEEDED';
  end if;

  v_count := public.refresh_seedance_quota(p_user_id);

  if v_count >= v_limit then
    raise exception 'SEEDANCE_QUOTA_EXCEEDED';
  end if;

  update profiles
  set seedance_count = v_count + 1
  where user_id = p_user_id;

  return v_count + 1;
end;
$$;

grant execute on function public.increment_seedance_count(uuid, integer) to service_role;
