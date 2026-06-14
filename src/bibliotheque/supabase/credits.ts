import { getBrowserSupabase } from "./client-navigateur";

/** Émis après un débit (ou autre action) pour rafraîchir l’affichage des crédits (ex. page Profil). */
export const USER_CREDITS_UPDATED_EVENT = "vws:user-credits-updated";

export function notifyUserCreditsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(USER_CREDITS_UPDATED_EVENT));
  }
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'debit' | 'credit' | 'purchase' | 'admin_add' | 'admin_remove';
  reason?: string;
  metadata?: Record<string, any>;
  created_by?: string;
  created_at: string;
}

export interface UserCredits {
  id: string;
  user_id: string;
  credits: number;
  video_display_cap?: number | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface UserCreditBuckets {
  text_generation: number;
  image_generation: number;
  image_modification: number;
  video_generation: number;
}

/**
 * Récupère les crédits de l'utilisateur connecté
 */
export async function getUserCredits(): Promise<number> {
  const supabase = getBrowserSupabase();
  
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    console.warn("Utilisateur non connecté");
    return 0;
  }

  // Rattrape les crédits mensuels de l'abonnement annuel (30/mois) si nécessaire.
  // On ignore les erreurs pour ne pas bloquer l'affichage des crédits.
  try {
    await supabase.functions.invoke("sync-subscription-credits", { body: {} });
  } catch {
    // no-op
  }

  const { data: rows, error } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", user.id);

  if (error) {
    console.error("Erreur récupération crédits:", error);
    return 0;
  }

  if (!rows?.length) return 0;
  return rows.reduce((sum, r) => sum + Number(r.credits ?? 0), 0);
}

/** Solde workflow + plafond affiché (menu profil « restant / total »). */
export async function getUserWorkflowVideoWallet(): Promise<{ balance: number; cap: number }> {
  const supabase = getBrowserSupabase();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { balance: 0, cap: 30 };
  }

  try {
    await supabase.functions.invoke("sync-subscription-credits", { body: {} });
  } catch {
    // no-op
  }

  const { data: rows, error } = await supabase
    .from("user_credits")
    .select("credits, video_display_cap")
    .eq("user_id", user.id);

  if (error) {
    console.error("Erreur récupération wallet vidéo:", error);
    return { balance: 0, cap: 30 };
  }

  if (!rows?.length) {
    return { balance: 0, cap: 30 };
  }

  const balance = rows.reduce((sum, r) => sum + Number(r.credits ?? 0), 0);
  const maxCap = rows.reduce((m, r) => {
    const c = r.video_display_cap;
    if (c == null || Number.isNaN(Number(c))) return m;
    return Math.max(m, Number(c));
  }, 0);
  const capBase = maxCap > 0 ? maxCap : 30;
  const cap = Math.max(capBase, balance, 1);

  return { balance, cap };
}

/**
 * @deprecated Préférer getUserWorkflowVideoWallet() — lit SUM(user_credits.credits), source unique d'affichage.
 * Ancienne formule cap − COUNT(telecharger_video) : diverge du solde réel après admin ou faux débits image.
 */
export async function getUserWorkflowCompleteVideoWallet(): Promise<{ balance: number; cap: number }> {
  const supabase = getBrowserSupabase();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { balance: 0, cap: 30 };
  }

  try {
    await supabase.functions.invoke("sync-subscription-credits", { body: {} });
  } catch {
    // no-op
  }

  // Cap: même source qu'aujourd'hui (user_credits.video_display_cap)
  const { data: capRows, error: capError } = await supabase
    .from("user_credits")
    .select("video_display_cap")
    .eq("user_id", user.id);

  if (capError) {
    console.error("Erreur récupération cap wallet workflow:", capError);
    return { balance: 0, cap: 30 };
  }

  const maxCap = (capRows || []).reduce((m, r) => {
    const c = (r as { video_display_cap?: number | null })?.video_display_cap;
    if (c == null || Number.isNaN(Number(c))) return m;
    return Math.max(m, Number(c));
  }, 0);
  const capBase = maxCap > 0 ? maxCap : 30;
  const cap = Math.max(capBase, 1);

  // spent_workflows = COUNT des débits "video_generation" au step=telecharger_video
  const { count, error: countError } = await supabase
    .from("credit_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("reason", "video_generation")
    .lt("amount", 0)
    .eq("metadata->>step", "telecharger_video");

  if (countError) {
    console.error("Erreur comptage workflows complets:", countError);
    return { balance: 0, cap };
  }

  const spentWorkflows = Math.max(0, Number(count || 0));
  const remaining = Math.max(0, cap - spentWorkflows);

  return { balance: remaining, cap };
}

