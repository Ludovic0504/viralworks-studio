import { saveHistory, listHistory, deleteHistory } from "@/bibliotheque/supabase/historique";
import { uploadImagesFromUrls } from "@/bibliotheque/supabase/storage";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";

export type StudioProductHistoryItem = {
  id: string;
  input?: string | null;
  output?: string | null;
  metadata?: {
    name?: string;
    description?: string;
    imageUrls?: string[];
    source?: string;
  } | null;
  created_at?: string;
};

const STORAGE_PRIVATE_PATH = "/storage/v1/object/generated-images/";
const STORAGE_PUBLIC_PATH = "/storage/v1/object/public/generated-images/";

export function normalizeProductStorageUrl(url: string): string {
  let u = String(url || "").trim();
  if (!u) return u;
  if (u.startsWith("http://")) u = u.replace("http://", "https://");
  if (u.includes(STORAGE_PRIVATE_PATH) && !u.includes(STORAGE_PUBLIC_PATH)) {
    u = u.replace(STORAGE_PRIVATE_PATH, STORAGE_PUBLIC_PATH);
  }
  return u;
}

export function getProductCoverUrl(item: StudioProductHistoryItem): string | null {
  const url = typeof item?.output === "string" ? item.output.trim() : "";
  if (!url) return null;
  return normalizeProductStorageUrl(url);
}

export function getProductName(item: StudioProductHistoryItem): string | null {
  const name = item?.metadata?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function buildPublicProductObjectUrl(
  supabaseUrl: string,
  userId: string,
  fileName: string,
): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}${STORAGE_PUBLIC_PATH}${userId}/products/${fileName}`;
}

function isSupabaseStoredImageUrl(url: string): boolean {
  const u = String(url || "").trim();
  if (!u.startsWith("https://")) return false;
  return u.includes("/storage/v1/object/public/generated-images/");
}

async function uploadProductImages(
  userId: string,
  imageInputs: string[],
): Promise<string[]> {
  const uploaded: string[] = [];

  for (const input of imageInputs) {
    const trimmed = String(input || "").trim();
    if (!trimmed) continue;

    const normalized = normalizeProductStorageUrl(trimmed);
    if (isSupabaseStoredImageUrl(normalized)) {
      uploaded.push(normalized);
      continue;
    }

    const result = await uploadImagesFromUrls([trimmed], userId, "image-studio-product", {
      subfolder: "products",
    });
    const rawUrl = result.urls?.[0];
    if (result.success && rawUrl && isSupabaseStoredImageUrl(rawUrl)) {
      uploaded.push(normalizeProductStorageUrl(rawUrl));
    }
  }

  return uploaded;
}

export async function listStudioProducts(limit = 20): Promise<StudioProductHistoryItem[]> {
  const rows = (await listHistory({ kind: "product", limit: limit * 2 })) as StudioProductHistoryItem[];

  const supabase = getBrowserSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const byId = new Map<string, StudioProductHistoryItem>();

  for (const row of rows) {
    const cover = getProductCoverUrl(row);
    if (!cover) continue;
    byId.set(row.id, { ...row, output: cover });
  }

  if (user?.id && supabaseUrl) {
    const { data: files } = await supabase.storage
      .from("generated-images")
      .list(`${user.id}/products`, {
        limit,
        sortBy: { column: "created_at", order: "desc" },
      });

    for (const file of files ?? []) {
      if (!file?.name || file.name === ".emptyFolderPlaceholder") continue;
      const url = buildPublicProductObjectUrl(supabaseUrl, user.id, file.name);
      const storageId = `storage-${file.id ?? file.name}`;
      if ([...byId.values()].some((item) => getProductCoverUrl(item) === url)) continue;
      byId.set(storageId, {
        id: storageId,
        output: url,
        created_at: file.created_at ?? file.updated_at,
        metadata: { source: "storage-list", name: file.name.replace(/\.[^.]+$/, "") },
      });
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return tb - ta;
    })
    .slice(0, limit);
}

export async function persistStudioProduct({
  name,
  description,
  imageDataUrls,
}: {
  name: string;
  description?: string;
  imageDataUrls: string[];
}): Promise<StudioProductHistoryItem | null> {
  const supabase = getBrowserSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    throw new Error("Connexion requise pour enregistrer un produit.");
  }

  const inputs = imageDataUrls.filter((u) => String(u || "").trim());
  if (!inputs.length) {
    throw new Error("Ajoutez au moins une image produit.");
  }

  const imageUrls = await uploadProductImages(user.id, inputs);
  if (!imageUrls.length) {
    throw new Error("Impossible d'enregistrer les images produit.");
  }

  const coverUrl = imageUrls[0];
  const trimmedName = name.trim();
  const trimmedDescription = String(description || "").trim();

  await saveHistory({
    kind: "product",
    input: trimmedName,
    output: coverUrl,
    metadata: {
      name: trimmedName,
      description: trimmedDescription || null,
      imageUrls,
      source: "image-studio-product",
    },
  });

  return {
    id: `local-${Date.now()}`,
    input: trimmedName,
    output: coverUrl,
    metadata: {
      name: trimmedName,
      description: trimmedDescription || null,
      imageUrls,
      source: "image-studio-product",
    },
    created_at: new Date().toISOString(),
  };
}

function isHistoryRowId(id: string): boolean {
  const s = String(id || "");
  return s.length > 0 && !s.startsWith("storage-");
}

function getStoragePathFromPublicUrl(url: string, userId: string): string | null {
  const normalized = normalizeProductStorageUrl(url);
  const marker = `/generated-images/${userId}/products/`;
  const idx = normalized.indexOf(marker);
  if (idx === -1) return null;
  const fileName = normalized.slice(idx + marker.length).split("?")[0]?.trim();
  if (!fileName) return null;
  return `${userId}/products/${fileName}`;
}

export async function deleteStudioProduct(
  item: StudioProductHistoryItem,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { success: false, error: "Utilisateur non connecté" };
  }

  if (isHistoryRowId(item.id)) {
    const result = await deleteHistory(item.id);
    if (!result.success) return result;
  }

  const urls = new Set<string>();
  const cover = getProductCoverUrl(item);
  if (cover) urls.add(cover);
  const metaUrls = item.metadata?.imageUrls;
  if (Array.isArray(metaUrls)) {
    for (const u of metaUrls) {
      if (typeof u === "string" && u.trim()) urls.add(normalizeProductStorageUrl(u));
    }
  }

  const paths = [...urls]
    .map((url) => getStoragePathFromPublicUrl(url, user.id))
    .filter((p): p is string => Boolean(p));

  if (paths.length > 0) {
    const { error } = await supabase.storage.from("generated-images").remove(paths);
    if (error) {
      console.error("Suppression fichiers produit:", error);
      if (!isHistoryRowId(item.id)) {
        return { success: false, error: error.message };
      }
    }
  }

  return { success: true };
}
