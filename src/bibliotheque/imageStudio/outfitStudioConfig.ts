import { imageStudioTemplateAsset } from "./imageStudioAssets";
import {
  IMAGE_STUDIO_IMAGE1_MENTION_TOKEN,
  IMAGE_STUDIO_PRODUCT_MENTION_TOKEN,
} from "./imageStudioGuideApply";

export type OutfitStudioGenderId = "homme" | "femme";

export type OutfitStudioSceneTypeId =
  | "studio-blanc"
  | "lifestyle-exterieur"
  | "interieur-commercial"
  | "mirror-selfie";

export type OutfitStudioStudioSubId = "blanc-pur" | "gris-clair" | "degrade-doux";

export type OutfitStudioLifestyleSubId =
  | "golf"
  | "rue-urbaine"
  | "vitrine-boutique"
  | "parc-jardin"
  | "plage"
  | "terrasse"
  | "rooftop"
  | "campus";

export type OutfitStudioInteriorSubId =
  | "coffee-shop"
  | "showroom-auto"
  | "hall-hotel"
  | "concept-store"
  | "restaurant-bar"
  | "salle-sport"
  | "spa"
  | "bibliotheque";

export type OutfitStudioMirrorSubId =
  | "chambre"
  | "dressing"
  | "salon"
  | "couloir"
  | "chambre-hotel"
  | "vestiaire-sport";

export type OutfitStudioSubContextId =
  | OutfitStudioStudioSubId
  | OutfitStudioLifestyleSubId
  | OutfitStudioInteriorSubId
  | OutfitStudioMirrorSubId;

export type OutfitStudioFramingId = "plein-pied" | "mi-cuisse" | "buste";

export type OutfitStudioRatioId = "4-5" | "1-1" | "9-16";

export type OutfitStudioPoseId =
  | "debout-statique"
  | "marche-figee"
  | "dynamique-legere"
  | "assise"
  | "appuye"
  | "assis";

export type OutfitPieceTypeId = "haut" | "bas" | "robe" | "ensemble" | "accessoire" | "inconnu";

export type OutfitStudioButtonOption<T extends string = string> = {
  id: T;
  label: string;
  image?: string;
};

export const OUTFIT_STUDIO_HERO_IMAGE = imageStudioTemplateAsset(
  "outfit-studio",
  "outfit-studio.png",
);

export const OUTFIT_STUDIO_GENDER_OPTIONS: OutfitStudioButtonOption<OutfitStudioGenderId>[] = [
  { id: "homme", label: "Homme" },
  { id: "femme", label: "Femme" },
];

export const OUTFIT_STUDIO_SCENE_TYPE_OPTIONS: OutfitStudioButtonOption<OutfitStudioSceneTypeId>[] =
  [
    {
      id: "studio-blanc",
      label: "Studio blanc",
      image: imageStudioTemplateAsset("outfit-studio", "scene-studio-blanc.png"),
    },
    {
      id: "lifestyle-exterieur",
      label: "Lifestyle extérieur",
      image: imageStudioTemplateAsset("outfit-studio", "scene-lifestyle-exterieur.png"),
    },
    {
      id: "interieur-commercial",
      label: "Intérieur commercial",
      image: imageStudioTemplateAsset("outfit-studio", "scene-interieur-commercial.png"),
    },
    {
      id: "mirror-selfie",
      label: "Mirror selfie",
      image: imageStudioTemplateAsset("outfit-studio", "scene-mirror-selfie.png"),
    },
  ];

export const OUTFIT_STUDIO_LIFESTYLE_SUB_OPTIONS: OutfitStudioButtonOption<OutfitStudioLifestyleSubId>[] =
  [
    { id: "golf", label: "Golf" },
    { id: "rue-urbaine", label: "Rue urbaine" },
    { id: "vitrine-boutique", label: "Devant vitrine boutique" },
    { id: "parc-jardin", label: "Parc-jardin" },
    { id: "plage", label: "Plage" },
    { id: "terrasse", label: "Terrasse extérieure" },
    { id: "rooftop", label: "Rooftop" },
    { id: "campus", label: "Campus" },
  ];

export const OUTFIT_STUDIO_INTERIOR_SUB_OPTIONS: OutfitStudioButtonOption<OutfitStudioInteriorSubId>[] =
  [
    { id: "coffee-shop", label: "Coffee shop" },
    { id: "showroom-auto", label: "Showroom auto" },
    { id: "hall-hotel", label: "Hall d'hôtel" },
    { id: "concept-store", label: "Boutique concept store" },
    { id: "restaurant-bar", label: "Restaurant-bar" },
    { id: "salle-sport", label: "Salle de sport" },
    { id: "spa", label: "Spa" },
    { id: "bibliotheque", label: "Bibliothèque" },
  ];

