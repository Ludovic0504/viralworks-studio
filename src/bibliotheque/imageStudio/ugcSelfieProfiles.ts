export type UgcSelfieGender = "homme" | "femme";

export type UgcSelfieAge = 20 | 30 | 40 | 50 | 60;

export type UgcSelfieProfileId = `${UgcSelfieGender}-${UgcSelfieAge}`;

export type UgcSelfieProfile = {
  id: UgcSelfieProfileId;
  gender: UgcSelfieGender;
  age: UgcSelfieAge;
  image: string;
  ageLabel: string;
  sexEn: "man" | "woman";
  physicalDescription: string;
  skinTone: string;
  hair: string;
  outfit: string;
};

export type UgcSelfieQuickOption = {
  id: string;
  label: string;
  promptValue: string;
};

export type UgcSelfieSkinToneOption = UgcSelfieQuickOption & {
  swatchColor: string;
};

export type UgcSelfieLocationPreset = {
  id: string;
  label: string;
  promptValue: string;
};

const UGC_SELFIE_IMAGE_BASE = "/image-studio/templates/ugc-selfie";

export const UGC_SELFIE_AGES: UgcSelfieAge[] = [20, 30, 40, 50, 60];

export const UGC_SELFIE_SKIN_TONE_OPTIONS: UgcSelfieSkinToneOption[] = [
  {
    id: "pale",
    label: "Pâle",
    promptValue: "very fair porcelain",
    swatchColor: "#F3E5DB",
  },
  {
    id: "fair",
    label: "Clair",
    promptValue: "light fair",
    swatchColor: "#E8D0BC",
  },
  {
    id: "medium",
    label: "Moyen",
    promptValue: "medium natural",
    swatchColor: "#C9976B",
  },
  {
    id: "tan",
    label: "Bronzé",
    promptValue: "warm bronzed tan",
    swatchColor: "#A06D45",
  },
  {
    id: "deep",
    label: "Foncé",
    promptValue: "rich dark brown",
    swatchColor: "#4A3428",
  },
  {
    id: "ebony",
    label: "Très foncé",
    promptValue: "deep black",
    swatchColor: "#0F0D0C",
  },
];

export const UGC_SELFIE_HAIR_OPTIONS: UgcSelfieQuickOption[] = [
  { id: "short", label: "Courts", promptValue: "short" },
  { id: "medium", label: "Mi-longs", promptValue: "medium-length" },
  { id: "long", label: "Longs", promptValue: "long" },
  { id: "wavy", label: "Ondulés", promptValue: "softly wavy" },
];

export const UGC_SELFIE_OUTFIT_OPTIONS: UgcSelfieQuickOption[] = [
  { id: "casual", label: "Décontracté", promptValue: "a casual t-shirt and jeans" },
  {
    id: "professional",
    label: "Professionnel",
    promptValue: "a crisp blazer over a white button-down shirt",
  },
  { id: "sporty", label: "Sportif", promptValue: "athletic wear" },
  { id: "elegant", label: "Élégant", promptValue: "an elegant linen top" },
];

/** Valeurs génériques quand l'utilisateur ne choisit pas tout — sans lien avec la photo. */
export const UGC_SELFIE_IMPROVISED_PHYSICAL = {
  skinTone: "natural medium",
  hair: "natural medium-length",
  outfit: "everyday casual clothing",
} as const;

export type UgcSelfiePhysicalResolveMode = "photo" | "improvise";

export const UGC_SELFIE_LOCATION_PRESETS: UgcSelfieLocationPreset[] = [
  { id: "gym", label: "Salle de sport", promptValue: "modern gym interior" },
  { id: "pool", label: "Piscine", promptValue: "sunlit swimming pool area" },
  { id: "office", label: "Bureau", promptValue: "upscale office with city skyline windows" },
  { id: "garage", label: "Garage", promptValue: "motorcycle workshop garage" },
  { id: "construction", label: "Chantier", promptValue: "construction site" },
  { id: "stadium", label: "Stade", promptValue: "crowded football stadium" },
  { id: "rooftop", label: "Toit-terrasse", promptValue: "rooftop balcony with city skyline" },
  { id: "street", label: "Rue", promptValue: "busy city street" },
];

