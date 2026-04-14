import { getBrowserSupabase } from "./client-navigateur";

export interface Nouveaute {
  id: string;
  title: string;
  description: string;
  type: 'feature' | 'improvement' | 'fix' | 'update' | 'creation' | 'fonctionnalite';
  category: 'Création' | 'Interface' | 'Fonctionnalité' | 'Ressources' | 'Technique' | 'Sécurité' | 'Boutique' | 'Profil';
  redirect_path: string | null;
  redirect_label: string | null;
  icon_name: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

/**
 * Récupère toutes les nouveautés actives
 */
export async function getNouveautes(): Promise<Nouveaute[]> {
  const supabase = getBrowserSupabase();

  const { data, error } = await supabase
    .from("nouveautes")
    .select("*")
    .eq("is_active", true)
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur récupération nouveautés:", error);
    return [];
  }

  return data || [];
}

/**
 * Récupère toutes les nouveautés (admin uniquement)
 */
export async function getAllNouveautes(): Promise<Nouveaute[]> {
  const supabase = getBrowserSupabase();

  const { data, error } = await supabase
    .from("nouveautes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur récupération toutes nouveautés:", error);
    return [];
  }

  return data || [];
}

/**
 * Crée une nouvelle nouveauté (admin uniquement)
 */
export async function createNouveaute(nouveaute: {
  title: string;
  description: string;
  type: Nouveaute['type'];
  category: Nouveaute['category'];
  redirect_path?: string | null;
  redirect_label?: string | null;
  icon_name?: string | null;
  published_at?: string | null;
}): Promise<{ success: boolean; data?: Nouveaute; error?: string }> {
  const supabase = getBrowserSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Utilisateur non connecté" };
  }

  const { data, error } = await supabase
    .from("nouveautes")
    .insert({
      ...nouveaute,
      created_by: user.id,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Erreur création nouveauté:", error);
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

/**
 * Met à jour une nouveauté (admin uniquement)
 */
export async function updateNouveaute(
  id: string,
  updates: Partial<Omit<Nouveaute, 'id' | 'created_by' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; data?: Nouveaute; error?: string }> {
  const supabase = getBrowserSupabase();

  const { data, error } = await supabase
    .from("nouveautes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Erreur mise à jour nouveauté:", error);
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

/**
 * Supprime une nouveauté (admin uniquement)
 */
export async function deleteNouveaute(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();

  const { error } = await supabase
    .from("nouveautes")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erreur suppression nouveauté:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Active/désactive une nouveauté (admin uniquement)
 */
export async function toggleNouveaute(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  return updateNouveaute(id, { is_active: isActive });
}
