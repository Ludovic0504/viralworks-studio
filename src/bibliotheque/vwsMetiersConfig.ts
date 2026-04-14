/**
 * Source unique : liste des métiers + paramètres métier pour Campagne VWS et vwsPromptEngine.
 * Tout nouveau métier ou ajustement se fait ici.
 */

export type VwsMetierProfile = {
  /** Libellé affiché dans le select (clé de correspondance avec campaignData.profession) */
  label: string;
  /** Injecté dans l’environnement visuel du moteur VWS quand les détails style sont vides ou en complément */
  environmentHint: string;
  /** Placeholder du champ « Détails supplémentaires » */
  stylePlaceholder: string;
  /** Court contexte ajouté au prompt « M’inspirer » (GPT) pour coller au terrain */
  inspireContext?: string;
};

export const VWS_METIER_PROFILES: VwsMetierProfile[] = [
  {
    label: "Agent immobilier",
    environmentHint:
      "bien réel en vente (appartement, maison, studio), entrée, pièce de vie, cuisine, salle d’eau, extérieur ou balcon selon le bien",
    stylePlaceholder: "Ex. : T3 rénové, style haussmannien, vue dégagée, quartier résidentiel, lumière naturelle…",
    inspireContext:
      "accroche sur le besoin client, visite courte pièce par pièce, focus points forts mesurables (surface, luminosité, extérieur)",
  },
  {
    label: "Restaurateur",
    environmentHint:
      "cuisine en service, plan de travail, dressage, salle ou terrasse, équipe en mouvement, plats prêts à servir",
    stylePlaceholder: "Ex. : service du midi, cuisine bistronomique, burger maison, four à pizza, ambiance du soir…",
    inspireContext: "préparation en cadence, dressage final, sortie de plat, réaction client en dégustation",
  },
  {
    label: "Coiffeur / barbier",
    environmentHint:
      "salon identifiable avec fauteuil, miroir, poste de travail, tondeuse, ciseaux, produits coiffants, lumière de miroir",
    stylePlaceholder: "Ex. : dégradé à blanc, taille de barbe, brushing, coloration, salon premium ou urbain…",
    inspireContext: "avant/après net, geste technique sur contour ou nuque, résultat final montré au miroir",
  },
  {
    label: "Garagiste / mécanicien",
    environmentHint:
      "atelier auto avec pont, valise diagnostic, outils, pièces démontées, véhicule client en intervention",
    stylePlaceholder: "Ex. : révision complète, freinage, distribution, diagnostic moteur, garage multimarque…",
    inspireContext: "problème client explicité, contrôle visuel, réparation en cours, test final véhicule",
  },
  {
    label: "Plombier",
    environmentHint:
      "intervention en salle de bain, cuisine ou local technique, fuite localisée, raccords, vannes, outillage plomberie",
    stylePlaceholder: "Ex. : fuite sous évier, remplacement robinet, débouchage, rénovation réseau eau chaude…",
    inspireContext: "constat du défaut, action de réparation, remise en eau et vérification d’étanchéité",
  },
  {
    label: "Électricien",
    environmentHint:
      "tableau électrique, prises, éclairages, câblage apparent en chantier, EPI et gestes de sécurité visibles",
    stylePlaceholder: "Ex. : mise aux normes NFC 15-100, ajout de prises, éclairage LED, domotique maison…",
    inspireContext: "diagnostic panne ou besoin, intervention claire au tableau, test final avec éclairage fonctionnel",
  },
  {
    label: "Chauffagiste / climatisation",
    environmentHint:
      "chaudière, pompe à chaleur, unité intérieure/extérieure, radiateurs ou plancher chauffant, instruments de mesure",
    stylePlaceholder: "Ex. : entretien chaudière gaz, dépannage PAC, installation clim split, optimisation consommation…",
    inspireContext: "contrôle des paramètres, entretien ou remplacement pièce, remise en service avec température stable",
  },
  {
    label: "Pisciniste",
    environmentHint:
      "bassin résidentiel, local technique, filtration, margelles, robot ou accessoires entretien, eau en condition réelle",
    stylePlaceholder: "Ex. : remise en route saison, traitement eau verte, installation pompe, entretien hebdomadaire…",
    inspireContext: "analyse qualité d’eau, action de traitement, réglage filtration, résultat eau claire",
  },
  {
    label: "Paysagiste / jardinier",
    environmentHint:
      "jardin privé ou copropriété, haies, pelouse, massifs, terrasse, outils d’entretien et déchets verts",
    stylePlaceholder: "Ex. : taille de haie, création massif, pose gazon, arrosage automatique, entretien saisonnier…",
    inspireContext: "avant/après zone traitée, geste professionnel, finition propre et visuellement nette",
  },
  {
    label: "Menuisier",
    environmentHint:
      "atelier bois ou pose sur chantier, établi, panneaux, machines de coupe, quincaillerie, éléments sur mesure",
    stylePlaceholder: "Ex. : placard sur mesure, escalier bois, pose porte intérieure, habillage mural…",
    inspireContext: "prise de cote, fabrication ou ajustage, pose finale et contrôle d’alignement",
  },
  {
    label: "Couvreur",
    environmentHint:
      "toiture en intervention, tuiles/ardoises/zinc, échafaudage, harnais, gouttières, conditions extérieures réalistes",
    stylePlaceholder: "Ex. : réparation fuite toiture, remplacement tuiles cassées, zinguerie, nettoyage toiture…",
    inspireContext: "zone défectueuse montrée, réparation sécurisée, contrôle d’écoulement ou d’étanchéité",
  },
  {
    label: "Maçon",
    environmentHint:
      "chantier gros œuvre ou rénovation, parpaings/briques, mortier, coffrage, ferraillage, niveaux et repères",
    stylePlaceholder: "Ex. : dalle béton, mur de clôture, ouverture de mur porteur, enduit de façade…",
    inspireContext: "mise en place précise, contrôle au niveau, progression du chantier visible à l’image",
  },
  {
    label: "Architecte / architecte d'intérieur",
    environmentHint:
      "plan 2D/3D, échantillons matériaux, chantier suivi ou intérieur finalisé, échanges client autour des choix",
    stylePlaceholder: "Ex. : rénovation appartement ancien, optimisation petit espace, conception cuisine, ambiance haut de gamme…",
    inspireContext: "problème d’aménagement posé, solution visuelle proposée, projection avant/après compréhensible",
  },
  {
    label: "Magasin de meubles / décoration",
    environmentHint:
      "showroom organisé par univers, meubles en situation, accessoires déco, client qui compare matières et dimensions",
    stylePlaceholder: "Ex. : salon complet, chambre moderne, style scandinave, offre promotionnelle en magasin…",
    inspireContext: "conseil client concret, mise en situation d’un meuble, argument confort/praticité/prix",
  },
  {
    label: "Coach sportif / salle de sport",
    environmentHint:
      "salle de sport active (musculation, cardio, functional), matériel utilisé, coach et pratiquant en séance réelle",
    stylePlaceholder: "Ex. : programme perte de poids, coaching force, remise en forme débutant, séance HIIT 30 min…",
    inspireContext: "objectif client clair, exercice démontré, correction posture, progression mesurable",
  },
];

export const VWS_METIER_LABELS: string[] = VWS_METIER_PROFILES.map((p) => p.label);

export function getVwsMetierProfile(professionLabel: string): VwsMetierProfile | null {
  const t = (professionLabel || "").trim();
  if (!t) return null;
  return VWS_METIER_PROFILES.find((p) => p.label === t) ?? null;
}

export function getVwsEnvironmentHint(professionLabel: string): string | null {
  return getVwsMetierProfile(professionLabel)?.environmentHint ?? null;
}
