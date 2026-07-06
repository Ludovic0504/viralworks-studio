-- Suppression de ses propres messages sans politique SELECT (lecture via Edge Function).
create or replace function public.community_delete_own_private_message(p_message_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.community_private_messages
    where id = p_message_id
      and user_id = auth.uid()
    returning id
  )
  select exists (select 1 from deleted);
$$;

create or replace function public.community_delete_own_public_message(p_message_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.community_public_messages
    where id = p_message_id
      and user_id = auth.uid()
    returning id
  )
  select exists (select 1 from deleted);
$$;

revoke all on function public.community_delete_own_private_message(uuid) from public;
revoke all on function public.community_delete_own_public_message(uuid) from public;
grant execute on function public.community_delete_own_private_message(uuid) to authenticated;
grant execute on function public.community_delete_own_public_message(uuid) to authenticated;
