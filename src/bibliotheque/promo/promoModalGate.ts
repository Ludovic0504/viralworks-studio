const PROMO_SUPPRESSED_PATHS = new Set([
  "/auth/confirm",
  "/auth/callback",
  "/reset-password",
]);

/** Jamais de modale promo sur les pages de flux auth. */
export function isPromoModalSuppressed(pathname: string): boolean {
  return PROMO_SUPPRESSED_PATHS.has(pathname);
}
