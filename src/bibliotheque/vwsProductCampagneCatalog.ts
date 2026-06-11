/**
 * Données Campagne VWS — **uniquement** formats catégorie produit (étape 1).
 * Icônes : identifiants résolus en lucide-react dans les modales UI.
 */

export type ProductSceneDecorCategory = "realiste" | "insolite";

export interface ProductSceneDecorDef {
  id: string;
  category: ProductSceneDecorCategory;
  name: string;
  description: string;
  /** Clé résolue côté UI (lucide-react) */
  iconId: string;
}

export type ProductOpeningHookCategory = "stunt" | "subtil";

export interface ProductOpeningHookDef {
  id: string;
  category: ProductOpeningHookCategory;
  name: string;
  description: string;
  iconId: string;
  /** Variante "Veo3-safe" utilisée uniquement dans le prompt vidéo (fallback = description). */
  video_hook_description?: string;
  frame0_directives: string[];
  frame0_negatives: string[];
  product_visibility_at_t0: "not_held" | "in_air" | "hidden" | "held" | "destroyed" | "offscreen";
  requires_character: boolean;
  camera_energy: "stable" | "bump" | "chaotic" | "slow";
}

export type ProductMiseEnSceneId =
  | "cinematique"
  | "facecam"
  | "situation"
  | "fondneutre"
  | "mains_produit";

export interface ProductMiseEnSceneDef {
  id: ProductMiseEnSceneId;
  label: string;
  notice: string;
  iconId: string;
  frame0_directives: string[];
  character_prominence: "primary" | "secondary" | "none";
  background_style: "neutral" | "real_context" | "cinematic";
}

export const PRODUCT_SCENE_DECORS: ProductSceneDecorDef[] = [
  {
    id: "studio",
    category: "realiste",
    name: "Studio / Fond uni",
    description: "Fond neutre, éclairage contrôlé, zéro distraction",
    iconId: "Scan",
  },
  {
    id: "domicile",
    category: "realiste",
    name: "Domicile",
    description: "Chambre, salon. Lumière naturelle, ambiance privée",
    iconId: "Home",
  },
  {
    id: "nature",
    category: "realiste",
    name: "Nature",
    description: "Forêt, plage, jardin. Lumière naturelle et organique",
    iconId: "Trees",
  },
  {
    id: "rue",
    category: "realiste",
    name: "Rue / Urbain",
    description: "Trottoir, rue animée, selfie en marchant en ville",
    iconId: "MapPin",
  },
  {
    id: "gym",
    category: "realiste",
    name: "Gym",
    description: "Salle de sport, vestiaire, après-entraînement",
    iconId: "Dumbbell",
  },
  {
    id: "bureau",
    category: "realiste",
    name: "Bureau",
    description: "Desk, laptop ouvert, lumière propre et moderne",
    iconId: "Briefcase",
  },
  {
    id: "voiture",
    category: "realiste",
    name: "Voiture",
    description: "Intérieur, siège conducteur ou passager, fenêtre",
    iconId: "Car",
  },
  {
    id: "cuisine",
    category: "realiste",
    name: "Cuisine",
    description: "Plan de travail, lumière naturelle, ambiance home",
    iconId: "ChefHat",
  },
  {
    id: "rooftop",
    category: "insolite",
    name: "Toit d'immeuble",
    description: "Bord d'un gratte-ciel, skyline de ville derrière",
    iconId: "Building2",
  },
  {
    id: "desert",
    category: "insolite",
    name: "Désert / Dunes",
    description: "Horizon désertique, golden hour, chaleur qui ondule",
    iconId: "Sun",
  },
  {
    id: "volcan",
    category: "insolite",
    name: "Bord de volcan",
    description: "Lave en arrière-plan, vapeur, rouge incandescent",
    iconId: "Flame",
  },
  {
    id: "train",
    category: "insolite",
    name: "Wagon de train",
    description: "Paysage qui défile à grande vitesse derrière la vitre",
    iconId: "Train",
  },
];

