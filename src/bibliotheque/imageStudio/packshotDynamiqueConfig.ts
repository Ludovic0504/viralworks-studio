import { imageStudioTemplateAsset } from "./imageStudioAssets";

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

export const PACKSHOT_HERO_IMAGE = imageStudioTemplateAsset(
  "packshot-dynamique",
  "packshot-dynamique.png",
);

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

export type PackshotUsageContextId =
  | "bebe-enfant"
  | "sport-actif"
  | "hygiene-bain"
  | "soin-beaute"
  | "cuisine-gourmand"
  | "artisanal-fait-main"
  | "tech-bureau"
  | "maison-cosy";

export type PackshotUsageDecorFields = Pick<
  PackshotAmbianceProfile,
  "decorElements" | "fondAmbiance" | "surfaceType" | "elementAppui" | "planPremier" | "planArriere"
>;

const USAGE_RULES: Array<{ id: PackshotUsageContextId; pattern: RegExp }> = [
  {
    id: "bebe-enfant",
    pattern:
      /\b(bébé|bebe|baby|enfant|kids?|puériculture|puericulture|couche|diaper|biberon|jouet|toy|maternité|maternite|nursery)\b/i,
  },
  {
    id: "sport-actif",
    pattern:
      /\b(gourde|sport|fitness|gym|salle de sport|running|randonnée|randonnee|hiking|trail|vélo|velo|cycling|musculation|workout|isotherme|outdoor|yoga|athlétique|athletique|hydratation)\b/i,
  },
  {
    id: "hygiene-bain",
    pattern:
      /\b(shampoing|shampoo|gel douche|savon|soap|bain|bath|déodorant|deodorant|dentifrice|toothpaste|serviette|towel|hygiène|hygiene)\b/i,
  },
  {
    id: "soin-beaute",
    pattern:
      /\b(sérum|serum|crème|cream|cosmétique|cosmetique|skincare|beauté|beauty|maquillage|makeup|parfum|perfume|huile|anti-âge|anti-age|contour des yeux|soin visage|lotion)\b/i,
  },
  {
    id: "cuisine-gourmand",
    pattern:
      /\b(boisson|drink|jus|juice|café|coffee|thé|tea|snack|chocolat|épice|epice|spice|condiment|miel|honey|fromage|pâtisserie|patisserie|aliment|food|canette|soda)\b/i,
  },
  {
    id: "artisanal-fait-main",
    pattern:
      /\b(artisanal|artisan|fait main|handmade|bougie|candle|cire|wax|poterie|savon artisanal|broderie|fait-main)\b/i,
  },
  {
    id: "tech-bureau",
    pattern:
      /\b(casque|headphone|chargeur|charger|câble|cable|smartphone|montre connectée|montre connectee|smartwatch|clavier|keyboard|enceinte|speaker|gadget|électronique|electronique|usb|bluetooth|tablette|tablet|webcam)\b/i,
  },
  {
    id: "maison-cosy",
    pattern:
      /\b(décoration|decoration|déco|deco|coussin|cushion|plaid|bougie parfumée|bougie parfumee|scented candle|vase|lampe|home|salon|living room|chambre|bedroom|cosy|cozy|intérieur|interieur)\b/i,
  },
];

export function inferPackshotUsageContext(
  productDescription: string,
): PackshotUsageContextId | null {
  const text = productDescription.trim();
  if (!text) return null;

  for (const rule of USAGE_RULES) {
    if (rule.pattern.test(text)) {
      return rule.id;
    }
  }

  return null;
}

