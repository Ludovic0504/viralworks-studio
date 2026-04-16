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
    let message = error.message || "Erreur lors du débit des crédits";
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
    const errMsg = String((data as { error?: string }).error || "Erreur lors du débit des crédits");
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

/**
 * Vérifie si l'utilisateur est admin
 */
export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole();
  return role === 'admin';
}
