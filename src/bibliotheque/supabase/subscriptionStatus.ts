/** Statuts Stripe donnant accès aux fonctionnalités d'abonnement (essai inclus). */
export const ENTITLED_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

export type EntitledSubscriptionStatus =
  (typeof ENTITLED_SUBSCRIPTION_STATUSES)[number];

export function isEntitledSubscriptionStatus(
  status: string | null | undefined,
): status is EntitledSubscriptionStatus {
  return status === "active" || status === "trialing";
}