const USAGE_GENERIC_DECOR: Record<PackshotUsageContextId, PackshotUsageDecorFields> = {
  "bebe-enfant": {
    decorElements:
      "accessoires puériculture discrets, textures douces et éléments de chambre d'enfant flous en arrière-plan",
    fondAmbiance: "environnement bébé/enfant doux et sécurisant",
    surfaceType: "surface douce mate (table de nursery, tapis ou plateau textile)",
    elementAppui: "un petit support textile doux ou accessoire enfant discret",
    planPremier: "textures douces et accessoires enfant flous",
    planArriere: "chambre d'enfant ou nursery en bokeh doux",
  },
  "sport-actif": {
    decorElements:
      "équipement sportif et outdoor discret en arrière-plan flou (randonnée, fitness ou nature active)",
    fondAmbiance: "environnement sportif ou outdoor cohérent avec l'usage actif du produit",
    surfaceType: "surface de contact adaptée au sport (banc, rocher plat, tapis ou plan minimal)",
    elementAppui: "un support discret cohérent avec un usage sportif ou outdoor",
    planPremier: "éléments sportifs ou outdoor flous",
    planArriere: "décor sportif ou nature active en bokeh",
  },
  "hygiene-bain": {
    decorElements:
      "éléments de salle de bain discrets (serviettes pliées, carrelage, robinetterie floue)",
    fondAmbiance: "atmosphère de salle de bain propre et fonctionnelle",
    surfaceType: "plan de vasque, carrelage ou plateau de bain mat",
    elementAppui: "serviette pliée ou petit accessoire de salle de bain",
    planPremier: "serviettes et carrelage flous",
    planArriere: "salle de bain épurée en bokeh",
  },
  "soin-beaute": {
    decorElements:
      "accessoires beauté discrets (miroir, pétales, flaconnage) en arrière-plan flou",
    fondAmbiance: "environnement soin et beauté adapté au rituel du produit",
    surfaceType: "plateau de coiffeuse, marbre ou surface vanity mate",
    elementAppui: "un petit miroir ou accessoire beauté discret",
    planPremier: "pétales et accessoires beauty flous",
    planArriere: "vanity ou espace beauté en bokeh doux",
  },
  "cuisine-gourmand": {
    decorElements:
      "ingrédients frais, herbes et ustensiles de cuisine discrets en arrière-plan flou",
    fondAmbiance: "plan de travail ou setting culinaire cohérent avec le produit alimentaire",
    surfaceType: "plan de travail, marbre ou planche à découper",
    elementAppui: "un ingrédient entier ou ustensile de cuisine discret",
    planPremier: "ingrédients et herbes flous",
    planArriere: "cuisine ou plan de travail en bokeh léger",
  },
  "artisanal-fait-main": {
    decorElements:
      "matières brutes, outils d'atelier et éléments naturels artisanaux en arrière-plan flou",
    fondAmbiance: "atelier artisanal ou setting fait main chaleureux",
    surfaceType: "planche de bois brut, établi ou surface artisanale patinée",
    elementAppui: "un morceau de matière brute ou outil artisanal discret",
    planPremier: "matières naturelles et outils flous",
    planArriere: "atelier artisanal en bokeh doux",
  },
  "tech-bureau": {
    decorElements:
      "setup bureau ou tech discret (câbles, écran flou, lignes épurées) en arrière-plan",
    fondAmbiance: "environnement bureau ou tech cohérent avec l'usage du produit",
    surfaceType: "bureau minimal, surface mate ou plateau tech",
    elementAppui: "un socle tech discret ou support minimal",
    planPremier: "reflets et éléments tech flous",
    planArriere: "bureau ou setup tech en bokeh structuré",
  },
  "maison-cosy": {
    decorElements:
      "éléments d'intérieur cosy discrets (textile, décoration, lumière douce) en arrière-plan flou",
    fondAmbiance: "intérieur de maison chaleureux cohérent avec un usage domestique",
    surfaceType: "table basse, étagère ou surface intérieure mate",
    elementAppui: "un objet déco discret ou textile plié",
    planPremier: "textiles et décoration intérieure flous",
    planArriere: "salon ou intérieur cosy en bokeh doux",
  },
};

type PackshotAmbiancePresetId = Exclude<PackshotAmbianceId, "autre">;

const USAGE_AMBIANCE_DECOR_OVERRIDES: Partial<
  Record<PackshotUsageContextId, Partial<Record<PackshotAmbiancePresetId, Partial<PackshotUsageDecorFields>>>>
