import type { ImageStudioHistoryItem } from "./imageStudioHistory";
import { listImageStudioHistory } from "./imageStudioHistory";

const CACHE_PREFIX = "image_studio_history_cache:";
const CACHE_MAX_ITEMS = 120;

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`;
}

function slimHistoryItem(item: ImageStudioHistoryItem): ImageStudioHistoryItem {
  const metadata = item.metadata;
  return {
    id: item.id,
    input: item.input ?? null,
    output: item.output ?? null,
    created_at: item.created_at,
    metadata: metadata
      ? {
          source: metadata.source,
          aspectRatio: metadata.aspectRatio,
          imageStudioModel: metadata.imageStudioModel,
          batchId: metadata.batchId,
          urls: Array.isArray(metadata.urls) ? metadata.urls.slice(0, 4) : undefined,
        }
      : null,
  };
}

export function loadImageStudioHistoryCache(userId: string): ImageStudioHistoryItem[] | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.filter(
      (row): row is ImageStudioHistoryItem =>
        Boolean(row && typeof row === "object" && typeof (row as ImageStudioHistoryItem).id === "string"),
    );
  } catch {
    return null;
  }
}

export function saveImageStudioHistoryCache(
  userId: string,
  items: ImageStudioHistoryItem[],
): void {
  if (!userId || typeof window === "undefined" || items.length === 0) return;
  try {
    localStorage.setItem(
      cacheKey(userId),
      JSON.stringify(items.slice(0, CACHE_MAX_ITEMS).map(slimHistoryItem)),
    );
  } catch {
    // quota / private mode
  }
}

let prefetchInflight: Promise<ImageStudioHistoryItem[] | null> | null = null;
let prefetchUserId: string | null = null;

/** Précharge l'historique au survol du menu pour un canva instantané à l'ouverture. */
export function prefetchImageStudioHistory(userId: string | undefined): void {
  if (!userId) return;
  if (prefetchInflight && prefetchUserId === userId) return;

  prefetchUserId = userId;
  prefetchInflight = listImageStudioHistory(CACHE_MAX_ITEMS)
    .then((rows) => {
      if (rows.length > 0) saveImageStudioHistoryCache(userId, rows);
      return rows;
    })
    .catch(() => null)
    .finally(() => {
      prefetchInflight = null;
    });
}

export function applyImageStudioHistoryCache(
  userId: string | undefined,
): ImageStudioHistoryItem[] | null {
  if (!userId) return null;
  return loadImageStudioHistoryCache(userId);
}
