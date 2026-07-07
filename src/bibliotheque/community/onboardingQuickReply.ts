import type { CommunityMessage } from "@/bibliotheque/supabase/communaute";
import {
  buildOptimisticOnboardingFollowUp,
  enrichCommunityMessage,
  hasOnboardingStep,
  isOptimisticOnboardingMessageId,
  mergePrivateMessagesWithServer,
  resolveMessageOnboardingStep,
  resolveOnboardingStep,
} from "@/bibliotheque/community/onboarding";

export const ONBOARDING_FOLLOW_UP_POLL_MS = [0, 250, 500, 900, 1400, 2000, 3000];

export function resolveSupportUserId(
  messages: CommunityMessage[],
  activeConversation?: { isSupport?: boolean; otherUserId?: string } | null,
): string {
  return (
    (activeConversation?.isSupport ? activeConversation.otherUserId : "") ||
    messages.find((message) => message.isSupport)?.userId ||
    ""
  );
}

export function isOnboardingFollowUpVisible(
  messages: CommunityMessage[],
  step: 2 | 3,
): boolean {
  return messages.some((message) => {
    if (resolveMessageOnboardingStep(message) !== step) return false;
    return Boolean(String(message.content || "").trim());
  });
}

export function findOnboardingSourceMessage(
  messages: CommunityMessage[],
  sourceMessageId: string,
  sourceOnboardingStep?: number | null,
): CommunityMessage | undefined {
  const byId = messages.find((message) => message.id === sourceMessageId);
  if (byId && !isOptimisticOnboardingMessageId(byId.id)) return byId;

  if (sourceOnboardingStep != null) {
    const persisted = messages.find(
      (message) =>
        resolveMessageOnboardingStep(message) === sourceOnboardingStep &&
        !isOptimisticOnboardingMessageId(message.id),
    );
    if (persisted) return persisted;

    const optimistic = messages.find(
      (message) =>
        resolveMessageOnboardingStep(message) === sourceOnboardingStep &&
        isOptimisticOnboardingMessageId(message.id),
    );
    if (optimistic) return optimistic;
  }

  return byId;
}

export function applyOnboardingQuickReplyOptimistic(
  messages: CommunityMessage[],
  input: {
    sourceMessageId: string;
    sourceOnboardingStep?: number | null;
    label: string;
    conversationId: string;
    supportUserId: string;
  },
): {
  messages: CommunityMessage[];
  answeredStep: 1 | 2;
  followUpStep: 2 | 3;
  sourceMessageId: string;
} | null {
  const text = input.label.trim();
  if (!text || !input.conversationId) return null;

  const sourceMessage = findOnboardingSourceMessage(
    messages,
    input.sourceMessageId,
    input.sourceOnboardingStep,
  );

  const answeredStep = sourceMessage ? resolveOnboardingStep(sourceMessage) : null;
  if ((answeredStep !== 1 && answeredStep !== 2) || !sourceMessage) return null;

  const followUpStep = (answeredStep + 1) as 2 | 3;
  const resolvedSourceMessageId = sourceMessage.id;

  const next = messages.map((message) => {
    const messageStep = resolveMessageOnboardingStep(message);
    const matchesSource =
      message.id === resolvedSourceMessageId || messageStep === answeredStep;
    if (!matchesSource) return message;
    return { ...message, quickReplySelected: text };
  });

  let result = next;
  if (input.supportUserId && !isOnboardingFollowUpVisible(next, followUpStep)) {
    result = [
      ...next,
      buildOptimisticOnboardingFollowUp({
        answeredStep,
        conversationId: input.conversationId,
        supportUserId: input.supportUserId,
      }),
    ];
  }

  return {
    messages: result.map(enrichCommunityMessage),
    answeredStep,
    followUpStep,
    sourceMessageId: resolvedSourceMessageId,
  };
}

export function ensureOnboardingFollowUpMessage(
  messages: CommunityMessage[],
  input: {
    answeredStep: 1 | 2;
    conversationId: string;
    supportUserId: string;
  },
): CommunityMessage[] {
  const followUpStep = (input.answeredStep + 1) as 2 | 3;
  if (isOnboardingFollowUpVisible(messages, followUpStep) || !input.supportUserId) {
    return messages.map(enrichCommunityMessage);
  }

  return [
    ...messages,
    buildOptimisticOnboardingFollowUp({
      answeredStep: input.answeredStep,
      conversationId: input.conversationId,
      supportUserId: input.supportUserId,
    }),
  ].map(enrichCommunityMessage);
}

export function rollbackOnboardingQuickReplySelection(
  messages: CommunityMessage[],
  answeredStep: number | null,
): CommunityMessage[] {
  if (answeredStep == null) return messages;
  return messages.map((message) =>
    resolveMessageOnboardingStep(message) === answeredStep
      ? { ...message, quickReplySelected: null }
      : message,
  );
}

export async function resolvePersistedOnboardingMessageId(
  fetchMessages: () => Promise<CommunityMessage[]>,
  sourceMessageId: string,
  answeredStep: number | null,
  getLocalMessages?: () => CommunityMessage[],
): Promise<string> {
  if (!isOptimisticOnboardingMessageId(sourceMessageId)) return sourceMessageId;
  if (answeredStep !== 1 && answeredStep !== 2) return sourceMessageId;

  const localPersisted = getLocalMessages?.().find(
    (message) =>
      resolveMessageOnboardingStep(message) === answeredStep &&
      !isOptimisticOnboardingMessageId(message.id),
  );
  if (localPersisted?.id) return localPersisted.id;

  const delays = [0, 150, 300, 600, 1000, 1500, 2500, 4000, 6000];
  for (const delay of delays) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const local = getLocalMessages?.().find(
      (message) =>
        resolveMessageOnboardingStep(message) === answeredStep &&
        !isOptimisticOnboardingMessageId(message.id),
    );
    if (local?.id) return local.id;

    const fetched = await fetchMessages();
    const persisted = fetched.find(
      (message) =>
        resolveMessageOnboardingStep(message) === answeredStep &&
        !isOptimisticOnboardingMessageId(message.id),
    );
    if (persisted?.id) return persisted.id;
  }

  throw new Error("Impossible d'enregistrer la réponse rapide pour l'instant.");
}

export async function syncOnboardingFollowUpAfterReply(
  fetchMessages: () => Promise<CommunityMessage[]>,
  getMessages: () => CommunityMessage[],
  expectFollowUpStep: 2 | 3,
  ensureInput: {
    answeredStep: 1 | 2;
    conversationId: string;
    supportUserId: string;
  } | null,
  onProgress?: (messages: CommunityMessage[]) => void,
): Promise<CommunityMessage[]> {
  const publish = (messages: CommunityMessage[]) => {
    const hydrated = messages.map(enrichCommunityMessage);
    onProgress?.(hydrated);
    return hydrated;
  };

  if (isOnboardingFollowUpVisible(getMessages(), expectFollowUpStep)) {
    const fetched = await fetchMessages();
    return publish(mergePrivateMessagesWithServer(getMessages(), fetched));
  }

  let latest = getMessages();

  for (const delay of ONBOARDING_FOLLOW_UP_POLL_MS) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const fetched = await fetchMessages();
    latest = mergePrivateMessagesWithServer(getMessages(), fetched);
    const hydrated = publish(latest);

    if (isOnboardingFollowUpVisible(hydrated, expectFollowUpStep)) {
      return hydrated;
    }
  }

  if (ensureInput && !isOnboardingFollowUpVisible(latest, expectFollowUpStep)) {
    return publish(ensureOnboardingFollowUpMessage(getMessages(), ensureInput));
  }

  return publish(latest);
}