> = {
  "sport-actif": {
    "tech-minimal": {
      decorElements:
        "sentier de randonnée ou salle de sport en lignes épurées, équipement outdoor minimal, reflets métalliques brossés discrets",
      fondAmbiance: "dégradé gris froid évoquant un environnement outdoor sportif structuré",
      surfaceType: "surface mate gris clair type banc de salle ou rocher plat minimal",
      elementAppui: "socle minimal en métal brossé",
      planPremier: "équipement sportif géométrique flou",
      planArriere: "décor outdoor sportif en bokeh structuré",
    },
    "spa-bien-etre": {
      decorElements:
        "tapis de yoga, serviette sport et végétation douce flous, ambiance wellness active",
      fondAmbiance: "espace wellness sportif, pierre claire et lumière apaisante",
      surfaceType: "dalles de pierre claire ou tapis de yoga mat",
      elementAppui: "galet lisse ou accessoire wellness sportif discret",
      planPremier: "tapis et feuillage wellness flous",
      planArriere: "espace fitness apaisant en bokeh doux",
    },
  },
  "soin-beaute": {
    "spa-bien-etre": {
      decorElements:
        "galets lisses, pétales, bambou et flaconnage beauté en arrière-plan flou",
      fondAmbiance: "rituel spa et soin, pierre claire et végétation douce",
      surfaceType: "dalles de pierre claire mate ou plateau vanity spa",
      elementAppui: "galet lisse ou flacon beauté discret",
      planPremier: "galets et pétales flous",
      planArriere: "rituel spa beauté en bokeh doux",
    },
    "artisanal-cosy": {
      decorElements:
        "coiffeuse en bois, lin naturel, fleurs séchées et flaconnage beauté en arrière-plan flou",
      fondAmbiance: "vanity artisanale chaleureuse, bois et tons terreux doux",
      surfaceType: "planche de bois patinée ou plateau vanity en lin",
      elementAppui: "morceau de bois flotté ou miroir artisanal discret",
      planPremier: "lin et fleurs séchées flous",
      planArriere: "vanity artisanale en bokeh chaleureux",
    },
    "tech-minimal": {
      decorElements:
        "vanity minimaliste, reflets froids, flaconnage épuré et lignes géométriques en arrière-plan flou",
      fondAmbiance: "espace beauté tech, dégradé gris clair à anthracite",
      surfaceType: "surface vanity mate gris clair",
      elementAppui: "socle minimal en métal brossé",
      planPremier: "reflets géométriques et flaconnage flous",
      planArriere: "vanity tech en bokeh structuré",
    },
  },
  "hygiene-bain": {
    "spa-bien-etre": {
      decorElements:
        "serviettes en lin blanc, galets, bambou et robinetterie épurée en arrière-plan flou",
      fondAmbiance: "salle de bain spa, pierre claire et végétation douce",
      surfaceType: "dalles de pierre claire mate",
      elementAppui: "galet lisse ou serviette pliée en lin",
      planPremier: "galets et serviettes flous",
      planArriere: "salle de bain spa en bokeh doux",
    },
  },
  "cuisine-gourmand": {
    "gourmand-frais": {
      decorElements:
        "fruits frais tranchés, herbes aromatiques et touches de marbre clair en arrière-plan flou",
      fondAmbiance: "marbre clair et ingrédients frais",
      surfaceType: "plateau en marbre clair",
      elementAppui: "un fruit entier ou herbes fraîches",
      planPremier: "ingrédients frais flous",
      planArriere: "marbre et herbes en bokeh léger",
    },
    "artisanal-cosy": {
      decorElements:
        "ingrédients naturels, planche en bois, lin et herbes séchées en arrière-plan flou",
      fondAmbiance: "cuisine artisanale chaleureuse, bois et tons terreux",
      surfaceType: "planche de bois rustique patinée",
      elementAppui: "morceau de bois flotté ou ingrédient entier",
      planPremier: "bois et herbes flous",
      planArriere: "cuisine artisanale en bokeh chaleureux",
    },
  },
  "artisanal-fait-main": {
    "artisanal-cosy": {
      decorElements:
        "branches de lavande séchée, bois flotté texturé, lin naturel et outils d'atelier en arrière-plan flou",
      fondAmbiance: "atelier artisanal chaleureux, bois vieilli et tons terreux doux",
      surfaceType: "planche de bois rustique patinée",
      elementAppui: "un morceau de bois flotté texturé",
      planPremier: "bois flotté et matières naturelles flous",
      planArriere: "atelier artisanal en bokeh doux",
    },
  },
  "tech-bureau": {
    "tech-minimal": {
      decorElements:
        "lignes géométriques épurées, écran flou, câbles discrets et reflets métalliques brossés",
      fondAmbiance: "bureau tech minimal, dégradé gris clair à anthracite",
      surfaceType: "surface mate gris clair",
      elementAppui: "socle minimal en métal brossé",
      planPremier: "reflets géométriques flous",
      planArriere: "setup tech en bokeh structuré",
    },
  },
  "maison-cosy": {
    "artisanal-cosy": {
      decorElements:
        "textiles en lin, bois patiné, décoration artisanale et lumière douce en arrière-plan flou",
      fondAmbiance: "intérieur artisanal chaleureux, bois vieilli et tons terreux",
      surfaceType: "table basse en bois rustique patinée",
      elementAppui: "coussin en lin ou objet déco artisanal discret",
      planPremier: "lin et bois flous",
      planArriere: "salon artisanal cosy en bokeh chaleureux",
    },
  },
  "bebe-enfant": {
    "artisanal-cosy": {
      decorElements:
        "textiles doux en lin, bois naturel clair et accessoires nursery discrets en arrière-plan flou",
      fondAmbiance: "nursery chaleureuse, bois clair et tons doux",
      surfaceType: "plateau en bois clair patiné ou surface textile douce",
      elementAppui: "petit objet textile doux ou jouet en bois discret",
      planPremier: "lin et bois clair flous",
      planArriere: "nursery chaleureuse en bokeh doux",
    },
    "spa-bien-etre": {
      decorElements:
        "textiles blancs doux, textures apaisantes et accessoires nursery épurés en arrière-plan flou",
      fondAmbiance: "nursery apaisante, pierre claire et tons neutres doux",
      surfaceType: "surface claire mate ou plateau textile blanc cassé",
      elementAppui: "petit linge doux plié ou accessoire nursery discret",
      planPremier: "textiles blancs flous",
      planArriere: "nursery épurée en bokeh doux",
    },
  },
};

