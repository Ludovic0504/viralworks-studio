import type { PromptTemplateDefinition } from "./promptTemplates";

export type TemplateSlotValues = Record<string, string>;

const STYLE_ONLY_RE =
  /^(luxe|luxury|minimal|minimaliste|naturel|nature|studio|beau|belle|joli|jolie|premium|élégant|elegant|commercial|pro|professionnel)$/i;

type KeywordRule = {
  pattern: RegExp;
  value: string;
};

const KNOWN_BEVERAGE_BRANDS: {
  pattern: RegExp;
  drink: string;
  brandBackdrop: string;
  brandPalette: string;
  flavorElements?: string;
}[] = [
  {
    pattern: /\bmonster(?:\s+energy)?\b/i,
    drink: "Monster Energy drink",
    brandBackdrop:
      "Deep black studio backdrop with a bright green radial glow centered behind the can — premium, dramatic, consistent with Monster Energy visual identity",
    brandPalette:
      "Neon green claw-mark accents, matte black can body, bright lime-green ingredient highlights, crystal-clear condensation on cold aluminum",
    flavorElements:
      "Fresh limes — whole and sliced, cut surfaces facing camera revealing their interior, all suspended mid-air in a dynamic circular orbital arrangement around the container — some tumbling, some whole, scattered at various distances and angles creating depth and energy",
  },
  {
    pattern: /\bcoca[- ]?cola\b/i,
    drink: "Coca-Cola",
    brandBackdrop:
      "Deep red studio backdrop with a subtle darker radial gradient vignette toward the corners — premium, dramatic, consistent with Coca-Cola visual identity",
    brandPalette:
      "Signature Coca-Cola red, white Spencerian script label colors, crystal-clear glass or aluminum material, ingredient colors coherent with cola flavor profile",
    flavorElements:
      "Fresh orange slices and ice cubes — whole and sliced, cut surfaces facing camera revealing their interior, all suspended mid-air in a dynamic circular orbital arrangement around the container",
  },
  {
    pattern: /\bpepsi\b/i,
    drink: "Pepsi",
    brandBackdrop:
      "Deep blue studio backdrop with a subtle darker radial gradient vignette toward the corners — premium, dramatic, consistent with Pepsi visual identity",
    brandPalette:
      "Pepsi blue, red and white label accents, crystal-clear container material, ingredient colors coherent with cola flavor profile",
  },
  {
    pattern: /\bred\s*bull\b/i,
    drink: "Red Bull energy drink",
    brandBackdrop:
      "Deep navy and silver studio backdrop with a subtle darker radial gradient vignette — premium, dramatic, consistent with Red Bull visual identity",
    brandPalette:
      "Red Bull blue and silver can, bold red bull logo accents, crystal-clear condensation on cold aluminum",
  },
];

function matchKeywordRules(text: string, rules: KeywordRule[]): string | null {
  for (const rule of rules) {
    if (rule.pattern.test(text)) return rule.value;
  }
  return null;
}

function splitClauses(text: string): string[] {
  return text
    .split(/[,;]|\bet\b|\bavec\b/gi)
    .map((part) => part.trim())
    .filter(Boolean);
}

function cleanPhrase(text: string): string {
  return text
    .replace(/^(un|une|le|la|les|mon|ma|mes)\s+/i, "")
    .replace(/\b(?:à mettre en avant|a mettre en avant)\b/gi, "")
    .trim();
}

function normalizeFlavorPhrase(phrase: string): string {
  return cleanPhrase(phrase)
    .replace(/^(des|du|de la|de l'|d')\s+/i, "")
    .replace(/\bcitrons?\s+verts?\b/gi, "green limes")
    .replace(/\bcitrons?\s+jaunes?\b/gi, "yellow lemons")
    .replace(/\bcitrons?\b/gi, "limes")
    .replace(/\boranges?\b/gi, "oranges")
    .replace(/\bfraises?\b/gi, "strawberries")
    .replace(/\bmangues?\b/gi, "mangoes")
    .trim();
}

function buildFlavorElementsFromPhrase(phrase: string): string {
  const cleaned = normalizeFlavorPhrase(phrase);
  if (!cleaned) return "";
  return `Fresh ${cleaned} — whole and sliced, cut surfaces facing camera revealing their interior, all suspended mid-air in a dynamic circular orbital arrangement around the container — some tumbling, some whole, scattered at various distances and angles creating depth and energy.`;
}

export function buildCustomFlavorElements(description: string): string {
  const cleaned = description.trim();
  if (!cleaned) return "";
  if (cleaned.length > 60 || /[.;]/.test(cleaned)) {
    return cleaned;
  }
  return buildFlavorElementsFromPhrase(cleaned);
}

export type ElementsMode = "reference" | "custom";

