export type PackshotPositionId =
  | "debout-droit"
  | "debout-incline"
  | "allonge"
  | "levitation";

export type PackshotBackgroundId = "environnement" | "neutre";

export type PackshotAmbianceId =
  | "artisanal-cosy"
  | "spa-bien-etre"
  | "gourmand-frais"
  | "tech-minimal"
  | "autre";

export type PackshotInteractionId =
  | "aucun"
  | "eclaboussure"
  | "elements-volants"
  | "matiere-englobante"
  | "fumee-vapeur";

export type PackshotProductStateId = "ferme-neuf" | "ouvert-entame";

export type PackshotFormatId = "carre-1-1" | "story-9-16" | "banniere-4-5";

export type PackshotButtonOption<T extends string = string> = {
  id: T;
  label: string;
};

export const PACKSHOT_POSITION_OPTIONS: PackshotButtonOption<PackshotPositionId>[] = [
  { id: "debout-droit", label: "Debout droit" },
  { id: "debout-incline", label: "Debout incliné" },
  { id: "allonge", label: "Allongé" },
  { id: "levitation", label: "En lévitation" },
];

export const PACKSHOT_BACKGROUND_OPTIONS: PackshotButtonOption<PackshotBackgroundId>[] = [
  { id: "environnement", label: "Environnement thématique" },
  { id: "neutre", label: "Fond neutre" },
];

export const PACKSHOT_AMBIANCE_OPTIONS: PackshotButtonOption<PackshotAmbianceId>[] = [
  { id: "artisanal-cosy", label: "Artisanal-cosy" },
  { id: "spa-bien-etre", label: "Spa-bien-être" },
  { id: "gourmand-frais", label: "Gourmand-frais" },
  { id: "tech-minimal", label: "Tech-minimal" },
  { id: "autre", label: "Autre" },
];

export const PACKSHOT_INTERACTION_OPTIONS: PackshotButtonOption<PackshotInteractionId>[] = [
  { id: "aucun", label: "Aucun" },
  { id: "eclaboussure", label: "Éclaboussure liquide" },
  { id: "elements-volants", label: "Éléments volants" },
  { id: "matiere-englobante", label: "Matière englobante" },
  { id: "fumee-vapeur", label: "Fumée-vapeur" },
];

export const PACKSHOT_STATE_OPTIONS: PackshotButtonOption<PackshotProductStateId>[] = [
  { id: "ferme-neuf", label: "Fermé-neuf" },
  { id: "ouvert-entame", label: "Ouvert-entamé" },
];

export const PACKSHOT_FORMAT_OPTIONS: PackshotButtonOption<PackshotFormatId>[] = [
  { id: "carre-1-1", label: "Post carré (1:1)" },
  { id: "story-9-16", label: "Story-Reel (9:16)" },
  { id: "banniere-4-5", label: "Bannière-pub (4:5)" },
];

export const PACKSHOT_HERO_IMAGE =
  "/image-studio/templates/packshot-dynamique/packshot-dynamique.png";

export type PackshotAmbianceProfile = {
  ambianceLabel: string;
  decorElements: string;
  fondAmbiance: string;
  paletteCouleurs: string;
  styleEditorial: string;
  temperatureCouleur: string;
  planPremier: string;
  planArriere: string;
  surfaceType: string;
  elementAppui: string;
};

export const PACKSHOT_AMBIANCE_PROFILES: Record<
  Exclude<PackshotAmbianceId, "autre">,
  PackshotAmbianceProfile
> = {
  "artisanal-cosy": {
    ambianceLabel: "artisanale et chaleureuse",
    decorElements:
      "branches de lavande séchée, bois flotté texturé, lin naturel drapé en arrière-plan",
    fondAmbiance: "bois vieilli et tons terreux doux",
    paletteCouleurs: "ambre, brun chaud, beige lin, gris doux",
    styleEditorial: "artisanal premium",
    temperatureCouleur: "chaude (2700-3200K)",
    planPremier: "bois flotté flou",
    planArriere: "lin et éléments naturels en bokeh doux",
    surfaceType: "planche de bois rustique patinée",
    elementAppui: "un morceau de bois flotté texturé",
  },
  "spa-bien-etre": {
    ambianceLabel: "spa apaisante et épurée",
    decorElements:
      "galets lisses, bambou, eucalyptus frais, serviettes en lin blanc en arrière-plan flou",
    fondAmbiance: "pierre claire et végétation douce",
    paletteCouleurs: "blanc cassé, vert sauge, gris pierre, touches d'eucalyptus",
    styleEditorial: "wellness premium",
    temperatureCouleur: "neutre froide (6000-6500K)",
    planPremier: "galets et feuillage flous",
    planArriere: "végétation spa en bokeh doux",
    surfaceType: "dalles de pierre claire mate",
    elementAppui: "un galet lisse naturel",
  },
  "gourmand-frais": {
    ambianceLabel: "gourmande et fraîche",
    decorElements:
      "fruits frais tranchés, herbes aromatiques, touches de marbre clair en arrière-plan flou",
    fondAmbiance: "marbre clair et ingrédients frais",
    paletteCouleurs: "couleurs vives des fruits, blanc marbre, verts frais",
    styleEditorial: "food styling commercial",
    temperatureCouleur: "neutre jour (5000-5600K)",
    planPremier: "ingrédients frais flous",
    planArriere: "marbre et herbes en bokeh léger",
    surfaceType: "plateau en marbre clair",
    elementAppui: "un fruit entier ou un élément de mise en scène gourmand",
  },
  "tech-minimal": {
    ambianceLabel: "tech minimaliste et précise",
    decorElements:
      "lignes géométriques épurées, reflets métalliques brossés discrets, espace négatif structuré",
    fondAmbiance: "dégradé gris clair à anthracite",
    paletteCouleurs: "gris anthracite, argent brossé, blanc pur, accents froids",
    styleEditorial: "tech premium",
    temperatureCouleur: "froide (7000K+)",
    planPremier: "reflets géométriques flous",
    planArriere: "dégradé neutre structuré en bokeh doux",
    surfaceType: "surface mate gris clair",
    elementAppui: "un socle minimal en métal brossé",
  },
};

