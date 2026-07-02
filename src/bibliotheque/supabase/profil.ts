import type { UserIntent } from "@/bibliotheque/sectorDefaults";
import { getBrowserSupabase } from "./client-navigateur";
import { resolveAuthenticatedUserId } from "./authSession";

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
  preferred_locale?: string | null;
}

const PROFILE_CACHE_TTL_MS = 60_000;
const PROFILE_STORAGE_PREFIX = "vws:profile:";
const PROFILE_STORAGE_TTL_MS = 24 * 60 * 60 * 1000;

let profileCache: {
  userId: string;
  data: UserProfile | null;
  fetchedAt: number;
} | null = null;

let profileInflight: {
  userId: string;
  promise: Promise<UserProfile | null>;
} | null = null;

function readPersistedUserProfile(userId: string): UserProfile | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${PROFILE_STORAGE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fetchedAt?: number; data?: UserProfile | null };
    if (!parsed?.fetchedAt || Date.now() - parsed.fetchedAt >= PROFILE_STORAGE_TTL_MS) {
      sessionStorage.removeItem(`${PROFILE_STORAGE_PREFIX}${userId}`);
      return null;
    }
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function writePersistedUserProfile(userId: string, data: UserProfile | null): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      `${PROFILE_STORAGE_PREFIX}${userId}`,
      JSON.stringify({ fetchedAt: Date.now(), data }),
    );
  } catch {
    // quota / private mode
  }
}

function removePersistedUserProfile(userId: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(`${PROFILE_STORAGE_PREFIX}${userId}`);
  } catch {
    // no-op
  }
}

function commitProfileCache(userId: string, data: UserProfile | null): void {
  profileCache = { userId, data, fetchedAt: Date.now() };
  writePersistedUserProfile(userId, data);
}

export function invalidateUserProfileCache(userId?: string | null): void {
  profileCache = null;
  if (userId) removePersistedUserProfile(userId);
}

export function readCachedUserProfile(userId?: string | null): UserProfile | null {
  if (!userId) return null;
  if (
    profileCache?.userId === userId &&
    Date.now() - profileCache.fetchedAt < PROFILE_CACHE_TTL_MS
  ) {
    return profileCache.data;
  }
  return readPersistedUserProfile(userId);
}

async function fetchUserProfileRow(uid: string): Promise<UserProfile | null> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", uid)
    .single();

  if (error) {
    console.error("Erreur récupération profil:", error);
    return null;
  }

  return data;
}

/**
 * Récupère le profil de l'utilisateur connecté
 */
export async function getUserProfile(userId?: string | null): Promise<UserProfile | null> {
  const uid = await resolveAuthenticatedUserId(userId);
  if (!uid) {
    return null;
  }

  if (
    profileCache?.userId === uid &&
    Date.now() - profileCache.fetchedAt < PROFILE_CACHE_TTL_MS
  ) {
    return profileCache.data;
  }

  if (profileInflight?.userId === uid) {
    return profileInflight.promise;
  }

  const promise = fetchUserProfileRow(uid)
    .then((data) => {
      commitProfileCache(uid, data);
      return data;
    })
    .finally(() => {
      if (profileInflight?.userId === uid) {
        profileInflight = null;
      }
    });

  profileInflight = { userId: uid, promise };
  return promise;
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

  invalidateUserProfileCache(user.id);
  return { success: true };
}

/**
 * Recopie prénom/nom depuis les métadonnées Auth vers `profiles` si la ligne profil est encore vide.
 * Utile après confirmation email (inscription sans session immédiate).
 */
export async function syncSignupProfileNamesFromMetadata(): Promise<void> {
  const supabase = getBrowserSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return;

  const existing = await getUserProfile(user.id);
  const meta = user.user_metadata || {};
  const metaFirst = typeof meta.first_name === "string" ? meta.first_name.trim() : "";
  const metaLast = typeof meta.last_name === "string" ? meta.last_name.trim() : "";
  if (!metaFirst && !metaLast) return;

  const first_name = existing?.first_name?.trim() || metaFirst;
  const last_name = existing?.last_name?.trim() || metaLast;
  if (!first_name && !last_name) return;

  if (
    existing?.first_name?.trim() === first_name &&
    existing?.last_name?.trim() === last_name &&
    existing?.full_name?.trim()
  ) {
    return;
  }

  const full_name =
    existing?.full_name?.trim() ||
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    `${first_name} ${last_name}`.trim();

  await updateUserProfile({ first_name, last_name, full_name });
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
