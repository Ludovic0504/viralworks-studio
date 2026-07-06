import type { CommunityMessage } from "@/bibliotheque/supabase/communaute";

type CacheEntry = {
  messages: CommunityMessage[];
  fetchedAt: number;
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CommunityMessage[]>>();

export function getCachedPrivateMessages(conversationId: string): CommunityMessage[] | null {
  const id = String(conversationId || "").trim();
  if (!id) return null;
  const hit = cache.get(id);
  if (!hit || Date.now() - hit.fetchedAt > CACHE_TTL_MS) return null;
  return hit.messages;
}

export async function prefetchPrivateMessages(
  conversationId: string,
  fetcher: () => Promise<CommunityMessage[]>,
): Promise<CommunityMessage[]> {
  const id = String(conversationId || "").trim();
  if (!id) return [];

  const hit = cache.get(id);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.messages;
  }

  let promise = inFlight.get(id);
  if (!promise) {
    promise = fetcher()
      .then((messages) => {
        cache.set(id, { messages, fetchedAt: Date.now() });
        inFlight.delete(id);
        return messages;
      })
      .catch((error) => {
        inFlight.delete(id);
        throw error;
      });
    inFlight.set(id, promise);
  }

  return promise;
}

export function rememberPrivateMessages(
  conversationId: string,
  messages: CommunityMessage[],
): void {
  const id = String(conversationId || "").trim();
  if (!id || !messages.length) return;
  cache.set(id, { messages, fetchedAt: Date.now() });
}
