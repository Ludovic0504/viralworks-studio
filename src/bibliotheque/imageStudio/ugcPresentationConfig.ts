export type UgcPresentationMode = "held" | "worn";

export type UgcPresentationBodyZone =
  | "head"
  | "wrist"
  | "upper"
  | "lower"
  | "feet"
  | "shoulder"
  | "full-outfit";

export type UgcPresentationPose = "forward" | "natural" | "default";

export type UgcPresentationBodyZoneOption = {
  id: UgcPresentationBodyZone;
  label: string;
  cadrageZone: string;
  heroFocus: string;
};

export type UgcPresentationLocationPreset = {
  id: string;
  label: string;
  /** Vide = dressing par défaut déjà décrit dans le template. */
  promptValue: string;
};

export const UGC_PRESENTATION_BODY_ZONE_OPTIONS: UgcPresentationBodyZoneOption[] = [
  {
    id: "head",
    label: "Tête / visage",
    cadrageZone:
      "Extreme close-up to close-up shot, face and shoulders filling most of the frame, camera very close to the subject as if arm's length or handheld nearby, minimal background visible",
    heroFocus:
      "both hands raised near the face, actively holding, adjusting, or lightly touching the item at face level, item positioned close to or overlapping the lower face, head slightly tilted, playful or engaged expression",
  },
  {
    id: "wrist",
    label: "Poignet / main",
    cadrageZone:
      "Extreme close-up shot, hands and wrist filling most of the frame, camera very close, face may be partially visible or softly out of focus in the background",
    heroFocus:
      "one or both hands raised toward the camera at chest-to-face height, wrist turned to clearly display the item, fingers relaxed and slightly spread, item angled toward the lens rather than flat against the skin",
  },
  {
    id: "upper",
    label: "Haut du corps",
    cadrageZone: "Medium shot, framed from waist up, feet and lower legs out of frame",
    heroFocus:
      "shoulders squared to the camera, one hand may rest on the opposite forearm or chest, torso centered and unobstructed by arms crossing in front",
  },
  {
    id: "lower",
    label: "Bas du corps",
    cadrageZone:
      "Full body shot, framed from head to feet, entire outfit visible in frame",
    heroFocus:
      "one hand resting lightly at the hip or waistband, weight shifted onto one leg to elongate the leg line and show the garment's drape and length clearly, body angled three-quarters rather than fully frontal, the other hand relaxed at the side away from the garment",
  },
  {
    id: "feet",
    label: "Pieds",
    cadrageZone:
      "Full body shot, framed from head to feet, entire outfit and shoes clearly visible in frame",
    heroFocus:
      "one foot placed slightly forward of the other, weight visibly distributed to show both shoes clearly, body angled slightly to reveal the side profile of the footwear",
  },
  {
    id: "shoulder",
    label: "Porté à l'épaule / dos",
    cadrageZone:
      "Medium shot, framed from waist up, shoulder or back area clearly visible depending on carry style",
    heroFocus:
      "shoulder or back turned partially toward the camera, one hand may rest on the strap, torso rotated enough to reveal the item clearly without fully turning away from the lens",
  },
  {
    id: "full-outfit",
    label: "Tenue complète",
    cadrageZone:
      "Full body shot, framed from head to feet, entire outfit clearly visible in frame",
    heroFocus:
      "body angled three-quarters, weight on one leg, arms relaxed away from the torso so the full silhouette and outfit are unobstructed",
  },
];

export const UGC_PRESENTATION_WORN_POSE_VALUES: Record<UgcPresentationPose, string> = {
  forward:
    "leaning slightly forward toward the camera from the waist, upper body tilted in, head slightly lowered and angled down toward the lens, close and intimate framing as if she/he is near the camera rather than posing at a distance, natural candid asymmetry in the shoulders, warm direct eye contact with the lens",
  natural:
    "standing relaxed, shoulders back, natural upright posture, comfortable distance from the camera, warm direct eye contact with the lens",
  default:
    "Standing relaxed, natural posture, comfortable distance from the camera",
};

/** Valeurs POSE pour le template PEM (produit tenu en main) — [PRODUIT] et her/his résolus avant injection. */
export const UGC_PRESENTATION_HELD_POSE_VALUES: Record<UgcPresentationPose, string> = {
  forward:
    "leaning slightly forward as if she/he has just finished setting the camera down and is only beginning to straighten back up, body still close to the camera, weight shifting backward, a natural unguarded transitional moment. [PRODUIT] is held close to or against her/his face or body, not yet raised or actively presented, casual relaxed grip, warm candid glance toward the lens",
  natural:
    "standing relaxed, shoulders back, natural upright posture, comfortable distance from the camera, holding up [PRODUIT] and extending it toward the camera at arm's length, item positioned slightly closer to the lens than the face, creating subtle depth between subject and object, presenting the product clearly toward the camera, warm direct eye contact with the lens",
  default:
    "Standing relaxed, natural posture, comfortable distance from the camera, holding [PRODUIT] visibly in front of her/his body",
};