export const OUTFIT_STUDIO_MIRROR_SUB_OPTIONS: OutfitStudioButtonOption<OutfitStudioMirrorSubId>[] =
  [
    { id: "chambre", label: "Chambre" },
    { id: "dressing", label: "Dressing" },
    { id: "salon", label: "Salon" },
    { id: "couloir", label: "Couloir-entrée" },
    { id: "chambre-hotel", label: "Chambre d'hôtel" },
    { id: "vestiaire-sport", label: "Salle de sport-vestiaire" },
  ];

export const OUTFIT_STUDIO_FRAMING_OPTIONS: OutfitStudioButtonOption<OutfitStudioFramingId>[] = [
  { id: "plein-pied", label: "Plein pied" },
  { id: "mi-cuisse", label: "Mi-cuisse" },
  { id: "buste", label: "Buste" },
];

export const OUTFIT_STUDIO_RATIO_OPTIONS: OutfitStudioButtonOption<OutfitStudioRatioId>[] = [
  { id: "4-5", label: "4:5" },
  { id: "1-1", label: "1:1" },
  { id: "9-16", label: "9:16" },
  ];

export const OUTFIT_STUDIO_POSE_OPTIONS_FEMME: OutfitStudioButtonOption<OutfitStudioPoseId>[] = [
  { id: "debout-statique", label: "Debout statique" },
  { id: "marche-figee", label: "Marche figée" },
  { id: "dynamique-legere", label: "Dynamique légère" },
  { id: "assise", label: "Assise" },
];

export const OUTFIT_STUDIO_POSE_OPTIONS_HOMME: OutfitStudioButtonOption<OutfitStudioPoseId>[] = [
  { id: "debout-statique", label: "Debout statique" },
  { id: "marche-figee", label: "Marche figée" },
  { id: "appuye", label: "Appuyé" },
  { id: "assis", label: "Assis" },
];

/** Template A — Studio blanc / Lifestyle extérieur / Intérieur commercial */
export const PROMPT_OUTFIT_STUDIO = `Clean editorial fashion shot, [SCENE_MOOD] aesthetic. [FRAMING_SHOT_TYPE], the [GENDER] standing in [POSE_DESCRIPTION]. [EXPRESSION_DESCRIPTION].

[HAIR_DESCRIPTION]. [PRONOUN_SUBJECT] is wearing [OUTFIT_DESCRIPTION_TOP], [OUTFIT_DESCRIPTION_BOTTOM], [OUTFIT_DESCRIPTION_FOOTWEAR][ACCESSORIES_SUFFIX].

Skin has a natural, healthy finish with visible texture, [MAKEUP_OR_GROOMING_DETAILS].

Lighting: [LIGHTING_SOURCE_AND_DIRECTION], [LIGHTING_QUALITY], [COLOR_TEMPERATURE].

Environment: [ENVIRONMENT_DESCRIPTION].

Style and mood: minimal, premium catalog/lookbook aesthetic, clean and commercial, confident and effortless.

Photorealistic quality, high detail, 4K, natural color grading, sharp focus throughout, [ASPECT_RATIO] aspect ratio.`;

/** Template B — Mirror selfie */
export const PROMPT_OUTFIT_SELFIE = `Authentic smartphone mirror selfie, natural and unposed, candid UGC energy. The [GENDER] stands facing a mirror, holding the phone up in front of [PRONOUN_OBJECT] with one hand — the phone is clearly visible in the reflection. [POSE_DESCRIPTION], weight shifted casually, [EXPRESSION_DESCRIPTION].

[HAIR_DESCRIPTION]. [PRONOUN_SUBJECT] is wearing [OUTFIT_DESCRIPTION_TOP], [OUTFIT_DESCRIPTION_BOTTOM], [OUTFIT_DESCRIPTION_FOOTWEAR][ACCESSORIES_SUFFIX].

Skin has a natural, slightly imperfect real-life finish, [MAKEUP_OR_GROOMING_DETAILS].

Lighting: [LIGHTING_SOURCE], soft ambient light typical of an indoor mirror selfie, natural reflections and slight glare on the mirror surface, no professional lighting setup.

Environment: [ENVIRONMENT_DESCRIPTION] — a real, lived-in interior visible in the reflection, slightly cluttered or candid, not staged.

Style and mood: casual, confident, natural UGC energy, Instagram-story authenticity, unfiltered but flattering.

Photorealistic quality, natural phone camera quality, slight grain, true-to-life color, [ASPECT_RATIO] aspect ratio (default 9:16).`;

const STUDIO_ENVIRONMENT: Record<OutfitStudioStudioSubId, string> = {
  "blanc-pur":
    "seamless pure white infinity cove background, no visible horizon line, completely neutral",
  "gris-clair":
    "seamless soft grey studio background, subtle neutral tone, minimal and clean",
  "degrade-doux":
    "seamless white background with a subtle soft gray gradient falloff toward the floor",
};

