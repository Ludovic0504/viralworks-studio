/** Origine canonique production — seule destination autorisée hors dev local. */
export const PRODUCTION_CANONICAL_ORIGIN = "https://viralworks-studio.com";

const BLOCKED_HOST_PATTERNS = [/\.netlify\.app$/i];

function readEnv(name: string): string | undefined {
  const deno = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno;
  if (deno?.env?.get) return deno.env.get(name);
  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }
  return undefined;
}

export function isLocalDevOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

export function isBlockedProductionHost(hostname: string): boolean {
  return BLOCKED_HOST_PATTERNS.some((re) => re.test(hostname));
}

function parseOrigin(value: string): string | null {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Origine autorisée en prod (apex canonique, jamais Netlify ni domaine tiers). */
export function normalizeAllowedProductionOrigin(raw: string): string | null {
  const origin = parseOrigin(raw);
  if (!origin) return null;
  if (isLocalDevOrigin(origin)) return origin;

  const host = new URL(origin).hostname;
  if (isBlockedProductionHost(host)) return null;
  if (host === "viralworks-studio.com" || host === "www.viralworks-studio.com") {
    return PRODUCTION_CANONICAL_ORIGIN;
  }
  return null;
}

/** URL de retour Stripe — viralworks-studio.com uniquement en production. */
export function resolveCheckoutReturnOrigin(
  requestedOrigin?: unknown,
): string {
  if (typeof requestedOrigin === "string") {
    const client = parseOrigin(requestedOrigin);
    if (client && isLocalDevOrigin(client)) return client;
  }

  const siteUrl = readEnv("SITE_URL")?.trim();
  if (siteUrl) {
    const allowed = normalizeAllowedProductionOrigin(siteUrl);
    if (allowed) return allowed;
    console.warn("SITE_URL ignoré (domaine non autorisé):", siteUrl);
  }

  return PRODUCTION_CANONICAL_ORIGIN;
}
