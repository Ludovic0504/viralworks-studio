-- Abonnement test ViralWorks Pro (pro_59) pour jeanlmt.pro@gmail.com
-- Inclut la génération d'avatars IA + quota avatar remis à zéro (5 / mois).

do $$
declare
  v_user_id uuid;
  v_sub_id text := 'manual_test_sub_jeanlmt_pro59';
  v_cus_id text;
begin
  select id
  into v_user_id
  from auth.users
  where lower(email) = lower('jeanlmt.pro@gmail.com')
  limit 1;

  if v_user_id is null then
    raise notice 'Utilisateur introuvable: jeanlmt.pro@gmail.com';
    return;
  end if;

  update public.profiles
  set
    is_tester = true,
    email = coalesce(nullif(trim(email), ''), 'jeanlmt.pro@gmail.com'),
    avatar_studio_count = 0,
    avatar_studio_reset_at = date_trunc('month', now()),
    updated_at = now()
  where user_id = v_user_id;

  select stripe_customer_id
  into v_cus_id
  from public.stripe_customers
  where user_id = v_user_id
  limit 1;

  if v_cus_id is null then
    v_cus_id := 'manual_test_cus_' || left(replace(v_user_id::text, '-', ''), 12);
    insert into public.stripe_customers (user_id, stripe_customer_id)
    values (v_user_id, v_cus_id)
    on conflict (user_id) do update
      set stripe_customer_id = excluded.stripe_customer_id;
  end if;

  update public.stripe_subscriptions
  set
    status = 'canceled',
    updated_at = now()
  where user_id = v_user_id
    and status = 'active'
    and stripe_subscription_id <> v_sub_id;

  insert into public.stripe_subscriptions (
    user_id,
    stripe_subscription_id,
    stripe_customer_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    updated_at
  )
  values (
    v_user_id,
    v_sub_id,
    v_cus_id,
    'active',
    now(),
    now() + interval '30 days',
    false,
    now()
  )
  on conflict (stripe_subscription_id) do update
  set
    user_id = excluded.user_id,
    stripe_customer_id = excluded.stripe_customer_id,
    status = 'active',
    current_period_start = now(),
    current_period_end = now() + interval '30 days',
    cancel_at_period_end = false,
    updated_at = now();

  insert into public.subscription_credit_cycles (
    user_id,
    stripe_subscription_id,
    plan_key,
    monthly_credit_amount,
    granted_months,
    updated_at
  )
  values (
    v_user_id,
    v_sub_id,
    'pro_59',
    10,
    0,
    now()
  )
  on conflict (stripe_subscription_id) do update
  set
    user_id = excluded.user_id,
    plan_key = 'pro_59',
    monthly_credit_amount = 10,
    updated_at = now();

  raise notice 'Abonnement pro_59 activé pour user_id=%', v_user_id;
end $$;

notify pgrst, 'reload schema';