const LIFESTYLE_ENVIRONMENT: Record<OutfitStudioLifestyleSubId, string> = {
  golf: "a manicured golf course at dusk, soft rolling green fairways, distant trees silhouetted against the sky, warm fading daylight",
  "rue-urbaine":
    "an urban street scene with modern architecture, sidewalk paving, city buildings and storefronts softly blurred in the background",
  "vitrine-boutique":
    "standing in front of a high-end boutique storefront, polished marble facade, elegant signage partially visible, glass reflections",
  "parc-jardin":
    "a lush green park setting, mature trees, dappled natural light filtering through leaves, soft grassy path",
  plage: "a coastal beach setting, soft sand, ocean horizon in the background, natural sea breeze light",
  terrasse:
    "an outdoor terrace with potted plants and modern furniture, soft afternoon light, relaxed upscale atmosphere",
  rooftop:
    "a rooftop setting overlooking a city skyline, modern railing, open sky, golden hour light",
  campus:
    "a university campus courtyard, brick or stone buildings, casual foot traffic softly blurred, daytime natural light",
};

const INTERIOR_ENVIRONMENT: Record<OutfitStudioInteriorSubId, string> = {
  "coffee-shop":
    "a modern coffee shop interior, marble counter, warm pendant lighting, blurred shelving and menu boards in the background",
  "showroom-auto":
    "a luxury car showroom, polished floor reflections, a premium vehicle softly visible in the background, bright even commercial lighting",
  "hall-hotel":
    "an upscale hotel lobby, marble floors, soft ambient lighting, elegant furniture blurred in the background",
  "concept-store":
    "a minimalist concept store interior, clean shelving, neutral tones, soft directional lighting",
  "restaurant-bar":
    "a stylish restaurant or bar interior, warm low lighting, blurred tables and bottles in the background",
  "salle-sport":
    "a modern upscale gym interior, clean equipment lines, bright even lighting, minimal industrial aesthetic",
  spa: "a calm spa interior, soft neutral tones, natural materials like wood and stone, diffused warm light",
  bibliotheque:
    "a cozy bookstore or library interior, wooden shelves filled with books, warm ambient lighting",
};

const MIRROR_ENVIRONMENT: Record<OutfitStudioMirrorSubId, string> = {
  chambre:
    "a cozy modern bedroom visible in the reflection, unmade bed or soft linens, warm personal decor",
  dressing:
    "a walk-in closet visible in the reflection, clothing racks and shelving softly blurred in the background",
  salon:
    "a cozy modern living room visible in the reflection, wooden floor, a sofa and shelving unit partially in frame",
  couloir:
    "a hallway or entryway visible in the reflection, coat hooks or a console table softly visible",
  "chambre-hotel":
    "a hotel room visible in the reflection, neutral decor, soft curtains, minimal personal clutter",
  "vestiaire-sport":
    "a gym locker room or mirror wall visible in the reflection, lockers or equipment softly blurred",
};

const FRAMING_SHOT_TYPE: Record<OutfitStudioFramingId, string> = {
  "plein-pied": "Full body shot, head to toe clearly visible",
  "mi-cuisse": "Medium long shot, framed from mid-thigh up",
  buste: "Medium close-up shot, framed from chest up",
};

const POSE_FEMME: Record<OutfitStudioPoseId, string> = {
  "debout-statique":
    "standing in a relaxed three-quarter pose, weight shifted onto one leg, one hand resting near the waist",
  "marche-figee":
    "caught mid-stride walking naturally, one foot slightly forward, natural arm swing",
  "dynamique-legere":
    "standing with a slight head tilt, one hand gently touching the hair, playful and light energy",
  assise: "sitting casually on a low surface, legs crossed or angled to one side, relaxed posture",
  appuye: "standing in a relaxed three-quarter pose, weight shifted onto one leg, one hand resting near the waist",
  assis: "sitting casually on a low surface, legs crossed or angled to one side, relaxed posture",
};

const POSE_HOMME: Record<OutfitStudioPoseId, string> = {
  "debout-statique":
    "standing in a relaxed three-quarter pose, one hand tucked casually near the waistband or pocket, shoulders squared",
  "marche-figee":
    "caught mid-stride walking naturally with a confident gait, hands relaxed at the sides",
  "dynamique-legere":
    "standing in a relaxed three-quarter pose, one hand tucked casually near the waistband or pocket, shoulders squared",
  assise: "sitting casually, forearms resting on knees, relaxed and grounded posture",
  appuye:
    "leaning casually against a wall or railing, one leg crossed over the other, relaxed confident posture",
  assis: "sitting casually, forearms resting on knees, relaxed and grounded posture",
};

