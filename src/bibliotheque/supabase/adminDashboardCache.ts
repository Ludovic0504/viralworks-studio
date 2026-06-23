import { getBrowserSupabase } from "./client-navigateur";

export type AdminDashboardSection =
  | "overview"
  | "payments"
  | "transactions"
  | "subscriptions"
  | "history"
  | "notifications";

export type AdminDashboardPayload = {
  stats: Record<string, number>;
  users: unknown[];
  subscriptions: unknown[];
  payments: unknown[];
  transactions: unknown[];
  history: unknown[];
  adminNotifications: unknown[];
};

const CACHE_KEY = "vws:admin-dashboard-v2";
const CACHE_TTL_MS = 90_000;

let memoryCache: { data: AdminDashboardPayload; fetchedAt: number; sections: Partial<Record<AdminDashboardSection, number>> } | null = null;
const inflight = new Map<string, Promise<AdminDashboardPayload>>();

function emptyPayload(): AdminDashboardPayload {
  return {
    stats: { totalUsers: 0, activeSubscriptions: 0, recentSignups: 0, verifiedEmails: 0, totalPayments: 0, totalTransactions: 0, totalHistory: 0, totalSubscriptions: 0, unreadAdminNotifications: 0 },
    users: [], subscriptions: [], payments: [], transactions: [], history: [], adminNotifications: [],
  };
}

function readPersisted() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.fetchedAt || Date.now() - parsed.fetchedAt >= CACHE_TTL_MS) { sessionStorage.removeItem(CACHE_KEY); return null; }
    return parsed;
  } catch { return null; }
}

function writePersisted(entry: typeof memoryCache) {
  if (typeof sessionStorage === "undefined" || !entry) return;
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry)); } catch { /* no-op */ }
}

function getCacheEntry() {
  if (memoryCache && Date.now() - memoryCache.fetchedAt < CACHE_TTL_MS) return memoryCache;
  const persisted = readPersisted();
  if (persisted) { memoryCache = persisted; return persisted; }
  return null;
}

function mergePayload(base: AdminDashboardPayload, partial: Partial<AdminDashboardPayload>): AdminDashboardPayload {
  return {
    stats: { ...base.stats, ...(partial.stats ?? {}) },
    users: partial.users ?? base.users,
    subscriptions: partial.subscriptions ?? base.subscriptions,
    payments: partial.payments ?? base.payments,
    transactions: partial.transactions ?? base.transactions,
    history: partial.history ?? base.history,
    adminNotifications: partial.adminNotifications ?? base.adminNotifications,
  };
}

export function adminTabToSection(tab: string): AdminDashboardSection | null {
  const map: Record<string, AdminDashboardSection> = {
    users: "overview", payments: "payments", transactions: "transactions",
    subscriptions: "subscriptions", history: "history", notifications: "notifications",
  };
  return map[tab] ?? null;
}

export function readCachedAdminDashboard(): AdminDashboardPayload | null {
  return getCacheEntry()?.data ?? null;
}

export function isAdminSectionCached(section: AdminDashboardSection): boolean {
  const entry = getCacheEntry();
  const loadedAt = entry?.sections?.[section];
  return Boolean(loadedAt && Date.now() - loadedAt < CACHE_TTL_MS);
}

export function invalidateAdminDashboardCache(): void {
  memoryCache = null;
  inflight.clear();
  if (typeof sessionStorage !== "undefined") { try { sessionStorage.removeItem(CACHE_KEY); } catch { /* no-op */ } }
}

async function invokeSections(sections: AdminDashboardSection[]): Promise<Partial<AdminDashboardPayload>> {
  const supabase = getBrowserSupabase();
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  if (!currentSession?.access_token) throw new Error("Pas de token d'accès");
  const { data, error } = await supabase.functions.invoke("admin-dashboard", {
    headers: { Authorization: `Bearer ${currentSession.access_token}` },
    body: { sections },
  });
  if (error) throw new Error(error.message || "Erreur chargement données");
  return (data ?? {}) as Partial<AdminDashboardPayload>;
}

export async function fetchAdminDashboardSections(sections: AdminDashboardSection[], options?: { skipCache?: boolean }): Promise<AdminDashboardPayload> {
  const uniqueSections = [...new Set(sections)];
  const cacheKey = uniqueSections.sort().join(",");
  if (!options?.skipCache) {
    const entry = getCacheEntry();
    if (entry && uniqueSections.every((s) => { const t = entry.sections[s]; return t && Date.now() - t < CACHE_TTL_MS; })) return entry.data;
    const pending = inflight.get(cacheKey);
    if (pending) return pending;
  }
  const promise = (async () => {
    const partial = await invokeSections(uniqueSections);
    const now = Date.now();
    const previous = options?.skipCache ? null : getCacheEntry();
    const merged = mergePayload(previous?.data ?? emptyPayload(), partial);
    const sectionTimestamps = { ...(previous?.sections ?? {}) };
    for (const s of uniqueSections) sectionTimestamps[s] = now;
    memoryCache = { data: merged, fetchedAt: now, sections: sectionTimestamps };
    writePersisted(memoryCache);
    return merged;
  })().finally(() => { inflight.delete(cacheKey); });
  inflight.set(cacheKey, promise);
  return promise;
}

export async function fetchAdminDashboard(options?: { skipCache?: boolean }): Promise<AdminDashboardPayload> {
  return fetchAdminDashboardSections(["overview", "payments", "transactions", "subscriptions", "history", "notifications"], options);
}

export function prefetchAdminDashboard(): void {
  void fetchAdminDashboardSections(["overview"]).catch(() => {});
}