export function parseElementsModeChoice(text: string): ElementsMode | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  if (
    /^(2|choisir|personnalis|moi.?même|moi meme|décrire|decrire|custom|manuel)/i.test(
      normalized,
    ) ||
    /choisir\s+moi/i.test(normalized)
  ) {
    return "custom";
  }
  if (
    /^(1|référence|reference|marque|défaut|defaut|typique)/i.test(normalized) ||
    /éléments?\s+de\s+référence|elements?\s+de\s+reference/i.test(normalized)
  ) {
    return "reference";
  }
  return null;
}

function findBrandFlavorElements(drink: string): string | null {
  const value = drink.trim();
  if (!value) return null;
  for (const brand of KNOWN_BEVERAGE_BRANDS) {
    if (brand.pattern.test(value) && brand.flavorElements) {
      return brand.flavorElements;
    }
  }
  return null;
}

export function resolveReferenceFlavorElements(
  slots: TemplateSlotValues,
  template: PromptTemplateDefinition,
): string {
  const fromBrand = findBrandFlavorElements(slots.drink ?? "");
  if (fromBrand) return fromBrand;

  const flavorVariable = template.variables.find((variable) => variable.key === "flavorElements");
  return flavorVariable?.defaultValue ?? "";
}

function extractPackaging(message: string): string | null {
  if (/\bcanette|\bcan\b/i.test(message)) {
    return "in its iconic aluminum can format";
  }
  if (/\bbouteille|\bbottle\b/i.test(message)) {
    return "in its iconic glass or PET bottle format";
  }
  if (/\bbrick|carton|brique\b/i.test(message)) {
    return "in its original carton packaging format";
  }
  return null;
}

function extractBeverageSlots(
  message: string,
  options?: { skipFlavor?: boolean },
): Partial<TemplateSlotValues> {
  const raw = message.trim();
  if (!raw) return {};

  const skipFlavor = options?.skipFlavor === true;
  const slots: Partial<TemplateSlotValues> = {};

  for (const brand of KNOWN_BEVERAGE_BRANDS) {
    if (brand.pattern.test(raw)) {
      slots.drink = brand.drink;
      slots.brandBackdrop = brand.brandBackdrop;
      slots.brandPalette = brand.brandPalette;
      if (!skipFlavor && brand.flavorElements) slots.flavorElements = brand.flavorElements;
      break;
    }
  }

  if (!skipFlavor) {
    const avecMatch = raw.match(/\bavec\s+(.+)$/i);
    if (avecMatch?.[1]) {
      const flavorPhrase = avecMatch[1].trim();
      const built = buildFlavorElementsFromPhrase(flavorPhrase);
      if (built) slots.flavorElements = built;
    }

    const saveurMatch = raw.match(/\b(?:saveur|goût|gout)\s+(.+?)(?:\s*,|\s*\.|$)/i);
    if (saveurMatch?.[1] && !slots.flavorElements) {
      const built = buildFlavorElementsFromPhrase(saveurMatch[1]);
      if (built) slots.flavorElements = built;
    }
  }

  const packaging = extractPackaging(raw);
  if (packaging) slots.packaging = packaging;

  if (!slots.drink) {
    let drinkCandidate = raw;
    const avecMatch = skipFlavor ? null : raw.match(/\bavec\s+(.+)$/i);
    if (avecMatch) {
      drinkCandidate = raw.slice(0, avecMatch.index).trim();
    }
    drinkCandidate = drinkCandidate
      .replace(/\b(?:canette|bouteille|brick|carton)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const clauses = splitClauses(drinkCandidate);
    const drinkClause =
      clauses.find((clause) => {
        const cleaned = cleanPhrase(clause);
        if (!cleaned || cleaned.length < 2) return false;
        if (STYLE_ONLY_RE.test(cleaned)) return false;
        if (/^(citron|citrons|orange|oranges|lime|limes|fraise|mangue)\b/i.test(cleaned)) return false;
        return true;
      }) ?? clauses[0];

    if (drinkClause) {
      const drink = cleanPhrase(drinkClause);
      if (drink && !STYLE_ONLY_RE.test(drink)) {
        slots.drink = /drink|boisson|energy|cola|jus|soda|beer|bière/i.test(drink)
          ? drink
          : `${drink} drink`;
      }
    }
  }

  return slots;
}

function filterSlotsForTemplate(
  slots: Partial<TemplateSlotValues>,
  template: PromptTemplateDefinition,
): Partial<TemplateSlotValues> {
  const variableKeys = new Set(template.variables.map((variable) => variable.key));
  const filtered: Partial<TemplateSlotValues> = {};
  for (const [key, value] of Object.entries(slots)) {
    if (variableKeys.has(key) && typeof value === "string" && value.trim()) {
      filtered[key] = value.trim();
    }
  }
  return filtered;
}

export function hasExplicitFlavorInMessage(message: string): boolean {
  const raw = message.trim();
  if (!raw) return false;
  if (/\bavec\s+\S/i.test(raw)) return true;
  if (/\b(?:saveur|goût|gout)\s+\S/i.test(raw)) return true;
  if (/\b(?:autour|ingrédients?|ingredients?|composé|compose)\b/i.test(raw)) return true;
  return false;
}

export function extractBeverageSlotsFromFirstMessage(
  message: string,
  template: PromptTemplateDefinition,
): Partial<TemplateSlotValues> {
  const drinkSlots = extractDrinkSlotsFromMessage(message, template);
  if (!hasExplicitFlavorInMessage(message)) {
    return drinkSlots;
  }

  const fullSlots = extractSlotsFromMessage(message, template);
  if (fullSlots.flavorElements) {
    return mergeTemplateSlots(drinkSlots, { flavorElements: fullSlots.flavorElements });
  }

  return drinkSlots;
}

export function extractDrinkSlotsFromMessage(
  message: string,
  template: PromptTemplateDefinition,
): Partial<TemplateSlotValues> {
  const raw = message.trim();
  if (!raw) return {};

  if (template.extractorId === "beverage-hero") {
    return filterSlotsForTemplate(extractBeverageSlots(raw, { skipFlavor: true }), template);
  }

  return filterSlotsForTemplate(extractBeverageSlots(raw), template);
}

export function extractSlotsFromMessage(
  message: string,
  template: PromptTemplateDefinition,
): Partial<TemplateSlotValues> {
  const raw = message.trim();
  if (!raw) return {};

  if (template.extractorId === "beverage-hero") {
    return filterSlotsForTemplate(extractBeverageSlots(raw), template);
  }

  return filterSlotsForTemplate({ drink: cleanPhrase(raw) }, template);
}

export function getRequiredTemplateVariable(
  template: PromptTemplateDefinition,
): PromptTemplateDefinition["variables"][number] | undefined {
  return template.variables.find((variable) => variable.required);
}

export function isWeakFlavorElements(value: string | undefined): boolean {
  const trimmed = (value ?? "").trim();
  return trimmed.length < 3;
}

export function isWeakRequiredSlot(
  template: PromptTemplateDefinition,
  slots: TemplateSlotValues,
): boolean {
  const required = getRequiredTemplateVariable(template);
  if (!required) return false;

  const value = (slots[required.key] ?? "").trim();
  if (value.length < 2) return true;
  if (STYLE_ONLY_RE.test(value)) return true;
  if (/^(citron|citrons|orange|oranges|lime|limes)\b/i.test(value)) return true;
  return false;
}

export function isBeverageGuideReady(
  template: PromptTemplateDefinition,
  slots: TemplateSlotValues,
): boolean {
  if (isWeakRequiredSlot(template, slots)) return false;
  if (template.extractorId === "beverage-hero" && isWeakFlavorElements(slots.flavorElements)) {
    return false;
  }
  return true;
}

/** @deprecated Utiliser isWeakRequiredSlot */
export function isWeakProductSlot(product: string | undefined): boolean {
  const value = (product ?? "").trim();
  if (value.length < 2) return true;
  if (STYLE_ONLY_RE.test(value)) return true;
  return false;
}

export function mergeTemplateSlots(
  current: TemplateSlotValues,
  patch: Partial<TemplateSlotValues>,
): TemplateSlotValues {
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === "string" && value.trim()) {
      next[key] = value.trim();
    }
  }
  return next;
}