const HAIR_FEMME = [
  "long straight hair worn down, natural healthy shine",
  "loose wavy hair with soft volume",
  "hair pulled back in a low ponytail, sleek finish",
] as const;

const HAIR_HOMME = [
  "short neatly styled hair, clean-cut",
  "slightly tousled textured hair, natural finish",
  "short hair with light stubble, groomed",
] as const;

const MAKEUP_FEMME =
  "soft neutral makeup, subtle definition on the eyes and a natural lip tone";
const GROOMING_HOMME = "no makeup, well-groomed eyebrows";

const SCENE_MOOD_STUDIO = "minimal studio";
const SCENE_MOOD_LIFESTYLE: Record<OutfitStudioLifestyleSubId, string> = {
  golf: "refined outdoor leisure",
  "rue-urbaine": "urban lifestyle",
  "vitrine-boutique": "luxury street style",
  "parc-jardin": "natural outdoor lifestyle",
  plage: "coastal relaxed",
  terrasse: "upscale outdoor lifestyle",
  rooftop: "urban golden hour",
  campus: "casual collegiate lifestyle",
};
const SCENE_MOOD_INTERIOR: Record<OutfitStudioInteriorSubId, string> = {
  "coffee-shop": "warm café lifestyle",
  "showroom-auto": "premium commercial",
  "hall-hotel": "upscale hospitality",
  "concept-store": "minimal retail editorial",
  "restaurant-bar": "evening social lifestyle",
  "salle-sport": "active premium lifestyle",
  spa: "calm wellness lifestyle",
  bibliotheque: "intellectual cozy lifestyle",
};

const LIGHTING_STUDIO =
  "soft, even studio lighting from the front, large diffused softbox setup with minimal shadow, neutral color temperature (5000-5600K daylight balanced)";

const LIGHTING_GOLDEN_HOUR =
  "warm natural golden hour sunlight from a low angle, soft directional shadows, warm color temperature (3200-3800K)";

const LIGHTING_DAY_NEUTRAL =
  "natural daylight, soft diffused overcast-style light, neutral color temperature (5000K), minimal harsh shadow";

const LIGHTING_VITRINE =
  "mixed lighting — ambient daylight combined with warm storefront glow, soft reflections on glass and marble";

const LIGHTING_INTERIOR_WARM =
  "warm ambient interior lighting, soft pendant or recessed lighting, gentle contrast, warm color temperature (2800-3200K)";

const LIGHTING_INTERIOR_NEUTRAL =
  "bright even commercial lighting, clean and neutral, minimal shadow, daylight-balanced (5000-5600K)";

const MIRROR_LIGHTING = [
  "warm indoor ambient lighting from a ceiling fixture and a nearby window",
  "soft daylight from a window, natural and slightly uneven",
  "warm evening lamp lighting, cozy and low-contrast",
] as const;

const PIECE_FILENAME_RULES: { pattern: RegExp; type: OutfitPieceTypeId }[] = [
  { pattern: /\b(robe|dress|gown)\b/i, type: "robe" },
  { pattern: /\b(pantalon|trouser|pants|jean|short|jupe|skirt)\b/i, type: "bas" },
  { pattern: /\b(chemise|shirt|top|blouse|polo|tee|t-shirt|veste|jacket|blazer|pull|sweater|hoodie)\b/i, type: "haut" },
  { pattern: /\b(ensemble|outfit|look|set)\b/i, type: "ensemble" },
  { pattern: /\b(sac|bag|ceinture|belt|bijou|jewelry|accessoire|hat|chapeau|scarf)\b/i, type: "accessoire" },
];

const FRAMING_TEXT_RULES: { pattern: RegExp; framing: OutfitStudioFramingId }[] = [
  { pattern: /\b(plein\s*pied|full\s*body|head\s*to\s*toe)\b/i, framing: "plein-pied" },
  { pattern: /\b(mi[-\s]?cuisse|mid[-\s]?thigh)\b/i, framing: "mi-cuisse" },
  { pattern: /\b(plan\s*buste|buste|chest\s*up|upper\s*body)\b/i, framing: "buste" },
];

const FOCUS_PIECE_RULES: { pattern: RegExp; type: OutfitPieceTypeId }[] = [
  { pattern: /\b(veste|jacket|blazer|manteau|coat|cardigan|gilet)\b/i, type: "haut" },
  { pattern: /\b(pantalon|trouser|pants|jean|short|jupe|skirt)\b/i, type: "bas" },
  { pattern: /\b(robe|dress|gown)\b/i, type: "robe" },
  { pattern: /\b(chaussure|shoe|sneaker|boot|basket|mocassin|loafer)\b/i, type: "accessoire" },
  { pattern: /\b(sac|bag|ceinture|belt|bijou|jewelry|accessoire|hat|chapeau|scarf)\b/i, type: "accessoire" },
];