function resolveUsageDecorFields(
  usage: PackshotUsageContextId,
  ambianceId: PackshotAmbianceId | string | null,
): PackshotUsageDecorFields {
  const generic = USAGE_GENERIC_DECOR[usage];

  if (ambianceId && ambianceId !== "autre" && ambianceId in PACKSHOT_AMBIANCE_PROFILES) {
    const override = USAGE_AMBIANCE_DECOR_OVERRIDES[usage]?.[ambianceId as PackshotAmbiancePresetId];
    if (override) {
      return { ...generic, ...override };
    }
  }

  return generic;
}

export function enrichProfileForUsage(
  profile: PackshotAmbianceProfile,
  productDescription: string,
  ambianceId: PackshotAmbianceId | string | null,
): PackshotAmbianceProfile {
  const usage = inferPackshotUsageContext(productDescription);
  if (!usage) return profile;

  const decorFields = resolveUsageDecorFields(usage, ambianceId);

  if (ambianceId === "autre") {
    return {
      ...profile,
      decorElements: `${decorFields.decorElements}, harmonisés avec une ambiance ${profile.ambianceLabel}`,
      surfaceType: decorFields.surfaceType,
      elementAppui: decorFields.elementAppui,
      planPremier: decorFields.planPremier,
      planArriere: decorFields.planArriere,
    };
  }

  return {
    ...profile,
    ...decorFields,
  };
}

export function inferPackshotFlyingElements(
  productDescription: string,
  usage: PackshotUsageContextId | null = inferPackshotUsageContext(productDescription),
): string {
  if (usage) {
    switch (usage) {
      case "sport-actif":
        return "gouttelettes d'eau et particules légères";
      case "soin-beaute":
        return "pétales et gouttes d'huile légère";
      case "hygiene-bain":
        return "gouttes d'eau et vapeur légère";
      case "cuisine-gourmand":
        if (/\b(citron|lime|menthe|agrumes|citrus)\b/i.test(productDescription)) {
          return "tranches d'agrumes et glaçons";
        }
        if (/\b(café|coffee|thé|tea|chocolat)\b/i.test(productDescription)) {
          return "poudre de cacao et particules aromatiques légères";
        }
        return "herbes fraîches, épices et particules gourmandes légères";
      case "artisanal-fait-main":
        return "brins secs, particules naturelles et fibres légères";
      case "tech-bureau":
        return "particules lumineuses discrètes et reflets légers";
      case "maison-cosy":
        return "particules de lumière douce et fibres textiles légères";
      case "bebe-enfant":
        return "bulles douces et confettis pastel légers";
      default:
        break;
    }
  }

  if (/\b(boisson|drink|citron|lime|menthe)\b/i.test(productDescription)) {
    return "tranches d'agrumes et glaçons";
  }
  if (/\b(cosmétique|beauty|skincare)\b/i.test(productDescription)) {
    return "pétales et gouttes d'huile légère";
  }

  return "particules et éléments décoratifs légers";
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
