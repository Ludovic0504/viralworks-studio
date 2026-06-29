const PROMO_SUPPRESSED_PATHS = new Set([
  "/auth/confirm",
  "/auth/callback",
  "/reset-password",
  "/logout",
]);

const AFTER_LOGOUT_KEY = "vw_promo_suppress_after_logout";
const HAD_ACCOUNT_KEY = "vw_promo_had_account";

export const PROMO_SEEN_KEYS = {
  acquisition: "vw_images_promo_seen_acquisition",
  conversion: "vw_images_promo_seen_conversion",
} as const;

export const PROMO_LOGOUT_SUPPRESS_EVENT = "vw:promo-logout-suppress";

export type PromoModalVariant = keyof typeof PROMO_SEEN_KEYS;

export const PROMO_OPEN_REQUEST_EVENT = "vw:promo-open-request";

/** Ouvre la modale promo immédiatement (ex. bouton Générer sans compte / sans abonnement). */
export function requestPromoModalOpen(variant?: PromoModalVariant): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<{ variant?: PromoModalVariant }>(PROMO_OPEN_REQUEST_EVENT, {
      detail: { variant },
    }),
  );
}

export function markHadAccountOnDevice(): void {
  try {
    localStorage.setItem(HAD_ACCOUNT_KEY, "1");
  } catch {
    // no-op
  }
}

/** Après déconnexion : pas de modale promo pour la session anonyme en cours. */
export function markPromoSuppressedOnLogout(): void {
  try {
    sessionStorage.setItem(AFTER_LOGOUT_KEY, "1");
    localStorage.setItem(HAD_ACCOUNT_KEY, "1");
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

/** Jamais de modale promo sur les pages de flux auth ni après déconnexion (session). */
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
    return sessionStorage.getItem(PROMO_SEEN_KEYS[variant]) === "1";
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
