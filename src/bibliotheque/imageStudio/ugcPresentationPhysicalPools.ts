import type { UgcSelfieProfileId } from "./ugcSelfieProfiles";

export type UgcPresentationPhysiqueVariant = {
  /** Valeur complète pour [PHYSIQUE] quand rien n'est précisé à la Q4. */
  full: string;
  /** Carrure + traits sans teint, pour fusion avec un teint explicite. */
  buildFace: string;
};

export type UgcPresentationPhysicalDraw = {
  physique: string;
  hairDescription: string;
};

type RandomFn = () => number;

const PROFILE_IDS: UgcSelfieProfileId[] = [
  "femme-20",
  "femme-30",
  "femme-40",
  "femme-50",
  "femme-60",
  "homme-20",
  "homme-30",
  "homme-40",
  "homme-50",
  "homme-60",
];

export const UGC_PRESENTATION_PHYSIQUE_POOLS: Record<
  UgcSelfieProfileId,
  UgcPresentationPhysiqueVariant[]
> = {
  "femme-20": [
    {
      full: "natural slim build, clear youthful skin, soft oval face",
      buildFace: "natural slim build, soft oval face with expressive eyes",
    },
    {
      full: "natural athletic build, warm golden skin, defined cheekbones",
      buildFace: "natural athletic build, defined cheekbones and bright eyes",
    },
    {
      full: "natural petite build, fair even skin, round gentle features",
      buildFace: "natural petite build, round gentle features and a soft jawline",
    },
    {
      full: "natural average build, light olive skin, balanced symmetrical face",
      buildFace: "natural average build, balanced symmetrical face with a straight nose",
    },
    {
      full: "natural lean build, sun-kissed skin, subtle freckles across the nose",
      buildFace: "natural lean build, subtle freckles across the nose and cheeks",
    },
    {
      full: "natural toned build, smooth medium skin, heart-shaped face",
      buildFace: "natural toned build, heart-shaped face with full lips",
    },
    {
      full: "natural slender build, porcelain-fair skin, delicate jawline",
      buildFace: "natural slender build, delicate jawline and fine brows",
    },
    {
      full: "natural medium build, honey-toned skin, open friendly expression",
      buildFace: "natural medium build, open friendly expression and soft cheek contours",
    },
  ],
  "femme-30": [
    {
      full: "natural lean build, even warm skin, refined angular face",
      buildFace: "natural lean build, refined angular face with high cheekbones",
    },
    {
      full: "natural average build, light tan skin, soft rounded features",
      buildFace: "natural average build, soft rounded features and relaxed expression",
    },
    {
      full: "natural athletic build, healthy glowing skin, strong defined jaw",
      buildFace: "natural athletic build, strong defined jaw and alert eyes",
    },
    {
      full: "natural slim build, fair skin with a light natural flush, oval face",
      buildFace: "natural slim build, oval face with a straight nose bridge",
    },
    {
      full: "natural medium build, olive skin, slightly asymmetric charming smile lines",
      buildFace: "natural medium build, slightly asymmetric charming smile lines around the eyes",
    },
    {
      full: "natural toned build, medium-brown skin, luminous cheek structure",
      buildFace: "natural toned build, luminous cheek structure and defined brows",
    },
    {
      full: "natural petite build, pale skin, delicate nose and chin",
      buildFace: "natural petite build, delicate nose and chin with gentle features",
    },
    {
      full: "natural curvy build, warm beige skin, full cheeks and soft jawline",
      buildFace: "natural curvy build, full cheeks and a soft jawline",
    },
  ],
  "femme-40": [
    {
      full: "natural average build, warm olive skin, mature defined cheekbones",
      buildFace: "natural average build, mature defined cheekbones and calm expression",
    },
    {
      full: "natural slim build, fair skin with faint smile lines, elegant narrow face",
      buildFace: "natural slim build, elegant narrow face with faint smile lines",
    },
    {
      full: "natural athletic build, medium tan skin, firm jaw and bright eyes",
      buildFace: "natural athletic build, firm jaw and bright attentive eyes",
    },
    {
      full: "natural medium build, golden skin, subtle crow's feet at the eyes",
      buildFace: "natural medium build, subtle crow's feet at the eyes and relaxed brows",
    },
    {
      full: "natural toned build, light brown skin, square-soft face shape",
      buildFace: "natural toned build, square-soft face shape with defined cheek planes",
    },
    {
      full: "natural lean build, sun-worn skin, fine lines around the mouth",
      buildFace: "natural lean build, fine lines around the mouth and a composed gaze",
    },
    {
      full: "natural curvy build, rosy medium skin, rounded face with mature warmth",
      buildFace: "natural curvy build, rounded face with mature warmth and soft features",
    },
    {
      full: "natural slender build, cool fair skin, angular chin and gentle under-eye texture",
      buildFace: "natural slender build, angular chin and gentle under-eye texture",
    },
  ],
  "femme-50": [
    {
      full: "natural average build, warm tan skin, visible fine lines and lived-in elegance",
      buildFace: "natural average build, visible fine lines and lived-in elegance in the face",
    },
    {
      full: "natural slim build, fair skin, soft nasolabial lines and bright eyes",
      buildFace: "natural slim build, soft nasolabial lines and bright expressive eyes",
    },
    {
      full: "natural stocky build, medium olive skin, strong cheek structure",
      buildFace: "natural stocky build, strong cheek structure and a confident expression",
    },
    {
      full: "natural lean build, weathered light skin, angular face with smile creases",
      buildFace: "natural lean build, angular face with smile creases at the corners of the eyes",
    },
    {
      full: "natural medium build, golden-brown skin, rounded mature features",
      buildFace: "natural medium build, rounded mature features and relaxed posture in the face",
    },
    {
      full: "natural toned build, sun-kissed skin, faint age spots on the cheeks",
      buildFace: "natural toned build, faint age spots on the cheeks and a warm gaze",
    },
    {
      full: "natural curvy build, soft beige skin, full face with gentle wrinkles",
      buildFace: "natural curvy build, full face with gentle wrinkles around the eyes",
    },
    {
      full: "natural slender build, pale skin, elongated face with subtle neck lines",
      buildFace: "natural slender build, elongated face with subtle neck lines",
    },
  ],
  "femme-60": [
    {
      full: "natural slim build, fair skin with visible age lines, graceful mature face",
      buildFace: "natural slim build, graceful mature face with visible age lines",
    },
    {
      full: "natural average build, warm weathered skin, soft rounded mature features",
      buildFace: "natural average build, soft rounded mature features and kind eyes",
    },
    {
      full: "natural stocky build, light olive skin, deep smile lines and strong brows",
      buildFace: "natural stocky build, deep smile lines and strong brows",
    },
    {
      full: "natural lean build, sun-worn skin, delicate wrinkles and high cheekbones",
      buildFace: "natural lean build, delicate wrinkles and high cheekbones",
    },
    {
      full: "natural medium build, honey-toned skin, gentle sag at the jaw with dignified expression",
      buildFace: "natural medium build, gentle sag at the jaw with a dignified expression",
    },
    {
      full: "natural toned build, pale skin, fine crepe texture around the eyes",
      buildFace: "natural toned build, fine crepe texture around the eyes and a serene look",
    },
    {
      full: "natural curvy build, medium tan skin, full cheeks with mature softness",
      buildFace: "natural curvy build, full cheeks with mature softness and warm eyes",
    },
    {
      full: "natural slender build, cool fair skin, thin lips and subtle forehead lines",
      buildFace: "natural slender build, thin lips and subtle forehead lines",
    },
  ],
  "homme-20": [
    {
      full: "natural lean build, clear skin, angular youthful jaw",
      buildFace: "natural lean build, angular youthful jaw and bright eyes",
    },
    {
      full: "natural athletic build, warm tan skin, broad shoulders and square face",
      buildFace: "natural athletic build, broad shoulders suggested in frame and a square face",
    },
    {
      full: "natural slim build, fair skin, narrow nose and soft stubble shadow",
      buildFace: "natural slim build, narrow nose and soft stubble shadow",
    },
    {
      full: "natural average build, olive skin, slightly uneven boyish features",
      buildFace: "natural average build, slightly uneven boyish features and an easy smile",
    },
    {
      full: "natural stocky build, medium-brown skin, round cheeks and strong brow ridge",
      buildFace: "natural stocky build, round cheeks and a strong brow ridge",
    },
    {
      full: "natural toned build, sun-kissed skin, defined cheek hollows",
      buildFace: "natural toned build, defined cheek hollows and alert expression",
    },
    {
      full: "natural medium build, light skin, straight nose and faint acne texture on the chin",
      buildFace: "natural medium build, straight nose and faint acne texture on the chin",
    },
    {
      full: "natural lanky build, golden skin, long face with relaxed features",
      buildFace: "natural lanky build, long face with relaxed features and clear eyes",
    },
  ],
  "homme-30": [
    {
      full: "natural athletic build, olive skin, sharp jawline and short stubble",
      buildFace: "natural athletic build, sharp jawline and short stubble",
    },
    {
      full: "natural average build, medium tan skin, balanced masculine features",
      buildFace: "natural average build, balanced masculine features and steady gaze",
    },
    {
      full: "natural lean build, fair skin, hollow cheeks and straight brows",
      buildFace: "natural lean build, hollow cheeks and straight brows",
    },
    {
      full: "natural stocky build, warm brown skin, wide nose and strong chin",
      buildFace: "natural stocky build, wide nose and strong chin",
    },
    {
      full: "natural toned build, sun-worn skin, faint lines at the eyes from outdoor life",
      buildFace: "natural toned build, faint lines at the eyes from outdoor life",
    },
    {
      full: "natural slim build, light olive skin, narrow face and clean-shaven look",
      buildFace: "natural slim build, narrow face and clean-shaven look",
    },
    {
      full: "natural medium build, golden skin, slightly crooked nose and relaxed expression",
      buildFace: "natural medium build, slightly crooked nose and relaxed expression",
    },
    {
      full: "natural broad build, deep tan skin, heavy-lidded eyes and square jaw",
      buildFace: "natural broad build, heavy-lidded eyes and square jaw",
    },
  ],
  "homme-40": [
    {
      full: "natural average build, tanned weathered skin, fine lines around the eyes",
      buildFace: "natural average build, fine lines around the eyes and a weathered look",
    },
    {
      full: "natural athletic build, olive skin, salt-and-pepper stubble and firm jaw",
      buildFace: "natural athletic build, salt-and-pepper stubble and firm jaw",
    },
    {
      full: "natural stocky build, fair skin, ruddy cheeks and thick brows",
      buildFace: "natural stocky build, ruddy cheeks and thick brows",
    },
    {
      full: "natural lean build, medium-brown skin, angular face with nasolabial folds",
      buildFace: "natural lean build, angular face with nasolabial folds",
    },
    {
      full: "natural broad build, sun-worn skin, deep-set eyes and a small scar through one eyebrow",
      buildFace: "natural broad build, deep-set eyes and a small scar through one eyebrow",
    },
    {
      full: "natural slim build, pale skin, gaunt cheekbones and light beard growth",
      buildFace: "natural slim build, gaunt cheekbones and light beard growth",
    },
    {
      full: "natural medium build, golden skin, rounded face with mature smile lines",
      buildFace: "natural medium build, rounded face with mature smile lines",
    },
    {
      full: "natural toned build, dark tan skin, strong nose bridge and crow's feet",
      buildFace: "natural toned build, strong nose bridge and crow's feet",
    },
  ],
  "homme-50": [
    {
      full: "natural stocky build, weathered tan skin, prominent laugh lines",
      buildFace: "natural stocky build, prominent laugh lines and a rugged expression",
    },
    {
      full: "natural average build, fair skin, graying stubble and softened jawline",
      buildFace: "natural average build, graying stubble and softened jawline",
    },
    {
      full: "natural lean build, olive skin, deep forehead lines and sharp cheekbones",
      buildFace: "natural lean build, deep forehead lines and sharp cheekbones",
    },
    {
      full: "natural broad build, medium-brown skin, heavy brow and sun spots on the temples",
      buildFace: "natural broad build, heavy brow and sun spots on the temples",
    },
    {
      full: "natural athletic build, sun-worn skin, creased eyes and strong neck tendons",
      buildFace: "natural athletic build, creased eyes and strong neck tendons",
    },
    {
      full: "natural medium build, ruddy fair skin, bulbous nose and gentle under-eye bags",
      buildFace: "natural medium build, bulbous nose and gentle under-eye bags",
    },
    {
      full: "natural slim build, golden skin, hollow temples and mature crow's feet",
      buildFace: "natural slim build, hollow temples and mature crow's feet",
    },
    {
      full: "natural sturdy build, dark tan skin, square face with visible age texture",
      buildFace: "natural sturdy build, square face with visible age texture",
    },
  ],
  "homme-60": [
    {
      full: "natural slim build, weathered skin with visible age lines, angular face",
      buildFace: "natural slim build, angular face with visible age lines",
    },
    {
      full: "natural stocky build, soft rounded face, light age spots on the skin",
      buildFace: "natural stocky build, soft rounded face with light age spots",
    },
    {
      full: "natural average build, deep-set eyes, slightly sun-worn complexion",
      buildFace: "natural average build, deep-set eyes and a slightly sun-worn look",
    },
    {
      full: "natural lean build, fair skin, thin lips and pronounced cheek wrinkles",
      buildFace: "natural lean build, thin lips and pronounced cheek wrinkles",
    },
    {
      full: "natural broad build, olive skin, heavy jowls and silver stubble",
      buildFace: "natural broad build, heavy jowls and silver stubble",
    },
    {
      full: "natural medium build, golden-brown skin, gentle sag under the eyes",
      buildFace: "natural medium build, gentle sag under the eyes and a warm expression",
    },
    {
      full: "natural sturdy build, tanned weathered skin, broken capillaries on the cheeks",
      buildFace: "natural sturdy build, broken capillaries on the cheeks and a firm chin",
    },
    {
      full: "natural slender build, pale skin, elongated face with deep nasolabial folds",
      buildFace: "natural slender build, elongated face with deep nasolabial folds",
    },
  ],
};