export const PRODUCT_OPENING_HOOKS: ProductOpeningHookDef[] = [
  {
    id: "producthit",
    category: "stunt",
    name: "Product Hit",
    description:
      "L'objet vole dans le cadre et frappe le sujet. Réaction brève → pivot produit",
    iconId: "Zap",
    frame0_directives: [
      "subject alert, motionless, hands empty",
      "peripheral shadow or blur at frame edge suggesting incoming object",
      "no reaction yet — pure anticipation",
    ],
    frame0_negatives: ["product held in hand", "subject already reacting", "surprised expression"],
    product_visibility_at_t0: "offscreen",
    requires_character: true,
    camera_energy: "stable",
  },
  {
    id: "productcrash",
    category: "stunt",
    name: "Product Crash",
    description: "Le produit tombe de haut et se détruit — chaos visuel immédiat",
    iconId: "TrendingDown",
    video_hook_description: "Le produit glisse ou est mal posé — il tombe au sol, impact net, réaction brève.",
    frame0_directives: [
      "subject facing camera, neutral expression, unaware of what is about to happen",
      "product out of frame or barely visible above, intact",
      "calm scene, tension only suggested by composition",
    ],
    frame0_negatives: ["broken product", "debris visible", "product already falling", "chaos in frame"],
    product_visibility_at_t0: "offscreen",
    requires_character: false,
    camera_energy: "chaotic",
  },
  {
    id: "blizzard",
    category: "stunt",
    name: "Blizzard",
    description: "Une tempête violente et impossible surgit dans la scène",
    iconId: "Snowflake",
    video_hook_description:
      "Un courant d'air soudain fait voler des objets légers, rideaux, feuilles ou papiers bougent, le sujet se retourne.",
    frame0_directives: [
      "calm scene, normal atmosphere",
      "subtle environmental hints: slightly dark sky, a few leaves or dust particles",
      "subject in normal state, perhaps starting to notice something is off",
    ],
    frame0_negatives: ["storm already visible", "violent elements in frame", "subject already overwhelmed"],
    product_visibility_at_t0: "offscreen",
    requires_character: true,
    camera_energy: "chaotic",
  },
  {
    id: "camerabump",
    category: "stunt",
    name: "Camera Bump",
    description: "La caméra percute accidentellement quelqu'un — chaos immédiat",
    iconId: "Video",
    video_hook_description:
      "Caméra portée trop proche — quelqu'un frôle le cadre, léger à-coup, cadrage se décale un instant.",
    frame0_directives: [
      "slight handheld instability, not yet a shock",
      "obstacle or person entering frame at the edge",
      "collision has not happened yet",
    ],
    frame0_negatives: ["motion blur from impact", "collision already happened", "perfectly stable framing"],
    product_visibility_at_t0: "held",
    requires_character: true,
    camera_energy: "bump",
  },
  {
    id: "productdodge",
    category: "stunt",
    name: "Product Dodge",
    description: "Un produit file vers le visage, la personne esquive et l'attrape",
    iconId: "Shuffle",
    frame0_directives: ["object flying toward subject's face", "subject in evasive motion", "hands completely free and open"],
    frame0_negatives: ["product held in hand at frame 0", "subject standing still"],
    product_visibility_at_t0: "offscreen",
    requires_character: true,
    camera_energy: "stable",
  },
  {
    id: "epicfail",
    category: "stunt",
    name: "Epic Fail",
    description: "Tentative ratée, chute spectaculaire — l'humour crée l'attention",
    iconId: "Frown",
    video_hook_description:
      "Le sujet tente un geste simple mais maladroit — il rate, petite gaffe visible, moment gênant mais réaliste.",
    frame0_directives: [
      "subject in overconfident pose, about to attempt something",
      "precarious balance or awkward grip suggesting imminent failure",
      "product poorly held or in unstable position",
    ],
    frame0_negatives: ["fall already in progress", "failed gesture already visible", "subject on the ground"],
    product_visibility_at_t0: "held",
    requires_character: true,
    camera_energy: "stable",
  },
  {
    id: "spicy",
    category: "subtil",
    name: "Spicy",
    description:
      "Gros plan extrême sur une pommette ou un cou, recule lentement vers le produit",
    iconId: "Flame",
    frame0_directives: [
      "extreme static close-up on cheek or neck",
      "skin texture and soft light fill the frame",
      "no product visible, no movement suggested",
    ],
    frame0_negatives: ["wide shot", "product visible", "full face visible", "camera movement suggested"],
    product_visibility_at_t0: "offscreen",
    requires_character: true,
    camera_energy: "slow",
  },
  {
    id: "interview",
    category: "subtil",
    name: "Interview",
    description:
      "Intervieweur interroge un inconnu dans la rue — première réponse = pivot produit",
    iconId: "Mic2",
    frame0_directives: [
      "vlog-style street setting",
      "subject seen from behind or three-quarter profile",
      "interviewer or microphone already at close distance, static",
      "interaction about to begin, no movement",
    ],
    frame0_negatives: ["product visible at frame 0", "subject facing camera directly", "interviewer approaching in motion"],
    product_visibility_at_t0: "offscreen",
    requires_character: true,
    camera_energy: "stable",
  },
  {
    id: "randommic",
    category: "subtil",
    name: "Random Object Mic",
    description: "Vlog banal — un objet absurde sort du champ et devient le micro",
    iconId: "CassetteTape",
    frame0_directives: [
      "mundane object held like a microphone",
      "subject ready to speak — mouth closed, anticipatory expression",
      "absurd energy conveyed through pose and expression alone",
    ],
    frame0_negatives: ["subject already speaking", "mouth open", "product visible"],
    product_visibility_at_t0: "offscreen",
    requires_character: true,
    camera_energy: "stable",
  },
  {
    id: "revealent",
    category: "subtil",
    name: "Reveal lent",
    description: "Le produit est flou — la mise au point progressive crée l'attente",
    iconId: "Eye",
    frame0_directives: [
      "product intentionally blurred or partially obscured at frame 0",
      "soft progressive focus pull implied",
      "anticipation atmosphere",
    ],
    frame0_negatives: ["product sharp and clearly visible", "product in focus"],
    product_visibility_at_t0: "hidden",
    requires_character: false,
    camera_energy: "slow",
  },
];