export function fillTemplateSlotDefaults(
  template: PromptTemplateDefinition,
  slots: TemplateSlotValues,
): TemplateSlotValues {
  const filled: TemplateSlotValues = {};
  for (const variable of template.variables) {
    const value = slots[variable.key]?.trim();
    filled[variable.key] = value || variable.defaultValue;
  }
  return filled;
}

export function assemblePromptFromTemplate(
  template: PromptTemplateDefinition,
  slots: TemplateSlotValues,
  options?: { shotType?: string; drinkName?: string },
): string {
  if (template.id === "product-photography") {
    let body = template.body;
    const drinkName = (options?.drinkName ?? slots.drink ?? "").trim();
    if (drinkName) {
      body = body.replaceAll("[NOM DE LA BOISSON]", drinkName);
    }
    if (options?.shotType?.trim()) {
      body = body.replaceAll("[TYPE DE SHOT]", options.shotType.trim());
    }
    const tail = template.fixedTail?.trim();
    if (!tail) return body.trim();
    return `${body.trim()}\n\n${tail}`;
  }

  const filled = fillTemplateSlotDefaults(template, slots);
  let body = template.body;
  for (const variable of template.variables) {
    body = body.replaceAll(`{{${variable.key}}}`, filled[variable.key] ?? "");
  }
  if (options?.shotType?.trim()) {
    body = body.replaceAll("[TYPE DE SHOT]", options.shotType.trim());
  }
  const tail = template.fixedTail?.trim();
  if (!tail) return body.trim();
  return `${body.trim()}\n\n${tail}`;
}

export function summarizeFilledSlots(
  template: PromptTemplateDefinition,
  slots: TemplateSlotValues,
): string {
  const filled = fillTemplateSlotDefaults(template, slots);
  const parts = template.variables
    .filter((variable) => filled[variable.key])
    .map((variable) => `${variable.label} : ${filled[variable.key]}`);
  return parts.join(" · ");
}