type ComplementOutfit = {
  top: string;
  bottom: string;
  footwear: string;
};

export function inferFocusPieceTypeFromNotes(notes: string): OutfitPieceTypeId | null {
  const text = notes.trim();
  if (!text) return null;
  for (const rule of FOCUS_PIECE_RULES) {
    if (rule.pattern.test(text)) return rule.type;
  }
  return null;
}

export function resolveOutfitStudioComplementOutfit(
  sceneTypeId: OutfitStudioSceneTypeId,
  subContextId: string | null,
  genderId: OutfitStudioGenderId,
): ComplementOutfit {
  const isHomme = genderId === "homme";

  if (sceneTypeId === "mirror-selfie") {
    return isHomme
      ? {
          top: "a simple neutral crew-neck t-shirt",
          bottom: "relaxed straight-leg dark wash jeans",
          footwear: "clean white low-top sneakers",
        }
      : {
          top: "a fitted neutral ribbed tank top",
          bottom: "high-waist straight-leg blue denim jeans",
          footwear: "black pointed-toe ankle boots",
        };
  }

  if (sceneTypeId === "studio-blanc") {
    return isHomme
      ? {
          top: "a crisp white ribbed polo shirt",
          bottom: "tailored charcoal grey trousers with a clean crease",
          footwear: "polished black leather oxford shoes",
        }
      : {
          top: "a fitted white sleeveless top",
          bottom: "tailored high-waist black wide-leg trousers",
          footwear: "minimal nude heeled sandals",
        };
  }

  if (sceneTypeId === "lifestyle-exterieur") {
    const outdoorId = (subContextId ?? "rue-urbaine") as OutfitStudioLifestyleSubId;
    if (["golf", "terrasse", "campus"].includes(outdoorId)) {
      return isHomme
        ? {
            top: "a navy blue polo shirt",
            bottom: "beige tailored chino shorts",
            footwear: "clean white leather sneakers",
          }
        : {
            top: "a light linen blouse",
            bottom: "flowy midi skirt in soft neutral tones",
            footwear: "tan leather flat sandals",
          };
    }
    if (outdoorId === "plage") {
      return isHomme
        ? {
            top: "a loose white linen shirt, unbuttoned",
            bottom: "light beige linen drawstring shorts",
            footwear: "woven leather slide sandals",
          }
        : {
            top: "a breezy white cotton camisole",
            bottom: "high-cut linen shorts in sand tone",
            footwear: "minimal strappy flat sandals",
          };
    }
    return isHomme
      ? {
          top: "a neutral oversized cotton t-shirt",
          bottom: "slim dark indigo jeans",
          footwear: "white leather sneakers",
        }
      : {
          top: "a soft beige knit sweater",
          bottom: "straight-leg medium-wash jeans",
          footwear: "white low-top sneakers",
        };
  }

  const interiorId = (subContextId ?? "coffee-shop") as OutfitStudioInteriorSubId;
  if (interiorId === "salle-sport" || interiorId === "vestiaire-sport") {
    return isHomme
      ? {
          top: "a fitted moisture-wicking grey t-shirt",
          bottom: "tapered black training joggers",
          footwear: "modern white and grey running sneakers",
        }
      : {
          top: "a fitted black sports bra layered with an open lightweight zip jacket",
          bottom: "high-rise black leggings",
          footwear: "white and grey training sneakers",
        };
  }

  if (["coffee-shop", "hall-hotel", "restaurant-bar", "spa", "bibliotheque"].includes(interiorId)) {
    return isHomme
      ? {
          top: "a soft merino wool crew-neck sweater",
          bottom: "tailored camel chino trousers",
          footwear: "brown suede loafers",
        }
      : {
          top: "a silk-like neutral blouse",
          bottom: "tailored straight-leg trousers in warm taupe",
          footwear: "block-heel ankle boots in tan leather",
        };
  }

  return isHomme
    ? {
        top: "a minimal black cotton t-shirt",
        bottom: "slim-fit dark grey trousers",
        footwear: "clean white minimalist sneakers",
      }
    : {
        top: "a structured neutral blazer over a simple top",
        bottom: "tailored straight-leg trousers in soft grey",
        footwear: "black leather ankle boots",
      };
}

type RandomFn = () => number;

export function getOutfitStudioPoseOptions(
  genderId: OutfitStudioGenderId,
): OutfitStudioButtonOption<OutfitStudioPoseId>[] {
  return genderId === "homme"
    ? OUTFIT_STUDIO_POSE_OPTIONS_HOMME
    : OUTFIT_STUDIO_POSE_OPTIONS_FEMME;
}