export const UGC_PRESENTATION_HAIR_POOLS: Record<UgcSelfieProfileId, string[]> = {
  "femme-20": [
    "long dark brown wavy hair",
    "shoulder-length straight black hair",
    "medium-length honey-blonde hair with soft layers",
    "long chestnut hair in a loose ponytail",
    "short textured bob with side part",
    "medium curly auburn hair",
    "long straight dark hair with wispy bangs",
    "shoulder-length sun-lightened brown hair",
  ],
  "femme-30": [
    "dark hair softly pulled back in a low bun",
    "medium-length caramel waves",
    "long straight espresso-brown hair",
    "short layered brunette hair with volume",
    "shoulder-length honey-highlighted hair",
    "long loose chestnut curls",
    "medium sleek black hair with a center part",
    "short tousled dark-blonde hair",
  ],
  "femme-40": [
    "sleek straight dark brown bob",
    "medium-length layered ash-brown hair",
    "long wavy chestnut hair with face-framing layers",
    "short textured pixie in warm brown",
    "shoulder-length honey-blonde waves",
    "long dark hair gathered in a loose low chignon",
    "medium straight black hair with subtle highlights",
    "short side-swept brunette hair with soft volume",
  ],
  "femme-50": [
    "voluminous salt-and-pepper wavy hair",
    "medium-length silver-streaked brown hair",
    "short layered gray-brown hair with body",
    "long loose auburn waves with natural gray strands",
    "shoulder-length straight dark hair with silver temples",
    "short curly salt-and-pepper hair",
    "medium wavy chestnut hair with soft gray highlights",
    "long silver-gray hair worn down naturally",
  ],
  "femme-60": [
    "silver-gray wavy hair worn loose",
    "short soft white-gray hair with gentle volume",
    "medium-length silver hair in a neat bob",
    "long straight white-gray hair with subtle layers",
    "short curly salt-and-pepper hair",
    "shoulder-length pearl-gray waves",
    "medium silver hair pulled back softly",
    "short feathered gray hair with a side part",
  ],
  "homme-20": [
    "short dark slightly messy hair",
    "medium-length wavy brown hair",
    "short black hair with a textured crop",
    "curly short dark hair with natural volume",
    "medium straight brown hair brushed back",
    "short bleached-blond hair with dark roots",
    "short dark hair under a backwards cap line visible at the crown",
    "medium shaggy light-brown hair",
  ],
  "homme-30": [
    "short dark textured hair with light stubble at the hairline",
    "medium-length wavy brown hair swept back",
    "short black fade with a longer top",
    "curly short dark hair with tight coils",
    "medium straight dark hair with a side part",
    "short sandy-blond hair with a messy fringe",
    "short salt-and-pepper hair starting at the temples",
    "medium-length layered brown hair with natural movement",
  ],
  "homme-40": [
    "short salt-and-pepper hair with a well-groomed beard",
    "medium-length dark hair brushed back with gray at the sides",
    "short cropped gray-brown hair",
    "curly short dark hair with silver streaks",
    "short straight black hair with a receding hairline",
    "medium wavy brown hair with gray temples",
    "short textured dark hair with a full beard shadow",
    "buzzed gray-brown hair with a defined hairline",
  ],
  "homme-50": [
    "short salt-and-pepper hair with grey beard stubble",
    "medium-length silver-gray hair swept to the side",
    "short cropped white-gray hair",
    "curly short gray hair with natural volume",
    "short dark hair heavily streaked with silver",
    "medium straight gray hair with a side part",
    "short thinning gray hair with a tanned scalp shadow",
    "buzzed silver hair with a strong jaw-framing line",
  ],
  "homme-60": [
    "short silver-gray hair softly swept back",
    "medium-length white-gray hair with gentle waves",
    "short cropped pearl-gray hair",
    "thinning silver hair combed to the side",
    "short white hair with a neat natural part",
    "medium straight gray-white hair with volume at the crown",
    "short salt-and-pepper hair with a trimmed beard",
    "buzzed silver-gray hair with a clean hairline",
  ],
};

