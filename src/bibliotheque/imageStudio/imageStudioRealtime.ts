import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import type { ImageStudioHistoryItem } from "./imageStudioHistory";

type HistoryChangePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

export function isImageStudioHistoryRecord(
  row: Record<string, unknown> | null | undefined,
): row is ImageStudioHistoryItem {
  if (!row || row.kind !== "image") return false;
  const meta = row.metadata as { source?: string } | null | undefined;
  return meta?.source === "image_studio";
}

function normalizeHistoryImageUrls(
  item: ImageStudioHistoryItem,
): ImageStudioHistoryItem {
  const urls = item.metadata?.urls;
  if (!Array.isArray(urls)) return item;
  return {
    ...item,
    metadata: {
      ...item.metadata,
      urls: urls.map((url) =>
        typeof url === "string" && url.startsWith("http://")
          ? url.replace("http://", "https://")
          : url,
      ),
    },
  };
}

export function historyRowFromRealtimePayload(
  payload: HistoryChangePayload,
): ImageStudioHistoryItem | null {
  const row = payload.new ?? payload.old;
  if (!isImageStudioHistoryRecord(row)) return null;
  return normalizeHistoryImageUrls(row);
}

export type ImageStudioHistoryRealtimeHandlers = {
  onInsert?: (item: ImageStudioHistoryItem) => void;
  onUpdate?: (item: ImageStudioHistoryItem) => void;
  onDelete?: (id: string) => void;
  onAnyChange?: () => void;
};

/**
 * Écoute les changements Supabase sur `history` pour synchroniser le canvas
 * et l'historique Image Studio entre onglets / appareils du même utilisateur.
 */
export function subscribeImageStudioHistory(
  userId: string,
  handlers: ImageStudioHistoryRealtimeHandlers,
): () => void {
  const supabase = getBrowserSupabase();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleFallbackReload = () => {
    if (!handlers.onAnyChange) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      handlers.onAnyChange?.();
    }, 120);
  };

  const channel = supabase
    .channel(`image-studio-history-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "history",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const item = historyRowFromRealtimePayload(
          payload as unknown as HistoryChangePayload,
        );
        if (!item) return;
        if (handlers.onInsert) {
          handlers.onInsert(item);
        } else {
          scheduleFallbackReload();
        }
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "history",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const item = historyRowFromRealtimePayload(
          payload as unknown as HistoryChangePayload,
        );
        if (!item) return;
        if (handlers.onUpdate) {
          handlers.onUpdate(item);
        } else {
          scheduleFallbackReload();
        }
      },
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "history",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const old = (payload as unknown as HistoryChangePayload).old;
        const id = typeof old?.id === "string" ? old.id : null;
        if (handlers.onDelete) {
          if (id) handlers.onDelete(id);
        } else if (id) {
          scheduleFallbackReload();
        }
      },
    )
    .subscribe();

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    void supabase.removeChannel(channel);
  };
}
