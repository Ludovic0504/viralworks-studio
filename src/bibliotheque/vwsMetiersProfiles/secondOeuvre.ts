import type { VwsMetierProfile } from "./types";

/** Second œuvre & finitions — 13 métiers */
export const SECOND_OEUVRE_METIER_PROFILES: VwsMetierProfile[] = [
  {
    label: "Peintre en bâtiment",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "intérieur ou façade en peinture, bâches de protection, rouleaux et pinceaux, pots de peinture, reprises de joints avant finition",
    stylePlaceholder:
      "Ex. : rénovation salon, peinture façade, finition mate, reprise humidité, deux tons mur et plafond…",
    inspireContext:
      "préparation des supports, application couleur, finition uniforme et pièce transformée",
  },
  {
    label: "Menuisier",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "atelier bois ou pose sur chantier, établi, panneaux, machines de coupe, quincaillerie, éléments sur mesure",
    stylePlaceholder:
      "Ex. : placard sur mesure, escalier bois, pose porte intérieure, habillage mural, fenêtre bois…",
    inspireContext:
      "prise de cote, fabrication ou ajustage, pose finale et contrôle d’alignement",
  },
  {
    label: "Ébéniste",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "atelier d’ébénisterie, placage, ponçage fin, assemblages précis, meuble haut de gamme en cours de fabrication",
    stylePlaceholder:
      "Ex. : table sur mesure, bibliothèque chêne, restauration commode, finition huile-cire, marqueterie…",
    inspireContext:
      "geste de précision sur bois, assemblage invisible, rendu surface et meuble fini",
  },
  {
    label: "Vitrier",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "pose vitrage sur chantier ou atelier, double vitrage, miroir, ventouses, mesure et calage dans la baie",
    stylePlaceholder:
      "Ex. : remplacement vitrage cassé, baie vitrée rénovation, miroir sur mesure, vitrine commerce, sécurit…",
    inspireContext:
      "retrait ancien vitrage, pose et calage, étanchéité et surface sans défaut",
  },
  {
    label: "Poseur de fenêtres",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "fenêtre PVC ou alu en pose, cales, mousse expansive, niveau à bulle, rénovation énergétique visible",
    stylePlaceholder:
      "Ex. : remplacement fenêtres maison, baie coulissante, double vitrage phonique, finition habillage…",
    inspireContext:
      "dépose ancienne menuiserie, pose du châssis, réglage et test d’ouverture",
  },
  {
    label: "Poseur de cloisons",
    recommendedVideoFormatId: "process_timelapse",
    environmentHint:
      "cloison sèche en montage, rails, montants, plaques, isolation phonique, distribution électrique intégrée",
    stylePlaceholder:
      "Ex. : division open space, cloison acoustique bureau, création chambre, renfort pour TV murale…",
    inspireContext:
      "ossature montée, plaques posées, ouverture prête pour porte et finition",
  },
  {
    label: "Isolation thermique",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "combles, ITI ou ITE, laine de verre, ouate, polyuréthane, pare-vapeur, épaisseur isolant mesurée",
    stylePlaceholder:
      "Ex. : isolation combles perdus, doublage thermique mur, ITE polystyrène, ponts thermiques traités…",
    inspireContext:
      "zone non isolée montrée, pose isolant, contrôle épaisseur et confort annoncé",
  },
  {
    label: "Plaquiste",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "placo en pose, bandes à joint, enduit de lissage, plafond démontable ou cloison courbe",
    stylePlaceholder:
      "Ex. : faux plafond design, cloison placo phonique, niche sur mesure, finition prête à peindre…",
    inspireContext:
      "structure métallique, pose plaques, joints lissés et surface plane",
  },
  {
    label: "Parqueteur",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "pose parquet massif ou contrecollé, ponçage, vitrification, motifs chevron ou point de Hongrie",
    stylePlaceholder:
      "Ex. : ponçage parquet ancien, pose chêne massif, vitrificateur, réparation lames abîmées…",
    inspireContext:
      "préparation sol, pose ou ponçage, finition brillante et reflet homogène",
  },
  {
    label: "Décorateur d'intérieur",
    recommendedVideoFormatId: "story_probleme_solution",
    environmentHint:
      "échantillons tissus et matériaux, moodboard, pièce en relooking, accessoires déco, avant/après ambiance",
    stylePlaceholder:
      "Ex. : salon contemporain, chambre parentale, style industriel, harmonisation couleurs et luminaires…",
    inspireContext:
      "besoin client exprimé, proposition déco, pièce transformée cohérente",
  },
  {
    label: "Cuisiniste",
    recommendedVideoFormatId: "produit_demo",
    environmentHint:
      "cuisine équipée en showroom ou chez client, plans de travail, façades, électroménager intégré, prise de mesures",
    stylePlaceholder:
      "Ex. : cuisine en L, plan quartz, rangements tiroirs, îlot central, rénovation complète cuisine…",
    inspireContext:
      "conseil aménagement, détail plan de travail ou rangement, cuisine fonctionnelle montrée",
  },
  {
    label: "Poseur de terrasses",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "terrasse bois composite ou pierre, lambourdes, plots réglables, garde-corps, jardin attenant",
    stylePlaceholder:
      "Ex. : terrasse ipé, dalles grès cérame extérieur, pergola bois, reprise structure, éclairage intégré…",
    inspireContext:
      "préparation sol, pose lames ou dalles, finition bordures et espace habitable",
  },
  {
    label: "Miroitier",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "atelier miroiterie, découpe verre, polissage chants, douche italienne vitrée, crédence verre",
    stylePlaceholder:
      "Ex. : miroir salle de bain sur mesure, paroi douche, crédence cuisine verre, vitrine magasin…",
    inspireContext:
      "mesure précise, découpe ou pose, rendu miroir sans défaut",
  },
];
