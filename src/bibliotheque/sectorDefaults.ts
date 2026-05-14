import {
  getDialogueDefaultForMiseId,
  normalizeProductStagingChipsForFormat,
  PRODUCT_SCENE_DECORS,
} from "@/bibliotheque/vwsProductCampagneCatalog";
import { getFormatById } from "@/bibliotheque/vwsVideoFormatsCatalog";

export const SECTORS = [
  { id: "artisan_btp", icon: "🔧", label: "Artisan / BTP" },
  { id: "restauration", icon: "🍽️", label: "Restauration" },
  { id: "commerce", icon: "🛍️", label: "Commerce / Retail" },
  { id: "sante_beaute", icon: "💆", label: "Santé / Beauté" },
  { id: "immobilier", icon: "🏠", label: "Immobilier" },
  { id: "services", icon: "💼", label: "Services / Conseil" },
  { id: "sport", icon: "🏋️", label: "Sport / Fitness" },
  { id: "education", icon: "🎓", label: "Éducation / Formation" },
] as const;

export type SectorId = (typeof SECTORS)[number]["id"];

export type SectorMiseKey = "en_situation" | "face_camera";

export interface SectorDefaultBundle {
  decors: string[];
  duree: "courte" | "longue";
  mise_en_scene: SectorMiseKey;
  placeholder_promesse: string;
  hooks: string[];
}

export const SECTOR_DEFAULTS: Record<SectorId, SectorDefaultBundle> = {
  artisan_btp: {
    decors: ["Atelier", "Chantier", "Bureau client", "Extérieur"],
    duree: "courte",
    mise_en_scene: "en_situation",
    placeholder_promesse: "Ex : électricien qui démontre une installation rapide et propre.",
    hooks: [
      "Tu savais qu'on peut faire ça en moins d'une heure ?",
      "Voici pourquoi 80% des gens font cette erreur chez eux.",
      "Avant / après : le résultat va te surprendre.",
    ],
  },
  restauration: {
    decors: ["Cuisine ouverte", "Salle du restaurant", "Comptoir", "Terrasse"],
    duree: "courte",
    mise_en_scene: "en_situation",
    placeholder_promesse: "Ex : chef qui prépare en live la spécialité de la maison.",
    hooks: [
      "Le plat que tout le monde nous réclame depuis 3 ans.",
      "Ce que personne ne voit en cuisine — jusqu'à aujourd'hui.",
      "On a testé cette recette 47 fois avant de la mettre à la carte.",
    ],
  },
  commerce: {
    decors: ["Boutique", "Vitrine", "Arrière-boutique", "Extérieur magasin"],
    duree: "courte",
    mise_en_scene: "face_camera",
    placeholder_promesse: "Ex : gérante présente les nouveautés de la semaine en boutique.",
    hooks: [
      "On vient de recevoir quelque chose que vous attendiez.",
      "3 pièces qu'on va vendre en 48h — les voilà.",
      "Ce que les clients nous demandent en ce moment.",
    ],
  },
  sante_beaute: {
    decors: ["Cabinet", "Salon", "Espace soin", "Extérieur"],
    duree: "courte",
    mise_en_scene: "face_camera",
    placeholder_promesse: "Ex : esthéticienne présente un soin en avant/après.",
    hooks: [
      "Ce soin change vraiment la peau — on vous montre.",
      "Pourquoi vous avez besoin de ça cet automne.",
      "Résultat en 1 séance — vous allez être surpris.",
    ],
  },
  immobilier: {
    decors: ["Appartement", "Maison", "Bureau agence", "Extérieur bien"],
    duree: "longue",
    mise_en_scene: "en_situation",
    placeholder_promesse: "Ex : agent immobilier présente un bien avec ses points forts.",
    hooks: [
      "Ce bien ne sera plus disponible d'ici 72h.",
      "Visite exclusive : ce que les photos ne montrent pas.",
      "On vous explique pourquoi ce quartier monte en ce moment.",
    ],
  },
  services: {
    decors: ["Bureau", "Open space", "Extérieur", "Salle de réunion"],
    duree: "courte",
    mise_en_scene: "face_camera",
    placeholder_promesse: "Ex : consultant explique la valeur de son service en 30 secondes.",
    hooks: [
      "Le problème que tous mes clients avaient avant de me contacter.",
      "Ce que personne ne vous dit sur ce sujet.",
      "En 3 ans, voici ce que j'ai appris en aidant des dizaines d'entreprises.",
    ],
  },
  sport: {
    decors: ["Salle de sport", "Extérieur", "Studio", "Terrain"],
    duree: "courte",
    mise_en_scene: "en_situation",
    placeholder_promesse: "Ex : coach démontre un exercice efficace avec explication.",
    hooks: [
      "L'erreur que font 9 personnes sur 10 à la salle.",
      "Ce mouvement change tout — et personne ne le fait.",
      "Résultat en 30 jours si tu fais ça tous les matins.",
    ],
  },
  education: {
    decors: ["Salle de cours", "Bureau", "Extérieur", "Studio"],
    duree: "longue",
    mise_en_scene: "face_camera",
    placeholder_promesse: "Ex : formateur partage une astuce concrète applicable immédiatement.",
    hooks: [
      "Ce que j'aurais aimé savoir quand j'ai commencé.",
      "En 60 secondes : la méthode que mes élèves utilisent.",
      "Pourquoi cette compétence va valoir de l'or dans 2 ans.",
    ],
  },
};

