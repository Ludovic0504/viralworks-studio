/** Sources bio autorisées (synchronisé avec supabase/functions/go-redirect). */
export const LINK_CLICK_SOURCES = ["facebook", "instagram", "tiktok"] as const;

export type LinkClickSource = (typeof LINK_CLICK_SOURCES)[number];

export function isLinkClickSource(value: string): value is LinkClickSource {
  return (LINK_CLICK_SOURCES as readonly string[]).includes(value);
}

/** Projet attendu (ref Supabase) — contrôle de cohérence URL / clé anon. */
const EXPECTED_PROJECT_REF = "wuvtfhletxieocetzppo";

export type GoRedirectFetchDebug = {
  source: LinkClickSource;
  url: string;
  supabaseUrl: string;
  anonKeyPresent: boolean;
  anonKeyRef: string | null;
  anonKeyMatchesProject: boolean;
};

/** URL + contrôles config (clé anon = JWT role anon, ref = projet). */
export function getGoRedirectFetchDebug(source: LinkClickSource): GoRedirectFetchDebug {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

  let anonKeyRef: string | null = null;
  try {
    if (anonKey) {
      const payload = JSON.parse(atob(anonKey.split(".")[1] ?? ""));
      anonKeyRef = typeof payload.ref === "string" ? payload.ref : null;
    }
  } catch {
    anonKeyRef = null;
  }

  const params = new URLSearchParams({ source, client: "1" });
  const url =
    supabaseUrl && anonKey
      ? `${supabaseUrl}/functions/v1/go-redirect?${params.toString()}`
      : "";

  return {
    source,
    url,
    supabaseUrl,
    anonKeyPresent: Boolean(anonKey),
    anonKeyRef,
    anonKeyMatchesProject:
      anonKeyRef === EXPECTED_PROJECT_REF &&
      supabaseUrl.includes(EXPECTED_PROJECT_REF),
  };
}

export type LogLinkClickResult = {
  debug: GoRedirectFetchDebug;
  ok: boolean;
  status?: number;
  statusText?: string;
  body?: string;
  error?: unknown;
};

/**
 * Enregistre le clic via Edge Function (headers apikey + Authorization comme le reste de l'app).
 */
export async function logLinkClick(source: LinkClickSource): Promise<LogLinkClickResult> {
  const debug = getGoRedirectFetchDebug(source);
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

  if (!debug.url || !anonKey) {
    return {
      debug,
      ok: false,
      error: new Error("VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquant"),
    };
  }

  if (!debug.anonKeyMatchesProject) {
    console.warn(
      "[go] Config Supabase incohérente :",
      `URL contient ${EXPECTED_PROJECT_REF}?`,
      debug.supabaseUrl.includes(EXPECTED_PROJECT_REF),
      "| ref JWT anon:",
      debug.anonKeyRef,
      `(attendu: ${EXPECTED_PROJECT_REF})`
    );
  }

  try {
    const res = await fetch(debug.url, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      keepalive: true,
    });
    const body = await res.text();
    return {
      debug,
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      body,
    };
  } catch (err) {
    return { debug, ok: false, error: err };
  }
}
