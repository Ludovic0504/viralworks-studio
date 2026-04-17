import { getBrowserSupabase } from "./client-navigateur";

/** Même UUIDs que la migration SQL pour un import idempotent côté client. */
export const INFORMATIONS_UTILES_SECTION_IDS = {
  prompts: "a1000000-0000-4000-8000-000000000001",
  images: "a1000000-0000-4000-8000-000000000002",
  workflow: "a1000000-0000-4000-8000-000000000003",
  tips: "a1000000-0000-4000-8000-000000000004",
} as const;

export const INFORMATIONS_UTILES_DEFAULT_SECTIONS = [
  {
    id: INFORMATIONS_UTILES_SECTION_IDS.prompts,
    slug: "prompts",
    title: "Création de prompts",
    icon_name: "FileText",
    color: "cyan" as const,
    sort_order: 0,
    is_active: true,
  },
  {
    id: INFORMATIONS_UTILES_SECTION_IDS.images,
    slug: "images",
    title: "Génération d'images",
    icon_name: "ImageIcon",
    color: "violet" as const,
    sort_order: 1,
    is_active: true,
  },
  {
    id: INFORMATIONS_UTILES_SECTION_IDS.workflow,
    slug: "workflow",
    title: "Workflow optimisé",
    icon_name: "Zap",
    color: "yellow" as const,
    sort_order: 2,
    is_active: true,
  },
  {
    id: INFORMATIONS_UTILES_SECTION_IDS.tips,
    slug: "tips",
    title: "Conseils pratiques",
    icon_name: "Lightbulb",
    color: "emerald" as const,
    sort_order: 3,
    is_active: true,
  },
];

export const INFORMATIONS_UTILES_DEFAULT_SECTION_ID_SET = new Set(
  INFORMATIONS_UTILES_DEFAULT_SECTIONS.map((s) => s.id)
);

export const INFORMATIONS_UTILES_DEFAULT_ITEMS = [
  {
    id: "b2000000-0000-4000-8000-000000000001",
    section_id: INFORMATIONS_UTILES_SECTION_IDS.prompts,
    title: "Structure efficace",
    content:
      "Commence par définir le contexte, puis l'action principale, et termine par le style souhaité. Exemple : 'Un développeur dans un bureau moderne, en train de coder sur un écran lumineux, style cinématique avec éclairage dramatique'.",
    example: "Contexte -> Action -> Style",
    sort_order: 0,
  },
  {
    id: "b2000000-0000-4000-8000-000000000002",
    section_id: INFORMATIONS_UTILES_SECTION_IDS.prompts,
    title: "Détails techniques",
    content:
      "Spécifie la caméra, l'éclairage et le ton. Pour VEO3, utilise les paramètres Scene, Style, Camera, Lighting et Tone pour un contrôle précis du rendu final.",
    example: "Camera: close-up | Lighting: golden hour",
    sort_order: 1,
  },
  {
    id: "b2000000-0000-4000-8000-000000000003",
    section_id: INFORMATIONS_UTILES_SECTION_IDS.prompts,
    title: "Dialogues en français",
    content:
      "Pour les vidéos avec dialogues, indique clairement les répliques en français. Le système traduira et adaptera automatiquement la prononciation.",
    example: "Dialogue: 'Bonjour, comment allez-vous ?'",
    sort_order: 2,
  },
  {
    id: "b2000000-0000-4000-8000-000000000004",
    section_id: INFORMATIONS_UTILES_SECTION_IDS.images,
    title: "Descriptions précises",
    content:
      "Plus ta description est détaillée, meilleur sera le résultat. Mentionne la composition, les couleurs, l'ambiance et le style artistique souhaité.",
    example: "Portrait d'une femme, style réaliste, éclairage doux, fond flou",
    sort_order: 0,
  },
  {
    id: "b2000000-0000-4000-8000-000000000005",
    section_id: INFORMATIONS_UTILES_SECTION_IDS.images,
    title: "Personnages de référence",
    content:
      "Utilise l'option de personnage de référence pour maintenir la cohérence visuelle dans une série d'images. Idéal pour créer des personnages récurrents.",
    example: "Même personnage, différentes poses",
    sort_order: 1,
  },
  {
    id: "b2000000-0000-4000-8000-000000000006",
    section_id: INFORMATIONS_UTILES_SECTION_IDS.images,
    title: "Formats adaptés",
    content:
      "Choisis le format selon l'usage : carré pour Instagram, paysage pour bannières, portrait pour stories. Chaque format a son impact visuel.",
    example: "16:9 pour vidéos | 1:1 pour posts",
    sort_order: 2,
  },
  {
    id: "b2000000-0000-4000-8000-000000000007",
    section_id: INFORMATIONS_UTILES_SECTION_IDS.workflow,
    title: "Organisation par projets",
    content:
      "Regroupe tes créations par projet pour garder une vue d'ensemble. Un projet peut contenir plusieurs prompts, images et vidéos liés.",
    example: "Projet 'Campagne Marketing' -> 5 prompts, 10 images",
    sort_order: 0,
  },
  {
    id: "b2000000-0000-4000-8000-000000000008",
    section_id: INFORMATIONS_UTILES_SECTION_IDS.workflow,
    title: "Historique intelligent",
    content:
      "Tous tes contenus sont sauvegardés automatiquement. Tu peux retrouver, modifier et réutiliser n'importe quelle création précédente.",
    example: "Accès rapide aux dernières créations",
    sort_order: 1,
  },
  {
    id: "b2000000-0000-4000-8000-000000000009",
    section_id: INFORMATIONS_UTILES_SECTION_IDS.workflow,
    title: "Itérations rapides",
    content:
      "Teste plusieurs variations en ajustant légèrement tes prompts. Les meilleurs résultats viennent souvent de petites modifications successives.",
    example: "Version 1 -> Ajustement -> Version 2 -> Final",
    sort_order: 2,
  },
  {
    id: "b2000000-0000-4000-8000-000000000010",
    section_id: INFORMATIONS_UTILES_SECTION_IDS.tips,
    title: "Commence simple",
    content:
      "Pour tes premiers essais, utilise des prompts courts et clairs. Une fois que tu maîtrises, tu peux ajouter plus de détails et de complexité.",
    example:
      "Simple: 'Un chat dans un jardin' -> Avancé: 'Un chat persan orange dans un jardin japonais, style photographie macro, éclairage naturel matinal'",
    sort_order: 0,
  },
  {
    id: "b2000000-0000-4000-8000-000000000011",
    section_id: INFORMATIONS_UTILES_SECTION_IDS.tips,
    title: "Expérimente les styles",
    content:
      "N'hésite pas à tester différents styles artistiques : réaliste, cartoon, cinématique, abstrait. Chaque style apporte une émotion différente.",
    example: "Même sujet, styles différents = résultats uniques",
    sort_order: 1,
  },
  {
    id: "b2000000-0000-4000-8000-000000000012",
    section_id: INFORMATIONS_UTILES_SECTION_IDS.tips,
    title: "Sauvegarde tes favoris",
    content:
      "Quand tu trouves un prompt qui fonctionne bien, sauvegarde-le comme modèle. Tu pourras le réutiliser et l'adapter pour d'autres créations.",
    example: "Modèles réutilisables dans l'historique",
    sort_order: 2,
  },
];