/** @deprecated Utiliser UGC_PRESENTATION_WORN_POSE_VALUES ou UGC_PRESENTATION_HELD_POSE_VALUES. */
export const UGC_PRESENTATION_POSE_VALUES = UGC_PRESENTATION_WORN_POSE_VALUES;

export const UGC_PRESENTATION_DEFAULT_PHYSIQUE =
  "natural, unremarkable build, no specific physical customization";

export const UGC_PRESENTATION_DEFAULT_AUTRE_TENUE =
  "a neutral, comfortable base outfit (soft beige or taupe knit cardigan or sweater)";

export const UGC_PRESENTATION_HELD_CADRAGE =
  "Medium shot, framed from roughly waist up, product held at chest height clearly visible in frame";

export const UGC_PRESENTATION_LOCATION_PRESETS: UgcPresentationLocationPreset[] = [
  { id: "closet-default", label: "Dressing luxe", promptValue: "" },
  { id: "bedroom", label: "Chambre", promptValue: "luxury master bedroom with soft natural light" },
  { id: "living", label: "Salon", promptValue: "elegant living room with warm ambient lighting" },
  { id: "boutique", label: "Boutique", promptValue: "upscale fashion boutique interior" },
  { id: "hotel", label: "Suite hôtel", promptValue: "luxury hotel suite with refined decor" },
  { id: "studio", label: "Studio photo", promptValue: "bright minimalist photo studio with softboxes" },
  { id: "kitchen", label: "Cuisine", promptValue: "modern high-end kitchen with marble countertops" },
  { id: "terrace", label: "Terrasse", promptValue: "sunlit rooftop terrace with city views" },
];

export function getUgcPresentationBodyZoneOption(
  zoneId: string | null | undefined,
): UgcPresentationBodyZoneOption | undefined {
  if (!zoneId) return undefined;
  return UGC_PRESENTATION_BODY_ZONE_OPTIONS.find((option) => option.id === zoneId);
}

export function getUgcPresentationHeroFocus(zoneId: string | null | undefined): string {
  return getUgcPresentationBodyZoneOption(zoneId)?.heroFocus ?? "";
}

export function needsFootwearLightingHighlight(bodyZone: string | null | undefined): boolean {
  return bodyZone === "feet" || bodyZone === "full-outfit";
}

export const UGC_PRESENTATION_CLOSET_SCENE_SETTING =
  "Subject centered in frame, standing in the middle of a luxury walk-in closet, symmetrical composition with matching wooden shelving units on both sides.";

export const UGC_PRESENTATION_CUSTOM_SCENE_SETTING =
  "Subject centered in frame, standing naturally in the setting described below.";

export const UGC_PRESENTATION_CLOSET_LIGHTING =
  "warm, soft ambient lighting from recessed ceiling spotlights and warm LED shelf lighting inside the closet cabinets, creating a cozy golden-toned glow (around 3000-3200K), gentle even illumination on the face and body, soft shadows, flattering catchlights in the eyes";

export const UGC_PRESENTATION_CUSTOM_LIGHTING =
  "warm, soft natural ambient lighting appropriate to the setting, gentle even illumination on the face and body, soft shadows, flattering catchlights in the eyes";

export function buildUgcPresentationClosetEnvironment(pronounObject: string): string {
  return `high-end walk-in closet / dressing room, custom wood-toned cabinetry (walnut or oak finish) on both sides filled with neatly organized designer handbags, folded clothing, and shoe displays lit with warm under-shelf LED strips, a large mirror centered in the background, a wood-paneled kitchen-island-style storage unit with a light marble/quartz top behind ${pronounObject}, hanging garment racks with clothes visible at the edges of the frame`;
}

export const UGC_PRESENTATION_CLOSET_STYLE_MOOD =
  'warm, aspirational, "boutique closet reveal" aesthetic, intimate yet polished, luxury lifestyle content style similar to closet-tour or outfit-reveal social media photos';

export const UGC_PRESENTATION_CUSTOM_STYLE_MOOD =
  "warm, aspirational, authentic lifestyle content style, intimate yet polished, natural social media photo aesthetic";

export type UgcPresentationLocationBlocks = {
  sceneSetting: string;
  lightingBlock: string;
  environmentBlock: string;
  styleMoodBlock: string;
};

export function resolveUgcPresentationLocationBlocks(
  location: string,
  pronounObject: string,
): UgcPresentationLocationBlocks {
  const trimmed = location.trim();
  if (!trimmed) {
    return {
      sceneSetting: UGC_PRESENTATION_CLOSET_SCENE_SETTING,
      lightingBlock: UGC_PRESENTATION_CLOSET_LIGHTING,
      environmentBlock: buildUgcPresentationClosetEnvironment(pronounObject),
      styleMoodBlock: UGC_PRESENTATION_CLOSET_STYLE_MOOD,
    };
  }

  return {
    sceneSetting: UGC_PRESENTATION_CUSTOM_SCENE_SETTING,
    lightingBlock: UGC_PRESENTATION_CUSTOM_LIGHTING,
    environmentBlock: trimmed,
    styleMoodBlock: UGC_PRESENTATION_CUSTOM_STYLE_MOOD,
  };
}
