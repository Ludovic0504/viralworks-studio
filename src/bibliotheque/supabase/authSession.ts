import { getBrowserSupabase } from "./client-navigateur";

/** Cache mémoire court pour dédupliquer les appels parallèles (getSession est local, pas getUser). */
let cachedUserId: string | null | undefined;
let cachedAt = 0;
const USER_ID_CACHE_TTL_MS = 10_000;

export function invalidateAuthUserIdCache(): void {
  cachedUserId = undefined;
  cachedAt = 0;
}

export async function signInWithEmailPassword(params: {
  email: string;
  password: string;
  remember?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase({ remember: params.remember });
  const email = String(params.email || "").trim().toLowerCase();
  const password = String(params.password || "");

  try {
    const { data, error } = await supabase.functions.invoke("auth-email-sign-in", {
      body: { email, password },
    });

    if (error) {
      let errorMessage = error.message || "Erreur lors de la connexion";
      if (error.context?.body) {
        try {
          const parsed = JSON.parse(error.context.body);
          if (parsed?.error) errorMessage = parsed.error;
        } catch {
          // ignore
        }
      }
      return { success: false, error: errorMessage };
    }

    if (data?.error) {
      return { success: false, error: String(data.error) };
    }

    const session = data?.session;
    if (!session?.access_token || !session?.refresh_token) {
      return { success: false, error: "Session non créée côté serveur" };
    }

    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    if (setSessionError) {
      return { success: false, error: setSessionError.message };
    }

    invalidateAuthUserIdCache();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erreur lors de la connexion",
    };
  }
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