function pickRandomIndex(length: number, randomFn: RandomFn = Math.random): number {
  if (length <= 0) return 0;
  return Math.floor(randomFn() * length);
}

export function isUgcPresentationProfileId(
  profileId: string | null | undefined,
): profileId is UgcSelfieProfileId {
  return Boolean(profileId && PROFILE_IDS.includes(profileId as UgcSelfieProfileId));
}

export function pickRandomUgcPresentationPhysiqueVariant(
  profileId: UgcSelfieProfileId,
  randomFn: RandomFn = Math.random,
): UgcPresentationPhysiqueVariant {
  const pool = UGC_PRESENTATION_PHYSIQUE_POOLS[profileId];
  return pool[pickRandomIndex(pool.length, randomFn)] ?? pool[0];
}

export function pickRandomUgcPresentationHairDescription(
  profileId: UgcSelfieProfileId,
  randomFn: RandomFn = Math.random,
): string {
  const pool = UGC_PRESENTATION_HAIR_POOLS[profileId];
  return pool[pickRandomIndex(pool.length, randomFn)] ?? pool[0];
}

export function drawUgcPresentationPhysicalDefaults(
  profileId: UgcSelfieProfileId,
  randomFn: RandomFn = Math.random,
): UgcPresentationPhysicalDraw {
  const physiqueVariant = pickRandomUgcPresentationPhysiqueVariant(profileId, randomFn);
  return {
    physique: physiqueVariant.full,
    hairDescription: pickRandomUgcPresentationHairDescription(profileId, randomFn),
  };
}

export type UgcPresentationPhysicalCustomInput = {
  skinTone?: string;
  hairPromptValue?: string;
};

export function drawUgcPresentationPhysicalCustom(
  profileId: UgcSelfieProfileId,
  input: UgcPresentationPhysicalCustomInput,
  randomFn: RandomFn = Math.random,
): UgcPresentationPhysicalDraw {
  const physiqueVariant = pickRandomUgcPresentationPhysiqueVariant(profileId, randomFn);
  const skin = input.skinTone?.trim();
  const hairPrompt = input.hairPromptValue?.trim();

  let physique = physiqueVariant.full;
  if (skin) {
    physique = `${physiqueVariant.buildFace}, ${skin} skin tone`;
  }

  let hairDescription = pickRandomUgcPresentationHairDescription(profileId, randomFn);
  if (hairPrompt) {
    hairDescription = `${hairPrompt} hair`;
  }

  return { physique, hairDescription };
}
