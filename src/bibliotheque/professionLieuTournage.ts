/**
 * Préremplissage « Où se passe la vidéo » selon le métier (106 libellés + alias legacy).
 */

import { METIERS_CATEGORIES } from "./metiersCategories";
import { PROFESSION_LABEL_ALIASES } from "./vwsMetiersConfig";

export type LieuTournageId = "chez_client" | "etablissement" | "neutre";

const CATEGORY_DEFAULT_LIEU: Record<string, LieuTournageId> = {
  batiment: "chez_client",
  second_oeuvre: "chez_client",
  technic: "chez_client",
  espace_vert: "neutre",
  auto: "etablissement",
  service: "chez_client",
  restauration: "etablissement",
  beaute: "etablissement",
  sante_sport: "etablissement",
  immo: "neutre",
};

/** Surcharges par libellé (prioritaire sur le défaut catégorie). */
const LIEU_OVERRIDES: Record<string, LieuTournageId> = {
  // Gros œuvre — extérieur / toiture / terrassement
  Charpentier: "neutre",
  Couvreur: "neutre",
  "Couvreur-zingueur": "neutre",
  Façadier: "neutre",
  "Ravaleur de façades": "neutre",
  Terrassier: "neutre",
  Ferronnier: "etablissement",
  Soudeur: "etablissement",
  // Second œuvre — atelier / showroom
  Ébéniste: "etablissement",
  Vitrier: "etablissement",
  Cuisiniste: "etablissement",
  Miroitier: "etablissement",
  "Poseur de terrasses": "neutre",
  // Technique
  Pisciniste: "neutre",
  Métallier: "etablissement",
  "Installateur solaire": "neutre",
  // Auto
  "Dépanneur automobile": "neutre",
  Concessionnaire: "etablissement",
  // Services
  "Agent de sécurité": "etablissement",
  "Ambulancier / VSL": "neutre",
  "Nettoyage professionnel": "chez_client",
  // Restauration
  "Food truck": "neutre",
  // Santé & sport
  "Coach sportif": "neutre",
  "Piscine & natation": "etablissement",
  // Immo
  "Agent immobilier": "neutre",
  Promoteur: "neutre",
  Géomètre: "neutre",
  "Expert immobilier": "etablissement",
  "Gestionnaire de biens": "etablissement",
  "Diagnostiqueur immobilier": "chez_client",
  Architecte: "chez_client",
  "Architecte d'intérieur": "chez_client",
};

function buildProfessionToLieuTournage(): Record<string, LieuTournageId> {
  const map: Record<string, LieuTournageId> = {};

  for (const category of METIERS_CATEGORIES) {
    const defaultLieu = CATEGORY_DEFAULT_LIEU[category.id] ?? "neutre";
    for (const label of category.items) {
      map[label] = LIEU_OVERRIDES[label] ?? defaultLieu;
    }
  }

  for (const [legacyLabel, canonical] of Object.entries(PROFESSION_LABEL_ALIASES)) {
    if (typeof canonical === "string") {
      map[legacyLabel] = map[canonical] ?? map[legacyLabel] ?? "neutre";
    } else {
      map[legacyLabel] = "etablissement";
    }
  }

  return map;
}

export const PROFESSION_TO_LIEU_TOURNAGE: Record<string, LieuTournageId> =
  buildProfessionToLieuTournage();

export function getLieuTournageForProfession(professionLabel: string): LieuTournageId | null {
  const t = (professionLabel || "").trim();
  if (!t) return null;
  return PROFESSION_TO_LIEU_TOURNAGE[t] ?? null;
}
