import type { AvatarConfig } from "@/bibliotheque/studio/avatarOptions";
import { saveHistory, listHistory } from "@/bibliotheque/supabase/historique";
import { uploadImagesFromUrls } from "@/bibliotheque/supabase/storage";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";

export type StudioAvatarHistoryItem = {
  id: string;
  output?: string | null;
  metadata?: {
    config?: Record<string, unknown>;
    source?: string;
  } | null;
  created_at?: string;
};

const STORAGE_PRIVATE_PATH = "/storage/v1/object/generated-images/";
const STORAGE_PUBLIC_PATH = "/storage/v1/object/public/generated-images/";

/** Force le format URL publique du bucket `generated-images` (option A). */
export function normalizeAvatarStorageUrl(url: string): string {
  let u = String(url || "").trim();
  if (!u) return u;
  if (u.startsWith("http://")) u = u.replace("http://", "https://");
  if (u.includes(STORAGE_PRIVATE_PATH) && !u.includes(STORAGE_PUBLIC_PATH)) {
    u = u.replace(STORAGE_PRIVATE_PATH, STORAGE_PUBLIC_PATH);
  }
  return u;
}

export function getAvatarUrlFromHistory(item: StudioAvatarHistoryItem): string | null {
  const url = typeof item?.output === "string" ? item.output.trim() : "";
  if (!url) return null;
  return normalizeAvatarStorageUrl(url);
}

function buildPublicAvatarObjectUrl(
  supabaseUrl: string,
  userId: string,
  fileName: string
): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}${STORAGE_PUBLIC_PATH}${userId}/avatars/${fileName}`;
}

export function serializeAvatarConfigForHistory(
  config: Partial<AvatarConfig>
): Record<string, unknown> {
  return {
    genre: config.genre ?? null,
    age: config.age ?? null,
    metier: config.metier ?? null,
    morphologie: config.morphologie ?? null,
    carnation: config.carnation ?? null,
    styleTenue: config.styleTenue ?? null,
    couleurDominante: config.couleurDominante ?? null,
    accessoires: config.accessoires ?? false,
    environment: config.environment ?? null,
  };
}

export async function listStudioAvatars(limit = 10): Promise<StudioAvatarHistoryItem[]> {
  const rows = (await listHistory({ kind: "avatar", limit: limit * 2 })) as StudioAvatarHistoryItem[];

  const supabase = getBrowserSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const byUrl = new Map<string, StudioAvatarHistoryItem>();

  for (const row of rows) {
    const url = getAvatarUrlFromHistory(row);
    if (!url || !url.includes(STORAGE_PUBLIC_PATH)) continue;
    byUrl.set(url, { ...row, output: url });
  }

  if (user?.id && supabaseUrl) {
    const { data: files } = await supabase.storage
      .from("generated-images")
      .list(`${user.id}/avatars`, {
        limit,
        sortBy: { column: "created_at", order: "desc" },
      });

    for (const file of files ?? []) {
      if (!file?.name || file.name === ".emptyFolderPlaceholder") continue;
      const url = buildPublicAvatarObjectUrl(supabaseUrl, user.id, file.name);
      if (byUrl.has(url)) continue;
      byUrl.set(url, {
        id: `storage-${file.id ?? file.name}`,
        output: url,
        created_at: file.created_at ?? file.updated_at,
        metadata: { source: "storage-list" },
      });
    }
  }

  return Array.from(byUrl.values())
    .sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return tb - ta;
    })
    .slice(0, limit);
}

function isSupabaseStoredImageUrl(url: string): boolean {
  const u = String(url || "").trim();
  if (!u.startsWith("https://")) return false;
  return u.includes("/storage/v1/object/public/generated-images/");
}

/**
 * Upload vers generated-images + entrée history (kind avatar).
 * Retourne l'URL Storage ou le base64 d'origine si l'upload échoue.
 */
export async function persistGeneratedAvatar(
  avatarUrlB64: string,
  config: Partial<AvatarConfig>
): Promise<string> {
  const supabase = getBrowserSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    console.warn("⏭️ Avatar non persisté : utilisateur non connecté");
    return avatarUrlB64;
  }

  let storageUrl: string;

  const normalizedInput = normalizeAvatarStorageUrl(avatarUrlB64);

  if (isSupabaseStoredImageUrl(normalizedInput)) {
    storageUrl = normalizedInput;
  } else {
    const uploadResult = await uploadImagesFromUrls(
      [avatarUrlB64],
      user.id,
      "studio-avatar",
      { subfolder: "avatars" }
    );

    const rawUrl = uploadResult.urls?.[0];
    if (!uploadResult.success || !rawUrl || !isSupabaseStoredImageUrl(rawUrl)) {
      console.warn("⚠️ Upload avatar Studio échoué, preview en base64 conservée");
      return avatarUrlB64;
    }

    storageUrl = normalizeAvatarStorageUrl(rawUrl);
  }

  await saveHistory({
    kind: "avatar",
    output: normalizeAvatarStorageUrl(storageUrl),
    metadata: {
      config: serializeAvatarConfigForHistory(config),
      source: "studio-generate-avatar",
    },
  });

  return storageUrl;
}