export function getOutfitStudioSubContextOptions(
  sceneTypeId: OutfitStudioSceneTypeId,
): OutfitStudioButtonOption<string>[] {
  switch (sceneTypeId) {
    case "lifestyle-exterieur":
      return OUTFIT_STUDIO_LIFESTYLE_SUB_OPTIONS;
    case "interieur-commercial":
      return OUTFIT_STUDIO_INTERIOR_SUB_OPTIONS;
    case "mirror-selfie":
      return OUTFIT_STUDIO_MIRROR_SUB_OPTIONS;
    default:
      return [];
  }
}

export function inferOutfitPieceTypeFromFilename(filename: string): OutfitPieceTypeId {
  const base = filename.trim();
  if (!base) return "inconnu";
  for (const rule of PIECE_FILENAME_RULES) {
    if (rule.pattern.test(base)) return rule.type;
  }
  return "inconnu";
}

export function inferOutfitPieceTypesFromFilenames(filenames: string[]): OutfitPieceTypeId[] {
  return filenames.map((name) => inferOutfitPieceTypeFromFilename(name));
}

export function inferOutfitLayoutFromImageCount(imageCount: number): "single" | "outfit-complet" {
  return imageCount > 1 ? "outfit-complet" : "single";
}

export function parseFramingOverrideFromNotes(notes: string): OutfitStudioFramingId | null {
  const text = notes.trim();
  if (!text) return null;
  for (const rule of FRAMING_TEXT_RULES) {
    if (rule.pattern.test(text)) return rule.framing;
  }
  return null;
}

export function resolveOutfitStudioDefaultStudioSub(
  randomFn: RandomFn = Math.random,
): OutfitStudioStudioSubId {
  const options: OutfitStudioStudioSubId[] = ["blanc-pur", "gris-clair", "degrade-doux"];
  const index = Math.floor(randomFn() * options.length);
  return options[index] ?? "gris-clair";
}

export function resolveOutfitStudioGenderLabel(genderId: OutfitStudioGenderId): string {
  return genderId === "homme" ? "man" : "woman";
}

export function resolveOutfitStudioPronouns(genderId: OutfitStudioGenderId): {
  subject: string;
  object: string;
} {
  return genderId === "homme"
    ? { subject: "He", object: "him" }
    : { subject: "She", object: "her" };
}

export function resolveOutfitStudioRatioText(ratioId: OutfitStudioRatioId): string {
  switch (ratioId) {
    case "1-1":
      return "1:1";
    case "9-16":
      return "9:16";
    default:
      return "4:5";
  }
}

export function resolveOutfitStudioFramingShotType(framingId: OutfitStudioFramingId): string {
  return FRAMING_SHOT_TYPE[framingId];
}

export function resolveOutfitStudioPoseDescription(
  genderId: OutfitStudioGenderId,
  poseId: OutfitStudioPoseId,
): string {
  const bank = genderId === "homme" ? POSE_HOMME : POSE_FEMME;
  return bank[poseId] ?? bank["debout-statique"];
}

export function resolveOutfitStudioDefaultPoseId(
  genderId: OutfitStudioGenderId,
): OutfitStudioPoseId {
  return "debout-statique";
}

export function resolveOutfitStudioHairDescription(
  genderId: OutfitStudioGenderId,
  randomFn: RandomFn = Math.random,
): string {
  const bank = genderId === "homme" ? HAIR_HOMME : HAIR_FEMME;
  const index = Math.floor(randomFn() * bank.length);
  return bank[index] ?? bank[0];
}

export function resolveOutfitStudioMakeupOrGrooming(genderId: OutfitStudioGenderId): string {
  return genderId === "homme" ? GROOMING_HOMME : MAKEUP_FEMME;
}

export function resolveOutfitStudioExpressionDescription(
  sceneTypeId: OutfitStudioSceneTypeId,
): string {
  if (sceneTypeId === "mirror-selfie") {
    return "relaxed natural expression, casual eye contact with the phone screen";
  }
  return "neutral confident expression, looking slightly off-camera";
}

export function resolveOutfitStudioEnvironment(
  sceneTypeId: OutfitStudioSceneTypeId,
  subContextId: string | null,
  randomFn: RandomFn = Math.random,
): string {
  if (sceneTypeId === "studio-blanc") {
    const studioSub =
      (subContextId as OutfitStudioStudioSubId | null) ??
      resolveOutfitStudioDefaultStudioSub(randomFn);
    return STUDIO_ENVIRONMENT[studioSub] ?? STUDIO_ENVIRONMENT["gris-clair"];
  }
  if (sceneTypeId === "lifestyle-exterieur") {
    const id = (subContextId ?? "rue-urbaine") as OutfitStudioLifestyleSubId;
    return LIFESTYLE_ENVIRONMENT[id] ?? LIFESTYLE_ENVIRONMENT["rue-urbaine"];
  }
  if (sceneTypeId === "interieur-commercial") {
    const id = (subContextId ?? "coffee-shop") as OutfitStudioInteriorSubId;
    return INTERIOR_ENVIRONMENT[id] ?? INTERIOR_ENVIRONMENT["coffee-shop"];
  }
  const id = (subContextId ?? "chambre") as OutfitStudioMirrorSubId;
  return MIRROR_ENVIRONMENT[id] ?? MIRROR_ENVIRONMENT.chambre;
}

