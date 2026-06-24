/** Stripe API récente : current_period_* est sur le premier subscription item, pas sur la racine. */
type StripeSubscriptionPeriodSource = {
  current_period_start?: number;
  current_period_end?: number;
  start_date?: number;
  items?: {
    data?: Array<{
      current_period_start?: number;
      current_period_end?: number;
    }>;
  };
};

export function resolveSubscriptionPeriodUnix(
  subscription: StripeSubscriptionPeriodSource,
): { periodStart: number; periodEnd: number } | null {
  const item = subscription.items?.data?.[0];
  const periodStart =
    item?.current_period_start ??
    subscription.current_period_start ??
    subscription.start_date;
  const periodEnd =
    item?.current_period_end ?? subscription.current_period_end;

  if (typeof periodStart !== "number" || typeof periodEnd !== "number") {
    return null;
  }

  return { periodStart, periodEnd };
}

export function subscriptionPeriodToIso(
  subscription: StripeSubscriptionPeriodSource,
): { current_period_start: string; current_period_end: string } | null {
  const period = resolveSubscriptionPeriodUnix(subscription);
  if (!period) return null;

  return {
    current_period_start: new Date(period.periodStart * 1000).toISOString(),
    current_period_end: new Date(period.periodEnd * 1000).toISOString(),
  };
}