/**
 * Récupère les crédits dédiés par catégorie (texte/image/vidéo).
 */
export async function getUserCreditBuckets(): Promise<UserCreditBuckets> {
  const supabase = getBrowserSupabase();
  const empty: UserCreditBuckets = {
    text_generation: 0,
    image_generation: 0,
    image_modification: 0,
    video_generation: 0,
  };

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return empty;

  const { data, error } = await supabase
    .from("user_credit_buckets")
    .select("text_generation,image_generation,image_modification,video_generation")
    .eq("user_id", user.id)
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") {
      return empty;
    }
    console.error("Erreur récupération crédits dédiés:", error);
    return empty;
  }

  return {
    text_generation: Number(data?.text_generation || 0),
    image_generation: Number(data?.image_generation || 0),
    image_modification: Number(data?.image_modification || 0),
    video_generation: Number(data?.video_generation || 0),
  };
}

/**
 * Vérifie si l'utilisateur a suffisamment de crédits
 */
export async function hasEnoughCredits(required: number): Promise<boolean> {
  const credits = await getUserCredits();
  return credits >= required;
}

/**
 * Débite des crédits (appelé par une fonction serveur)
 */
export async function debitCredits(
  amount: number,
  reason: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; remainingCredits?: number; error?: string }> {
  const supabase = getBrowserSupabase();
  
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { success: false, error: "Utilisateur non connecté" };
  }

  // Appeler la fonction Edge Function pour débiter
  console.log("[debitCredits] Appel debit-credits:", { amount, reason, metadata });
  
  const { data, error } = await supabase.functions.invoke("debit-credits", {
    body: {
      amount,
      reason,
      metadata,
    },
  });

  if (error) {
    console.error("Erreur débit crédits:", error);
    let message = error.message || "Erreur lors du débit (solde vidéo)";
    try {
      const ctx = error.context as { body?: string } | undefined;
      if (ctx?.body && typeof ctx.body === "string") {
        const parsed = JSON.parse(ctx.body) as { error?: string };
        if (parsed?.error) message = parsed.error;
      }
    } catch {
      /* ignore */
    }
    return { success: false, error: message };
  }

  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    (data as { success?: boolean }).success !== true
  ) {
    const errMsg = String((data as { error?: string }).error || "Erreur lors du débit (solde vidéo)");
    return { success: false, error: errMsg };
  }

  console.log("[debitCredits] Débit réussi:", data);
  notifyUserCreditsUpdated();
  return { success: true, remainingCredits: (data as { remaining_credits?: number })?.remaining_credits };
}

/**
 * Récupère l'historique des transactions de crédits
 */
export async function getCreditTransactions(limit: number = 50): Promise<CreditTransaction[]> {
  const supabase = getBrowserSupabase();
  
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return [];
  }

  const { data, error } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Erreur récupération transactions:", error);
    return [];
  }

  return data || [];
}

/**
 * Récupère le rôle de l'utilisateur depuis profiles
 */
export async function getUserRole(): Promise<'user' | 'admin' | null> {
  const supabase = getBrowserSupabase();
  
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (error) {
    console.error("Erreur récupération rôle:", error);
    return null;
  }

  return (data?.role as 'user' | 'admin') || 'user';
}

let adminCache: { userId: string; value: boolean } | null = null;
let adminInflight: { userId: string; promise: Promise<boolean> } | null = null;

export function readCachedAdminStatus(userId: string | undefined): boolean | null {
  if (!userId || adminCache?.userId !== userId) return null;
  return adminCache.value;
}

/** Précharge le statut admin (ex. au survol du lien Éditer ma vidéo). */
export function prefetchAdminAccess(userId: string | undefined) {
  if (!userId) return;
  void resolveAdminStatus(userId);
}

async function resolveAdminStatus(userId: string): Promise<boolean> {
  if (adminCache?.userId === userId) return adminCache.value;
  if (adminInflight?.userId === userId) return adminInflight.promise;

  const promise = getUserRole()
    .then((role) => {
      const value = role === "admin";
      adminCache = { userId, value };
      return value;
    })
    .catch(() => {
      adminCache = { userId, value: false };
      return false;
    })
    .finally(() => {
      if (adminInflight?.userId === userId) adminInflight = null;
    });

  adminInflight = { userId, promise };
  return promise;
}

export function resolveAdminStatusForUser(userId: string): Promise<boolean> {
  return resolveAdminStatus(userId);
}

/**
 * Vérifie si l'utilisateur est admin
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = getBrowserSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return resolveAdminStatus(user.id);
}
