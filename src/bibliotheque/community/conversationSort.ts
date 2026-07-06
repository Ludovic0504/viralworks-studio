import type { CommunityConversation } from "@/bibliotheque/supabase/communaute";

/** Support en tête si message support reçu ; sinon tri par dernier envoi de l'utilisateur. */
export function compareActivePrivateConversations(
  a: CommunityConversation,
  b: CommunityConversation,
): number {
  const aSupportPinned = Boolean(a.isSupport && a.hasIncomingFromSupport);
  const bSupportPinned = Boolean(b.isSupport && b.hasIncomingFromSupport);
  if (aSupportPinned && !bSupportPinned) return -1;
  if (!aSupportPinned && bSupportPinned) return 1;

  const aOutgoing = String(a.lastOutgoingAt || "");
  const bOutgoing = String(b.lastOutgoingAt || "");
  if (aOutgoing && bOutgoing) {
    const byOutgoing = bOutgoing.localeCompare(aOutgoing);
    if (byOutgoing !== 0) return byOutgoing;
  } else if (aOutgoing && !bOutgoing) {
    return -1;
  } else if (!aOutgoing && bOutgoing) {
    return 1;
  }

  return String(b.updatedAt || b.lastMessageAt || "").localeCompare(
    String(a.updatedAt || a.lastMessageAt || ""),
  );
}

export function sortActivePrivateConversations(
  conversations: CommunityConversation[],
): CommunityConversation[] {
  return [...conversations].sort(compareActivePrivateConversations);
}

export function shouldShowInActivePrivateConversations(
  conversation: CommunityConversation,
  options: { activeConversationId?: string; isAdminUser?: boolean } = {},
): boolean {
  if (conversation.isSupport) {
    return Boolean(
      conversation.hasIncomingFromSupport ||
        conversation.lastOutgoingAt ||
        conversation.lastMessageAt ||
        String(conversation.lastMessage || "").trim() ||
        conversation.id === options.activeConversationId,
    );
  }
  if (options.isAdminUser) {
    return Boolean(
      conversation.lastOutgoingAt ||
        conversation.lastMessageAt ||
        String(conversation.lastMessage || "").trim(),
    );
  }
  return Boolean(
    conversation.lastOutgoingAt ||
      conversation.id === options.activeConversationId,
  );
}