export const PRODUCT_MISE_EN_SCENE: ProductMiseEnSceneDef[] = [
  {
    id: "cinematique",
    label: "Cinématique",
    notice: "Plan composé, lumière travaillée, ton sobre. Comme une pub de marque.",
    iconId: "Aperture",
    frame0_directives: [
      "composed cinematic shot",
      "carefully worked lighting",
      "brand advertisement tone",
      "luxury commercial photography",
      "studio lighting setup",
      "professional ad production quality",
    ],
    character_prominence: "secondary",
    background_style: "cinematic",
  },
  {
    id: "facecam",
    label: "Face caméra",
    notice: "Quelqu'un parle directement à l'objectif, lumière naturelle, énergie spontanée.",
    iconId: "User",
    frame0_directives: [
      "character directly facing lens",
      "eye contact with camera",
      "natural light",
      "spontaneous energy",
      "casual UGC smartphone style",
      "no studio lighting whatsoever",
      "authentic creator content",
      "ordinary everyday lighting",
    ],
    character_prominence: "primary",
    background_style: "real_context",
  },
  {
    id: "situation",
    label: "En situation",
    notice: "Une scène se déroule — un personnage dans un contexte, une micro-histoire.",
    iconId: "GitBranch",
    frame0_directives: [
      "character in real-life context",
      "micro-story unfolding naturally",
      "environment fully integrated",
    ],
    character_prominence: "primary",
    background_style: "real_context",
  },
  {
    id: "fondneutre",
    label: "Fond neutre",
    notice: "Sujet centré sur fond uni, lumière propre. Rien ne distrait du produit.",
    iconId: "PanelBottom",
    frame0_directives: ["centered subject on clean neutral background", "nothing distracts from product"],
    character_prominence: "none",
    background_style: "neutral",
  },
  {
    id: "mains_produit",
    label: "Produit en mains",
    notice: "Gros plan mains et produit, sans visage. Lumière naturelle, feel lifestyle authentique.",
    iconId: "Hand",
    frame0_directives: [
      "product held in hands",
      "hands and wrists only visible in frame",
      "no face visible",
      "extreme close-up on product and hands",
      "natural ambient lighting",
      "authentic lifestyle product feel",
      "no studio setup",
    ],
    character_prominence: "secondary",
    background_style: "real_context",
  },
];

/** Ids catalogue réels `vwsVideoFormatsCatalog` → options + défaut mise en scène */
const PRODUCT_MISE_MATRIX: Record<string, { options: ProductMiseEnSceneId[]; defaultId: ProductMiseEnSceneId }> = {
  produit_pub_esthetique: {
    options: ["cinematique", "situation", "fondneutre"],
    defaultId: "cinematique",
  },
  produit_demo: {
    options: ["facecam", "situation", "fondneutre"],
    defaultId: "facecam",
  },
  produit_unboxing: {
    options: ["facecam", "mains_produit", "cinematique"],
    defaultId: "mains_produit",
  },
  produit_test_review: {
    options: ["facecam", "situation"],
    defaultId: "facecam",
  },
  produit_comparatif: {
    options: ["facecam", "fondneutre"],
    defaultId: "facecam",
  },
  produit_focus_detail: {
    options: ["cinematique", "fondneutre"],
    defaultId: "cinematique",
  },
  produit_preuve_performance: {
    options: ["cinematique", "situation"],
    defaultId: "cinematique",
  },
  produit_reveal: {
    options: ["cinematique", "situation", "fondneutre"],
    defaultId: "cinematique",
  },
};

