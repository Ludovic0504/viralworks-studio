export type ConversationSortRow = {
  id: string;
  otherUserId: string;
  otherUsername: string;
  updatedAt: string;
  lastMessage: string;
  lastMessageAt: string;
  isSupport?: boolean;
  hasOnboardingAnswers?: boolean;
  lastOutgoingAt?: string | null;
  hasIncomingFromSupport?: boolean;
};

export function compareActivePrivateConversations(
  a: ConversationSortRow,
  b: ConversationSortRow,
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

export function sortActivePrivateConversations<T extends ConversationSortRow>(rows: T[]): T[] {
  return [...rows].sort(compareActivePrivateConversations);
}
