import { getBrowserSupabase } from "./client-navigateur";

/** Cache mémoire court pour dédupliquer les appels parallèles (getSession est local, pas getUser). */
let cachedUserId: string | null | undefined;
let cachedAt = 0;
const USER_ID_CACHE_TTL_MS = 10_000;

export function invalidateAuthUserIdCache(): void {
  cachedUserId = undefined;
  cachedAt = 0;
}

/**
 * Résout l'id utilisateur via getSession (local) — évite getUser() (round-trip réseau) sur les lectures.
 */
export async function resolveAuthenticatedUserId(
  explicitUserId?: string | null,
): Promise<string | null> {
  if (explicitUserId) return explicitUserId;

  if (
    cachedUserId !== undefined &&
    Date.now() - cachedAt < USER_ID_CACHE_TTL_MS
  ) {
    return cachedUserId;
  }

  const supabase = getBrowserSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user?.id ?? null;
  cachedUserId = userId;
  cachedAt = Date.now();
  return userId;
}
