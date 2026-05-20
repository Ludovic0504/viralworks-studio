export const AVATAR_CATEGORIES = [
  { id: "apparence", label: "Apparence" },
  { id: "tenue", label: "Tenue" },
  { id: "profession", label: "Profession" },
] as const;

export type AvatarCategoryId = (typeof AVATAR_CATEGORIES)[number]["id"];

export const GENRES = [
  { value: "homme", label: "Homme" },
  { value: "femme", label: "Femme" },
] as const;

export const MORPHOLOGIES = [
  { value: "mince", label: "Mince" },
  { value: "athletique", label: "Athlétique" },
  { value: "moyenne", label: "Moyenne" },
  { value: "robuste", label: "Robuste" },
] as const;

export const CARNATIONS = [
  { value: "claire", label: "Claire" },
  { value: "medium", label: "Medium" },
  { value: "mate", label: "Mate" },
  { value: "foncee", label: "Foncée" },
] as const;

export const STYLES_TENUE = [
  { value: "travail", label: "Tenue de travail" },
  { value: "casual", label: "Casual" },
  { value: "ville", label: "Tenue de ville" },
] as const;

export const COULEURS_DOMINANTES = [
  { value: "blanc", label: "Blanc", swatch: "#f5f5f5" },
  { value: "noir", label: "Noir", swatch: "#1a1a1a" },
  { value: "bleu", label: "Bleu", swatch: "#2563eb" },
  { value: "gris", label: "Gris", swatch: "#6b7280" },
  { value: "orange", label: "Orange", swatch: "#ea580c" },
  { value: "vert", label: "Vert", swatch: "#16a34a" },
] as const;

export const METIERS = [
  { value: "electricien", label: "Électricien" },
  { value: "plombier", label: "Plombier" },
  { value: "macon", label: "Maçon" },
  { value: "climaticien", label: "Climaticien" },
  { value: "menuisier", label: "Menuisier" },
  { value: "peintre", label: "Peintre" },
  { value: "carreleur", label: "Carreleur" },
  { value: "couvreur", label: "Couvreur" },
] as const;

export type OutputFormat = "face" | "triptyque";

/** Valeur fixe envoyée à l'API, jamais exposée dans l'UI. */
export const AVATAR_ENVIRONMENT = "studio" as const;

export interface AvatarConfig {
  activeCategory: AvatarCategoryId;
  genre: string | null;
  morphologie: string | null;
  age: number;
  carnation: string | null;
  styleTenue: string | null;
  couleurDominante: string | null;
  metier: string;
  accessoires: boolean;
  environment: typeof AVATAR_ENVIRONMENT;
  previewFaceUrl: string | null;
  previewTriptyqueUrl: string | null;
  generatingFace: boolean;
  generatingTriptyque: boolean;
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  activeCategory: "apparence",
  genre: null,
  morphologie: null,
  age: 35,
  carnation: null,
  styleTenue: null,
  couleurDominante: null,
  metier: "",
  accessoires: false,
  environment: AVATAR_ENVIRONMENT,
  previewFaceUrl: null,
  previewTriptyqueUrl: null,
  generatingFace: false,
  generatingTriptyque: false,
};
