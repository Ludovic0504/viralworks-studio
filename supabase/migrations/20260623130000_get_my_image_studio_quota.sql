-- Lecture quota Image Studio : même logique que le serveur (refresh + compteur à jour).
create or replace function public.get_my_image_studio_quota()
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

  v_count := public.refresh_image_studio_quota(v_user_id);

  select image_studio_reset_at
  into v_reset
  from public.profiles
  where user_id = v_user_id;

  return json_build_object(
    'count', coalesce(v_count, 0),
    'reset_at', v_reset
  );
end;
$$;

revoke all on function public.get_my_image_studio_quota() from public;
grant execute on function public.get_my_image_studio_quota() to authenticated;
