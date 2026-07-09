import type { PromptTemplateDefinition } from "./promptTemplates";
import {
  getLifestyleShotStyleById,
  getProductShotStyleById,
  isLifestyleProductGuideTemplate,
  isStudioProductGuideTemplate,
  isUgcSelfieGuideTemplate,
  isUgcPresentationGuideTemplate,
  isBrandCampaignShootGuideTemplate,
  LIFESTYLE_PLACEHOLDERS,
  LIFESTYLE_TEMPLATE_BODY_CONTINUITY,
  LIFESTYLE_TEMPLATE_BODY_STANDALONE,
  PRODUCT_PHOTOGRAPHY_DEFAULT_BASE_SECTION,
  PRODUCT_PHOTOGRAPHY_DEFAULT_LIGHTING_SECTION,
  PRODUCT_PHOTOGRAPHY_DEFAULT_SCENE_INTRO,
  PRODUCT_PHOTOGRAPHY_DEFAULT_STYLE_SECTION,
  PRODUCT_PHOTOGRAPHY_DEFAULT_SUBJECT_DETAIL,
  PRODUCT_PHOTOGRAPHY_PLACEHOLDERS,
  UGC_PRESENTATION_HELD_TEMPLATE_BODY,
  UGC_PRESENTATION_PLACEHOLDERS,
  UGC_PRESENTATION_WORN_TEMPLATE_BODY,
  UGC_SELFIE_PLACEHOLDERS,
  UGC_SELFIE_TEMPLATE_BODY,
} from "./promptTemplates";
import {
  resolveLifestyleComposition,
  resolveLifestyleLensLine,
  type LifestyleFramingId,
} from "./lifestyleFramingConfig";
import {
  getUgcPresentationBodyZoneOption,
  getUgcPresentationHeroFocus,
  needsFootwearLightingHighlight,
  resolveUgcPresentationLocationBlocks,
  UGC_PRESENTATION_DEFAULT_AUTRE_TENUE,
  UGC_PRESENTATION_HELD_POSE_VALUES,
  UGC_PRESENTATION_WORN_POSE_VALUES,
  type UgcPresentationBodyZone,
  type UgcPresentationMode,
  type UgcPresentationPose,
} from "./ugcPresentationConfig";
import {
  drawUgcPresentationPhysicalCustom,
  drawUgcPresentationPhysicalDefaults,
  isUgcPresentationProfileId,
} from "./ugcPresentationPhysicalPools";
import {
  getUgcSelfieProfileById,
  UGC_SELFIE_IMPROVISED_PHYSICAL,
  type UgcSelfieGender,
  type UgcSelfiePhysicalResolveMode,
  type UgcSelfieProfileId,
} from "./ugcSelfieProfiles";
import { assembleBrandCampaignShootPromptFromSlots } from "./brandCampaignShootAssembly";

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

function extractDrinkLabelFromMessage(message: string): string {
  const raw = message.trim();
  if (!raw) return "";

  let candidate = raw;
  const avecMatch = raw.match(/\bavec\s+(.+)$/i);
  if (avecMatch?.index != null) {
    candidate = raw.slice(0, avecMatch.index).trim();
  }

  candidate = candidate
    .replace(/\b(?:canette|bouteille|brick|carton|bottle|can)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const cleaned = cleanPhrase(candidate);
  return cleaned || raw;
}

export function isPackagingSpecifiedInMessage(message: string): boolean {
  return extractPackaging(message) !== null;
}

export function isPackagingResolved(
  slots: TemplateSlotValues,
  template: PromptTemplateDefinition,
): boolean {
  const packaging = slots.packaging?.trim();
  if (!packaging) return false;
  const defaultPackaging =
    template.variables.find((variable) => variable.key === "packaging")?.defaultValue ??
    "can, bottle, carton or other";
  return packaging !== defaultPackaging;
}

export type PackagingChoice = "can" | "bottle";

export function parsePackagingChoice(text: string): PackagingChoice | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  if (
    /^(1|canette|can)\b/i.test(normalized) ||
    /\bcanette\b/i.test(normalized) ||
    normalized === "can"
  ) {
    return "can";
  }
  if (
    /^(2|bouteille|bottle)\b/i.test(normalized) ||
    /\bbouteille\b/i.test(normalized) ||
    normalized === "bottle"
  ) {
    return "bottle";
  }
  return null;
}

