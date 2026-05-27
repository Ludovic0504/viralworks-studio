-- Activation abonnement mensuel test — jean.limonta06@gmail.com
-- user_id: 7f77fb6d-015b-4962-b74a-03f86a835d77

begin;

insert into public.stripe_subscriptions (
  user_id,
  stripe_subscription_id,
  stripe_customer_id,
  status,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  updated_at
) values (
  '7f77fb6d-015b-4962-b74a-03f86a835d77',
  'manual_test_sub_jean_limonta_monthly',
  'cus_TpS6xWd2HNNWAx',
  'active',
  now(),
  now() + interval '30 days',
  false,
  now()
)
on conflict (stripe_subscription_id) do update set
  user_id = excluded.user_id,
  stripe_customer_id = excluded.stripe_customer_id,
  status = excluded.status,
  current_period_start = excluded.current_period_start,
  current_period_end = excluded.current_period_end,
  cancel_at_period_end = excluded.cancel_at_period_end,
  updated_at = excluded.updated_at;

insert into public.subscription_credit_cycles (
  user_id,
  stripe_subscription_id,
  plan_key,
  monthly_credit_amount,
  granted_months,
  updated_at
) values (
  '7f77fb6d-015b-4962-b74a-03f86a835d77',
  'manual_test_sub_jean_limonta_monthly',
  'monthly',
  30,
  0,
  now()
)
on conflict (stripe_subscription_id) do update set
  user_id = excluded.user_id,
  plan_key = excluded.plan_key,
  monthly_credit_amount = excluded.monthly_credit_amount,
  granted_months = excluded.granted_months,
  updated_at = excluded.updated_at;

update public.user_credits
set
  credits = coalesce(credits, 0) + 30,
  video_display_cap = greatest(
    coalesce(credits, 0) + 30,
    case
      when coalesce(credits, 0) = 0 or coalesce(credits, 0) = coalesce(video_display_cap, 30)
      then 30
      else coalesce(credits, 0) + 30
    end
  ),
  updated_at = now()
where user_id = '7f77fb6d-015b-4962-b74a-03f86a835d77';

insert into public.credit_transactions (
  user_id,
  amount,
  type,
  reason,
  metadata
) values (
  '7f77fb6d-015b-4962-b74a-03f86a835d77',
  30,
  'credit',
  'subscription_payment',
  jsonb_build_object(
    'subscription_id', 'manual_test_sub_jean_limonta_monthly',
    'manual_activation', true,
    'plan', 'monthly'
  )
);

commit;
