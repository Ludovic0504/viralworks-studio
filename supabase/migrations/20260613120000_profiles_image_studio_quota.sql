-- Quota mensuel Image Studio (200 générations / mois)
alter table public.profiles
  add column if not exists image_studio_count integer not null default 0,
  add column if not exists image_studio_reset_at timestamptz;

comment on column public.profiles.image_studio_count is
  'Nombre de générations Image Studio consommées dans le cycle mensuel courant.';
comment on column public.profiles.image_studio_reset_at is
  'Début du cycle mensuel courant pour le quota Image Studio.';

create or replace function public.refresh_image_studio_quota(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_reset timestamptz;
  v_month_start timestamptz := date_trunc('month', now());
begin
  select image_studio_count, image_studio_reset_at
  into v_count, v_reset
  from profiles
  where user_id = p_user_id
  for update;

  if not found then
    return 0;
  end if;

  if v_reset is null or v_reset < v_month_start then
    update profiles
    set image_studio_count = 0,
        image_studio_reset_at = v_month_start
    where user_id = p_user_id;
    return 0;
  end if;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.increment_image_studio_count(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  v_count := public.refresh_image_studio_quota(p_user_id);

  if v_count >= 200 then
    raise exception 'IMAGE_STUDIO_QUOTA_EXCEEDED';
  end if;

  update profiles
  set image_studio_count = v_count + 1
  where user_id = p_user_id;

  return v_count + 1;
end;
$$;

revoke all on function public.refresh_image_studio_quota(uuid) from public;
revoke all on function public.increment_image_studio_count(uuid) from public;
grant execute on function public.refresh_image_studio_quota(uuid) to authenticated, service_role;
grant execute on function public.increment_image_studio_count(uuid) to service_role;