export const UGC_SELFIE_PROFILES: UgcSelfieProfile[] = [
  {
    id: "femme-20",
    gender: "femme",
    age: 20,
    image: `${UGC_SELFIE_IMAGE_BASE}/Selfie_Femme_20ans.png`,
    ageLabel: "20 ans",
    sexEn: "woman",
    physicalDescription:
      "youthful features with a fresh, natural glow and soft facial contours",
    skinTone: "warm light-brown",
    hair: "long dark brown wavy",
    outfit: "a white Real Madrid football jersey tied at the waist with light blue denim shorts",
  },
  {
    id: "femme-30",
    gender: "femme",
    age: 30,
    image: `${UGC_SELFIE_IMAGE_BASE}/Selfie_Femme_30ans.png`,
    ageLabel: "30 ans",
    sexEn: "woman",
    physicalDescription: "refined features with a dewy complexion and confident expression",
    skinTone: "medium tan",
    hair: "dark, softly pulled back",
    outfit: "a simple black tank top with dark work overalls tied around her waist",
  },
  {
    id: "femme-40",
    gender: "femme",
    age: 40,
    image: `${UGC_SELFIE_IMAGE_BASE}/Selfie_Femme_40ans.png`,
    ageLabel: "40 ans",
    sexEn: "woman",
    physicalDescription:
      "mature features with natural skin texture and defined cheekbones",
    skinTone: "warm olive",
    hair: "sleek straight dark brown bob",
    outfit: "a dark charcoal grey blazer over a crisp white button-down shirt",
  },
  {
    id: "femme-50",
    gender: "femme",
    age: 50,
    image: `${UGC_SELFIE_IMAGE_BASE}/Selfie_Femme_50ans.png`,
    ageLabel: "50 ans",
    sexEn: "woman",
    physicalDescription:
      "mature features with visible fine lines and a warm, lived-in elegance",
    skinTone: "tan",
    hair: "voluminous salt-and-pepper wavy",
    outfit: "a worn black leather biker jacket over a dark grey graphic t-shirt",
  },
  {
    id: "femme-60",
    gender: "femme",
    age: 60,
    image: `${UGC_SELFIE_IMAGE_BASE}/Selfie_Femme_60ans.png`,
    ageLabel: "60 ans",
    sexEn: "woman",
    physicalDescription:
      "graceful mature features with visible natural texture and fine lines around the eyes",
    skinTone: "fair",
    hair: "silver-grey wavy",
    outfit: "a light beige linen-textured v-neck top",
  },
  {
    id: "homme-20",
    gender: "homme",
    age: 20,
    image: `${UGC_SELFIE_IMAGE_BASE}/Selfie_Homme_20ans.png`,
    ageLabel: "20 ans",
    sexEn: "man",
    physicalDescription: "youthful features with an easygoing, natural charm",
    skinTone: "tan",
    hair: "short dark, slightly messy under a backwards baseball cap",
    outfit: "a simple black t-shirt and a dark olive-brown baseball cap worn backwards",
  },
  {
    id: "homme-30",
    gender: "homme",
    age: 30,
    image: `${UGC_SELFIE_IMAGE_BASE}/Selfie_Homme_30ans.png`,
    ageLabel: "30 ans",
    sexEn: "man",
    physicalDescription: "athletic features with a healthy post-workout glow",
    skinTone: "olive",
    hair: "short dark textured with short stubble",
    outfit: "a black athletic stringer tank top and a black leather weightlifting belt",
  },
  {
    id: "homme-40",
    gender: "homme",
    age: 40,
    image: `${UGC_SELFIE_IMAGE_BASE}/Selfie_Homme_40ans.png`,
    ageLabel: "40 ans",
    sexEn: "man",
    physicalDescription:
      "mature features with fine lines around the eyes and a weathered, confident look",
    skinTone: "tanned weathered",
    hair: "short salt-and-pepper with a well-groomed beard",
    outfit: "a dark blue mechanic's jumpsuit stained with grease and oil",
  },
  {
    id: "homme-50",
    gender: "homme",
    age: 50,
    image: `${UGC_SELFIE_IMAGE_BASE}/Selfie_Homme_50ans.png`,
    ageLabel: "50 ans",
    sexEn: "man",
    physicalDescription:
      "weathered features with prominent laugh lines and a rugged warmth",
    skinTone: "tanned weathered",
    hair: "short salt-and-pepper with grey beard stubble",
    outfit:
      "a dusty grey shirt under a bright yellow high-visibility safety vest and a scuffed white hard hat",
  },
  {
    id: "homme-60",
    gender: "homme",
    age: 60,
    image: `${UGC_SELFIE_IMAGE_BASE}/Selfie_Homme_60ans.png`,
    ageLabel: "60 ans",
    sexEn: "man",
    physicalDescription:
      "distinguished mature features with natural wrinkles around the eyes",
    skinTone: "fair",
    hair: "short silver-grey, softly swept back",
    outfit: "a dark blue button-down shirt over a black t-shirt",
  },
];

export function getUgcSelfieProfilesForGender(gender: UgcSelfieGender): UgcSelfieProfile[] {
  return UGC_SELFIE_PROFILES.filter((profile) => profile.gender === gender);
}

export function getUgcSelfieProfileById(
  profileId: string | null | undefined,
): UgcSelfieProfile | undefined {
  if (!profileId) return undefined;
  return UGC_SELFIE_PROFILES.find((profile) => profile.id === profileId);
}

export const UGC_PRESENTATION_AGE_MIN = 18;
export const UGC_PRESENTATION_AGE_MAX = 80;
export const UGC_PRESENTATION_AGE_DEFAULT = 30;

export function clampUgcPresentationAge(age: number): number {
  return Math.min(UGC_PRESENTATION_AGE_MAX, Math.max(UGC_PRESENTATION_AGE_MIN, Math.round(age)));
}

export function resolveUgcPresentationProfileIdFromAge(
  gender: UgcSelfieGender,
  age: number,
): UgcSelfieProfileId {
  const clamped = clampUgcPresentationAge(age);
  let bucket: UgcSelfieAge;
  if (clamped <= 24) bucket = 20;
  else if (clamped <= 34) bucket = 30;
  else if (clamped <= 44) bucket = 40;
  else if (clamped <= 54) bucket = 50;
  else bucket = 60;
  return `${gender}-${bucket}`;
}