export const PACKSHOT_NEUTRAL_PROFILE: PackshotAmbianceProfile = {
  ambianceLabel: "studio neutre et commercial",
  decorElements: "",
  fondAmbiance: "fond uni propre",
  paletteCouleurs: "tons neutres harmonisés au produit",
  styleEditorial: "commercial studio",
  temperatureCouleur: "neutre chaude (3500-4000K)",
  planPremier: "surface de contact légèrement floue",
  planArriere: "fond uni en dégradé doux",
  surfaceType: "surface studio mate",
  elementAppui: "un support discret",
};

export type PackshotMaterialHints = {
  matiereProduit: string;
  qualiteReflets: string;
  temperatureOverride?: string;
};

const MATERIAL_RULES: Array<{
  pattern: RegExp;
  matiereProduit: string;
  qualiteReflets: string;
}> = [
  {
    pattern: /\b(verre|glass|cristal|crystal)\b/i,
    matiereProduit: "verre",
    qualiteReflets: "nets et contrastés",
  },
  {
    pattern: /\b(métal|metal|aluminium|aluminum|acier|steel|chrome)\b/i,
    matiereProduit: "métal poli",
    qualiteReflets: "nets et contrastés",
  },
  {
    pattern: /\b(plastique brillant|glossy plastic|acrylique|acrylic)\b/i,
    matiereProduit: "plastique brillant",
    qualiteReflets: "nets et contrastés",
  },
  {
    pattern: /\b(plastique|plastic|mat)\b/i,
    matiereProduit: "plastique mat",
    qualiteReflets: "doux et diffus",
  },
  {
    pattern: /\b(céramique|ceramic|porcelaine|porcelain)\b/i,
    matiereProduit: "céramique",
    qualiteReflets: "doux et diffus",
  },
  {
    pattern: /\b(carton|kraft|paper|papier)\b/i,
    matiereProduit: "carton kraft",
    qualiteReflets: "quasi absents",
  },
  {
    pattern: /\b(bois|wood)\b/i,
    matiereProduit: "bois brut",
    qualiteReflets: "quasi absents",
  },
  {
    pattern: /\b(cire|wax|bougie|candle)\b/i,
    matiereProduit: "cire",
    qualiteReflets: "quasi absents",
  },
  {
    pattern: /\b(tissu|fabric|textile|cuir|leather)\b/i,
    matiereProduit: "tissu",
    qualiteReflets: "quasi absents",
  },
  {
    pattern: /\b(glace|ice|eau|water|résine|resin)\b/i,
    matiereProduit: "matière transparente",
    qualiteReflets: "irisés/multiples",
  },
];

export function inferPackshotMaterialHints(productDescription: string): PackshotMaterialHints {
  const text = productDescription.trim();
  for (const rule of MATERIAL_RULES) {
    if (rule.pattern.test(text)) {
      return {
        matiereProduit: rule.matiereProduit,
        qualiteReflets: rule.qualiteReflets,
      };
    }
  }
  return {
    matiereProduit: "matière du produit",
    qualiteReflets: "doux et diffus",
  };
}

export function isPackshotLevitationPosition(positionId: PackshotPositionId | string | null): boolean {
  return positionId === "levitation";
}

export function isPackshotPosedTemplate(positionId: PackshotPositionId | string | null): boolean {
  return (
    positionId === "debout-droit" ||
    positionId === "debout-incline" ||
    positionId === "allonge"
  );
}

export function resolvePackshotFormatRatio(formatId: PackshotFormatId | string | null | undefined): string {
  if (formatId === "carre-1-1") return "1:1";
  if (formatId === "story-9-16") return "9:16";
  return "4:5";
}

export function resolvePackshotAmbianceProfile(
  backgroundId: PackshotBackgroundId | string | null,
  ambianceId: PackshotAmbianceId | string | null,
  customAmbiance: string | null,
): PackshotAmbianceProfile {
  if (backgroundId === "neutre") {
    return PACKSHOT_NEUTRAL_PROFILE;
  }

  if (ambianceId === "autre") {
    const custom = customAmbiance?.trim() || "ambiance personnalisée";
    return {
      ...PACKSHOT_NEUTRAL_PROFILE,
      ambianceLabel: custom,
      decorElements: `éléments de décor évoquant une ambiance ${custom}`,
      fondAmbiance: custom,
      paletteCouleurs: `palette harmonisée avec une ambiance ${custom}`,
      styleEditorial: "éditorial lifestyle",
    };
  }

  if (ambianceId && ambianceId in PACKSHOT_AMBIANCE_PROFILES) {
    return PACKSHOT_AMBIANCE_PROFILES[ambianceId as Exclude<PackshotAmbianceId, "autre">];
  }

  return PACKSHOT_NEUTRAL_PROFILE;
}
