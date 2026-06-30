export const IMAGE_STUDIO_PROMPT_MAX_LENGTH = 10000;

export type PromptMentionKind = "Avatar" | "Produit" | "Image1";

export type PromptMentionAssets = {
  avatarUrl?: string | null;
  productUrl?: string | null;
  image1Url?: string | null;
};

export type PromptMentionOption = {
  kind: PromptMentionKind;
  token: string;
  label: string;
  description: string;
};

export const PROMPT_MENTION_OPTIONS: PromptMentionOption[] = [
  {
    kind: "Avatar",
    token: "@Avatar",
    label: "Avatar",
    description: "Avatar sélectionné (Mes avatars)",
  },
  {
    kind: "Produit",
    token: "@Produit",
    label: "Produit",
    description: "Image produit du contexte",
  },
  {
    kind: "Image1",
    token: "@Image1",
    label: "Image 1",
    description: "Image de référence importée",
  },
];

const MENTION_KINDS: PromptMentionKind[] = ["Avatar", "Produit", "Image1"];

const MENTION_REGEX = /@(Avatar|Produit|Image1)\b/g;

export type PromptMentionHighlightPart =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; kind: PromptMentionKind; resolved: boolean };

export function splitPromptForMentionHighlight(
  prompt: string,
  assets: PromptMentionAssets,
): PromptMentionHighlightPart[] {
  const availability = getMentionAssetAvailability(assets);
  const parts: PromptMentionHighlightPart[] = [];
  let lastIndex = 0;
  const re = new RegExp(MENTION_REGEX.source, "g");
  let match: RegExpExecArray | null;

  while ((match = re.exec(prompt)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: prompt.slice(lastIndex, match.index) });
    }
    const kind = match[1] as PromptMentionKind;
    parts.push({
      type: "mention",
      value: match[0],
      kind,
      resolved: availability[kind],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < prompt.length) {
    parts.push({ type: "text", value: prompt.slice(lastIndex) });
  }

  return parts;
}

const ATTACHED_IMAGE_ROLE: Record<PromptMentionKind, string> = {
  Avatar: "identité du personnage (visage) à placer dans la scène, pas la pose ni le fond de la photo",
  Image1: "décor / lieu / arrière-plan de référence",
  Produit: "produit à montrer ou utiliser fidèlement (forme, couleurs, design)",
};

const TEXT_ONLY_MENTION: Record<PromptMentionKind, string> = {
  Avatar: "@Avatar sans image → personnage d'après le texte",
  Image1: "@Image1 sans image → décor d'après le texte",
  Produit: "@Produit sans image → produit d'après le texte",
};

export function parseMentionKindsInOrder(prompt: string): PromptMentionKind[] {
  const ordered: PromptMentionKind[] = [];
  const seen = new Set<PromptMentionKind>();
  const re = new RegExp(MENTION_REGEX.source, "g");
  let match: RegExpExecArray | null;

  while ((match = re.exec(prompt)) !== null) {
    const kind = match[1] as PromptMentionKind;
    if (!seen.has(kind)) {
      seen.add(kind);
      ordered.push(kind);
    }
  }

  return ordered;
}

export function countMentionOccurrences(prompt: string, kind: PromptMentionKind): number {
  const re = new RegExp(`@${kind}\\b`, "g");
  return (prompt.match(re) ?? []).length;
}

export function promptHasMentions(prompt: string): boolean {
  return parseMentionKindsInOrder(prompt).length > 0;
}

function getAssetUrl(kind: PromptMentionKind, assets: PromptMentionAssets): string | null {
  const raw =
    kind === "Avatar"
      ? assets.avatarUrl
      : kind === "Produit"
        ? assets.productUrl
        : assets.image1Url;
  const url = typeof raw === "string" ? raw.trim() : "";
  return url || null;
}

const COMPOSITION_BLOCK_MARKER = "\n\n[Refs]";

export function stripImageStudioCompositionBlock(text: string): string {
  const trimmed = String(text || "").trim();
  const idx = trimmed.indexOf(COMPOSITION_BLOCK_MARKER);
  if (idx >= 0) return trimmed.slice(0, idx).trim();
  return trimmed;
}

export function getImageStudioUserPrompt(input: string | null | undefined): string {
  return stripImageStudioCompositionBlock(String(input || ""));
}

function wantsPersonReplacement(userPrompt: string): boolean {
  return /à la place|a la place|remplac|remplace|substitu|instead of|in place of|en lieu et place/i.test(
    userPrompt,
  );
}

