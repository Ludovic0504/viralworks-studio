alter table public.profiles
  add column if not exists is_tester boolean not null default false;

update public.profiles set is_tester = true
where lower(email) = lower('perrot.kevin0605@gmail.com');

notify pgrst, 'reload schema';
