-- Choix du cadeau après paiement (statut en attente de sélection)

alter table public.welcome_gift_shipments
  drop constraint if exists welcome_gift_shipments_status_check;

alter table public.welcome_gift_shipments
  add constraint welcome_gift_shipments_status_check
  check (status in ('pending', 'pending_choice', 'submitted', 'pending_manual', 'failed'));
