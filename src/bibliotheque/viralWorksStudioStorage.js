/**
 * Clés et helpers de persistance pour ViralWorks Studio (navigation / brouillon).
 * Centralise les chaînes pour éviter les divergences entre pages (ex. Image.jsx).
 */

export const LS_VIRAL_STUDIO_DRAFT = "vws_studio_draft_v1";
/** Copie locale (tous onglets) — secours si sessionStorage vide (nouvel onglet). */
export const LS_IMAGE_STEP_KEY = "vws_studio_image_step_v1";
/** Copie par onglet — évite qu’un autre onglet écrase avec un état vide. */
export const SS_IMAGE_STEP_KEY = "vws_studio_image_step_session_v1";
/** Dernières grilles visuelles (secours UX + restauration après navigation). */
export const SS_VISUAL_SNAPSHOTS_KEY = "vws_studio_visual_snapshots_v1";
/** Miroir de l’idée campagne (le brouillon efface `idea` à l’enregistrement — pour rechargement UI). */
export const SS_CAMPAIGN_IDEA_LIVE_KEY = "vws_studio_campaign_idea_live_v1";
/** Étape courante, validations, cerveau préparé — secours si le layout est démonté (retour accueil). */
export const SS_SPA_UI_KEY = "vws_studio_spa_ui_v1";
/** Snapshot persistant du workflow ViralWorks (reprise cross-navigation). */
export const LS_VIRALWORKS_WORKFLOW_STATE_KEY = "viralworks_workflow_state";
/** Index persistant des médias du workflow (refs images/vidéos, timestamps). */
export const LS_VIRALWORKS_MEDIA_CACHE_KEY = "viralworks_media_cache";

/** Rechargement complet (F5) : ne pas réinjecter le brouillon visuel / SPA UI depuis la session. */
export function isReloadNavigation() {
  if (typeof performance === "undefined") return false;
  const entry = performance.getEntriesByType?.("navigation")?.[0];
  if (entry && "type" in entry) return entry.type === "reload";
  const legacy = performance.navigation;
  if (legacy && typeof legacy.type === "number") return legacy.type === 1;
  return false;
}

/**
 * Supprime les clés de session liées au studio (image, snapshots, SPA UI).
 * À appeler une seule fois par chargement de page en cas de reload (voir garde __vwsStudioReloadPurgeDone).
 */
export function clearViralWorksTransientSessionKeys() {
  try {
    sessionStorage.removeItem(SS_IMAGE_STEP_KEY);
    localStorage.removeItem(LS_IMAGE_STEP_KEY);
    sessionStorage.removeItem(SS_VISUAL_SNAPSHOTS_KEY);
    sessionStorage.removeItem(SS_SPA_UI_KEY);
  } catch {
    /* ignore */
  }
}

export function loadSpaUiStateFromSession() {
  if (isReloadNavigation()) return null;
  try {
    const raw = sessionStorage.getItem(SS_SPA_UI_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadViralStudioDraftFromLocal() {
  try {
    const raw = localStorage.getItem(LS_VIRAL_STUDIO_DRAFT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      campaign: parsed.campaign && typeof parsed.campaign === "object" ? parsed.campaign : {},
      scriptPrompt: typeof parsed.scriptPrompt === "string" ? parsed.scriptPrompt : "",
      imageStep:
        parsed.imageStep && typeof parsed.imageStep === "object" ? parsed.imageStep : null,
    };
  } catch {
    return null;
  }
}

export function loadViralWorksWorkflowStateFromLocal() {
  try {
    const raw = localStorage.getItem(LS_VIRALWORKS_WORKFLOW_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveViralWorksWorkflowStateToLocal(snapshot) {
  try {
    localStorage.setItem(LS_VIRALWORKS_WORKFLOW_STATE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function clearViralWorksWorkflowStateFromLocal() {
  try {
    localStorage.removeItem(LS_VIRALWORKS_WORKFLOW_STATE_KEY);
  } catch {
    /* ignore */
  }
}