function findKnownBrandMetadata(
  message: string,
  options?: { skipFlavor?: boolean },
): Partial<TemplateSlotValues> {
  const raw = message.trim();
  if (!raw) return {};

  const skipFlavor = options?.skipFlavor === true;
  for (const brand of KNOWN_BEVERAGE_BRANDS) {
    if (!brand.pattern.test(raw)) continue;
    const metadata: Partial<TemplateSlotValues> = {
      brandBackdrop: brand.brandBackdrop,
      brandPalette: brand.brandPalette,
    };
    if (!skipFlavor && brand.flavorElements) {
      metadata.flavorElements = brand.flavorElements;
    }
    return metadata;
  }
  return {};
}

function extractPackaging(message: string): string | null {
  if (/\bcanette|\bcan\b/i.test(message)) {
    return "can";
  }
  if (/\bbouteille|\bbottle\b/i.test(message)) {
    return "bottle";
  }
  if (/\bbrick|carton|brique\b/i.test(message)) {
    return "carton";
  }
  return null;
}

function resolvePackagingFormat(
  slots: TemplateSlotValues,
  template: PromptTemplateDefinition,
): string {
  const packaging = fillTemplateSlotDefaults(template, slots).packaging?.trim() ?? "";
  const defaultPackaging =
    template.variables.find((variable) => variable.key === "packaging")?.defaultValue ??
    "can, bottle, carton or other";

  if (!packaging || packaging === defaultPackaging) {
    return defaultPackaging;
  }
  if (/^(can|bottle|carton)$/i.test(packaging)) {
    return packaging.toLowerCase();
  }
  if (/\bbottle\b|glass or PET/i.test(packaging)) return "bottle";
  if (/\bcarton\b/i.test(packaging)) return "carton";
  if (/\bcan\b|aluminum can/i.test(packaging)) return "can";
  return packaging;
}

function adaptFlavorElementsForShot(flavorElements: string, shotId: string | null | undefined): string {
  if (shotId === "underwater") {
    let adapted = flavorElements
      .replace(/suspended mid-air/gi, "suspended in the water at varied depths")
      .replace(/\bmid-air\b/gi, "in the water");
    if (!/\bice\b/i.test(adapted)) {
      adapted = adapted.replace(
        /around the container/i,
        "around the container, with clear ice cubes and fresh green mint leaves at varied depths",
      );
    }
    return adapted.replace(
      /scattered at various distances and angles creating depth and energy/i,
      "scattered at naturally uneven distances and angles with organic tumble and depth — not a perfectly symmetrical layout",
    );
  }
  if (shotId === "top-down") {
    return flavorElements
      .replace(/suspended mid-air/gi, "arranged on the surface around the container")
      .replace(/\bmid-air\b/gi, "on the surface");
  }
  return flavorElements;
}

function adaptBrandBackdropForShot(backdrop: string, shotId: string | null | undefined): string {
  if (shotId !== "underwater") return backdrop;
  return backdrop
    .replace(/\bstudio backdrop\b/gi, "underwater environment")
    .replace(/toward the corners/gi, "into the deep water");
}

export type AssemblePromptOptions = {
  shotType?: string;
  drinkName?: string;
  shotId?: string;
  lifestyleFramingId?: LifestyleFramingId | null;
};

