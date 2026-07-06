import type { CommunityConversation } from "@/bibliotheque/supabase/communaute";
import { sortActivePrivateConversations } from "@/bibliotheque/community/conversationSort";

const STORAGE_KEY = "vws_support_conversation_stub";

function pickNewerIso(a?: string | null, b?: string | null): string | null {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left) return right || null;
  if (!right) return left || null;
  return left.localeCompare(right) >= 0 ? left : right;
}

/** Fusionne deux versions d'une conversation sans perdre les métadonnées d'activité. */
export function mergeConversationRecords(
  base: CommunityConversation,
  overlay: CommunityConversation,
): CommunityConversation {
  const newerMessageAt = pickNewerIso(base.lastMessageAt, overlay.lastMessageAt);
  const baseIsNewerMessage = newerMessageAt === String(base.lastMessageAt || "").trim();

  return {
    ...base,
    ...overlay,
    hasIncomingFromSupport:
      Boolean(base.hasIncomingFromSupport) || Boolean(overlay.hasIncomingFromSupport),
    lastOutgoingAt: pickNewerIso(base.lastOutgoingAt, overlay.lastOutgoingAt),
    lastMessageAt: newerMessageAt,
    updatedAt: pickNewerIso(base.updatedAt, overlay.updatedAt) || base.updatedAt || overlay.updatedAt,
    lastMessage: baseIsNewerMessage
      ? base.lastMessage || overlay.lastMessage
      : overlay.lastMessage || base.lastMessage,
    unreadCount: Math.max(Number(base.unreadCount || 0), Number(overlay.unreadCount || 0)),
    notificationsMuted: overlay.notificationsMuted ?? base.notificationsMuted,
  };
}

export function getRememberedSupportConversation(): CommunityConversation | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CommunityConversation;
    if (!parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function rememberSupportConversation(conv: CommunityConversation): void {
  const id = String(conv?.id || "").trim();
  if (!id) return;
  try {
    const existing = getRememberedSupportConversation();
    const merged =
      existing && String(existing.id) === id
        ? mergeConversationRecords(existing, conv)
        : conv;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
}

export function upsertConversationInList(
  list: CommunityConversation[],
  conv: CommunityConversation,
): CommunityConversation[] {
  const byId = new Map<string, CommunityConversation>();
  for (const row of list) {
    if (row?.id) byId.set(String(row.id), row);
  }
  const id = String(conv.id);
  const existing = byId.get(id);
  byId.set(id, existing ? mergeConversationRecords(existing, conv) : conv);
  return sortActivePrivateConversations([...byId.values()]);
}

export function mergeConversationLists(
  primary: CommunityConversation[],
  secondary: CommunityConversation[],
): CommunityConversation[] {
  let merged = [...primary];
  for (const conv of secondary) {
    if (!conv?.id) continue;
    merged = upsertConversationInList(merged, conv);
  }
  return merged;
}
