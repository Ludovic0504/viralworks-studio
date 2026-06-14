-- Plan Pro 59€ (pro_59) + quotas mensuels Seedance et Avatar Studio

alter table public.subscription_credit_cycles
  drop constraint if exists subscription_credit_cycles_plan_key_check;

alter table public.subscription_credit_cycles
  add constraint subscription_credit_cycles_plan_key_check
  check (plan_key in ('monthly', 'yearly', 'image_9', 'pro_59', 'premium_129'));

alter table public.profiles
  add column if not exists seedance_count integer not null default 0,
  add column if not exists seedance_reset_at timestamptz,
  add column if not exists avatar_studio_count integer not null default 0,
  add column if not exists avatar_studio_reset_at timestamptz;

comment on column public.profiles.seedance_count is
  'Éditions vidéo Seedance consommées dans le cycle mensuel courant.';
comment on column public.profiles.avatar_studio_count is
  'Générations Avatar IA consommées dans le cycle mensuel courant.';

create or replace function public.refresh_seedance_quota(p_user_id uuid)
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
  select seedance_count, seedance_reset_at
  into v_count, v_reset
  from profiles
  where user_id = p_user_id
  for update;

  if not found then
    return 0;
  end if;

  if v_reset is null or v_reset < v_month_start then
    update profiles
    set seedance_count = 0,
        seedance_reset_at = v_month_start
    where user_id = p_user_id;
    return 0;
  end if;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.increment_seedance_count(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  v_count := public.refresh_seedance_quota(p_user_id);

  if v_count >= 15 then
    raise exception 'SEEDANCE_QUOTA_EXCEEDED';
  end if;

  update profiles
  set seedance_count = v_count + 1
  where user_id = p_user_id;

  return v_count + 1;
end;
$$;

create or replace function public.refresh_avatar_studio_quota(p_user_id uuid)
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
  select avatar_studio_count, avatar_studio_reset_at
  into v_count, v_reset
  from profiles
  where user_id = p_user_id
  for update;

  if not found then
    return 0;
  end if;

  if v_reset is null or v_reset < v_month_start then
    update profiles
    set avatar_studio_count = 0,
        avatar_studio_reset_at = v_month_start
    where user_id = p_user_id;
    return 0;
  end if;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.increment_avatar_studio_count(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  v_count := public.refresh_avatar_studio_quota(p_user_id);

  if v_count >= 5 then
    raise exception 'AVATAR_STUDIO_QUOTA_EXCEEDED';
  end if;

  update profiles
  set avatar_studio_count = v_count + 1
  where user_id = p_user_id;

  return v_count + 1;
end;
$$;

revoke all on function public.refresh_seedance_quota(uuid) from public;
revoke all on function public.increment_seedance_count(uuid) from public;
revoke all on function public.refresh_avatar_studio_quota(uuid) from public;
revoke all on function public.increment_avatar_studio_count(uuid) from public;

grant execute on function public.refresh_seedance_quota(uuid) to authenticated, service_role;
grant execute on function public.increment_seedance_count(uuid) to service_role;
grant execute on function public.refresh_avatar_studio_quota(uuid) to authenticated, service_role;
grant execute on function public.increment_avatar_studio_count(uuid) to service_role;
