/**
 * Clés et helpers de persistance pour ViralWorks Studio (session onglet).
 * Centralise les chaînes pour éviter les divergences entre pages (ex. Image.jsx).
 */

import { resetWorkflowUsage } from "./workflowQuota";
import { purgeViralWorksMediaCache } from "./viralWorksMediaCache";
import { clearAllVideo24CheckpointsLocal } from "./videoPipeline24Checkpoint";

export const SS_VIRAL_STUDIO_DRAFT = "vws_studio_draft_v1";
/** Alias rétrocompat — même clé, stockage session */
export const LS_VIRAL_STUDIO_DRAFT = SS_VIRAL_STUDIO_DRAFT;

export const SS_IMAGE_STEP_KEY = "vws_studio_image_step_session_v1";
/** Ancienne copie localStorage — purge legacy uniquement */
export const LS_IMAGE_STEP_KEY = "vws_studio_image_step_v1";

export const SS_VISUAL_SNAPSHOTS_KEY = "vws_studio_visual_snapshots_v1";
export const SS_CAMPAIGN_IDEA_LIVE_KEY = "vws_studio_campaign_idea_live_v1";
export const SS_SPA_UI_KEY = "vws_studio_spa_ui_v1";
export const SS_VIRALWORKS_WORKFLOW_STATE_KEY = "viralworks_workflow_state";
export const SS_VIRALWORKS_MEDIA_CACHE_KEY = "viralworks_media_cache";
export const SS_BRAIN_V2_LAST_KEY = "vws_brain_v2_last";

/** @deprecated Utiliser SS_VIRALWORKS_WORKFLOW_STATE_KEY */
export const LS_VIRALWORKS_WORKFLOW_STATE_KEY = SS_VIRALWORKS_WORKFLOW_STATE_KEY;
/** @deprecated Utiliser SS_VIRALWORKS_MEDIA_CACHE_KEY */
export const LS_VIRALWORKS_MEDIA_CACHE_KEY = SS_VIRALWORKS_MEDIA_CACHE_KEY;

const HISTORY_LOCAL_CACHE_KEY = "history_v2";
const SS_APP_BOOT_MARKER = "vws_app_boot_marker";
export const SS_STUDIO_LEASE_KEY = "vws_studio_workflow_lease";

/** Clés workflow persistées en localStorage scopé par utilisateur (P0). */
export const STUDIO_SCOPED_KEYS = [
  SS_STUDIO_LEASE_KEY,
  SS_VIRALWORKS_WORKFLOW_STATE_KEY,
  SS_SPA_UI_KEY,
  SS_VIRAL_STUDIO_DRAFT,
];

/** userId courant pour load/save sans paramètre explicite (défini par FournisseurAuth). */
let studioScopedUserId = null;

/** Inactivité studio : au-delà, le workflow est réinitialisé au prochain accès. */
export const STUDIO_WORKFLOW_IDLE_MS = 4 * 60 * 60 * 1000;

/** Émis après purge du workflow (déconnexion, idle, nouvelle session). */
export const STUDIO_WORKFLOW_RESET_EVENT = "vws:studio-workflow-reset";

const LOCAL_STORAGE_LEGACY_KEYS = [
  SS_VIRAL_STUDIO_DRAFT,
  LS_IMAGE_STEP_KEY,
  SS_VIRALWORKS_WORKFLOW_STATE_KEY,
  SS_VIRALWORKS_MEDIA_CACHE_KEY,
  "vws_workflow_quota_v1",
  SS_BRAIN_V2_LAST_KEY,
  HISTORY_LOCAL_CACHE_KEY,
];

let spaImageStepMemoryClearFn = null;

export function registerSpaImageStepMemoryClear(fn) {
  spaImageStepMemoryClearFn = typeof fn === "function" ? fn : null;
}

export function clearSpaImageStepMemory() {
  try {
    spaImageStepMemoryClearFn?.();
  } catch {
    /* ignore */
  }
}

export function setStudioScopedUserId(userId) {
  const uid = String(userId || "").trim();
  studioScopedUserId = uid || null;
}

