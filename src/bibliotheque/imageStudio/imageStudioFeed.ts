import type { ImageStudioAspectRatio } from "./imageStudioHistory";
import {
  getImageUrlFromHistory,
  type ImageStudioHistoryItem,
} from "./imageStudioHistory";

export type ImageStudioFeedImage = {
  url: string;
  historyId?: string;
};

export type ImageStudioFeedRow = {
  id: string;
  prompt: string;
  model?: string;
  aspectRatio?: ImageStudioAspectRatio | string;
  createdAt?: string;
  images: ImageStudioFeedImage[];
  generating?: boolean;
  progress?: { current: number; total: number };
};

export const IMAGE_STUDIO_FEED_PROMPT_MAX = 140;

/** Nombre de lignes de génération visibles par défaut dans le canva central. */
export const FEED_VISIBLE_ROW_LIMIT = 6;

export function feedRowContainsHistoryItem(
  row: ImageStudioFeedRow,
  item: { id?: string; metadata?: { batchId?: string } | null },
): boolean {
  if (item.id && row.images.some((image) => image.historyId === item.id)) {
    return true;
  }
  const batchId = item.metadata?.batchId?.trim();
  return Boolean(batchId && row.id === batchId);
}

export function getFeedRowVisibility(
  feedRows: ImageStudioFeedRow[],
  expanded: boolean,
  limit = FEED_VISIBLE_ROW_LIMIT,
): { visibleRows: ImageStudioFeedRow[]; hiddenCount: number } {
  if (expanded || feedRows.length <= limit) {
    return { visibleRows: feedRows, hiddenCount: 0 };
  }
  return {
    visibleRows: feedRows.slice(-limit),
    hiddenCount: feedRows.length - limit,
  };
}

export function truncateFeedPrompt(
  text: string,
  max = IMAGE_STUDIO_FEED_PROMPT_MAX,
): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function groupHistoryIntoFeedRows(
  items: ImageStudioHistoryItem[],
): ImageStudioFeedRow[] {
  const batchMap = new Map<string, ImageStudioFeedRow>();
  const batchOrder: string[] = [];

  for (const item of items) {
    const url = getImageUrlFromHistory(item);
    if (!url) continue;

    const batchId =
      (item.metadata as { batchId?: string } | null)?.batchId?.trim() || item.id;

    if (!batchMap.has(batchId)) {
      batchOrder.push(batchId);
      batchMap.set(batchId, {
        id: batchId,
        prompt: item.input?.trim() || "",
        model: item.metadata?.imageStudioModel,
        aspectRatio: item.metadata?.aspectRatio,
        createdAt: item.created_at,
        images: [],
      });
    }

    batchMap.get(batchId)!.images.push({ url, historyId: item.id });
  }

  return batchOrder.reverse().map((batchId) => {
    const row = batchMap.get(batchId)!;
    return { ...row, images: [...row.images].reverse() };
  });
}

/** Reconstruit le feed depuis Supabase en conservant les lignes en cours de génération. */
export function mergeFeedRowsFromHistory(
  items: ImageStudioHistoryItem[],
  pendingRows: ImageStudioFeedRow[] = [],
): ImageStudioFeedRow[] {
  const fromHistory = groupHistoryIntoFeedRows(items);
  const pending = pendingRows.filter((row) => row.generating);
  if (pending.length === 0) return fromHistory;

  const historyBatchIds = new Set(fromHistory.map((row) => row.id));
  const extraPending = pending.filter((row) => !historyBatchIds.has(row.id));
  if (extraPending.length === 0) return fromHistory;

  return [...fromHistory, ...extraPending];
}

export function feedRowAspectClass(ratio?: string): string {
  if (ratio === "9:16") return "is-portrait";
  if (ratio === "4:5") return "is-portrait-45";
  if (ratio === "16:9") return "is-landscape";
  return "is-square";
}