const LEGACY_STAGING_TO_MISE: Partial<Record<string, ProductMiseEnSceneId>> = {
  situation_reelle: "situation",
  avant_apres: "situation",
  test_direct: "facecam",
  temoignage: "facecam",
};

export function getProductDecorById(id: string | null | undefined): ProductSceneDecorDef | undefined {
  if (!id) return undefined;
  return PRODUCT_SCENE_DECORS.find((d) => d.id === id);
}

export function getProductHookById(id: string | null | undefined): ProductOpeningHookDef | undefined {
  if (!id) return undefined;
  return PRODUCT_OPENING_HOOKS.find((h) => h.id === id);
}

export function getProductMiseDef(id: string | null | undefined): ProductMiseEnSceneDef | undefined {
  if (!id) return undefined;
  return PRODUCT_MISE_EN_SCENE.find((m) => m.id === id);
}

export function getProductMiseOptionsForFormat(formatId: string | null | undefined): ProductMiseEnSceneDef[] {
  const row = formatId ? PRODUCT_MISE_MATRIX[formatId] : undefined;
  const ids = row?.options ?? PRODUCT_MISE_MATRIX.produit_pub_esthetique.options;
  return ids
    .map((mid) => PRODUCT_MISE_EN_SCENE.find((m) => m.id === mid))
    .filter((m): m is ProductMiseEnSceneDef => Boolean(m));
}

export function getProductMiseDefaultForFormat(formatId: string | null | undefined): ProductMiseEnSceneId {
  const row = formatId ? PRODUCT_MISE_MATRIX[formatId] : undefined;
  return row?.defaultId ?? "cinematique";
}

export function getDialogueDefaultForMiseId(miseId: string | null | undefined): boolean {
  return miseId === "facecam";
}

/**
 * Retourne un tableau d'au plus un id de mise en scène valide pour ce format.
 * Migre les anciens chips produit (situation_reelle, …) si possible.
 */
export function normalizeProductStagingChipsForFormat(
  formatId: string | null | undefined,
  chips: string[] | null | undefined
): ProductMiseEnSceneId[] {
  const allowed = new Set(
    (formatId ? PRODUCT_MISE_MATRIX[formatId]?.options : null) ??
      PRODUCT_MISE_MATRIX.produit_pub_esthetique.options
  );
  const list = Array.isArray(chips) ? chips : [];
  const allowedIds = [...allowed];

  for (const raw of list) {
    if (allowed.has(raw as ProductMiseEnSceneId)) {
      return [raw as ProductMiseEnSceneId];
    }
    const mapped = LEGACY_STAGING_TO_MISE[raw];
    if (mapped && allowed.has(mapped)) {
      return [mapped];
    }
  }

  return [getProductMiseDefaultForFormat(formatId)];
}

export function decorCategoryLabelFr(cat: ProductSceneDecorCategory): string {
  return cat === "realiste" ? "Réaliste" : "Insolite";
}

export function hookCategoryLabelFr(cat: ProductOpeningHookCategory): string {
  return cat === "stunt" ? "Stunt" : "Subtil";
}

/**
 * Phrase « lieu / décor » pour prompts (produit). Pas de décor = neutre générique.
 */
export function buildProductSceneDecorSentence(decorId: string | null | undefined): string {
  const d = getProductDecorById(decorId);
  if (!d) {
    return "Décor de la scène : non spécifié — rester cohérent avec la promesse et le format.";
  }
  return `Décor de la scène : ${d.name}. ${d.description}.`;
}

export function buildProductOpeningHookSentence(hookId: string | null | undefined): string | null {
  const h = getProductHookById(hookId);
  if (!h) return null;
  const desc = h.video_hook_description ?? h.description;
  return `Hook d'accroche (3 premières secondes) : ${h.name} — ${desc}`;
}

/**
 * Dérive `location_type` spec depuis le décor produit (best-effort).
 */
export function locationTypeFromProductDecor(
  decorId: string | null | undefined
): "chez_client" | "etablissement" | "neutre" {
  if (!decorId) return "neutre";
  if (decorId === "domicile" || decorId === "cuisine") return "chez_client";
  if (decorId === "bureau" || decorId === "gym" || decorId === "studio") return "etablissement";
  return "neutre";
}
