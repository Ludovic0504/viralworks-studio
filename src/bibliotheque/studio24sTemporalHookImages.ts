/**
 * Accroches temporelles 24s (triple vignette auto : Début / Transformation / Résultat).
 * Quand cette option est active, `Image.jsx` génère en arrière-plan les images scène 2 et 3
 * à partir de l’image 1 sélectionnée (NanoBanana puis fallback Hailuo selon la logique existante).
 *
 * Désactivation temporaire : tout est coupé si `false` ici ET pas de variable d’env.
 *
 * Réactiver facilement :
 * 1) Mettre `STUDIO_24S_TEMPORAL_HOOK_IMAGES_CODE_SWITCH` à `true` ci-dessous, ou
 * 2) Dans `.env` : `VITE_STUDIO_24S_TEMPORAL_HOOK_IMAGES=1` (ou `true`)
 */
const STUDIO_24S_TEMPORAL_HOOK_IMAGES_CODE_SWITCH = false;

const fromEnv =
  import.meta.env.VITE_STUDIO_24S_TEMPORAL_HOOK_IMAGES === "true" ||
  import.meta.env.VITE_STUDIO_24S_TEMPORAL_HOOK_IMAGES === "1";

export const STUDIO_24S_TEMPORAL_HOOK_IMAGES_ENABLED =
  STUDIO_24S_TEMPORAL_HOOK_IMAGES_CODE_SWITCH || fromEnv;
