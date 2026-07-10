const PROD_CANONICAL_ORIGIN = "https://viralworks-studio.com";

const BLOCKED_HOST_PATTERN = /\.netlify\.app$/i;

function parseOrigin(value: string): string | null {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function normalizeProductionOrigin(origin: string): string | null {
  try {
    const host = new URL(origin).hostname;
    if (BLOCKED_HOST_PATTERN.test(host)) return PROD_CANONICAL_ORIGIN;
    if (host === "viralworks-studio.com" || host === "www.viralworks-studio.com") {
      return PROD_CANONICAL_ORIGIN;
    }
    return null;
  } catch {
    return null;
  }
}

/** Origine canonique pour Stripe, auth redirects, etc. (évite www / apex / Netlify). */
export function getAppOrigin(): string {
  const explicit = String(import.meta.env.VITE_SITE_URL ?? "").trim();
  if (explicit) {
    const parsed = parseOrigin(explicit);
    if (parsed) {
      if (isLocalDevOrigin(parsed)) return parsed;
      const normalized = normalizeProductionOrigin(parsed);
      if (normalized) return normalized;
    }
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    if (isLocalDevOrigin(window.location.origin)) {
      return window.location.origin;
    }
    const normalized = normalizeProductionOrigin(window.location.origin);
    if (normalized) return normalized;
    if (BLOCKED_HOST_PATTERN.test(window.location.hostname)) {
      return PROD_CANONICAL_ORIGIN;
    }
  }

  return PROD_CANONICAL_ORIGIN;
}

export function isLocalDevOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Redirige vers viralworks-studio.com (alias www, Netlify, etc.). */
export function redirectToCanonicalOriginIfNeeded(): void {
  if (typeof window === "undefined") return;

  const canonical = getAppOrigin();
  if (isLocalDevOrigin(window.location.origin) && isLocalDevOrigin(canonical)) return;

  const host = window.location.hostname;
  const mustRedirect =
    BLOCKED_HOST_PATTERN.test(host) || window.location.origin !== canonical;

  if (!mustRedirect) return;

  const target = `${canonical}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
}
