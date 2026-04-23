/**
 * Clé publique Stripe (pk_test_… ou pk_live_…).
 *
 * Où la mettre : fichier `.env.local` (dev) ou `.env.production` (build prod), jamais dans Supabase.
 * Variable : VITE_STRIPE_PUBLISHABLE_KEY
 *
 * Le checkout actuel passe par une session créée côté serveur (Edge Function) : cette clé n’est
 * pas obligatoire pour payer, mais elle est prête pour Stripe.js / Elements si tu en as besoin.
 */

export function getStripePublishableKey(): string {
  const k = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  return typeof k === "string" ? k.trim() : "";
}

export function hasStripePublishableKey(): boolean {
  return getStripePublishableKey().length > 0;
}
