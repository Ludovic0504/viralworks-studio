create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  body text,
  actor_user_id uuid,
  actor_email text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.admin_notifications enable row level security;

drop policy if exists "admin can read notifications" on public.admin_notifications;
create policy "admin can read notifications"
  on public.admin_notifications
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'jean.limonta06@gmail.com');

drop policy if exists "admin can mark notifications read" on public.admin_notifications;
create policy "admin can mark notifications read"
  on public.admin_notifications
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'jean.limonta06@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'jean.limonta06@gmail.com');

create index if not exists admin_notifications_created_at_idx on public.admin_notifications (created_at desc);
create index if not exists admin_notifications_read_at_idx on public.admin_notifications (read_at);

