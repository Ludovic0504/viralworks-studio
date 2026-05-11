/**
 * Cache mémoire + fetch Pexels pour les aperçus des cartes format (Campagne VWS).
 *
 * - **Dev (Vite)** : appels vers `/__pexels/v1/...` — la clé est injectée par le proxy Node
 *   (même valeur que `.env.local`, sans passer par le bundle client → évite des 401 fantômes).
 * - **Prod** : soit appel direct avec `VITE_PEXELS_API_KEY`, soit `/api/pexels-search` si
 *   `VITE_PEXELS_SERVER=1` et `PEXELS_API_KEY` (ou VITE_) côté Vercel uniquement.
 */

const urlByQuery = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();

/** Placeholder laissé dans .env — ne doit pas déclencher d’appels API. */
const PLACEHOLDER_KEYS = new Set(["", "COLLER_TA_CLE_ICI", "COLLE_TA_CLE_ICI"]);

function normalizeApiKey(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  let k = String(raw).trim().replace(/^\uFEFF/, "");
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  if (k.toLowerCase().startsWith("bearer ")) {
    k = k.slice(7).trim();
  }
  return k;
}

function getApiKey(): string {
  if (typeof import.meta === "undefined") return "";
  const k = normalizeApiKey(import.meta.env?.VITE_PEXELS_API_KEY);
  if (!k || PLACEHOLDER_KEYS.has(k)) return "";
  return k;
}

/** Prod : images via la route serveur `/api/pexels-search` sans clé dans le bundle (`VITE_PEXELS_SERVER=1`). */
function useServerPexelsProxy(): boolean {
  return import.meta.env.VITE_PEXELS_SERVER === "1";
}

/** True si on peut tenter un fetch (clé dans le bundle, proxy serveur Vercel, ou dev : proxy Vite peut avoir la clé sans `import.meta.env`). */
function canAttemptPexelsFetch(): boolean {
  if (getApiKey()) return true;
  if (useServerPexelsProxy()) return true;
  if (import.meta.env.DEV) return true;
  return false;
}

function entryKey(apiKey: string, query: string, photoIndex: number): string {
  const mode = import.meta.env.DEV
    ? "dev-proxy"
    : useServerPexelsProxy()
      ? "server-proxy"
      : "direct";
  return `${mode}\n${apiKey}\n${query.trim()}\n${photoIndex}`;
}

function searchUrlAndHeaders(params: URLSearchParams): { url: string; headers: HeadersInit } {
  const qs = params.toString();

  if (import.meta.env.DEV) {
    return {
      url: `/__pexels/v1/search?${qs}`,
      headers: {},
    };
  }

  if (import.meta.env.PROD && useServerPexelsProxy()) {
    return {
      url: `/api/pexels-search?${qs}`,
      headers: {},
    };
  }

  const key = getApiKey();
  return {
    url: `https://api.pexels.com/v1/search?${qs}`,
    headers: key ? { Authorization: key } : {},
  };
}

async function fetchMediumUrlForQuery(
  query: string,
  photoIndex: number = 0
): Promise<string | null> {
  if (!query.trim()) return null;
  if (!canAttemptPexelsFetch()) return null;

  const idx = Math.max(0, Math.floor(photoIndex));
  const keyForCache = getApiKey() || (useServerPexelsProxy() ? "server-proxy" : "");
  const eKey = entryKey(keyForCache, query, idx);
  const cached = urlByQuery.get(eKey);
  if (cached !== undefined) return cached === "" ? null : cached;

  const pending = inFlight.get(eKey);
  if (pending) return pending;

  const promise = (async (): Promise<string | null> => {
    try {
      const perPage = idx === 0 ? 1 : Math.min(80, idx + 1);
      const params = new URLSearchParams({
        query: query.trim(),
        per_page: String(perPage),
        size: "medium",
      });
      const { url, headers } = searchUrlAndHeaders(params);
      const res = await fetch(url, { headers });
      if (res.status === 401) {
        if (import.meta.env.DEV) {
          console.warn(
            "[Pexels] 401 — vérifie VITE_PEXELS_API_KEY dans .env.local, redémarre npm run dev. En prod, configure PEXELS_API_KEY / VITE_PEXELS_API_KEY + VITE_PEXELS_SERVER=1 sur Vercel ou la clé VITE côté build."
          );
        }
        urlByQuery.set(eKey, "");
        return null;
      }
      if (!res.ok) {
        urlByQuery.set(eKey, "");
        return null;
      }
      const data = (await res.json()) as {
        photos?: { src?: { medium?: string } }[];
      };
      const urlMedium = data.photos?.[idx]?.src?.medium ?? null;
      urlByQuery.set(eKey, urlMedium ?? "");
      return urlMedium || null;
    } catch {
      urlByQuery.set(eKey, "");
      return null;
    } finally {
      inFlight.delete(eKey);
    }
  })();

  inFlight.set(eKey, promise);
  return promise;
}

/** Image medium pour la requête (index dans la page de résultats) ; mis en cache (y compris les échecs vides). */
export async function getCachedPexelsMediumUrl(
  pexelsQuery: string,
  photoIndex: number = 0
): Promise<string | null> {
  const url = await fetchMediumUrlForQuery(pexelsQuery, photoIndex);
  return url || null;
}

export type PexelsPrefetchSpec = { query: string; photoIndex?: number };

/** Précharge les formats listés (ex. catégorie visible au premier passage). Les doublons sont dédupliqués via le cache. */
export function prefetchPexelsQueries(specs: readonly PexelsPrefetchSpec[]): void {
  if (!canAttemptPexelsFetch()) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Pexels] prefetch ignoré : ni clé client, ni mode dev/proxy serveur (impossible)."
      );
    }
    return;
  }
  const tuples = specs
    .map((s) => ({ query: s.query.trim(), idx: Math.max(0, Math.floor(s.photoIndex ?? 0)) }))
    .filter((s) => s.query.length > 0);
  const seen = new Set<string>();
  const unique: { query: string; idx: number }[] = [];
  for (const t of tuples) {
    const k = `${t.query}\n${t.idx}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(t);
  }
  void Promise.allSettled(unique.map((t) => fetchMediumUrlForQuery(t.query, t.idx)));
}

export function hasPexelsApiKey(): boolean {
  return canAttemptPexelsFetch();
}
