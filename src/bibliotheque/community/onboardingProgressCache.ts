import type { CommunityMessage } from "@/bibliotheque/supabase/communaute";
import { mergePrivateMessagesWithServer } from "@/bibliotheque/community/onboarding";

const STORAGE_KEY = "vws_onboarding_private_messages";

type StoredMap = Record<string, CommunityMessage[]>;

function readStore(): StoredMap {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: StoredMap): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function getRememberedOnboardingPrivateMessages(
  conversationId: string,
): CommunityMessage[] | null {
  const id = String(conversationId || "").trim();
  if (!id) return null;
  const messages = readStore()[id];
  return Array.isArray(messages) && messages.length ? messages : null;
}

export function rememberOnboardingPrivateMessages(
  conversationId: string,
  messages: CommunityMessage[],
): void {
  const id = String(conversationId || "").trim();
  if (!id || !messages.length) return;
  const store = readStore();
  store[id] = messages;
  writeStore(store);
}

export function mergeRememberedOnboardingPrivateMessages(
  conversationId: string,
  incoming: CommunityMessage[],
): CommunityMessage[] {
  const id = String(conversationId || "").trim();
  if (!id || !incoming.length) return incoming;
  const current = getRememberedOnboardingPrivateMessages(id) || [];
  const merged = mergePrivateMessagesWithServer(current, incoming);
  rememberOnboardingPrivateMessages(id, merged);
  return merged;
}
