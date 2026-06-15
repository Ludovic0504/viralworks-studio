const PROD_FALLBACK_ORIGIN = "https://viralworks-studio.com";

/** Origine canonique pour Stripe, auth redirects, etc. (évite www / apex / localhost prod). */
export function getAppOrigin(): string {
  const explicit = String(import.meta.env.VITE_SITE_URL ?? "").trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      // ignore
    }
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return PROD_FALLBACK_ORIGIN;
}

export function isLocalDevOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Redirige vers l'origine canonique si l'utilisateur est sur un alias (ex. www). */
export function redirectToCanonicalOriginIfNeeded(): void {
  if (typeof window === "undefined") return;

  const canonical = getAppOrigin();
  if (isLocalDevOrigin(window.location.origin) || isLocalDevOrigin(canonical)) return;
  if (window.location.origin === canonical) return;

  const target = `${canonical}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
}
