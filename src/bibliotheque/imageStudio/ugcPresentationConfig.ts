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
      "Close-up to medium shot, framed from chest up, feet not relevant to composition",
  },
  {
    id: "wrist",
    label: "Poignet / main",
    cadrageZone:
      "Medium-close shot, framed from waist up, hands and wrists clearly visible and in focus",
  },
  {
    id: "upper",
    label: "Haut du corps",
    cadrageZone: "Medium shot, framed from waist up, feet and lower legs out of frame",
  },
  {
    id: "lower",
    label: "Bas du corps",
    cadrageZone:
      "Medium-long shot, framed from mid-thigh down to ankles, upper body partially visible, feet not necessarily in frame",
  },
  {
    id: "feet",
    label: "Pieds",
    cadrageZone:
      "Full body shot, framed from head to feet, entire outfit and shoes clearly visible in frame",
  },
  {
    id: "shoulder",
    label: "Porté à l'épaule / dos",
    cadrageZone:
      "Medium shot, framed from waist up, shoulder or back area clearly visible depending on carry style",
  },
  {
    id: "full-outfit",
    label: "Tenue complète",
    cadrageZone:
      "Full body shot, framed from head to feet, entire outfit clearly visible in frame",
  },
];

export const UGC_PRESENTATION_POSE_VALUES: Record<UgcPresentationPose, string> = {
  forward:
    "leaning slightly forward toward the camera from the waist, upper body tilted in, head slightly lowered and angled down toward the lens, close and intimate framing as if she/he is near the camera rather than posing at a distance, natural candid asymmetry in the shoulders, warm direct eye contact with the lens",
  natural:
    "standing relaxed, shoulders back, natural upright posture, comfortable distance from the camera, warm direct eye contact with the lens",
  default:
    "Standing relaxed, natural posture, comfortable distance from the camera",
};

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

export function needsFootwearLightingHighlight(bodyZone: string | null | undefined): boolean {
  return bodyZone === "feet" || bodyZone === "full-outfit";
}
