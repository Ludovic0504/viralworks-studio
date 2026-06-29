const PROMO_SUPPRESSED_PATHS = new Set([
  "/auth/confirm",
  "/auth/callback",
  "/reset-password",
  "/logout",
]);

const AFTER_LOGOUT_KEY = "vw_promo_suppress_after_logout";

export const PROMO_SEEN_KEYS = {
  acquisition: "vw_images_promo_seen_acquisition",
  conversion: "vw_images_promo_seen_conversion",
} as const;

export const PROMO_LOGOUT_SUPPRESS_EVENT = "vw:promo-logout-suppress";

/** Après déconnexion : plus de modale promo (session en cours + acquisition déjà vue). */
export function markPromoSuppressedOnLogout(): void {
  try {
    sessionStorage.setItem(AFTER_LOGOUT_KEY, "1");
    sessionStorage.setItem(PROMO_SEEN_KEYS.acquisition, "1");
    localStorage.setItem(PROMO_SEEN_KEYS.acquisition, "1");
  } catch {
    // no-op
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PROMO_LOGOUT_SUPPRESS_EVENT));
  }
}

export function clearPromoLogoutSuppression(): void {
  try {
    sessionStorage.removeItem(AFTER_LOGOUT_KEY);
  } catch {
    // no-op
  }
}

export function isPromoSuppressedAfterLogout(): boolean {
  try {
    return sessionStorage.getItem(AFTER_LOGOUT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Jamais de modale promo sur les pages de flux auth ni après déconnexion. */
export function isPromoModalSuppressed(pathname: string): boolean {
  if (isPromoSuppressedAfterLogout()) {
    return true;
  }
  return PROMO_SUPPRESSED_PATHS.has(pathname);
}

export function hasSeenPromoVariant(
  variant: keyof typeof PROMO_SEEN_KEYS,
): boolean {
  try {
    const key = PROMO_SEEN_KEYS[variant];
    return (
      sessionStorage.getItem(key) === "1" || localStorage.getItem(key) === "1"
    );
  } catch {
    return false;
  }
}

export function markPromoVariantSeen(
  variant: keyof typeof PROMO_SEEN_KEYS,
): void {
  try {
    sessionStorage.setItem(PROMO_SEEN_KEYS[variant], "1");
  } catch {
    // no-op
  }
}
