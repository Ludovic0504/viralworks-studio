import { getFormatById } from "./vwsVideoFormatsCatalog";

/**
 * Contraint ou écrase le mode MODE_A/MODE_B issu du Clarify Gate
 * selon la catégorie du format vidéo choisi.
 *
 * Règles déterministes par categoryId :
 * - humain  → toujours MODE_B (humain face caméra dès le frame 0)
 * - social  → MODE_B par défaut (selfie/face caméra dominant)
 * - process → MODE_A par défaut, sauf formats avec artisan visible au départ
 * - storytelling → gate conservé (trop variable)
 * - produit → MODE_A par défaut, sauf test/review et démo (mains visibles)
 * - inconnu/null → gate conservé
 */
export function resolveClarifyModeForFormat(
  gateMode: "MODE_A" | "MODE_B" | null,
  videoFormatId: string | null | undefined
): "MODE_A" | "MODE_B" | null {
  if (!videoFormatId) return gateMode;

  const format = getFormatById(videoFormatId);
  if (!format) return gateMode;

  const categoryId = format.categoryId;

  const FORCE_MODE_B_CATEGORIES = ["humain", "social"];
  if (FORCE_MODE_B_CATEGORIES.includes(categoryId)) return "MODE_B";

  const PROCESS_MODE_B_IDS = [
    "process_demo_geste",
    "process_step_by_step",
    "process_coulisses",
    "process_erreur_correction",
  ];
  if (categoryId === "process") {
    return PROCESS_MODE_B_IDS.includes(videoFormatId) ? "MODE_B" : "MODE_A";
  }

  const PRODUIT_MODE_B_IDS = ["produit_test_review", "produit_demo"];
  if (categoryId === "produit") {
    return PRODUIT_MODE_B_IDS.includes(videoFormatId) ? "MODE_B" : "MODE_A";
  }

  return gateMode;
}