export function resolveOutfitStudioSceneMood(
  sceneTypeId: OutfitStudioSceneTypeId,
  subContextId: string | null,
): string {
  if (sceneTypeId === "studio-blanc") return SCENE_MOOD_STUDIO;
  if (sceneTypeId === "lifestyle-exterieur") {
    const id = (subContextId ?? "rue-urbaine") as OutfitStudioLifestyleSubId;
    return SCENE_MOOD_LIFESTYLE[id] ?? "outdoor lifestyle";
  }
  const id = (subContextId ?? "coffee-shop") as OutfitStudioInteriorSubId;
  return SCENE_MOOD_INTERIOR[id] ?? "refined commercial lifestyle";
}

export function resolveOutfitStudioLighting(
  sceneTypeId: OutfitStudioSceneTypeId,
  subContextId: string | null,
  randomFn: RandomFn = Math.random,
): {
  sourceAndDirection: string;
  quality: string;
  colorTemperature: string;
  mirrorSource?: string;
} {
  if (sceneTypeId === "studio-blanc") {
    return {
      sourceAndDirection: LIGHTING_STUDIO,
      quality: "even and diffused",
      colorTemperature: "neutral daylight-balanced (5000-5600K)",
    };
  }

  if (sceneTypeId === "mirror-selfie") {
    const index = Math.floor(randomFn() * MIRROR_LIGHTING.length);
    return {
      sourceAndDirection: MIRROR_LIGHTING[index] ?? MIRROR_LIGHTING[0],
      quality: "soft ambient indoor",
      colorTemperature: "natural indoor mixed light",
      mirrorSource: MIRROR_LIGHTING[index] ?? MIRROR_LIGHTING[0],
    };
  }

  if (sceneTypeId === "lifestyle-exterieur") {
    const id = (subContextId ?? "rue-urbaine") as OutfitStudioLifestyleSubId;
    if (["golf", "parc-jardin", "rooftop", "plage"].includes(id)) {
      return {
        sourceAndDirection: LIGHTING_GOLDEN_HOUR,
        quality: "warm directional natural light",
        colorTemperature: "warm (3200-3800K)",
      };
    }
    if (id === "vitrine-boutique") {
      return {
        sourceAndDirection: LIGHTING_VITRINE,
        quality: "mixed ambient storefront light",
        colorTemperature: "mixed warm and neutral",
      };
    }
    return {
      sourceAndDirection: LIGHTING_DAY_NEUTRAL,
      quality: "soft natural daylight",
      colorTemperature: "neutral (5000K)",
    };
  }

  const id = (subContextId ?? "coffee-shop") as OutfitStudioInteriorSubId;
  if (["showroom-auto", "salle-sport", "concept-store"].includes(id)) {
    return {
      sourceAndDirection: LIGHTING_INTERIOR_NEUTRAL,
      quality: "bright even commercial light",
      colorTemperature: "daylight-balanced (5000-5600K)",
    };
  }
  return {
    sourceAndDirection: LIGHTING_INTERIOR_WARM,
    quality: "warm ambient interior light",
    colorTemperature: "warm (2800-3200K)",
  };
}

export type OutfitDescriptions = {
  top: string;
  bottom: string;
  footwear: string;
  accessoriesSuffix: string;
};

function isDirectiveClothingNotes(notes: string): boolean {
  const text = notes.trim();
  if (!text) return false;
  if (parseFramingOverrideFromNotes(text)) return true;
  return /\b(focus|mettre en avant|emphasis on|highlight|plan\s)/i.test(text);
}

function assignPieceToSlot(
  descriptions: OutfitDescriptions,
  pieceType: OutfitPieceTypeId,
  token: string,
): void {
  switch (pieceType) {
    case "robe":
      descriptions.top = token;
      descriptions.bottom = "minimal neutral styling to complement the dress";
      break;
    case "bas":
      descriptions.bottom = token;
      break;
    case "accessoire":
      descriptions.accessoriesSuffix = descriptions.accessoriesSuffix
        ? `${descriptions.accessoriesSuffix}, ${token}`
        : `, ${token}`;
      break;
    case "ensemble":
      descriptions.top = token;
      descriptions.bottom = "matching bottom piece from the uploaded outfit set";
      break;
    case "haut":
    default:
      descriptions.top = token;
      break;
  }
}