/** Ids `PRODUCT_SCENE_DECORS` en tête de liste modale, ordre = priorité (aligné sémantiquement sur `decors`). */
export const SECTOR_DECOR_PRIORITY_IDS: Record<SectorId, string[]> = {
  artisan_btp: ["bureau", "rue", "studio", "nature"],
  restauration: ["cuisine", "domicile", "bureau", "rue"],
  commerce: ["rue", "bureau", "studio", "domicile"],
  sante_beaute: ["domicile", "studio", "bureau", "nature"],
  immobilier: ["domicile", "bureau", "rue", "nature"],
  services: ["bureau", "domicile", "rue", "nature"],
  sport: ["gym", "nature", "studio", "rue"],
  education: ["bureau", "domicile", "studio", "nature"],
};

/** Hook catalogue produit par défaut (catégorie souvent subtil). */
export const SECTOR_DEFAULT_PRODUCT_HOOK_ID: Record<SectorId, string> = {
  artisan_btp: "revealent",
  restauration: "interview",
  commerce: "interview",
  sante_beaute: "revealent",
  immobilier: "revealent",
  services: "interview",
  sport: "spicy",
  education: "randommic",
};

/** Format produit par défaut pour appliquer décor / hook / mise (options facecam + situation). */
export const DEFAULT_PRODUCT_VIDEO_FORMAT_FOR_SECTOR_PREFILL = "produit_demo" as const;

const KNOWN_SECTOR_IDS = new Set<string>(SECTORS.map((s) => s.id));

export function isKnownSectorId(id: string | null | undefined): id is SectorId {
  return typeof id === "string" && KNOWN_SECTOR_IDS.has(id);
}

export function getSectorLabelForDisplay(secteur: string): string {
  if (isKnownSectorId(secteur)) {
    const row = SECTORS.find((s) => s.id === secteur);
    return row ? `${row.icon} ${row.label}` : secteur;
  }
  return secteur.trim() || "Secteur personnalisé";
}

export function getSectorDefaults(secteur: string | null | undefined): SectorDefaultBundle | null {
  if (!secteur || !isKnownSectorId(secteur)) return null;
  return SECTOR_DEFAULTS[secteur] ?? null;
}

export function getProductPromessePlaceholderForSecteur(secteur: string | null | undefined): string {
  const d = getSectorDefaults(secteur);
  if (d?.placeholder_promesse) return d.placeholder_promesse;
  return "Ce que ça résout ou apporte en une phrase…";
}

function miseKeyToChip(mise: SectorMiseKey): "situation" | "facecam" {
  return mise === "face_camera" ? "facecam" : "situation";
}

function firstValidDecorId(priorityIds: string[]): string | null {
  const valid = new Set(PRODUCT_SCENE_DECORS.map((d) => d.id));
  for (const id of priorityIds) {
    if (valid.has(id)) return id;
  }
  return null;
}

export type LegacyCampaignPatch = Record<string, unknown>;

/**
 * Patch « legacy » fusionné via `applyLegacyCampaignPatchToSpec` pour préremplir l’étape 1.
 * Si `videoFormatId` est fourni et n’est pas un format produit, seuls `sequenceType` / `styleDetails` sont posés quand pertinent.
 */
export function buildLegacyCampaignPatchFromSecteur(
  secteur: string | null | undefined,
  videoFormatId?: string | null
): LegacyCampaignPatch {
  if (!secteur?.trim()) return {};

  const defaults = getSectorDefaults(secteur);
  const sequenceType = defaults?.duree === "longue" ? "three_x_8s" : "single_8s";

  const hooksBlock =
    defaults?.hooks?.length ?
      `Idées d'accroche (modifiable) :\n${defaults.hooks.map((h) => `- ${h}`).join("\n")}`
    : "";

  const formatId =
    videoFormatId && String(videoFormatId).trim() ?
      String(videoFormatId).trim()
    : DEFAULT_PRODUCT_VIDEO_FORMAT_FOR_SECTOR_PREFILL;

  const formatDef = getFormatById(formatId);
  const isProduct = formatDef?.categoryId === "produit";

  const patch: LegacyCampaignPatch = {
    sequenceType,
  };

  if (hooksBlock) {
    patch.styleDetails = hooksBlock;
  }

  if (!isProduct || !defaults) {
    return patch;
  }

  const miseChip = miseKeyToChip(defaults.mise_en_scene);
  const stagingChips = normalizeProductStagingChipsForFormat(formatId, [miseChip]);
  const decorId =
    isKnownSectorId(secteur) ? firstValidDecorId(SECTOR_DECOR_PRIORITY_IDS[secteur]) : null;
  const hookId = isKnownSectorId(secteur) ? SECTOR_DEFAULT_PRODUCT_HOOK_ID[secteur] : "revealent";

  patch.videoFormatId = formatId;
  patch.stagingChips = stagingChips;
  patch.dialogueEnabled = getDialogueDefaultForMiseId(stagingChips[0]);
  if (decorId) patch.productSceneDecorId = decorId;
  if (hookId) patch.productOpeningHookId = hookId;

  return patch;
}

export function getDecorPriorityIdsForSecteur(secteur: string | null | undefined): string[] {
  if (!secteur || !isKnownSectorId(secteur)) return [];
  return [...SECTOR_DECOR_PRIORITY_IDS[secteur]];
}
