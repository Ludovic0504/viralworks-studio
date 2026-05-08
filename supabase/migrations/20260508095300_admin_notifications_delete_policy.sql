alter table public.admin_notifications enable row level security;

drop policy if exists "admin can delete notifications" on public.admin_notifications;
create policy "admin can delete notifications"
  on public.admin_notifications
  for delete
  to authenticated
  using ((auth.jwt() ->> 'email') = 'jean.limonta06@gmail.com');

