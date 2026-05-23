-- Lecture link_clicks réservée aux admins (dashboard /admin/stats)
drop policy if exists "link_clicks_select_admin" on public.link_clicks;
create policy "link_clicks_select_admin"
  on public.link_clicks for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles pr
      where pr.user_id = auth.uid() and pr.role = 'admin'
    )
  );
