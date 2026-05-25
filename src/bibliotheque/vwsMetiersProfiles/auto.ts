import type { VwsMetierProfile } from "./types";

/** Auto & mécanique — 9 métiers */
export const AUTO_METIER_PROFILES: VwsMetierProfile[] = [
  {
    label: "Garagiste / mécanicien",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "atelier auto avec pont, valise diagnostic, outils, pièces démontées, véhicule client en intervention",
    stylePlaceholder:
      "Ex. : révision complète, freinage, distribution, diagnostic moteur, garage multimarque, vidange…",
    inspireContext:
      "problème client explicité, contrôle visuel, réparation en cours, test final véhicule",
  },
  {
    label: "Carrossier",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "cabine peinture ou atelier carrosserie, débosselage, mastic, aérographe, pare-chocs, teinte constructeur",
    stylePlaceholder:
      "Ex. : reprise aile enfoncée, peinture capot, débosselage sans peinture, réparation pare-chocs, polissage…",
    inspireContext:
      "impact visible, préparation surface, peinture ou redressage, carrosserie homogène",
  },
  {
    label: "Électricien automobile",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "tableau de bord démonté, faisceau, valise OBD, alternateur, batterie, phares et calculateur moteur",
    stylePlaceholder:
      "Ex. : panne démarreur, diagnostic OBD, réparation faisceau, installation autoradio, feux LED…",
    inspireContext:
      "code défaut lu, réparation câblage ou composant, voyant éteint et essai route",
  },
  {
    label: "Préparateur auto",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "véhicule sport ou collection, jantes, kit carrosserie, mapping, échappement, detailing haut de gamme",
    stylePlaceholder:
      "Ex. : préparation esthétique vente, reprogrammation moteur, kit carbone, covering, protection céramique…",
    inspireContext:
      "transformation esthétique ou perf, geste précis, véhicule prêt salon ou circuit",
  },
  {
    label: "Mécanicien moto",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "atelier moto, pont ou chevalet, chaîne, pneus, carénage démonté, outillage spécifique deux-roues",
    stylePlaceholder:
      "Ex. : révision 6000 km, changement pneus, réglage carburateur, freinage, customisation guidon…",
    inspireContext:
      "panne ou entretien expliqué, pièce changée, essai moteur au ralenti puis départ",
  },
  {
    label: "Concessionnaire",
    recommendedVideoFormatId: "story_lifestyle",
    environmentHint:
      "showroom véhicules neufs ou occasion, hall lumineux, essai routier, remise clés, conseiller et client",
    stylePlaceholder:
      "Ex. : SUV familial, utilitaire pro, reprise ancien véhicule, LOA, livraison modèle neuf…",
    inspireContext:
      "présentation véhicule, essai ou configuration options, remise clés moment signature",
  },
  {
    label: "Contrôle technique",
    recommendedVideoFormatId: "humain_face_expert",
    environmentHint:
      "ligne contrôle technique, banc freinage, géométrie, émissions, plaque atelier, véhicule sur pont",
    stylePlaceholder:
      "Ex. : contre-visite freins, préparation avant CT, explication points de contrôle, centre agréé…",
    inspireContext:
      "vérification point par point, affichage conforme ou conseil correction, vignette validée",
  },
  {
    label: "Dépanneur automobile",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "dépanneuse sur route, plateau, véhicule en panne, gyrophares, attache sécurisée, intervention urgence",
    stylePlaceholder:
      "Ex. : panne batterie autoroute, remorquage accident, crevaison, déblocage véhicule, assistance 24h…",
    inspireContext:
      "panne sur place, mise en sécurité, remorquage ou réparation rapide, client rassuré",
  },
  {
    label: "Vitrage auto",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "pare-brise ou vitre latérale, ventouse, colle spécifique, découpe film, atelier mobile ou fixe",
    stylePlaceholder:
      "Ex. : remplacement pare-brise, impact réparé, vitre teintée, lunette arrière, franchise assurance…",
    inspireContext:
      "impact étoile montré, pose ou résine, vitre propre et étanchéité testée",
  },
];
