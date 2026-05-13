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
}

export type ProductMiseEnSceneId = "cinematique" | "facecam" | "situation" | "fondneutre";

export interface ProductMiseEnSceneDef {
  id: ProductMiseEnSceneId;
  label: string;
  notice: string;
  iconId: string;
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
  },
  {
    id: "productcrash",
    category: "stunt",
    name: "Product Crash",
    description: "Le produit tombe de haut et se détruit — chaos visuel immédiat",
    iconId: "TrendingDown",
  },
  {
    id: "blizzard",
    category: "stunt",
    name: "Blizzard",
    description: "Une tempête violente et impossible surgit dans la scène",
    iconId: "Snowflake",
  },
  {
    id: "camerabump",
    category: "stunt",
    name: "Camera Bump",
    description: "La caméra percute accidentellement quelqu'un — chaos immédiat",
    iconId: "Video",
  },
  {
    id: "productdodge",
    category: "stunt",
    name: "Product Dodge",
    description: "Un produit file vers le visage, la personne esquive et l'attrape",
    iconId: "Shuffle",
  },
  {
    id: "epicfail",
    category: "stunt",
    name: "Epic Fail",
    description: "Tentative ratée, chute spectaculaire — l'humour crée l'attention",
    iconId: "Frown",
  },
  {
    id: "spicy",
    category: "subtil",
    name: "Spicy",
    description:
      "Gros plan extrême sur une pommette ou un cou, recule lentement vers le produit",
    iconId: "Flame",
  },
  {
    id: "interview",
    category: "subtil",
    name: "Interview",
    description:
      "Intervieweur interroge un inconnu dans la rue — première réponse = pivot produit",
    iconId: "Mic2",
  },
  {
    id: "randommic",
    category: "subtil",
    name: "Random Object Mic",
    description: "Vlog banal — un objet absurde sort du champ et devient le micro",
    iconId: "CassetteTape",
  },
  {
    id: "revealent",
    category: "subtil",
    name: "Reveal lent",
    description: "Le produit est flou — la mise au point progressive crée l'attente",
    iconId: "Eye",
  },
];

export const PRODUCT_MISE_EN_SCENE: ProductMiseEnSceneDef[] = [
  {
    id: "cinematique",
    label: "Cinématique",
    notice: "Plan composé, lumière travaillée, ton sobre. Comme une pub de marque.",
    iconId: "Aperture",
  },
  {
    id: "facecam",
    label: "Face caméra",
    notice: "Quelqu'un parle directement à l'objectif, lumière naturelle, énergie spontanée.",
    iconId: "User",
  },
  {
    id: "situation",
    label: "En situation",
    notice: "Une scène se déroule — un personnage dans un contexte, une micro-histoire.",
    iconId: "GitBranch",
  },
  {
    id: "fondneutre",
    label: "Fond neutre",
    notice: "Sujet centré sur fond uni, lumière propre. Rien ne distrait du produit.",
    iconId: "PanelBottom",
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
    options: ["situation", "facecam"],
    defaultId: "situation",
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
  return `Hook d'accroche (3 premières secondes) : ${h.name} — ${h.description}`;
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
