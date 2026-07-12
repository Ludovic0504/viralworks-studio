-- Journal idempotent des emails admin onboarding (hors clochette admin_notifications).

create table if not exists public.admin_onboarding_email_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  emailed_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.admin_onboarding_email_log enable row level security;

comment on table public.admin_onboarding_email_log is
  'Trace des emails admin onboarding envoyés (pas affichés dans la clochette admin).';

-- Conserver l'idempotence pour les emails déjà envoyés via admin_notifications.
insert into public.admin_onboarding_email_log (user_id, kind, emailed_at)
select n.actor_user_id, n.kind, n.created_at
from public.admin_notifications n
where n.kind in (
  'onboarding_step1_delivery',
  'onboarding_answers_complete',
  'onboarding_answer_follow_up'
)
  and n.actor_user_id is not null
on conflict (user_id, kind) do nothing;

-- Retirer les notifs onboarding de la clochette admin.
delete from public.admin_notifications
where kind in (
  'onboarding_step1_delivery',
  'onboarding_answers_complete',
  'onboarding_answer_follow_up'
);
