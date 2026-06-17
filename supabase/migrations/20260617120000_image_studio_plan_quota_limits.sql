-- Quota Image Studio : limite selon l'offre (passée par l'edge function)
drop function if exists public.increment_image_studio_count(uuid);

create or replace function public.increment_image_studio_count(
  p_user_id uuid,
  p_limit integer default 200
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_limit integer := greatest(1, coalesce(p_limit, 200));
begin
  v_count := public.refresh_image_studio_quota(p_user_id);

  if v_count >= v_limit then
    raise exception 'IMAGE_STUDIO_QUOTA_EXCEEDED';
  end if;

  update profiles
  set image_studio_count = v_count + 1
  where user_id = p_user_id;

  return v_count + 1;
end;
$$;

revoke all on function public.increment_image_studio_count(uuid, integer) from public;
grant execute on function public.increment_image_studio_count(uuid, integer) to service_role;
