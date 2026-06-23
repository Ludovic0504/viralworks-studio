import { getBrowserSupabase } from "./client-navigateur";
import { resolveAuthenticatedUserId } from "./authSession";

export type HistoryKind = "prompt" | "image" | "video" | "avatar" | "product";

export async function saveHistory({
  kind,
  input,
  output,
  model,
  metadata,
}: {
  kind: HistoryKind;
  input?: string;
  output?: string;
  model?: string;
  metadata?: Record<string, any>;
}) {
  const supabase = getBrowserSupabase();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    console.warn("⏭️ Erreur auth:", userErr);
    return;
  }
  if (!user) {
    console.warn("⏭️ Aucun utilisateur connecté, historique non sauvegardé dans Supabase.");
    return;
  }

  // Construire l'objet d'insertion sans metadata si null/undefined
  const insertData: any = {
    user_id: user.id,
    kind,
    input: input ?? null,
    output: output ?? null,
    model: model ?? null,
  };
  
  // Ajouter metadata seulement s'il est défini (pour éviter l'erreur si la colonne n'existe pas)
  if (metadata !== null && metadata !== undefined) {
    // Normaliser les URLs : convertir HTTP en HTTPS avant sauvegarde
    let normalizedMetadata = { ...metadata };
    if (kind === "image" && metadata.urls && Array.isArray(metadata.urls)) {
      normalizedMetadata = {
        ...metadata,
        urls: metadata.urls.map((url: string) => {
          if (url && url.startsWith("http://")) {
            return url.replace("http://", "https://");
          }
          return url;
        }),
      };
    }
    insertData.metadata = normalizedMetadata;
  }

  const { error } = await supabase.from("history").insert(insertData);

  if (error) {
    console.error("❌ Erreur d'enregistrement historique:", error);
    // Ne pas throw pour ne pas bloquer l'application si Supabase est mal configuré
  } else {
    console.log("✅ Enregistré dans Supabase:", kind, model);
  }
}

export async function listHistory({
  kind,
  limit = 20,
  metadataSource,
  userId,
}: {
  kind?: HistoryKind;
  limit?: number;
  metadataSource?: string;
  userId?: string | null;
}) {
  const supabase = getBrowserSupabase();

  const uid = await resolveAuthenticatedUserId(userId);
  if (!uid) return [];

  let query = supabase
    .from("history")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (kind) query = query.eq("kind", kind);
  if (metadataSource) {
    query = query.filter("metadata->>source", "eq", metadataSource);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Erreur listHistory:", error);
    return [];
  }

  // Normaliser les URLs : convertir HTTP en HTTPS pour éviter les erreurs Mixed Content
  const normalizedData = (data ?? []).map((item) => {
    if (item.kind === "image" && item.metadata?.urls) {
      // Convertir toutes les URLs HTTP en HTTPS
      const normalizedUrls = item.metadata.urls.map((url: string) => {
        if (url && url.startsWith("http://")) {
          return url.replace("http://", "https://");
        }
        return url;
      });
      return {
        ...item,
        metadata: {
          ...item.metadata,
          urls: normalizedUrls,
        },
      };
    }
    return item;
  });

  return normalizedData;
}

export type HistoryCounts = {
  prompts: number;
  images: number;
  videos: number;
  total: number;
};

/** Compteurs légers (COUNT) — évite de charger des centaines de lignes pour les stats Profil. */
export async function getHistoryCounts(userId?: string | null): Promise<HistoryCounts> {
  const uid = await resolveAuthenticatedUserId(userId);
  if (!uid) return { prompts: 0, images: 0, videos: 0, total: 0 };

  const supabase = getBrowserSupabase();
  const [promptRes, imageRes, videoRes, totalRes] = await Promise.all([
    supabase
      .from("history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("kind", "prompt"),
    supabase
      .from("history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("kind", "image"),
    supabase
      .from("history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("kind", "video"),
    supabase
      .from("history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid),
  ]);

  return {
    prompts: promptRes.count ?? 0,
    images: imageRes.count ?? 0,
    videos: videoRes.count ?? 0,
    total: totalRes.count ?? 0,
  };
}

/**
 * Supprime un élément de l'historique
 */
export async function deleteHistory(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { success: false, error: "Utilisateur non connecté" };
  }

  const { error } = await supabase
    .from("history")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // S'assurer que l'utilisateur ne peut supprimer que ses propres entrées

  if (error) {
    console.error("Erreur suppression historique:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Supprime tout l'historique d'un type donné
 */
export async function deleteAllHistory(kind?: HistoryKind): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { success: false, error: "Utilisateur non connecté" };
  }

  let query = supabase
    .from("history")
    .delete()
    .eq("user_id", user.id);

  if (kind) {
    query = query.eq("kind", kind);
  }

  const { error } = await query;

  if (error) {
    console.error("Erreur suppression historique:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Met à jour uniquement le metadata d'un élément d'historique
 */
export async function updateHistoryMetadata(
  id: string,
  metadata: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { success: false, error: "Utilisateur non connecté" };
  }

  const { error } = await supabase
    .from("history")
    .update({ metadata })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Erreur update metadata historique:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
