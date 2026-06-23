-- Réinitialise le quota Avatar Studio lors d'un changement d'abonnement (upgrade / downgrade).
create or replace function public.reset_avatar_studio_quota_on_plan_change(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    avatar_studio_count = 0,
    avatar_studio_reset_at = date_trunc('month', now())
  where user_id = p_user_id;
end;
$$;

revoke all on function public.reset_avatar_studio_quota_on_plan_change(uuid) from public;
grant execute on function public.reset_avatar_studio_quota_on_plan_change(uuid) to service_role;