function buildReferenceOrder(
  mentionKinds: PromptMentionKind[],
  assets: PromptMentionAssets,
): PromptMentionKind[] {
  const attached = mentionKinds.filter((kind) => Boolean(getAssetUrl(kind, assets)));
  if (!attached.includes("Avatar") || !attached.includes("Image1")) {
    return attached;
  }
  const ordered: PromptMentionKind[] = ["Image1", "Avatar"];
  for (const kind of attached) {
    if (!ordered.includes(kind)) ordered.push(kind);
  }
  return ordered;
}

function buildCompositionInstructions(
  userPrompt: string,
  mentionKinds: PromptMentionKind[],
  imageIndexByKind: Map<PromptMentionKind, number>,
): string {
  const lines: string[] = ["[Refs]", "Mapping:"];

  for (const kind of mentionKinds) {
    const token = `@${kind}`;
    const imageIndex = imageIndexByKind.get(kind);
    if (imageIndex != null) {
      lines.push(`${token}=image${imageIndex} (${ATTACHED_IMAGE_ROLE[kind]})`);
    } else {
      lines.push(`${token}=${TEXT_ONLY_MENTION[kind]}`);
    }
  }

  const avatarIndex = imageIndexByKind.get("Avatar");
  const sceneIndex = imageIndexByKind.get("Image1");

  if (avatarIndex != null && sceneIndex != null) {
    lines.push(
      `Scène: image${sceneIndex} sert de base (décor, cadrage, éclairage). Remplacer toute personne visible dans image${sceneIndex} par le personnage de image${avatarIndex}. Ne pas conserver le visage ni le corps de la personne d'origine dans image${sceneIndex}.`,
    );
    if (wantsPersonReplacement(userPrompt)) {
      lines.push(
        "Le prompt demande un remplacement explicite : le sujet final doit être image" +
          `${avatarIndex} (identité), pas la personne présente dans image${sceneIndex}.`,
      );
    }
  } else {
    lines.push(
      "Composer: @Avatar dans le lieu (@Image1 ou texte), @Produit visible/utilisé. Les @ répétés précisent interactions.",
    );
  }

  if (mentionKinds.some((kind) => countMentionOccurrences(userPrompt, kind) > 1)) {
    lines.push("Les mentions répétées renvoient à la même référence.");
  }

  return lines.join(" ");
}

export type ResolvedPromptMentions = {
  /** Prompt affiché à l'utilisateur (sans bloc technique). */
  userPrompt: string;
  /** Prompt envoyé au modèle (user + instructions). */
  generationPrompt: string;
  /** @deprecated Alias de generationPrompt — compatibilité interne. */
  prompt: string;
  referenceImages: string[];
  mentionKinds: PromptMentionKind[];
};

export function resolvePromptMentions(
  prompt: string,
  assets: PromptMentionAssets,
): ResolvedPromptMentions {
  const trimmed = prompt.trim();
  const mentionKinds = parseMentionKindsInOrder(trimmed);

  if (mentionKinds.length === 0) {
    const image1Url = getAssetUrl("Image1", assets);
    return {
      userPrompt: trimmed,
      generationPrompt: trimmed,
      prompt: trimmed,
      referenceImages: image1Url ? [image1Url] : [],
      mentionKinds: [],
    };
  }

  const referenceOrder = buildReferenceOrder(mentionKinds, assets);
  const referenceImages: string[] = [];
  const imageIndexByKind = new Map<PromptMentionKind, number>();

  for (const kind of referenceOrder) {
    const url = getAssetUrl(kind, assets);
    if (!url) continue;
    referenceImages.push(url);
    imageIndexByKind.set(kind, referenceImages.length);
  }

  const compositionBlock = buildCompositionInstructions(trimmed, mentionKinds, imageIndexByKind);
  const generationPrompt = `${trimmed}\n\n${compositionBlock}`;

  return {
    userPrompt: trimmed,
    generationPrompt,
    prompt: generationPrompt,
    referenceImages,
    mentionKinds,
  };
}

export function filterMentionOptions(query: string): PromptMentionOption[] {
  const q = query.toLowerCase();
  return PROMPT_MENTION_OPTIONS.filter((option) => {
    if (!q) return true;
    return (
      option.kind.toLowerCase().startsWith(q) ||
      option.token.slice(1).toLowerCase().startsWith(q)
    );
  });
}

export function getMentionAssetAvailability(assets: PromptMentionAssets): Record<PromptMentionKind, boolean> {
  return {
    Avatar: Boolean(typeof assets.avatarUrl === "string" && assets.avatarUrl.trim()),
    Produit: Boolean(typeof assets.productUrl === "string" && assets.productUrl.trim()),
    Image1: Boolean(typeof assets.image1Url === "string" && assets.image1Url.trim()),
  };
}

export function isPromptMentionKind(value: string): value is PromptMentionKind {
  return MENTION_KINDS.includes(value as PromptMentionKind);
}
