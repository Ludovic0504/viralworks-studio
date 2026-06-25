-- Lecture quota Seedance : refresh mensuel + compteur à jour (comme Image Studio).
create or replace function public.get_my_seedance_quota()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
  v_reset timestamptz;
begin
  if v_user_id is null then
    return null;
  end if;

  v_count := public.refresh_seedance_quota(v_user_id);

  select seedance_reset_at
  into v_reset
  from public.profiles
  where user_id = v_user_id;

  return json_build_object(
    'count', coalesce(v_count, 0),
    'reset_at', v_reset
  );
end;
$$;

revoke all on function public.get_my_seedance_quota() from public;
grant execute on function public.get_my_seedance_quota() to authenticated;
