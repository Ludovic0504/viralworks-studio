import type { CatalogMentionHint } from "./types";

export type TemplateIntentMetadata = {
  intentTagsFr: string[];
  promptFocusEn: string;
  mentionHint: CatalogMentionHint;
  variableRolesFr?: Partial<Record<string, string>>;
};

/**
 * Métadonnées d'intention par template — enrichissement du catalogue Prompt Assistant.
 * Les corps de prompt et options détaillées restent dans les fichiers guides existants.
 */
export const TEMPLATE_INTENT_METADATA: Record<string, TemplateIntentMetadata> = {
  "product-photography": {
    intentTagsFr: [
      "boisson",
      "canette",
      "bouteille",
      "studio produit",
      "splash",
      "ingredients",
      "hero shot",
      "publicite boisson",
      "condensation",
      "saveur",
    ],
    promptFocusEn:
      "ultra-sharp studio product photography, dramatic splash or ingredient orbit, three-point studio lighting, high-end commercial beverage campaign",
    mentionHint: "produit",
    variableRolesFr: {
      drink: "Nom ou marque de la boisson mise en héros",
      packaging: "Format d'emballage (can, bottle, carton)",
      flavorElements: "Ingrédients et éléments de saveur autour du produit",
      brandBackdrop: "Fond studio aux couleurs de la marque",
      brandPalette: "Palette couleurs signature de la marque",
    },
  },
  "lifestyle-product-photography": {
    intentTagsFr: [
      "lifestyle",
      "en main",
      "terrain",
      "sport",
      "decor reel",
      "quotidien",
      "environnement",
      "utilisation",
      "contexte reel",
    ],
    promptFocusEn:
      "lifestyle product photography, product held in hand in a real environment, natural context, authentic usage scene",
    mentionHint: "produit",
    variableRolesFr: {
      product: "Nom ou marque du produit tenu en main",
      environment: "Lieu ou décor réel (gym, rue, cuisine, extérieur…)",
    },
  },
  "ugc-selfie-produit": {
    intentTagsFr: [
      "selfie",
      "ugc",
      "smartphone",
      "authentique",
      "miroir",
      "naturel",
      "tiktok",
      "influenceur",
      "creator",
      "face camera",
    ],
    promptFocusEn:
      "UGC selfie product shot, smartphone front-camera aesthetic, casual authentic creator vibe, natural imperfect lighting",
    mentionHint: "produit",
    variableRolesFr: {
      productName: "Produit présenté dans le selfie",
      location: "Lieu de la scène (intérieur, extérieur, salle de bain…)",
      skinTone: "Teint de peau du créateur",
      hair: "Cheveux du créateur",
      outfit: "Tenue casual du créateur",
    },
  },
  "ugc-presentation-produit": {
    intentTagsFr: [
      "presentation",
      "face camera",
      "tenu en main",
      "porte sur le corps",
      "ugc",
      "fixe",
      "demo produit",
      "essayage",
      "try on",
    ],
    promptFocusEn:
      "UGC product presentation, fixed front-camera framing, product held in hand or worn on body, clean creator demo",
    mentionHint: "produit",
    variableRolesFr: {
      productName: "Produit tenu ou porté",
      location: "Pièce ou décor de la présentation",
      physique: "Silhouette du présentateur",
      hair: "Coiffure du présentateur",
      autreTenue: "Reste de la tenue autour du produit",
    },
  },
  "brand-campaign-shoot": {
    intentTagsFr: [
      "campagne",
      "shooting",
      "premium",
      "luxe",
      "editorial",
      "pose",
      "narratif",
      "publicite marque",
      "lookbook",
      "commercial haut de gamme",
    ],
    promptFocusEn:
      "premium brand campaign shoot, editorial pose, narrative environment, high-fashion commercial quality, confident model presentation",
    mentionHint: "produit",
    variableRolesFr: {
      productOutfit: "Tenue ou produit mis en avant dans la campagne",
      ambiancePrompt: "Ambiance globale (sporty-luxe, minimal, etc.)",
      physique: "Description physique du modèle",
      environment: "Décor narratif de la campagne",
    },
  },
  "packshot-dynamique": {
    intentTagsFr: [
      "packshot",
      "e-commerce",
      "fiche produit",
      "fond neutre",
      "levitation",
      "produit seul",
      "catalogue",
      "fond blanc",
      "studio produit",
      "fumee",
      "vapeur",
    ],
    promptFocusEn:
      "dynamic packshot product photography, clean commercial framing, optional levitation or smoke effect, e-commerce ready",
    mentionHint: "produit",
    variableRolesFr: {
      productDescription: "Description du produit (matière, couleur, forme)",
      positionId: "Posture du produit (debout, incliné, lévitation…)",
      backgroundId: "Type de fond (neutre, environnement, couleur)",
      ambianceId: "Ambiance visuelle (cosy, premium, artisanal…)",
      interactionId: "Effet dynamique optionnel (fumée, éclaboussure…)",
      productStateId: "État du produit (neuf, ouvert, entamé)",
      formatId: "Ratio de sortie (feed, story, bannière)",
    },
  },
  "editorial-worn-held": {
    intentTagsFr: [
      "editorial",
      "porte",
      "tenu",
      "bijou",
      "mannequin",
      "haute couture",
      "macro",
      "corps entier",
      "on-body",
      "mode",
      "accessoire",
    ],
    promptFocusEn:
      "editorial worn or held product, fashion model, on-body or in-hand jewelry/accessory, premium luxury editorial aesthetic",
    mentionHint: "produit",
    variableRolesFr: {
      sceneTypeId: "Bijou porté ou produit tenu en main",
      genderId: "Genre du modèle",
      zoneId: "Zone du corps (poignet, cou, visage…)",
      framingId: "Cadrage (macro, buste, corps entier)",
      outfitDescription: "Tenue du modèle pour mise en scène corps entier",
      productDescription: "Description du bijou ou produit",
      postureId: "Posture et pose du modèle",
      backgroundId: "Type de fond",
      ambianceId: "Ambiance éditoriale",
    },
  },
  "produit-en-application": {
    intentTagsFr: [
      "application",
      "texture",
      "cosmetique",
      "soin",
      "peau",
      "geste",
      "contact corps",
      "creme",
      "serum",
      "maquillage",
      "demo application",
    ],
    promptFocusEn:
      "product in application, texture or object in contact with skin, realistic application gesture, beauty or skincare close-up",
    mentionHint: "produit",
    variableRolesFr: {
      productTypeId: "Texture appliquée ou objet en contact",
      genderId: "Sexe du modèle",
      bodyZoneId: "Zone du corps ciblée",
      containerId: "Contenant visible ou non",
      textureTypeId: "Type de texture (sérum, crème, gel…)",
      objectTypeId: "Type d'objet (rasoir, brosse…)",
      postureId: "Posture du modèle",
      decorId: "Décor (studio, salle de bain…)",
      lightingId: "Éclairage (doux naturel, studio…)",
      productName: "Nom du produit appliqué",
    },
  },
  "outfit-studio": {
    intentTagsFr: [
      "outfit",
      "tenue",
      "look",
      "vetement",
      "mannequin",
      "lookbook",
      "styling",
      "porte",
      "fashion studio",
      "catalogue mode",
    ],
    promptFocusEn:
      "outfit studio fashion presentation, model wearing uploaded garments, clean lookbook aesthetic, garment-focused composition",
    mentionHint: "garment",
    variableRolesFr: {
      genderId: "Sexe du mannequin",
      clothingNotes: "Précisions sur les pièces uploadées",
      sceneTypeId: "Type de scène (studio blanc, lifestyle, intérieur…)",
      subContextId: "Sous-contexte du décor",
      framingId: "Cadrage (buste, plein-pied, plan américain)",
      ratioId: "Ratio de sortie",
      poseId: "Pose du mannequin",
    },
  },
};
