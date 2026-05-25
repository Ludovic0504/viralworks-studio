/**
 * Catalogue Avatar IA : 106 métiers alignés sur metiersCategories + accessoires prompts.
 */

import { ALL_METIERS, METIERS_CATEGORIES } from "../metiersCategories";

export function metierLabelToSlug(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Anciens slugs configs Avatar → slug canonique (106 métiers). */
export const AVATAR_METIER_SLUG_ALIASES: Record<string, string> = {
  climaticien: "climatisation_vmc",
  peintre: "peintre_en_batiment",
};

const LABEL_TO_CATEGORY = new Map<string, string>(
  METIERS_CATEGORIES.flatMap((c) => c.items.map((label) => [label, c.id] as const))
);

const CATEGORY_DEFAULT_ACCESSOIRES: Record<string, string> = {
  batiment: "gants de protection, casque de chantier",
  second_oeuvre: "ceinture porte-outils, lunettes de protection",
  technic: "ceinture porte-outils, gants de travail",
  espace_vert: "gants de jardinage, sécateur",
  auto: "clés, chiffon, outils de garage",
  service: "gants, équipement de service",
  restauration: "tablier, torchon professionnel",
  beaute: "peigne, ciseaux, serviette",
  sante_sport: "serviette, tenue professionnelle",
  immo: "tablette, clés ou dossier",
};

/** Accessoires détaillés par libellé métier (prioritaire sur défaut catégorie). */
const ACCESSOIRES_BY_LABEL: Record<string, string> = {
  // batiment
  Maçon: "gants de protection, casque de chantier, niveau à bulle",
  Carreleur: "genouillères, gants, spatule",
  Plâtrier: "gants, truelle, ceinture outils",
  Charpentier: "ceinture harnais, mètre, crayon charpentier",
  Couvreur: "harnais de sécurité, casque",
  "Couvreur-zingueur": "harnais, gants de soudeur légers",
  Façadier: "harnais, lunettes de protection",
  "Poseur de sols": "genouillères, coupe-joint",
  "Ravaleur de façades": "lunettes, gants, lance haute pression",
  Jointeur: "gants, raclette à joint",
  Terrassier: "casque, gants de manutention",
  "Coffreur-bancheur": "casque, gants, marteau",
  Ferronnier: "gants de soudure, lunettes",
  Soudeur: "masque de soudure, gants",
  "Tailleur de pierre": "lunettes, gants, boucharde",
  // second_oeuvre
  "Peintre en bâtiment": "gants fins, tablier de peintre, rouleau",
  Menuisier: "ceinture porte-outils, lunettes de protection",
  Ébéniste: "lunettes, ciseau à bois, serre-joint",
  Vitrier: "gants de manutention, ventouses",
  "Poseur de fenêtres": "mètre, niveau, gants",
  "Poseur de cloisons": "ceinture outils, visseuse",
  "Isolation thermique": "masque, gants, cutter",
  Plaquiste: "gants, couteau à enduit",
  Parqueteur: "genouillères, marteau à parquet",
  "Décorateur d'intérieur": "échantillons tissus, mètre",
  Cuisiniste: "mètre, crayon, plan",
  "Poseur de terrasses": "gants, niveau",
  Miroitier: "gants, ventouses",
  // technic
  Plombier: "ceinture porte-outils, gants de travail",
  Électricien: "ceinture porte-outils, mètre ruban",
  Chauffagiste: "carnet technique, manomètre",
  "Climatisation / VMC": "carnet technique, manomètre, stylo",
  "Énergéticien (pompe à chaleur)": "manomètre, carnet de relevés",
  "Installateur solaire": "casque, gants, multimètre",
  Domoticien: "tablette, tournevis testeur",
  Ramoneur: "brosse, aspirateur professionnel",
  Pisciniste: "filet, testeur eau, gants",
  Serrurier: "trousse de serrurier, tournevis",
  Métallier: "gants de soudure, lunettes",
  "Automaticien portails & volets": "télécommande test, tournevis",
  "Installateur alarme / vidéosurveillance": "perceuse, testeur câble",
  "Technicien fibre optique": "soudeuse fibre, testeur optique",
  // espace_vert
  Jardinier: "gants de jardinage, sécateur",
  Paysagiste: "gants, sécateur, mètre",
  "Tondeur de pelouse": "lunettes, bouchons oreilles",
  Élagueur: "harnais, casque, tronçonneuse (au repos)",
  Arboriste: "casque, gants, corde",
  "Tailleur de haies": "gants, taille-haie (au repos)",
  Pépiniériste: "gants, arrosoir",
  "Pisciniste paysager": "épuisette, testeur eau",
  "Aménageur de terrasse": "gants, niveau",
  "Maçon paysagiste": "gants, truelle",
  Fontainier: "gants, clé à molette",
  "Agriculteur / maraîcher": "gants, panier de récolte",
  // auto
  "Garagiste / mécanicien": "clés, chiffon, lampe atelier",
  Carrossier: "masque peinture, pistolet (au repos)",
  "Électricien automobile": "valise diagnostic, multimètre",
  "Préparateur auto": "chiffon microfibre, gants",
  "Mécanicien moto": "clés, gants",
  Concessionnaire: "clés véhicule, dossier client",
  "Contrôle technique": "tablette, gilet réfléchissant",
  "Dépanneur automobile": "gilet haute visibilité, triangle",
  "Vitrage auto": "ventouses, gants",
  // service
  Déménageur: "gants de manutention, sangle",
  "Nettoyage professionnel": "gants, pulvérisateur",
  "Aide à domicile": "sac de courses, gants",
  "Garde d'animaux / toiletteur": "laisse, brosse toilettage",
  "Laveur de vitres": "raclette, seau",
  "Débouchage canalisations": "gants, caméra inspection",
  "Dépannage électroménager": "tournevis, multimètre",
  "Agent de sécurité": "radio, lampe torche",
  "Ambulancier / VSL": "gants médicaux, tensiomètre",
  // restauration
  Restaurateur: "tablier, torchon",
  Traiteur: "tablier, gants alimentaires",
  "Boulanger / Pâtissier": "tablier, toque",
  "Boucher / Charcutier": "tablier, gants, couteau (fourreau)",
  "Food truck": "tablier, gants",
  Glacier: "tablier, spatule",
  Chocolatier: "tablier, spatule",
  Poissonnier: "tablier, gants, couteau (fourreau)",
  "Cave à vins": "tire-bouchon, ardoise",
  // beaute
  Coiffeur: "peigne, ciseaux",
  Barbier: "tondeuse, peigne",
  Esthéticienne: "gants, serviettes",
  "Onglerie / nail art": "lime, pinceau vernis",
  "Maquilleur professionnel": "pinceaux maquillage, éponge",
  "Masseur / spa": "serviettes, huile",
  Tatoueur: "gants, machine (au repos)",
  Opticien: "lunettes de test, chiffon",
  "Prothésiste dentaire": "gants, masque, loupe",
  // sante_sport
  "Coach sportif": "sifflet, chronomètre",
  "Salle de sport": "serviette, gourde",
  Ostéopathe: "serviette, gants",
  Kiné: "élastique thérapeutique, serviette",
  Diététicien: "carnet, balance",
  "Yoga / pilates": "tapis, serviette",
  "Arts martiaux": "ceinture, gants",
  "Piscine & natation": "sifflet, planche",
  // immo
  "Agent immobilier": "clés, dossier bien",
  Architecte: "plan, crayon, équerre",
  "Architecte d'intérieur": "échantillons, mètre",
  Promoteur: "casque, plan chantier",
  Géomètre: "station totale, bornes",
  "Expert immobilier": "dossier, tablette",
  "Gestionnaire de biens": "clés, trousseau",
  "Diagnostiqueur immobilier": "testeur, mètre",
};

function accessoiresForLabel(label: string): string {
  if (ACCESSOIRES_BY_LABEL[label]) return ACCESSOIRES_BY_LABEL[label];
  const cat = LABEL_TO_CATEGORY.get(label);
  return (cat && CATEGORY_DEFAULT_ACCESSOIRES[cat]) || "accessoires de travail adaptés au métier";
}

function buildAccessoiresParMetier(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const label of ALL_METIERS) {
    map[metierLabelToSlug(label)] = accessoiresForLabel(label);
  }
  for (const [legacy, canonical] of Object.entries(AVATAR_METIER_SLUG_ALIASES)) {
    if (map[canonical]) map[legacy] = map[canonical];
  }
  return map;
}

export const ACCESSOIRES_PAR_METIER: Record<string, string> = buildAccessoiresParMetier();

export const METIERS = [...ALL_METIERS]
  .sort((a, b) => a.localeCompare(b, "fr"))
  .map((label) => ({
    value: metierLabelToSlug(label),
    label,
  }));

export function resolveAvatarMetierSlug(slug: string): string {
  const t = (slug || "").trim();
  if (!t) return t;
  return AVATAR_METIER_SLUG_ALIASES[t] ?? t;
}

export function resolveAvatarMetierLabel(slug: string): string {
  const canonical = resolveAvatarMetierSlug(slug);
  const found = METIERS.find((m) => m.value === canonical);
  if (found) return found.label;
  const legacy = METIERS.find((m) => m.value === slug);
  return legacy?.label ?? slug;
}
