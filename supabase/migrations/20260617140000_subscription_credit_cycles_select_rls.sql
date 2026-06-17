-- Lecture fiable du plan d'abonnement côté client.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subscription_credit_cycles'
      and policyname = 'Users can view their own subscription credit cycles'
  ) then
    create policy "Users can view their own subscription credit cycles"
      on public.subscription_credit_cycles
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.get_my_subscription_cycle()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'plan_key', scc.plan_key,
    'monthly_credit_amount', scc.monthly_credit_amount
  )
  into v_result
  from public.subscription_credit_cycles scc
  where scc.user_id = auth.uid()
  order by scc.updated_at desc nulls last, scc.created_at desc
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.get_my_subscription_cycle() from public;
grant execute on function public.get_my_subscription_cycle() to authenticated;
