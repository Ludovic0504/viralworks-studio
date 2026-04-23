-- Cadeau multi-fournisseurs (Gelato, Printful, manuel) + choix produit

alter table public.welcome_gift_shipments
  add column if not exists gift_product_id text,
  add column if not exists fulfillment_provider text,
  add column if not exists printful_order_id text,
  add column if not exists printful_response jsonb;

alter table public.welcome_gift_shipments
  drop constraint if exists welcome_gift_shipments_status_check;

alter table public.welcome_gift_shipments
  add constraint welcome_gift_shipments_status_check
  check (status in ('pending', 'submitted', 'pending_manual', 'failed'));
