import type { UserIntent } from "@/bibliotheque/sectorDefaults";
import { getBrowserSupabase } from "./client-navigateur";

export interface UserProfile {
  user_id: string;
  email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  job?: string;
  birth_date?: string;
  avatar_url?: string;
  /** Secteur d'activité (id catalogue ou texte « autre »). */
  secteur?: string | null;
  user_intent?: UserIntent | null;
  created_at: string;
  updated_at: string;
  role: string;
  /** Accès premium sans abonnement actif (compte testeur). */
  is_tester?: boolean;
}

/**
 * Récupère le profil de l'utilisateur connecté
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = getBrowserSupabase();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) {
    console.error("Erreur récupération profil:", error);
    return null;
  }

  return data;
}

/**
 * Met à jour le profil de l'utilisateur
 */
export async function updateUserProfile(updates: {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  job?: string;
  birth_date?: string;
  avatar_url?: string;
  secteur?: string | null;
  user_intent?: UserIntent | null;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { success: false, error: "Non autorisé" };
  }

  const row: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };
  for (const key of Object.keys(row)) {
    if (row[key] === undefined) delete row[key];
  }

  const { error } = await supabase.from("profiles").update(row).eq("user_id", user.id);

  if (error) {
    console.error("Erreur mise à jour profil:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Upload un avatar vers Supabase Storage
 */
export async function uploadAvatar(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = getBrowserSupabase();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { success: false, error: "Non autorisé" };
  }

  try {
    // Vérifier que le fichier est une image
    if (!file.type.startsWith("image/")) {
      return { success: false, error: "Le fichier doit être une image" };
    }

    // Limiter la taille à 5MB
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: "L'image ne doit pas dépasser 5MB" };
    }

    // Générer un nom de fichier unique
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = fileName; // Le bucket est déjà "avatars", pas besoin de préfixe

    // Uploader le fichier
    const { error: uploadError, data } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error("Erreur upload avatar:", uploadError);
      return { success: false, error: uploadError.message };
    }

    // Récupérer l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    return { success: true, url: publicUrl };
  } catch (err) {
    console.error("Erreur upload avatar:", err);
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue" };
  }
}

/**
 * Supprime l'avatar de l'utilisateur
 */
export async function deleteAvatar(avatarUrl: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { success: false, error: "Non autorisé" };
  }

  try {
    // Extraire le chemin du fichier depuis l'URL
    // L'URL peut être : https://[project].supabase.co/storage/v1/object/public/avatars/filename.jpg
    const urlParts = avatarUrl.split("/avatars/");
    if (urlParts.length < 2) {
      return { success: false, error: "URL invalide" };
    }

    const fileName = urlParts[1].split("?")[0]; // Enlever les query params si présents
    const filePath = fileName; // Le bucket est déjà "avatars"

    // Supprimer le fichier
    const { error: deleteError } = await supabase.storage
      .from("avatars")
      .remove([filePath]);

    if (deleteError) {
      console.error("Erreur suppression avatar:", deleteError);
      return { success: false, error: deleteError.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Erreur suppression avatar:", err);
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue" };
  }
}
