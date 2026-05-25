/**
 * Catalogue des 106 métiers (10 catégories) — libellés UI et recherche combobox.
 * Les profils VWS (environmentHint, etc.) sont dans vwsMetiersProfiles/.
 */

export interface MetierCategory {
  id: string;
  label: string;
  items: string[];
}

export const METIERS_CATEGORIES: MetierCategory[] = [
  {
    id: "batiment",
    label: "Gros œuvre & bâtiment",
    items: [
      "Maçon",
      "Carreleur",
      "Plâtrier",
      "Charpentier",
      "Couvreur",
      "Couvreur-zingueur",
      "Façadier",
      "Poseur de sols",
      "Ravaleur de façades",
      "Jointeur",
      "Terrassier",
      "Coffreur-bancheur",
      "Ferronnier",
      "Soudeur",
      "Tailleur de pierre",
    ],
  },
  {
    id: "second_oeuvre",
    label: "Second œuvre & finitions",
    items: [
      "Peintre en bâtiment",
      "Menuisier",
      "Ébéniste",
      "Vitrier",
      "Poseur de fenêtres",
      "Poseur de cloisons",
      "Isolation thermique",
      "Plaquiste",
      "Parqueteur",
      "Décorateur d'intérieur",
      "Cuisiniste",
      "Poseur de terrasses",
      "Miroitier",
    ],
  },
  {
    id: "technic",
    label: "Technique & installation",
    items: [
      "Plombier",
      "Électricien",
      "Chauffagiste",
      "Climatisation / VMC",
      "Énergéticien (pompe à chaleur)",
      "Installateur solaire",
      "Domoticien",
      "Ramoneur",
      "Pisciniste",
      "Serrurier",
      "Métallier",
      "Automaticien portails & volets",
      "Installateur alarme / vidéosurveillance",
      "Technicien fibre optique",
    ],
  },
  {
    id: "espace_vert",
    label: "Espaces verts & extérieur",
    items: [
      "Jardinier",
      "Paysagiste",
      "Tondeur de pelouse",
      "Élagueur",
      "Arboriste",
      "Tailleur de haies",
      "Pépiniériste",
      "Pisciniste paysager",
      "Aménageur de terrasse",
      "Maçon paysagiste",
      "Fontainier",
      "Agriculteur / maraîcher",
    ],
  },
  {
    id: "auto",
    label: "Auto & mécanique",
    items: [
      "Garagiste / mécanicien",
      "Carrossier",
      "Électricien automobile",
      "Préparateur auto",
      "Mécanicien moto",
      "Concessionnaire",
      "Contrôle technique",
      "Dépanneur automobile",
      "Vitrage auto",
    ],
  },
  {
    id: "service",
    label: "Services aux particuliers",
    items: [
      "Déménageur",
      "Nettoyage professionnel",
      "Aide à domicile",
      "Garde d'animaux / toiletteur",
      "Laveur de vitres",
      "Débouchage canalisations",
      "Dépannage électroménager",
      "Agent de sécurité",
      "Ambulancier / VSL",
    ],
  },
  {
    id: "restauration",
    label: "Restauration & alimentation",
    items: [
      "Restaurateur",
      "Traiteur",
      "Boulanger / Pâtissier",
      "Boucher / Charcutier",
      "Food truck",
      "Glacier",
      "Chocolatier",
      "Poissonnier",
      "Cave à vins",
    ],
  },
  {
    id: "beaute",
    label: "Beauté & bien-être",
    items: [
      "Coiffeur",
      "Barbier",
      "Esthéticienne",
      "Onglerie / nail art",
      "Maquilleur professionnel",
      "Masseur / spa",
      "Tatoueur",
      "Opticien",
      "Prothésiste dentaire",
    ],
  },
  {
    id: "sante_sport",
    label: "Santé & sport",
    items: [
      "Coach sportif",
      "Salle de sport",
      "Ostéopathe",
      "Kiné",
      "Diététicien",
      "Yoga / pilates",
      "Arts martiaux",
      "Piscine & natation",
    ],
  },
  {
    id: "immo",
    label: "Immobilier & habitat",
    items: [
      "Agent immobilier",
      "Architecte",
      "Architecte d'intérieur",
      "Promoteur",
      "Géomètre",
      "Expert immobilier",
      "Gestionnaire de biens",
      "Diagnostiqueur immobilier",
    ],
  },
];

/** Liste à plat des 106 libellés (ordre catégories). */
export const ALL_METIERS = METIERS_CATEGORIES.flatMap((c) => c.items) as readonly string[];

export type Metier = (typeof ALL_METIERS)[number];

/** Vérifie qu’un libellé fait partie du catalogue. */
export function isKnownMetierLabel(label: string): boolean {
  const t = (label || "").trim();
  return t.length > 0 && (ALL_METIERS as readonly string[]).includes(t);
}