function extractBeverageSlots(
  message: string,
  options?: { skipFlavor?: boolean },
): Partial<TemplateSlotValues> {
  const raw = message.trim();
  if (!raw) return {};

  const skipFlavor = options?.skipFlavor === true;
  const slots: Partial<TemplateSlotValues> = {};

  const drinkLabel = extractDrinkLabelFromMessage(raw);
  if (drinkLabel && !STYLE_ONLY_RE.test(drinkLabel)) {
    slots.drink = drinkLabel;
  }

  Object.assign(slots, findKnownBrandMetadata(raw, { skipFlavor }));

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

export function extractVerbatimSlot(message: string): string {
  return message.trim();
}

export function isLifestyleGuideReady(
  template: PromptTemplateDefinition,
  slots: TemplateSlotValues,
): boolean {
  if (!isLifestyleProductGuideTemplate(template)) return false;
  const product = (slots.product ?? "").trim();
  const environment = (slots.environment ?? "").trim();
  return product.length >= 2 && environment.length >= 2;
}

export type UgcSelfiePhysicalOverrides = {
  skinTone?: string;
  hair?: string;
  outfit?: string;
};

export type UgcSelfieAssemblyInput = {
  profileId: UgcSelfieProfileId | string;
  productName: string;
  location: string;
  physicalOverrides?: UgcSelfiePhysicalOverrides | null;
  physicalMode?: UgcSelfiePhysicalResolveMode;
};

function resolveUgcSelfiePronouns(gender: UgcSelfieGender): {
  pronounSubject: string;
  pronounPossessive: string;
} {
  if (gender === "homme") {
    return { pronounSubject: "He", pronounPossessive: "his" };
  }
  return { pronounSubject: "She", pronounPossessive: "her" };
}

/** Complète les champs manquants — depuis la photo ou par improvisation générique. */
export function resolveUgcSelfiePhysicalSlots(
  profileId: string,
  partial: UgcSelfiePhysicalOverrides = {},
  mode: UgcSelfiePhysicalResolveMode = "improvise",
): { skinTone: string; hair: string; outfit: string } | null {
  const profile = getUgcSelfieProfileById(profileId);
  if (!profile) return null;

  const fallbacks =
    mode === "photo"
      ? {
          skinTone: profile.skinTone,
          hair: profile.hair,
          outfit: profile.outfit,
        }
      : UGC_SELFIE_IMPROVISED_PHYSICAL;

  return {
    skinTone: partial.skinTone?.trim() || fallbacks.skinTone,
    hair: partial.hair?.trim() || fallbacks.hair,
    outfit: partial.outfit?.trim() || fallbacks.outfit,
  };
}

export function assembleUgcSelfiePrompt(input: UgcSelfieAssemblyInput): string {
  const profile = getUgcSelfieProfileById(input.profileId);
  if (!profile) return "";

  const productName = input.productName;
  const location = input.location;
  const resolvedPhysical =
    resolveUgcSelfiePhysicalSlots(
      input.profileId,
      input.physicalOverrides ?? {},
      input.physicalMode ?? "improvise",
    ) ?? resolveUgcSelfiePhysicalSlots(input.profileId, {}, input.physicalMode ?? "improvise");
  if (!resolvedPhysical) return "";

  const { skinTone, hair, outfit } = resolvedPhysical;
  const { pronounSubject, pronounPossessive } = resolveUgcSelfiePronouns(profile.gender);

  return UGC_SELFIE_TEMPLATE_BODY.replaceAll(UGC_SELFIE_PLACEHOLDERS.age, String(profile.age))
    .replaceAll(UGC_SELFIE_PLACEHOLDERS.sex, profile.sexEn)
    .replaceAll(UGC_SELFIE_PLACEHOLDERS.physicalDescription, profile.physicalDescription)
    .replaceAll(UGC_SELFIE_PLACEHOLDERS.skinTone, skinTone)
    .replaceAll(UGC_SELFIE_PLACEHOLDERS.hair, hair)
    .replaceAll(UGC_SELFIE_PLACEHOLDERS.pronounSubject, pronounSubject)
    .replaceAll(UGC_SELFIE_PLACEHOLDERS.productName, productName)
    .replaceAll(UGC_SELFIE_PLACEHOLDERS.pronounPossessive, pronounPossessive)
    .replaceAll(UGC_SELFIE_PLACEHOLDERS.outfit, outfit)
    .replaceAll(UGC_SELFIE_PLACEHOLDERS.location, location)
    .trim();
}

export function isUgcSelfieGuideReady(
  template: PromptTemplateDefinition,
  slots: TemplateSlotValues,
): boolean {
  if (!isUgcSelfieGuideTemplate(template)) return false;
  const profileId = (slots.profileId ?? "").trim();
  const productName = (slots.productName ?? "").trim();
  const location = (slots.location ?? "").trim();
  return Boolean(profileId) && productName.length >= 2 && location.length >= 2;
}

export function assembleUgcSelfiePromptFromSlots(slots: TemplateSlotValues): string {
  const profileId = (slots.profileId ?? "").trim();
  const productName = (slots.productName ?? "").trim();
  const location = (slots.location ?? "").trim();
  if (!profileId || !productName || !location) return "";

  const physicalMode =
    slots.physicalMode === "photo" ? "photo" : ("improvise" as UgcSelfiePhysicalResolveMode);

  const resolvedPhysical = resolveUgcSelfiePhysicalSlots(
    profileId,
    {
      skinTone: slots.skinTone,
      hair: slots.hair,
      outfit: slots.outfit,
    },
    physicalMode,
  );
  if (!resolvedPhysical) return "";

  return assembleUgcSelfiePrompt({
    profileId,
    productName,
    location,
    physicalOverrides: resolvedPhysical,
    physicalMode,
  });
}

export type UgcPresentationAssemblyInput = {
  presentationMode: UgcPresentationMode;
  bodyZone?: UgcPresentationBodyZone | string | null;
  pose?: UgcPresentationPose | string | null;
  profileId: string;
  age?: number;
  productName: string;
  autreTenue?: string;
  location?: string;
  physicalMode?: "default" | "custom";
  skinTone?: string;
  hair?: string;
  physique?: string;
  hairDescription?: string;
};

function resolveUgcPresentationPronouns(gender: UgcSelfieGender): {
  sexeDescription: string;
  pronounSubjectCap: string;
  pronounSubjectLower: string;
  pronounPossessive: string;
  pronounObject: string;
  jewelry: string;
  makeupGrooming: string;
  pronounInPose: string;
} {
  if (gender === "homme") {
    return {
      sexeDescription: "A confident man",
      pronounSubjectCap: "He",
      pronounSubjectLower: "he",
      pronounPossessive: "his",
      pronounObject: "him",
      jewelry: "a simple watch and subtle ring",
      makeupGrooming: "grooming",
      pronounInPose: "he",
    };
  }
  return {
    sexeDescription: "An elegant woman",
    pronounSubjectCap: "She",
    pronounSubjectLower: "she",
    pronounPossessive: "her",
    pronounObject: "her",
    jewelry: "gold hoop earrings and a delicate bracelet",
    makeupGrooming: "makeup",
    pronounInPose: "she",
  };
}

function resolveUgcPresentationHairDescription(
  hairDescription?: string,
  hairOverride?: string,
): string {
  if (hairDescription?.trim()) {
    return hairDescription.trim();
  }
  if (hairOverride?.trim()) {
    return `${hairOverride.trim()} hair`;
  }
  return "natural, softly styled hair";
}

function resolveUgcPresentationPhysique(physique?: string): string {
  return physique?.trim() || "natural, unremarkable build, no specific physical customization";
}

function resolveUgcPresentationWornPose(
  pose: UgcPresentationPose | string | null | undefined,
  pronounInPose: string,
): string {
  const poseKey = (pose ?? "default") as UgcPresentationPose;
  const raw =
    UGC_PRESENTATION_WORN_POSE_VALUES[poseKey] ?? UGC_PRESENTATION_WORN_POSE_VALUES.default;
  return raw.replaceAll("she/he", pronounInPose);
}

function resolveUgcPresentationHeldPose(
  pose: UgcPresentationPose | string | null | undefined,
  pronounInPose: string,
  pronounPossessive: string,
  productName: string,
): string {
  const poseKey = (pose ?? "default") as UgcPresentationPose;
  const raw =
    UGC_PRESENTATION_HELD_POSE_VALUES[poseKey] ?? UGC_PRESENTATION_HELD_POSE_VALUES.default;
  return raw
    .replaceAll("[PRODUIT]", productName)
    .replaceAll("she/he", pronounInPose)
    .replaceAll("her/his", pronounPossessive);
}

function applyUgcPresentationPlaceholders(
  templateBody: string,
  values: Record<string, string>,
): string {
  let body = templateBody;
  for (const [placeholder, value] of Object.entries(values)) {
    body = body.replaceAll(placeholder, value);
  }
  return body.trim();
}

export function assembleUgcPresentationPrompt(input: UgcPresentationAssemblyInput): string {
  const profile = getUgcSelfieProfileById(input.profileId);
  if (!profile) return "";

  const productName = input.productName.trim();
  if (!productName) return "";

  const presentationMode = input.presentationMode;
  const pronouns = resolveUgcPresentationPronouns(profile.gender);
  const physicalMode = input.physicalMode ?? "default";
  const hairDescription = resolveUgcPresentationHairDescription(
    input.hairDescription,
    input.hair,
  );
  const physique = resolveUgcPresentationPhysique(input.physique);
  const location = (input.location ?? "").trim();
  const locationBlocks = resolveUgcPresentationLocationBlocks(
    location,
    pronouns.pronounObject,
  );
  const bodyZone = input.bodyZone ?? null;
  const isFullOutfit = bodyZone === "full-outfit";

  let autreTenue = (input.autreTenue ?? "").trim();
  if (!autreTenue && !isFullOutfit) {
    autreTenue = UGC_PRESENTATION_DEFAULT_AUTRE_TENUE;
  }

  const pose =
    presentationMode === "held"
      ? resolveUgcPresentationHeldPose(
          input.pose,
          pronouns.pronounInPose,
          pronouns.pronounPossessive,
          productName,
        )
      : resolveUgcPresentationWornPose(input.pose, pronouns.pronounInPose);

  const resolvedAge =
    input.age !== undefined && Number.isFinite(input.age) ? Math.round(input.age) : profile.age;

  const commonValues: Record<string, string> = {
    [UGC_PRESENTATION_PLACEHOLDERS.sexeDescription]: pronouns.sexeDescription,
    [UGC_PRESENTATION_PLACEHOLDERS.age]: String(resolvedAge),
    [UGC_PRESENTATION_PLACEHOLDERS.hairDescription]: hairDescription,
    [UGC_PRESENTATION_PLACEHOLDERS.pose]: pose,
    [UGC_PRESENTATION_PLACEHOLDERS.pronounPossessive]: pronouns.pronounPossessive,
    [UGC_PRESENTATION_PLACEHOLDERS.physique]: physique,
    [UGC_PRESENTATION_PLACEHOLDERS.pronounSubjectLower]: pronouns.pronounSubjectLower,
    [UGC_PRESENTATION_PLACEHOLDERS.autreTenue]: autreTenue,
    [UGC_PRESENTATION_PLACEHOLDERS.jewelry]: pronouns.jewelry,
    [UGC_PRESENTATION_PLACEHOLDERS.makeupGrooming]: pronouns.makeupGrooming,
    [UGC_PRESENTATION_PLACEHOLDERS.sceneSetting]: locationBlocks.sceneSetting,
    [UGC_PRESENTATION_PLACEHOLDERS.lightingBlock]: locationBlocks.lightingBlock,
    [UGC_PRESENTATION_PLACEHOLDERS.environmentBlock]: locationBlocks.environmentBlock,
    [UGC_PRESENTATION_PLACEHOLDERS.styleMoodBlock]: locationBlocks.styleMoodBlock,
    [UGC_PRESENTATION_PLACEHOLDERS.pronounObject]: pronouns.pronounObject,
  };

  if (presentationMode === "held") {
    return applyUgcPresentationPlaceholders(UGC_PRESENTATION_HELD_TEMPLATE_BODY, commonValues);
  }

  const wornCommonValues = {
    ...commonValues,
    [UGC_PRESENTATION_PLACEHOLDERS.produit]: productName,
  };

  const zoneOption = getUgcPresentationBodyZoneOption(bodyZone);
  const cadrageZone = zoneOption?.cadrageZone ?? "";
  const heroFocus = getUgcPresentationHeroFocus(bodyZone);
  const footwearSuffix = needsFootwearLightingHighlight(bodyZone)
    ? ", with added highlight and clarity at floor level to emphasize footwear"
    : "";

  let wornBody = UGC_PRESENTATION_WORN_TEMPLATE_BODY.replace(
    "[FOOTWEAR_LIGHTING_SUFFIX]",
    footwearSuffix,
  );

  wornBody = wornBody.replaceAll("Her/His", pronouns.pronounSubjectCap);

  let result = applyUgcPresentationPlaceholders(wornBody, {
    ...wornCommonValues,
    [UGC_PRESENTATION_PLACEHOLDERS.cadrageZone]: cadrageZone,
    [UGC_PRESENTATION_PLACEHOLDERS.heroFocus]: heroFocus,
    [UGC_PRESENTATION_PLACEHOLDERS.waistSide]: "waist/side",
  });

  if (!autreTenue) {
    result = result.replace(/\.\s*\./g, ".");
  }

  return result;
}

export function isUgcPresentationGuideReady(
  template: PromptTemplateDefinition,
  slots: TemplateSlotValues,
): boolean {
  if (!isUgcPresentationGuideTemplate(template)) return false;
  const profileId = (slots.profileId ?? "").trim();
  const productName = (slots.productName ?? "").trim();
  const presentationMode = (slots.presentationMode ?? "").trim();
  const location = slots.location;
  if (!profileId || productName.length < 2 || !presentationMode) return false;
  if (presentationMode === "worn" && !(slots.bodyZone ?? "").trim()) return false;
  return location !== undefined && location !== null;
}

export function assembleUgcPresentationPromptFromSlots(slots: TemplateSlotValues): string {
  const profileId = (slots.profileId ?? "").trim();
  const productName = (slots.productName ?? "").trim();
  const presentationMode = (slots.presentationMode ?? "").trim() as UgcPresentationMode;
  if (!profileId || !productName || !presentationMode) return "";

  const physicalMode =
    slots.physicalMode === "custom" ? ("custom" as const) : ("default" as const);

  let physique = slots.physique?.trim();
  let hairDescription = slots.hairDescription?.trim();

  if ((!physique || !hairDescription) && isUgcPresentationProfileId(profileId)) {
    const drawn =
      physicalMode === "custom"
        ? drawUgcPresentationPhysicalCustom(profileId, {
            skinTone: slots.skinTone,
            hairPromptValue: slots.hair,
          })
        : drawUgcPresentationPhysicalDefaults(profileId);
    physique = physique || drawn.physique;
    hairDescription = hairDescription || drawn.hairDescription;
  }

  const ageRaw = (slots.age ?? "").trim();
  const parsedAge = ageRaw ? Number(ageRaw) : NaN;
  const age = Number.isFinite(parsedAge) ? parsedAge : undefined;

  return assembleUgcPresentationPrompt({
    presentationMode,
    bodyZone: slots.bodyZone ?? null,
    pose: (slots.pose ?? "default") as UgcPresentationPose,
    profileId,
    age,
    productName,
    autreTenue: slots.autreTenue,
    location: slots.location ?? "",
    physicalMode,
    skinTone: slots.skinTone,
    hair: slots.hair,
    physique,
    hairDescription,
  });
}

export function assembleLifestylePrompt(
  shotId: string | null | undefined,
  slots: TemplateSlotValues,
  options?: Pick<AssemblePromptOptions, "lifestyleFramingId">,
): string {
  const shot = getLifestyleShotStyleById(shotId);
  if (!shot) return "";

  const framingId = options?.lifestyleFramingId ?? null;
  const lensLine = resolveLifestyleLensLine(shotId, framingId);
  const composition = resolveLifestyleComposition(shotId, framingId, shot.templateVariant);

  const templateBody =
    shot.templateVariant === "body-continuity"
      ? LIFESTYLE_TEMPLATE_BODY_CONTINUITY
      : LIFESTYLE_TEMPLATE_BODY_STANDALONE;

  const productName = (slots.product ?? "").trim();
  const environment = (slots.environment ?? "").trim();

  return templateBody
    .replaceAll(LIFESTYLE_PLACEHOLDERS.lensLine, lensLine)
    .replaceAll(LIFESTYLE_PLACEHOLDERS.composition, composition)
    .replaceAll(LIFESTYLE_PLACEHOLDERS.productName, productName)
    .replaceAll(LIFESTYLE_PLACEHOLDERS.shotType, shot.promptValue)
    .replaceAll(LIFESTYLE_PLACEHOLDERS.environment, environment)
    .trim();
}

export function assemblePromptFromTemplate(
  template: PromptTemplateDefinition,
  slots: TemplateSlotValues,
  options?: AssemblePromptOptions,
): string {
  if (isUgcSelfieGuideTemplate(template)) {
    return assembleUgcSelfiePromptFromSlots(slots);
  }

  if (isUgcPresentationGuideTemplate(template)) {
    return assembleUgcPresentationPromptFromSlots(slots);
  }

  if (isBrandCampaignShootGuideTemplate(template)) {
    return assembleBrandCampaignShootPromptFromSlots(slots);
  }

  if (isLifestyleProductGuideTemplate(template)) {
    return assembleLifestylePrompt(options?.shotId, slots, {
      lifestyleFramingId: options?.lifestyleFramingId,
    });
  }

  if (isStudioProductGuideTemplate(template)) {
    const filled = fillTemplateSlotDefaults(template, slots);
    const shot = getProductShotStyleById(options?.shotId);
    const subjectDetail = shot?.subjectDetail ?? PRODUCT_PHOTOGRAPHY_DEFAULT_SUBJECT_DETAIL;
    const baseSection = shot?.baseSection ?? PRODUCT_PHOTOGRAPHY_DEFAULT_BASE_SECTION;
    const sceneIntro = shot?.sceneIntro ?? PRODUCT_PHOTOGRAPHY_DEFAULT_SCENE_INTRO;
    const lightingSection = shot?.lightingSection ?? PRODUCT_PHOTOGRAPHY_DEFAULT_LIGHTING_SECTION;
    const styleSection = shot?.styleSection ?? PRODUCT_PHOTOGRAPHY_DEFAULT_STYLE_SECTION;
    const flavorElements = adaptFlavorElementsForShot(
      filled.flavorElements ?? "",
      options?.shotId,
    );
    const brandBackdrop = adaptBrandBackdropForShot(
      filled.brandBackdrop ?? "",
      options?.shotId,
    );

    let body = template.body;
    const drinkName = (options?.drinkName ?? slots.drink ?? "").trim();
    if (drinkName) {
      body = body.replaceAll(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.drinkName, drinkName);
    }
    body = body.replaceAll(
      PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.formatPackaging,
      resolvePackagingFormat(slots, template),
    );
    body = body.replaceAll(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.subjectDetail, subjectDetail);
    body = body.replaceAll(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.flavorElements, flavorElements);
    body = body.replaceAll(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.baseSection, baseSection);
    body = body.replaceAll(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.brandBackdrop, brandBackdrop);
    body = body.replaceAll(
      PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.brandPalette,
      filled.brandPalette ?? "",
    );
    body = body.replaceAll(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.sceneIntro, sceneIntro);
    body = body.replaceAll(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.lightingSection, lightingSection);
    body = body.replaceAll(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.styleSection, styleSection);
    if (options?.shotType?.trim()) {
      body = body.replaceAll(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.shotType, options.shotType.trim());
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
    body = body.replaceAll(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.shotType, options.shotType.trim());
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