function resolvePrimaryPieceType(
  pieceTypes: OutfitPieceTypeId[],
  focusType: OutfitPieceTypeId | null,
): OutfitPieceTypeId {
  if (focusType && pieceTypes.includes(focusType)) return focusType;
  return pieceTypes[0] ?? "inconnu";
}

export function resolveOutfitDescriptions(input: {
  userNotes: string;
  imageCount: number;
  pieceTypes: OutfitPieceTypeId[];
  garmentToken: string;
  sceneTypeId: OutfitStudioSceneTypeId;
  subContextId: string | null;
  genderId: OutfitStudioGenderId;
}): OutfitDescriptions {
  const notes = input.userNotes.trim();
  const hasImages = input.imageCount > 0;
  const productToken = IMAGE_STUDIO_PRODUCT_MENTION_TOKEN;
  const image1Token = IMAGE_STUDIO_IMAGE1_MENTION_TOKEN;
  const layout = inferOutfitLayoutFromImageCount(input.imageCount);
  const directiveNotes = isDirectiveClothingNotes(notes);
  const complement = resolveOutfitStudioComplementOutfit(
    input.sceneTypeId,
    input.subContextId,
    input.genderId,
  );

  if (!hasImages) {
    if (notes.length >= 2 && !directiveNotes) {
      return {
        top: notes,
        bottom: complement.bottom,
        footwear: complement.footwear,
        accessoriesSuffix: "",
      };
    }
    return {
      top: input.garmentToken,
      bottom: complement.bottom,
      footwear: complement.footwear,
      accessoriesSuffix: "",
    };
  }

  if (notes.length >= 2 && !directiveNotes) {
    return {
      top: notes,
      bottom: layout === "outfit-complet" ? productToken : complement.bottom,
      footwear: complement.footwear,
      accessoriesSuffix: "",
    };
  }

  const base: OutfitDescriptions = {
    top: complement.top,
    bottom: complement.bottom,
    footwear: complement.footwear,
    accessoriesSuffix: "",
  };

  if (layout === "outfit-complet") {
    const tokens = [productToken, image1Token];
    input.pieceTypes.slice(0, Math.min(input.imageCount, tokens.length)).forEach((pieceType, index) => {
      assignPieceToSlot(base, pieceType, tokens[index] ?? productToken);
    });
    return base;
  }

  const primaryType = resolvePrimaryPieceType(
    input.pieceTypes,
    inferFocusPieceTypeFromNotes(notes),
  );

  switch (primaryType) {
    case "robe":
      base.top = productToken;
      base.bottom = "minimal neutral styling to complement the dress";
      break;
    case "bas":
      base.bottom = productToken;
      break;
    case "accessoire":
      base.accessoriesSuffix = `, ${productToken}`;
      break;
    case "ensemble":
      base.top = productToken;
      base.bottom = "matching bottom piece from the uploaded outfit set";
      break;
    case "haut":
    default:
      base.top = productToken;
      break;
  }

  return base;
}

export function resolveEffectiveFramingId(
  framingId: OutfitStudioFramingId,
  userNotes: string,
): OutfitStudioFramingId {
  return parseFramingOverrideFromNotes(userNotes) ?? framingId;
}

export function resolveOutfitStudioReferenceImageUrls(input: {
  imageUrls: string[];
  imageFilenames: string[];
  userNotes: string;
  assembledPrompt: string;
}): { productImageUrl: string | null; importedRefImageUrl: string | null } {
  const imageUrls = input.imageUrls.map((url) => url.trim()).filter(Boolean);
  if (!imageUrls.length) {
    return { productImageUrl: null, importedRefImageUrl: null };
  }

  if (imageUrls.length === 1) {
    return { productImageUrl: imageUrls[0], importedRefImageUrl: null };
  }

  const pieceTypes = inferOutfitPieceTypesFromFilenames(input.imageFilenames);
  const focusType = inferFocusPieceTypeFromNotes(input.userNotes);
  let heroIndex = 0;
  if (focusType) {
    const focusIndex = pieceTypes.findIndex((type) => type === focusType);
    if (focusIndex >= 0) heroIndex = focusIndex;
  }

  const productImageUrl = imageUrls[heroIndex] ?? imageUrls[0];
  const usesImage1 = input.assembledPrompt.includes(IMAGE_STUDIO_IMAGE1_MENTION_TOKEN);
  if (!usesImage1) {
    return { productImageUrl, importedRefImageUrl: null };
  }

  const secondaryIndex = imageUrls.findIndex((_, index) => index !== heroIndex);
  return {
    productImageUrl,
    importedRefImageUrl: secondaryIndex >= 0 ? imageUrls[secondaryIndex] : null,
  };
}
