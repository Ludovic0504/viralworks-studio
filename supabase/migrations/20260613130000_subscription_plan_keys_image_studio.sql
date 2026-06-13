-- Étendre les clés de plan d'abonnement (image 9€ + studio 129€, conserver legacy)
alter table public.subscription_credit_cycles
  drop constraint if exists subscription_credit_cycles_plan_key_check;

alter table public.subscription_credit_cycles
  add constraint subscription_credit_cycles_plan_key_check
  check (plan_key in ('monthly', 'yearly', 'image_9', 'premium_129'));
