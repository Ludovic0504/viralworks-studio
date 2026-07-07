-- Essai Image Studio : 7 jours / 30 images, quota séparé du cycle mensuel calendaire.

alter table public.profiles
  add column if not exists image_studio_quota_mode text not null default 'monthly',
  add column if not exists image_studio_cycle_ends_at timestamptz,
  add column if not exists image_studio_trial_used boolean not null default false;

comment on column public.profiles.image_studio_quota_mode is
  'Cycle quota Image Studio : monthly (calendaire) ou trial (essai 7 jours).';
comment on column public.profiles.image_studio_cycle_ends_at is
  'Fin du cycle essai Image Studio (ignoré en mode monthly).';
comment on column public.profiles.image_studio_trial_used is
  'True si l''utilisateur a déjà bénéficié de l''essai Image Studio (1 essai / compte).';

alter table public.profiles
  drop constraint if exists profiles_image_studio_quota_mode_check;

alter table public.profiles
  add constraint profiles_image_studio_quota_mode_check
  check (image_studio_quota_mode in ('monthly', 'trial'));

create or replace function public.refresh_image_studio_quota(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_reset timestamptz;
  v_mode text;
  v_month_start timestamptz := date_trunc('month', now());
begin
  select image_studio_count, image_studio_reset_at, image_studio_quota_mode
  into v_count, v_reset, v_mode
  from profiles
  where user_id = p_user_id
  for update;

  if not found then
    return 0;
  end if;

  if coalesce(v_mode, 'monthly') = 'trial' then
    return coalesce(v_count, 0);
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

create or replace function public._image_studio_plan_limit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_key text;
begin
  select scc.plan_key
  into v_plan_key
  from stripe_subscriptions ss
  join subscription_credit_cycles scc
    on scc.stripe_subscription_id = ss.stripe_subscription_id
  where ss.user_id = p_user_id
    and ss.status in ('active', 'trialing')
  order by ss.updated_at desc
  limit 1;

  if v_plan_key = 'image_9' then
    return 150;
  end if;

  if v_plan_key in ('pro_59', 'premium_129', 'monthly', 'yearly') then
    return 200;
  end if;

  return 0;
end;
$$;

create or replace function public._image_studio_quota_payload(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_reset timestamptz;
  v_mode text;
  v_cycle_ends timestamptz;
  v_limit integer;
  v_trial_used boolean;
begin
  v_count := public.refresh_image_studio_quota(p_user_id);

  select
    image_studio_reset_at,
    image_studio_quota_mode,
    image_studio_cycle_ends_at,
    image_studio_trial_used
  into v_reset, v_mode, v_cycle_ends, v_trial_used
  from profiles
  where user_id = p_user_id;

  if not found then
    return json_build_object(
      'count', 0,
      'limit', 0,
      'mode', 'monthly',
      'reset_at', null,
      'cycle_ends_at', null,
      'trial_used', false,
      'trial_expired', false
    );
  end if;

  v_mode := coalesce(v_mode, 'monthly');

  if v_mode = 'trial' then
    if v_cycle_ends is not null and now() >= v_cycle_ends then
      v_limit := 0;
    else
      v_limit := 30;
    end if;
  else
    v_limit := public._image_studio_plan_limit(p_user_id);
  end if;

  return json_build_object(
    'count', coalesce(v_count, 0),
    'limit', coalesce(v_limit, 0),
    'mode', v_mode,
    'reset_at', v_reset,
    'cycle_ends_at', v_cycle_ends,
    'trial_used', coalesce(v_trial_used, false),
    'trial_expired',
      v_mode = 'trial'
      and v_cycle_ends is not null
      and now() >= v_cycle_ends
  );
end;
$$;

create or replace function public.get_my_image_studio_quota()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return null;
  end if;

  return public._image_studio_quota_payload(v_user_id);
end;
$$;

create or replace function public.resolve_image_studio_quota(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return null;
  end if;

  return public._image_studio_quota_payload(p_user_id);
end;
$$;

-- Idempotent : no-op si l'essai est déjà initialisé (replay webhook Stripe).
create or replace function public.start_image_studio_trial(
  p_user_id uuid,
  p_cycle_ends_at timestamptz
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_mode text;
begin
  select image_studio_quota_mode
  into v_existing_mode
  from profiles
  where user_id = p_user_id
  for update;

  if not found then
    return json_build_object('started', false, 'reason', 'profile_not_found');
  end if;

  if coalesce(v_existing_mode, 'monthly') = 'trial' then
    return (
      public._image_studio_quota_payload(p_user_id)::jsonb
      || jsonb_build_object('started', false, 'reason', 'already_trial')
    )::json;
  end if;

  update profiles
  set
    image_studio_count = 0,
    image_studio_quota_mode = 'trial',
    image_studio_reset_at = now(),
    image_studio_cycle_ends_at = p_cycle_ends_at,
    image_studio_trial_used = true
  where user_id = p_user_id;

  return (
    public._image_studio_quota_payload(p_user_id)::jsonb
    || jsonb_build_object('started', true)
  )::json;
end;
$$;

-- Idempotent : no-op si pas en mode essai (replay subscription.updated).
create or replace function public.convert_image_studio_to_monthly_quota(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
begin
  select image_studio_quota_mode
  into v_mode
  from profiles
  where user_id = p_user_id
  for update;

  if not found then
    return json_build_object('converted', false, 'reason', 'profile_not_found');
  end if;

  if coalesce(v_mode, 'monthly') is distinct from 'trial' then
    return (
      public._image_studio_quota_payload(p_user_id)::jsonb
      || jsonb_build_object('converted', false, 'reason', 'not_trial')
    )::json;
  end if;

  update profiles
  set
    image_studio_count = 0,
    image_studio_quota_mode = 'monthly',
    image_studio_reset_at = date_trunc('month', now()),
    image_studio_cycle_ends_at = null
  where user_id = p_user_id;

  return (
    public._image_studio_quota_payload(p_user_id)::jsonb
    || jsonb_build_object('converted', true)
  )::json;
end;
$$;

create or replace function public.reset_image_studio_quota_on_plan_change(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    image_studio_count = 0,
    image_studio_reset_at = date_trunc('month', now()),
    image_studio_quota_mode = 'monthly',
    image_studio_cycle_ends_at = null
  where user_id = p_user_id;
end;
$$;

revoke all on function public._image_studio_plan_limit(uuid) from public;
revoke all on function public._image_studio_quota_payload(uuid) from public;
revoke all on function public.resolve_image_studio_quota(uuid) from public;
revoke all on function public.start_image_studio_trial(uuid, timestamptz) from public;
revoke all on function public.convert_image_studio_to_monthly_quota(uuid) from public;

grant execute on function public.get_my_image_studio_quota() to authenticated;
grant execute on function public.resolve_image_studio_quota(uuid) to service_role;
grant execute on function public.start_image_studio_trial(uuid, timestamptz) to service_role;
grant execute on function public.convert_image_studio_to_monthly_quota(uuid) to service_role;