function resolveScopedUserId(explicitUserId) {
  const uid = String(explicitUserId ?? studioScopedUserId ?? "").trim();
  return uid || null;
}

export function scopedKey(baseKey, userId) {
  const uid = String(userId || "").trim();
  if (!uid) return null;
  return `${baseKey}:u:${uid}`;
}

export function readStudioScoped(baseKey, userId) {
  const key = scopedKey(baseKey, resolveScopedUserId(userId));
  if (!key || typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStudioScoped(baseKey, userId, value) {
  const key = scopedKey(baseKey, resolveScopedUserId(userId));
  if (!key || typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function clearStudioScopedForUser(userId) {
  const uid = resolveScopedUserId(userId);
  if (!uid || typeof localStorage === "undefined") return;
  for (const baseKey of STUDIO_SCOPED_KEYS) {
    const key = scopedKey(baseKey, uid);
    if (!key) continue;
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function readLegacySessionRaw(baseKey) {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(baseKey);
  } catch {
    return null;
  }
}

function removeLegacySessionKey(baseKey) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(baseKey);
  } catch {
    /* ignore */
  }
}

function canMigrateLegacySessionKey(baseKey, raw, userId) {
  if (!raw) return false;
  if (baseKey === SS_STUDIO_LEASE_KEY) {
    const lease = parseStudioLease(raw);
    return Boolean(lease && lease.userId === userId);
  }
  const legacyLeaseRaw = readLegacySessionRaw(SS_STUDIO_LEASE_KEY);
  if (!legacyLeaseRaw) return true;
  const lease = parseStudioLease(legacyLeaseRaw);
  if (!lease) return true;
  return lease.userId === userId;
}

/** Dual-read sessionStorage legacy → localStorage scopé (P0). */
export function migrateLegacySessionStorageToLocal(userId) {
  const uid = String(userId || "").trim();
  if (!uid || typeof localStorage === "undefined") return;

  for (const baseKey of STUDIO_SCOPED_KEYS) {
    const key = scopedKey(baseKey, uid);
    if (!key) continue;

    if (readStudioScoped(baseKey, uid)) {
      removeLegacySessionKey(baseKey);
      continue;
    }

    const legacyRaw = readLegacySessionRaw(baseKey);
    if (!legacyRaw || !canMigrateLegacySessionKey(baseKey, legacyRaw, uid)) continue;

    try {
      localStorage.setItem(key, legacyRaw);
      removeLegacySessionKey(baseKey);
    } catch {
      /* ignore */
    }
  }
}

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
 * Supprime les clés UI transitoires (image, snapshots, SPA) — ex. au F5.
 */
export function clearViralWorksTransientSessionKeys() {
  try {
    sessionStorage.removeItem(SS_IMAGE_STEP_KEY);
    sessionStorage.removeItem(SS_VISUAL_SNAPSHOTS_KEY);
    sessionStorage.removeItem(SS_SPA_UI_KEY);
    localStorage.removeItem(LS_IMAGE_STEP_KEY);
  } catch {
    /* ignore */
  }
}

function removeSessionKeys(keys) {
  if (typeof sessionStorage === "undefined") return;
  for (const key of keys) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function parseStudioLease(raw) {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    const userId = typeof o.userId === "string" ? o.userId : "";
    const lastActivityAt = Number(o.lastActivityAt);
    if (!userId || !Number.isFinite(lastActivityAt)) return null;
    return {
      userId,
      startedAt: Number(o.startedAt) || lastActivityAt,
      lastActivityAt,
    };
  } catch {
    return null;
  }
}

function readStudioLease(userId) {
  const scopedRaw = readStudioScoped(SS_STUDIO_LEASE_KEY, userId);
  if (scopedRaw) {
    const parsed = parseStudioLease(scopedRaw);
    if (parsed) return parsed;
  }
  return parseStudioLease(readLegacySessionRaw(SS_STUDIO_LEASE_KEY));
}

/** True si le workflow doit être repris à zéro (nouvel onglet, autre user, idle > 4 h). */
export function shouldResetStudioWorkflow(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return true;
  const lease = readStudioLease(uid);
  if (!lease) return true;
  if (lease.userId !== uid) return true;
  if (Date.now() - lease.lastActivityAt > STUDIO_WORKFLOW_IDLE_MS) return true;
  return false;
}

export function touchStudioWorkflowLease(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return;
  const prev = readStudioLease(uid);
  const now = Date.now();
  const next = {
    userId: uid,
    startedAt: prev?.userId === uid ? prev.startedAt : now,
    lastActivityAt: now,
  };
  const payload = JSON.stringify(next);
  writeStudioScoped(SS_STUDIO_LEASE_KEY, uid, payload);
  removeLegacySessionKey(SS_STUDIO_LEASE_KEY);
}

export function clearStudioWorkflowLease(userId) {
  const key = scopedKey(SS_STUDIO_LEASE_KEY, resolveScopedUserId(userId));
  if (key && typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  removeLegacySessionKey(SS_STUDIO_LEASE_KEY);
}

function purgeSessionStudioKeysSync() {
  const sessionKeys = [
    SS_VIRAL_STUDIO_DRAFT,
    SS_IMAGE_STEP_KEY,
    SS_VISUAL_SNAPSHOTS_KEY,
    SS_CAMPAIGN_IDEA_LIVE_KEY,
    SS_SPA_UI_KEY,
    SS_VIRALWORKS_WORKFLOW_STATE_KEY,
    SS_VIRALWORKS_MEDIA_CACHE_KEY,
    "vws_workflow_quota_v1",
    SS_BRAIN_V2_LAST_KEY,
    SS_STUDIO_LEASE_KEY,
  ].filter((key) => !STUDIO_SCOPED_KEYS.includes(key));

  removeSessionKeys(sessionKeys);
  try {
    sessionStorage.removeItem(SS_VIRALWORKS_WORKFLOW_STATE_KEY);
    sessionStorage.removeItem(SS_VIRAL_STUDIO_DRAFT);
    sessionStorage.removeItem(SS_SPA_UI_KEY);
    sessionStorage.removeItem(SS_STUDIO_LEASE_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LS_IMAGE_STEP_KEY);
  } catch {
    /* ignore */
  }
}

function runBootSessionPurgeIfNeeded() {
  if (typeof sessionStorage === "undefined") return;
  if (sessionStorage.getItem(SS_APP_BOOT_MARKER)) return;
  try {
    sessionStorage.setItem(SS_APP_BOOT_MARKER, "1");
  } catch {
    return;
  }
  purgeSessionStudioKeysSync();
  clearLegacyViralWorksLocalStorage();
}

/** Nettoie les anciennes clés localStorage du studio (migration). */
export function clearLegacyViralWorksLocalStorage() {
  if (typeof localStorage === "undefined") return;
  for (const key of LOCAL_STORAGE_LEGACY_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export function loadSpaUiStateFromSession(userId) {
  if (isReloadNavigation()) return null;
  try {
    const uid = resolveScopedUserId(userId);
    if (uid) {
      const scopedRaw = readStudioScoped(SS_SPA_UI_KEY, uid);
      if (scopedRaw) {
        const parsed = JSON.parse(scopedRaw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    }
    const raw = readLegacySessionRaw(SS_SPA_UI_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadViralStudioDraftFromSession(userId) {
  try {
    const uid = resolveScopedUserId(userId);
    if (uid) {
      const scopedRaw = readStudioScoped(SS_VIRAL_STUDIO_DRAFT, uid);
      if (scopedRaw) {
        const parsed = JSON.parse(scopedRaw);
        if (parsed && typeof parsed === "object") {
          return {
            campaign: parsed.campaign && typeof parsed.campaign === "object" ? parsed.campaign : {},
            scriptPrompt: typeof parsed.scriptPrompt === "string" ? parsed.scriptPrompt : "",
            imageStep:
              parsed.imageStep && typeof parsed.imageStep === "object" ? parsed.imageStep : null,
          };
        }
      }
    }
    const raw = readLegacySessionRaw(SS_VIRAL_STUDIO_DRAFT);
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

/** @deprecated Utiliser loadViralStudioDraftFromSession */
export function loadViralStudioDraftFromLocal() {
  return loadViralStudioDraftFromSession();
}

export function saveViralStudioDraftToSession(snapshot, userId) {
  try {
    const payload = JSON.stringify(snapshot);
    const uid = resolveScopedUserId(userId);
    if (uid && writeStudioScoped(SS_VIRAL_STUDIO_DRAFT, uid, payload)) {
      removeLegacySessionKey(SS_VIRAL_STUDIO_DRAFT);
      return true;
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SS_VIRAL_STUDIO_DRAFT, payload);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function loadViralWorksWorkflowStateFromSession(userId) {
  try {
    const uid = resolveScopedUserId(userId);
    if (uid) {
      const scopedRaw = readStudioScoped(SS_VIRALWORKS_WORKFLOW_STATE_KEY, uid);
      if (scopedRaw) {
        const parsed = JSON.parse(scopedRaw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    }
    const raw = readLegacySessionRaw(SS_VIRALWORKS_WORKFLOW_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** @deprecated Utiliser loadViralWorksWorkflowStateFromSession */
export function loadViralWorksWorkflowStateFromLocal() {
  return loadViralWorksWorkflowStateFromSession();
}

export function saveViralWorksWorkflowStateToSession(snapshot, userId) {
  try {
    const payload = JSON.stringify(snapshot);
    const uid = resolveScopedUserId(userId);
    if (uid && writeStudioScoped(SS_VIRALWORKS_WORKFLOW_STATE_KEY, uid, payload)) {
      removeLegacySessionKey(SS_VIRALWORKS_WORKFLOW_STATE_KEY);
      return true;
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SS_VIRALWORKS_WORKFLOW_STATE_KEY, payload);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** @deprecated Utiliser saveViralWorksWorkflowStateToSession */
export function saveViralWorksWorkflowStateToLocal(snapshot) {
  return saveViralWorksWorkflowStateToSession(snapshot);
}

export function clearViralWorksWorkflowStateFromSession(userId) {
  const key = scopedKey(SS_VIRALWORKS_WORKFLOW_STATE_KEY, resolveScopedUserId(userId));
  if (key && typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  removeLegacySessionKey(SS_VIRALWORKS_WORKFLOW_STATE_KEY);
  try {
    localStorage.removeItem(SS_VIRALWORKS_WORKFLOW_STATE_KEY);
  } catch {
    /* ignore */
  }
}

/** @deprecated Utiliser clearViralWorksWorkflowStateFromSession */
export function clearViralWorksWorkflowStateFromLocal() {
  clearViralWorksWorkflowStateFromSession();
}

/**
 * Purge complète du workflow studio (déconnexion).
 * N’affecte pas l’historique Supabase du profil.
 */
export async function clearAllViralWorksStudioPersistence(userId) {
  const uid = resolveScopedUserId(userId);
  clearSpaImageStepMemory();
  clearViralWorksTransientSessionKeys();
  clearViralWorksWorkflowStateFromSession(uid);
  removeSessionKeys([
    SS_VIRAL_STUDIO_DRAFT,
    SS_CAMPAIGN_IDEA_LIVE_KEY,
    SS_VIRALWORKS_MEDIA_CACHE_KEY,
    "vws_workflow_quota_v1",
    SS_BRAIN_V2_LAST_KEY,
  ]);
  removeLegacySessionKey(SS_VIRAL_STUDIO_DRAFT);
  removeLegacySessionKey(SS_SPA_UI_KEY);
  clearStudioWorkflowLease(uid);
  if (uid) {
    clearStudioScopedForUser(uid);
  }
  clearLegacyViralWorksLocalStorage();
  try {
    resetWorkflowUsage();
  } catch {
    /* ignore */
  }
  try {
    await purgeViralWorksMediaCache();
  } catch {
    /* ignore */
  }
  try {
    clearAllVideo24CheckpointsLocal();
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new Event(STUDIO_WORKFLOW_RESET_EVENT));
    } catch {
      /* ignore */
    }
  }
}

runBootSessionPurgeIfNeeded();
