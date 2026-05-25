import type { VwsMetierProfile } from "./types";

/** Beauté & bien-être — 9 métiers */
export const BEAUTE_METIER_PROFILES: VwsMetierProfile[] = [
  {
    label: "Coiffeur",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "salon avec fauteuil, miroir, poste de travail, tondeuse, ciseaux, produits coiffants, lumière de miroir",
    stylePlaceholder:
      "Ex. : dégradé à blanc, brushing, coloration, balayage, salon premium ou urbain, lissage brésilien…",
    inspireContext:
      "avant/après net, geste technique sur coupe ou couleur, résultat final montré au miroir",
  },
  {
    label: "Barbier",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "barbershop, fauteuil cuir, rasoir, tondeuse, taille barbe, serviette chaude, ambiance masculine soignée",
    stylePlaceholder:
      "Ex. : taille barbe sculptée, rasage traditionnel, dégradé fade, soin barbe huile, combo cheveux + barbe…",
    inspireContext:
      "contour barbe au rasoir ou tondeuse, finition nette, client satisfait au miroir",
  },
  {
    label: "Esthéticienne",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "cabine esthétique, soin visage, épilation, appareil haute fréquence, produits dermo, lumière douce",
    stylePlaceholder:
      "Ex. : soin anti-âge, épilation jambes, microdermabrasion, massage visage, forfait mariée…",
    inspireContext:
      "peau avant imperfection, application soin, peau lumineuse après séance",
  },
  {
    label: "Onglerie / nail art",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "table manucure, UV lamp, vernis, capsules, nail art détaillé, mains client en pose",
    stylePlaceholder:
      "Ex. : pose gel, french manucure, nail art mariage, remplissage 3 semaines, soin cuticules…",
    inspireContext:
      "ongles naturels puis pose ou décoration, finition brillante, mains présentées",
  },
  {
    label: "Maquilleur professionnel",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "palettes fards, pinceaux, mariée ou shooting, lumière ring light, retouches miroir",
    stylePlaceholder:
      "Ex. : maquillage mariée, soirée smoky, shooting mode, correction teint HD, cours particulier…",
    inspireContext:
      "visage nu puis maquillage étape par étape, rendu photo ou événement",
  },
  {
    label: "Masseur / spa",
    recommendedVideoFormatId: "story_lifestyle",
    environmentHint:
      "cabine massage, huiles, lumière tamisée, table professionnelle, ambiance zen, serviettes chaudes",
    stylePlaceholder:
      "Ex. : massage suédois 1h, pierres chaudes, duo spa, massage dos stress, forfait détente…",
    inspireContext:
      "accueil client, geste massage fluide, client détendu en fin de séance",
  },
  {
    label: "Tatoueur",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "studio tatouage, dermographe, transfert motif, hygiène gants, peau en cours de travail",
    stylePlaceholder:
      "Ex. : tatouage bras, retouche, cover-up, minimaliste poignet, piercing associé…",
    inspireContext:
      "stencil posé, travail aiguille, motif net et peau proprement pansée",
  },
  {
    label: "Opticien",
    recommendedVideoFormatId: "humain_face_expert",
    environmentHint:
      "magasin optique, murs montures, test vue, machine réfraction, ajustement branche lunettes",
    stylePlaceholder:
      "Ex. : lunettes progressives, solaire sur mesure, lentilles, ajustement enfant, dépistage vue…",
    inspireContext:
      "examen vue, choix monture, essayage miroir et confort porté",
  },
  {
    label: "Prothésiste dentaire",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "labo dentaire, empreinte, fraisage ou coulée, couronne céramique, articulateur, microscope",
    stylePlaceholder:
      "Ex. : couronne zircone, gouttière blanchiment, prothèse amovible, facette, réparation casse…",
    inspireContext:
      "fabrication pièce, contrôle occlusion, prothèse finie prête à poser",
  },
];
