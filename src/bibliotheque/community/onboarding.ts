import type {
  CommunityConversation,
  CommunityMessage,
  UnreadPrivatePreview,
} from "@/bibliotheque/supabase/communaute";

export const ONBOARDING_STEP1_MARKER = "Salut 👋";
export const ONBOARDING_STEP2_MARKER = "tu cherches à faire quoi principalement";

export const ONBOARDING_STEP3_MARKER = "Merci pour tes réponses";

export const ONBOARDING_STEP2_CONTENT =
  "Et toi, tu cherches à faire quoi principalement avec ViralWorks Studio ?";

export const ONBOARDING_STEP3_CONTENT = `Merci pour tes réponses !

Bonne découverte de ViralWorks Studio.

Si tu as besoin d'une info, n'hésite pas à l'écrire ici — je te répondrai le plus rapidement possible.`;

export const ONBOARDING_STEP1_CONTENT = `Salut 👋

Merci d'avoir rejoint ViralWorks Studio.

Je suis le fondateur de la plateforme et je voulais te souhaiter la bienvenue.

Par curiosité, comment t'es tombé(e) sur ViralWorks Studio ?`;

export const ONBOARDING_STEP1_QUICK_REPLIES = [
  "Instagram",
  "Skool",
  "Groupe Facebook",
  "Google/autre",
  "Par recommandation",
  "Autres",
] as const;

export const ONBOARDING_STEP2_QUICK_REPLIES = [
  "Créer des visuels",
  "Créer des vidéos",
  "Éditer des vidéos",
  "Autres",
] as const;

export function resolveQuickReplyOptions(
  msg: Pick<CommunityMessage, "content" | "quickReplyOptions" | "onboardingStep" | "isSupport">,
): string[] | undefined {
  if (msg.quickReplyOptions?.length) return msg.quickReplyOptions;

  if (msg.onboardingStep === 1) return [...ONBOARDING_STEP1_QUICK_REPLIES];
  if (msg.onboardingStep === 2) return [...ONBOARDING_STEP2_QUICK_REPLIES];

  if (!msg.isSupport) return undefined;
  const content = String(msg.content || "");
  if (content.includes(ONBOARDING_STEP1_MARKER)) return [...ONBOARDING_STEP1_QUICK_REPLIES];
  if (content.includes(ONBOARDING_STEP2_MARKER)) return [...ONBOARDING_STEP2_QUICK_REPLIES];

  return undefined;
}

export function resolveOnboardingStepFromPreviewText(
  previewText: string,
  isSupport: boolean,
): 1 | 2 | 3 | null {
  if (!isSupport) return null;
  const text = String(previewText || "");
  if (text.includes(ONBOARDING_STEP1_MARKER) || text.startsWith("Salut")) return 1;
  if (text.includes(ONBOARDING_STEP2_MARKER)) return 2;
  if (text.includes(ONBOARDING_STEP3_MARKER)) return 3;
  return null;
}

export function resolveOnboardingContentForStep(step: number | null): string | null {
  if (step === 1) return ONBOARDING_STEP1_CONTENT;
  if (step === 2) return ONBOARDING_STEP2_CONTENT;
  if (step === 3) return ONBOARDING_STEP3_CONTENT;
  return null;
}

export function enrichOnboardingMessageContent(message: CommunityMessage): CommunityMessage {
  const step =
    message.onboardingStep ??
    resolveOnboardingStep(message) ??
    resolveOnboardingStepFromPreviewText(message.content, Boolean(message.isSupport));

  if (!step) return message;

  const content = resolveOnboardingContentForStep(step) || message.content;
  return {
    ...message,
    content,
    onboardingStep: step,
    isSupport: message.isSupport ?? true,
  };
}

export function enrichCommunityMessage(message: CommunityMessage): CommunityMessage {
  const withContent = enrichOnboardingMessageContent(message);
  const quickReplyOptions = resolveQuickReplyOptions(withContent);
  if (!quickReplyOptions?.length) return withContent;
  if (withContent.quickReplyOptions?.length) return withContent;
  return { ...withContent, quickReplyOptions };
}

export function buildMessageFromUnreadPreview(preview: UnreadPrivatePreview): CommunityMessage {
  const previewText = String(preview.contentPreview || "");
  const step = resolveOnboardingStepFromPreviewText(previewText, preview.isSupport);
  const content = step ? resolveOnboardingContentForStep(step) || previewText : previewText;

  return {
    id: preview.messageId,
    conversationId: preview.conversationId,
    userId: preview.senderUserId,
    username: preview.senderName || "Support",
    content,
    createdAt: preview.createdAt || new Date().toISOString(),
    attachment: null,
    isSupport: preview.isSupport,
    onboardingStep: step,
  };
}

