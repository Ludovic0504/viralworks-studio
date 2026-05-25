import type { VwsMetierProfile } from "./types";

/** Gros œuvre & bâtiment — 15 métiers */
export const BATIMENT_METIER_PROFILES: VwsMetierProfile[] = [
  {
    label: "Maçon",
    recommendedVideoFormatId: "process_timelapse",
    environmentHint:
      "chantier gros œuvre ou rénovation, parpaings ou briques, mortier, coffrage, ferraillage, niveau à bulle et repères de maçonnerie",
    stylePlaceholder:
      "Ex. : dalle béton, mur de clôture, ouverture mur porteur, reprise sous dalle, enduit de façade…",
    inspireContext:
      "mise en place précise, contrôle au niveau, progression du chantier visible à l’image",
  },
  {
    label: "Carreleur",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "salle de bain ou cuisine en pose, carrelage au sol ou mural, colle, croisillons, coupe-carreau, joints en finition",
    stylePlaceholder:
      "Ex. : douche italienne, crédence cuisine, grand format 60×60, reprise de joints, anti-dérapant terrasse…",
    inspireContext:
      "préparation du support, pose calepinée, découpe nette, jointoiement et rendu plan impeccable",
  },
  {
    label: "Plâtrier",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "intérieur en plâtrerie, rails métalliques, plaques BA13, enduit de lissage, échafaudage intérieur, poussière de chantier maîtrisée",
    stylePlaceholder:
      "Ex. : cloison acoustique, faux plafond design, reprise fissures, doublage isolant, finition prête à peindre…",
    inspireContext:
      "structure ossature posée, application enduit ou plaque, contrôle planéité avant finition",
  },
  {
    label: "Charpentier",
    recommendedVideoFormatId: "process_timelapse",
    environmentHint:
      "charpente bois ou traditionnelle, fermes, pannes, chevrons, assemblages, levage pièces, toiture partiellement couverte",
    stylePlaceholder:
      "Ex. : charpente traditionnelle rénovée, extension ossature bois, remplacement chevrons, bardage bois…",
    inspireContext:
      "assemblage ou levage d’élément porteur, calage précis, structure complète visible sous toiture",
  },
  {
    label: "Couvreur",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "toiture en intervention, tuiles ardoises ou zinc, échafaudage, harnais, gouttières, conditions extérieures réalistes",
    stylePlaceholder:
      "Ex. : réparation fuite toiture, remplacement tuiles cassées, zinguerie, nettoyage toiture…",
    inspireContext:
      "zone défectueuse montrée, réparation sécurisée, contrôle d’écoulement ou d’étanchéité",
  },
  {
    label: "Couvreur-zingueur",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "zinguerie en toiture, noues, chéneaux, solins, feuilles de zinc ou acier, soudure ou pliage sur place, évacuation eaux pluviales",
    stylePlaceholder:
      "Ex. : remplacement chéneau, solin cheminée, habillage lucarne, gouttière zinc, étanchéité noue…",
    inspireContext:
      "défaut d’étanchéité identifié, pose ou réparation zinc, test écoulement sous pluie simulée",
  },
  {
    label: "Façadier",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "façade en intervention, échafaudage ou nacelle, enduit, bardage, isolation par l’extérieur, nettoyage ou reprise fissures",
    stylePlaceholder:
      "Ex. : ravalement complet, ITE polystyrène, enduit décoratif, reprise fissures structurelles, nettoyage façade…",
    inspireContext:
      "état avant visible, préparation support, application enduit ou bardage, rendu façade homogène",
  },
  {
    label: "Poseur de sols",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "chantier intérieur, ragréage, pose parquet stratifié ou massif, vinyle, moquette ou résine, outils de coupe et calage",
    stylePlaceholder:
      "Ex. : parquet chêne massif, sol PVC commercial, ragréage autonivelant, reprise sous-couche, plinthes…",
    inspireContext:
      "support préparé, pose progressive, finition plinthes et passage dans la pièce terminée",
  },
  {
    label: "Ravaleur de façades",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "façade encrassée puis nettoyée, hydrogommage ou aérogommage, échafaudage, protection vitrages, traitement anti-mousse",
    stylePlaceholder:
      "Ex. : ravalement pierre, nettoyage brique, traitement hydrofuge, décrassage après chantier, reprise joints pierre…",
    inspireContext:
      "contraste avant/après net sur la façade, geste de projection ou brossage, résultat pierre ou enduit éclatant",
  },
  {
    label: "Jointeur",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "carrelage fraîchement posé, joints ciment ou époxy, raclette, éponge, finition angles et silicone sanitaire",
    stylePlaceholder:
      "Ex. : joints salle de bain, joint époxy cuisine, reprise joints noircis, silicone douche, finition angle sortant…",
    inspireContext:
      "application joint en croisillons, lissage, nettoyage surface et brillance uniforme",
  },
  {
    label: "Terrassier",
    recommendedVideoFormatId: "process_timelapse",
    environmentHint:
      "terrassement, pelleteuse ou mini-pelle, niveau laser, tranchées, remblai, réseaux enterrés, sol nu préparé",
    stylePlaceholder:
      "Ex. : fondations maison, tranchée réseaux, nivellement terrain, création allée gravier, bassin excavation…",
    inspireContext:
      "terrassement en cours, contrôle niveau, sol prêt pour suite du chantier",
  },
  {
    label: "Coffreur-bancheur",
    recommendedVideoFormatId: "process_timelapse",
    environmentHint:
      "coffrage bois ou métallique, banches, ferraillage avant coulage, coulé béton, chantier structure béton armé",
    stylePlaceholder:
      "Ex. : dalle industrielle, mur soutènement, poteaux béton, voile maison, découpe coffrage complexe…",
    inspireContext:
      "montage coffrage, pose armatures, coulage et décoffrage, surface béton propre",
  },
  {
    label: "Ferronnier",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "atelier ferronnerie, forge ou soudure, portail, garde-corps, escalier métal, meuleuse et poste à souder",
    stylePlaceholder:
      "Ex. : garde-corps terrasse, portillon sur mesure, escalier hélicoïdal, grille fenêtre, pergola acier…",
    inspireContext:
      "assemblage pièces métal, soudure visible, pose sur site et alignement final",
  },
  {
    label: "Soudeur",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "poste à souder MIG/MAG ou TIG, EPI complet, pièces métal assemblées, étincelles, contrôle cordon de soudure",
    stylePlaceholder:
      "Ex. : réparation charpente métal, soudure inox cuisine pro, structure industrielle, pipeline, bardage…",
    inspireContext:
      "préparation chanfrein, cordon de soudure en cours, contrôle visuel qualité soudure",
  },
  {
    label: "Tailleur de pierre",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "atelier ou chantier pierre naturelle, taille, boucharde, pose pierre de taille, restauration patrimoine ou dallage",
    stylePlaceholder:
      "Ex. : restauration encadrement fenêtre, seuil pierre, muret moellons, dallage calcaire, sculpture ornement…",
    inspireContext:
      "taille ou ajustage pierre, pose au mortier, rendu texture et joint pierre harmonieux",
  },
];
