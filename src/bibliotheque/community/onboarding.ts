import type { CommunityMessage, UnreadPrivatePreview } from "@/bibliotheque/supabase/communaute";

export const ONBOARDING_STEP1_MARKER = "Salut 👋";
export const ONBOARDING_STEP2_MARKER = "tu cherches à faire quoi principalement";

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

export function enrichCommunityMessage(message: CommunityMessage): CommunityMessage {
  const quickReplyOptions = resolveQuickReplyOptions(message);
  if (!quickReplyOptions?.length) return message;
  if (message.quickReplyOptions?.length) return message;
  return { ...message, quickReplyOptions };
}

export function buildMessageFromUnreadPreview(preview: UnreadPrivatePreview): CommunityMessage {
  const previewText = String(preview.contentPreview || "");
  const isWelcome =
    preview.isSupport &&
    (previewText.includes(ONBOARDING_STEP1_MARKER) || previewText.startsWith("Salut"));
  const content = isWelcome ? ONBOARDING_STEP1_CONTENT : previewText;

  return {
    id: preview.messageId,
    conversationId: preview.conversationId,
    userId: preview.senderUserId,
    username: preview.senderName || "Support",
    content,
    createdAt: preview.createdAt || new Date().toISOString(),
    attachment: null,
    isSupport: preview.isSupport,
    onboardingStep: isWelcome ? 1 : null,
  };
}
