import type { VwsMetierProfile } from "./types";

/** Espaces verts & extérieur — 12 métiers */
export const ESPACE_VERT_METIER_PROFILES: VwsMetierProfile[] = [
  {
    label: "Jardinier",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "jardin privé ou copropriété, pelouse tondue, massifs, bordures, outils manuels ou tondeuse, déchets verts",
    stylePlaceholder:
      "Ex. : entretien mensuel, désherbage, plantation arbustes, arrosage manuel, remise en état jardin abandonné…",
    inspireContext:
      "zone en friche puis jardin net, geste d’entretien régulier, résultat vert et structuré",
  },
  {
    label: "Paysagiste",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "création jardin, terrasse végétalisée, plan masse, plantation arbres, éclairage extérieur, finitions haut de gamme",
    stylePlaceholder:
      "Ex. : jardin contemporain, bassin ornamental, allée gravier, muret pierre, projet clé en main…",
    inspireContext:
      "avant terrain nu, pose végétaux et minéral, rendu paysager abouti",
  },
  {
    label: "Tondeur de pelouse",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "pelouse résidentielle ou parc, tondeuse tractée ou autoportée, lignes droites, ramassage herbe, bordures nettes",
    stylePlaceholder:
      "Ex. : tonte hebdomadaire, 1re tonte printemps, entretien copropriété, mulching, scarification…",
    inspireContext:
      "herbe haute puis pelouse régulière, passage tondeuse, finition bordures",
  },
  {
    label: "Élagueur",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "arbre en hauteur, harnais et corde, tronçonneuse, branches au sol, sécurité EPI, accès nacelle ou grimpe",
    stylePlaceholder:
      "Ex. : élagage sécurité route, abattage dirigé, haubanage, débroussaillage sous lignes, nettoyage couronne…",
    inspireContext:
      "branche à risque identifiée, coupe contrôlée, arbre équilibré et site sécurisé",
  },
  {
    label: "Arboriste",
    recommendedVideoFormatId: "humain_face_expert",
    environmentHint:
      "diagnostic arbre, billet sanitaire, soins phytosanitaires, plantation jeune sujet, conseil mairie ou particulier",
    stylePlaceholder:
      "Ex. : traitement chancre, plantation tilleul, diagnostic avant extension, taille douce patrimoine…",
    inspireContext:
      "examen tronc et feuillage, geste de soin ou plantation, arbre pérenne mis en valeur",
  },
  {
    label: "Tailleur de haies",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "haie taillée au cordeau, taille-haie, récupérateur, clôture végétale régulière, jardin périurbain",
    stylePlaceholder:
      "Ex. : haie laurier 20 m, topiaire boule, réduction hauteur vue, taille 2 fois par an…",
    inspireContext:
      "haie brouillon puis lignes droites nettes, geste répétitif, façade harmonisée",
  },
  {
    label: "Pépiniériste",
    recommendedVideoFormatId: "produit_demo",
    environmentHint:
      "pépinière, rangées de plants, étiquetage variétés, conseil client, rempotage ou mise en terre démo",
    stylePlaceholder:
      "Ex. : haie persistante kit, arbres fruitiers, plantes méditerranéennes, conseil sol calcaire, promo saison…",
    inspireContext:
      "présentation variété, conseil exposition, client qui choisit plants sains",
  },
  {
    label: "Pisciniste paysager",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "bassin naturel ou piscine intégrée jardin, liner, filtration discrète, plage bois, végétation périphérique",
    stylePlaceholder:
      "Ex. : piscine miroir, bassin naturel, plage travertin, éclairage bassin, entretien eau verte…",
    inspireContext:
      "terrassement bassin, étanchéité, remplissage eau claire et intégration végétale",
  },
  {
    label: "Aménageur de terrasse",
    recommendedVideoFormatId: "process_timelapse",
    environmentHint:
      "terrasse extérieure bois ou pierre, pergola, garde-corps, évacuation eaux, liaison maison jardin",
    stylePlaceholder:
      "Ex. : terrasse ipé sur plots, pergola bioclimatique, store banne, cuisine d’été extérieure…",
    inspireContext:
      "structure lambourdes, pose finition, espace de vie extérieur utilisable",
  },
  {
    label: "Maçon paysagiste",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "muret pierre, escalier extérieur béton ou pierre, bordure béton, dallage jardin, fondations pergola",
    stylePlaceholder:
      "Ex. : muret soutènement, escalier jardin 5 marches, bordure pavés, dalle béton désactivé…",
    inspireContext:
      "fondations ou murs montés, finition pierre, intégration dans pente jardin",
  },
  {
    label: "Fontainier",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "fontaine décorative, pompe, bac étanche, pierre reconstituée, raccordement eau et électricité enterrés",
    stylePlaceholder:
      "Ex. : fontaine murale, bassin koï, cascade pierre, éclairage LED bassin, hivernage…",
    inspireContext:
      "eau qui s’écoule, réglage débit, ambiance zen et étanchéité vérifiée",
  },
  {
    label: "Agriculteur / maraîcher",
    recommendedVideoFormatId: "process_timelapse",
    environmentHint:
      "parcelle maraîchère, serre tunnel, rangées légumes, récolte, tracteur léger ou outils manuels",
    stylePlaceholder:
      "Ex. : vente directe ferme, paniers légumes, culture bio tomates, saison plantation, marché local…",
    inspireContext:
      "semis ou récolte, geste producteur, panier plein et fraîcheur visible",
  },
];