export function hydratePrivateMessagesFromUnreadPreview(
  conversationId: string,
  preview: UnreadPrivatePreview,
  remembered: CommunityMessage[] | null | undefined,
): CommunityMessage[] {
  const previewMessage = enrichCommunityMessage(buildMessageFromUnreadPreview(preview));
  const convId = String(conversationId || "").trim();
  if (!convId || convId !== preview.conversationId) {
    return [previewMessage];
  }

  const base = remembered?.length ? remembered : [];
  if (!base.length) return [previewMessage];

  const hasPreviewId = base.some((message) => message.id === previewMessage.id);
  const hasPreviewStep =
    previewMessage.onboardingStep != null &&
    base.some((message) => message.onboardingStep === previewMessage.onboardingStep);

  if (hasPreviewId || hasPreviewStep) {
    return base.map(enrichCommunityMessage);
  }

  return mergePrivateMessagesWithServer(base, [previewMessage]).map(enrichCommunityMessage);
}

export function buildConversationFromUnreadPreview(
  preview: UnreadPrivatePreview,
): CommunityConversation {
  const step = resolveOnboardingStepFromPreviewText(preview.contentPreview, preview.isSupport);
  const fullContent = step ? resolveOnboardingContentForStep(step) : null;

  return {
    id: preview.conversationId,
    otherUserId: preview.senderUserId,
    otherUsername: preview.isSupport ? "Support officiel" : preview.senderName || "Utilisateur",
    updatedAt: preview.createdAt || new Date().toISOString(),
    lastMessage: fullContent || preview.contentPreview || "",
    lastMessageAt: preview.createdAt || "",
    isSupport: preview.isSupport,
  };
}

const OPTIMISTIC_ONBOARDING_ID_PREFIX = "temp-onboarding-step";

export function isOptimisticOnboardingMessageId(id: string | null | undefined): boolean {
  return String(id || "").startsWith(OPTIMISTIC_ONBOARDING_ID_PREFIX);
}

export function resolveOnboardingStep(
  msg: Pick<CommunityMessage, "content" | "onboardingStep" | "isSupport">,
): number | null {
  if (msg.onboardingStep === 1 || msg.onboardingStep === 2) return msg.onboardingStep;
  const content = String(msg.content || "");
  if (content.includes(ONBOARDING_STEP1_MARKER)) return 1;
  if (content.includes(ONBOARDING_STEP2_MARKER)) return 2;
  return null;
}

export function buildOptimisticOnboardingFollowUp(input: {
  answeredStep: 1 | 2;
  conversationId: string;
  supportUserId: string;
}): CommunityMessage {
  const now = new Date().toISOString();
  if (input.answeredStep === 1) {
    return {
      id: `${OPTIMISTIC_ONBOARDING_ID_PREFIX}2-${Date.now()}`,
      conversationId: input.conversationId,
      userId: input.supportUserId,
      username: "Support officiel",
      content: ONBOARDING_STEP2_CONTENT,
      createdAt: now,
      attachment: null,
      isSupport: true,
      onboardingStep: 2,
      quickReplyOptions: [...ONBOARDING_STEP2_QUICK_REPLIES],
    };
  }

  return {
    id: `${OPTIMISTIC_ONBOARDING_ID_PREFIX}3-${Date.now()}`,
    conversationId: input.conversationId,
    userId: input.supportUserId,
    username: "Support officiel",
    content: ONBOARDING_STEP3_CONTENT,
    createdAt: now,
    attachment: null,
    isSupport: true,
    onboardingStep: 3,
  };
}

export function mergePrivateMessagesWithServer(
  current: CommunityMessage[],
  server: CommunityMessage[],
): CommunityMessage[] {
  const serverSteps = new Set(
    server.map((message) => message.onboardingStep).filter((step): step is number => Boolean(step)),
  );
  const optimistic = current.filter(
    (message) =>
      isOptimisticOnboardingMessageId(message.id) &&
      message.onboardingStep != null &&
      !serverSteps.has(message.onboardingStep),
  );
  if (!optimistic.length) return server;

  return [...server, ...optimistic].sort((a, b) =>
    String(a.createdAt).localeCompare(String(b.createdAt)),
  );
}
