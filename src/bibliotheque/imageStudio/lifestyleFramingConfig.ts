export type LifestyleFramingId = "serre" | "large";

export const LIFESTYLE_FRAMING_ELIGIBLE_SHOT_IDS = [
  "pov-debout",
  "produit-levitation",
  "produit-seul",
  "vue-dessus",
  "deux-mains",
] as const;

export type LifestyleFramingEligibleShotId = (typeof LIFESTYLE_FRAMING_ELIGIBLE_SHOT_IDS)[number];

export const LIFESTYLE_FRAMING_OPTIONS: Array<{ id: LifestyleFramingId; label: string; hint: string }> = [
  {
    id: "serre",
    label: "Cadrage serré",
    hint: "Produit dominant dans le cadre.",
  },
  {
    id: "large",
    label: "Cadrage large",
    hint: "Produit intégré dans la scène de vie.",
  },
];

export function isLifestyleFramingEligible(
  shotId: string | null | undefined,
): shotId is LifestyleFramingEligibleShotId {
  if (!shotId) return false;
  return (LIFESTYLE_FRAMING_ELIGIBLE_SHOT_IDS as readonly string[]).includes(shotId);
}

export const LIFESTYLE_COMPOSITION_BODY_CONTINUITY_FIXED = `Portrait orientation 9:16, product as the clear focal point of the frame, arm and hand entering from the bottom or side of frame in a way that logically connects to the visible body/lap/legs below, environment in soft bokeh behind.`;

export const LIFESTYLE_COMPOSITION_STANDALONE_FIXED = `Portrait orientation 9:16, product as the clear focal point of the frame, environment in soft bokeh behind.`;

const LIFESTYLE_LENS_SERRE = "85mm lens f/2.0";
const LIFESTYLE_LENS_LARGE_POV = "50mm lens f/4.0";
const LIFESTYLE_LENS_LARGE_SCENE = "35mm lens f/4.0";

const COMPOSITION_BY_SHOT_AND_FRAMING: Record<
  LifestyleFramingEligibleShotId,
  Record<LifestyleFramingId, string>
> = {
  "pov-debout": {
    serre:
      "Portrait orientation 9:16, product as the clear focal point occupying roughly 45–55% of the frame height, arm extended forward holding the product at shoulder height while walking, ground or path visible beneath the arm but softly blurred, shallow depth of field with tack-sharp focus on the product and label.",
    large:
      "Portrait orientation 9:16, wide contextual framing — the walking path and full lifestyle environment readable across the frame, product held naturally at shoulder height occupying roughly 15–20% of the frame height, deeper depth of field so the scene feels like a genuine in-context moment rather than a product hero shot, arm and product still clearly identifiable within the scene.",
  },
  "produit-levitation": {
    serre:
      "Portrait orientation 9:16, product as the clear focal point occupying roughly 45–55% of the frame height, captured mid-air with dynamic diagonal energy, environment in soft bokeh around the floating product, shallow depth of field with tack-sharp focus on the product.",
    large:
      "Portrait orientation 9:16, wide lifestyle scene — the product suspended mid-air occupies roughly 15–20% of the frame height within a fully readable environment, deeper depth of field revealing the surrounding décor, surfaces and lifestyle props, the floating moment feels integrated into the scene rather than isolated against blur.",
  },
  "produit-seul": {
    serre:
      "Portrait orientation 9:16, product as the clear focal point occupying roughly 45–55% of the frame height, 45-degree hero angle, clean isolated product focus with shallow depth of field, environment in soft bokeh behind.",
    large:
      "Portrait orientation 9:16, wide lifestyle scene — product resting naturally on a surface within the full environment, occupying roughly 15–20% of the frame height, surrounding décor and lifestyle props clearly visible with deeper depth of field, the product belongs to the scene rather than dominating it.",
  },
  "vue-dessus": {
    serre:
      "Portrait orientation 9:16, overhead bird's-eye composition with the product as the clear focal point at center, complementary lifestyle objects visible at the edges but softly blurred, shallow depth of field with tack-sharp focus on the product label and surface.",
    large:
      "Portrait orientation 9:16, wide overhead flat-lay — the full surface scene readable across the frame, product placed among complementary lifestyle objects occupying roughly 15–20% of the total scene area, deeper depth of field keeping both the product and surrounding context in gentle, natural focus.",
  },
  "deux-mains": {
    serre:
      "Portrait orientation 9:16, close mid-shot — both hands and the product interaction as the clear focal point, product occupying roughly 45–55% of the frame height, background softly blurred, shallow depth of field keeping hands, product and the opening action tack sharp.",
    large:
      "Portrait orientation 9:16, medium contextual framing — both hands and the opening/interaction action fully readable at chest height, product occupying roughly 30–40% of the frame height, enough of the lifestyle environment visible to situate the moment without losing the hand action, moderate depth of field keeping hands, product and immediate surroundings naturally sharp.",
  },
};

function resolveLargeLensLine(shotId: LifestyleFramingEligibleShotId): string {
  if (shotId === "pov-debout" || shotId === "deux-mains") {
    return LIFESTYLE_LENS_LARGE_POV;
  }
  return LIFESTYLE_LENS_LARGE_SCENE;
}

export function resolveLifestyleLensLine(
  shotId: string | null | undefined,
  framingId: LifestyleFramingId | null | undefined,
): string {
  if (isLifestyleFramingEligible(shotId) && framingId === "large") {
    return resolveLargeLensLine(shotId);
  }
  return LIFESTYLE_LENS_SERRE;
}

export function resolveLifestyleComposition(
  shotId: string | null | undefined,
  framingId: LifestyleFramingId | null | undefined,
  templateVariant: "body-continuity" | "standalone",
): string {
  if (isLifestyleFramingEligible(shotId)) {
    const framing = framingId === "large" ? "large" : "serre";
    return COMPOSITION_BY_SHOT_AND_FRAMING[shotId][framing];
  }

  return templateVariant === "body-continuity"
    ? LIFESTYLE_COMPOSITION_BODY_CONTINUITY_FIXED
    : LIFESTYLE_COMPOSITION_STANDALONE_FIXED;
}

export function getLifestyleFramingOptionLabel(framingId: LifestyleFramingId | string | null): string {
  return LIFESTYLE_FRAMING_OPTIONS.find((option) => option.id === framingId)?.label ?? "";
}
