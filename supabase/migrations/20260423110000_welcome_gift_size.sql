-- Taille choisie pour les cadeaux vêtements (tee-shirt / hoodie)

alter table public.welcome_gift_shipments
  add column if not exists gift_size text;