export type ImporterDefautResult = {
  success: boolean;
  error?: string;
  /** true si des lignes ont été insérées */
  inserted?: boolean;
  /** true si la table avait déjà des catégories */
  skippedAlreadyPresent?: boolean;
};

/**
 * Crée les 4 lignes de catégories d’origine si elles manquent (ignore les doublons).
 * Permet à l’admin d’éditer sans import complet des fiches.
 */
export async function ensureDefaultSectionsInDb(): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();
  for (const row of INFORMATIONS_UTILES_DEFAULT_SECTIONS) {
    const { error } = await supabase.from("informations_utiles_sections").insert(row);
    if (error) {
      if (error.code === "23505") continue;
      const m = (error.message ?? "").toLowerCase();
      if (m.includes("duplicate") || m.includes("unique")) continue;
      return { success: false, error: error.message };
    }
  }
  return { success: true };
}

/**
 * Insère les 4 catégories et 12 fiches d’origine (admin uniquement, RLS).
 * Sans effet si au moins une catégorie existe déjà.
 */
export async function importerContenuInformationsUtilesDefautDepuisLApp(): Promise<ImporterDefautResult> {
  const supabase = getBrowserSupabase();

  const { count: sectionCount, error: secCountErr } = await supabase
    .from("informations_utiles_sections")
    .select("*", { count: "exact", head: true });

  if (secCountErr) {
    return { success: false, error: secCountErr.message };
  }

  const { count: itemCount, error: itemCountErr } = await supabase
    .from("informations_utiles_items")
    .select("*", { count: "exact", head: true });

  if (itemCountErr) {
    return { success: false, error: itemCountErr.message };
  }

  if ((itemCount ?? 0) >= 10) {
    return { success: true, skippedAlreadyPresent: true, inserted: false };
  }

  if ((sectionCount ?? 0) === 0) {
    const { error: e1 } = await supabase.from("informations_utiles_sections").insert(INFORMATIONS_UTILES_DEFAULT_SECTIONS);
    if (e1) {
      return { success: false, error: e1.message };
    }
    const { error: e2 } = await supabase.from("informations_utiles_items").insert(INFORMATIONS_UTILES_DEFAULT_ITEMS);
    if (e2) {
      return { success: false, error: e2.message };
    }
    return { success: true, inserted: true };
  }

  if ((itemCount ?? 0) === 0) {
    const { error: e2 } = await supabase.from("informations_utiles_items").insert(INFORMATIONS_UTILES_DEFAULT_ITEMS);
    if (e2) {
      return {
        success: false,
        error: `${e2.message} — Si vous avez créé des catégories vides à la main, supprimez-les ou réappliquez la migration avec les bons identifiants.`,
      };
    }
    return { success: true, inserted: true };
  }

  return { success: true, skippedAlreadyPresent: true, inserted: false };
}
