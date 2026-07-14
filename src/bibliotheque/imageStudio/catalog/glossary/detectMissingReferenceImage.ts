export type PromptAssistMessageLike = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
};

const REFERENCE_IMAGE_PATTERNS: RegExp[] = [
  /\bce\s+produit\b/i,
  /\bcet\s+(?:objet|article|produit|bijou|accessoire|vetement|v[eê]tement)\b/i,
  /\bcette\s+(?:photo|image|veste|robe|pi[eè]ce|bouteille|canette|bijou|cr[eé]ation)\b/i,
  /\b(?:l['’]image|la\s+photo)\s+(?:jointe|upload[eé]e|envoy[eé]e|fournie|ci[- ]jointe)\b/i,
  /\b(?:sur|dans|depuis|d['’]apr[eè]s)\s+(?:la\s+)?(?:photo|image)\b/i,
  /\b(?:à partir de|en partant de)\s+(?:la\s+)?(?:photo|image)\b/i,
  /\b(?:analyse|analyser|reproduire|recréer|recreer)\s+(?:la\s+)?(?:photo|image)\b/i,
  /\bthis\s+product\b/i,
  /\bthe\s+(?:attached|uploaded)\s+image\b/i,
  /\bfrom\s+the\s+(?:photo|image)\b/i,
];

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Le texte utilisateur suppose une image ou un produit visible en référence. */
export function messageImpliesReferenceImage(text: string): boolean {
  const normalized = normalizeForMatch(text);
  if (!normalized) return false;
  return REFERENCE_IMAGE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function conversationHasReferenceImage(
  messages: PromptAssistMessageLike[],
): boolean {
  return messages.some((message) => message.role === "user" && Boolean(message.imageUrl));
}

export function shouldAskForMissingReferenceImage(
  text: string,
  messages: PromptAssistMessageLike[],
  options?: { currentMessageHasImage?: boolean },
): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (options?.currentMessageHasImage) return false;
  if (conversationHasReferenceImage(messages)) return false;
  return messageImpliesReferenceImage(trimmed);
}

export const PROMPT_ASSIST_MISSING_IMAGE_REPLY =
  "Ta demande fait référence à un produit ou une image, mais aucune photo n'a été jointe. Utilise le bouton image à gauche du champ de saisie pour l'ajouter, puis renvoie ta demande.";
