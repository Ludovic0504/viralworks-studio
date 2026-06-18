import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react";
import PageTitle from "../composants/interface/TitrePage";
import CampagneVWS from "./CampagneVWS.jsx";
import ImagePage from "./Image.jsx";
import VideoPage from "./Video.jsx";
import { resetWorkflowUsage } from "@/bibliotheque/workflowQuota";
import {
  SS_IMAGE_STEP_KEY,
  SS_VISUAL_SNAPSHOTS_KEY,
  SS_CAMPAIGN_IDEA_LIVE_KEY,
  SS_SPA_UI_KEY,
  SS_BRAIN_V2_LAST_KEY,
  isReloadNavigation,
  clearViralWorksTransientSessionKeys,
  loadSpaUiStateFromSession,
  loadViralStudioDraftFromSession,
  loadViralWorksWorkflowStateFromSession,
  saveViralWorksWorkflowStateToSession,
  saveViralStudioDraftToSession,
  clearViralWorksWorkflowStateFromSession,
  registerSpaImageStepMemoryClear,
  clearAllViralWorksStudioPersistence,
  shouldResetStudioWorkflow,
  touchStudioWorkflowLease,
  STUDIO_WORKFLOW_RESET_EVENT,
} from "@/bibliotheque/viralWorksStudioStorage";
import {
  loadImageMediaRefs,
  loadVideoMediaRefs,
  saveImageMediaRef,
  saveVideoMediaRef,
  loadViralWorksMediaCacheIndex,
  purgeViralWorksMediaCache,
} from "@/bibliotheque/viralWorksMediaCache";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { useProfilStudio } from "@/contexte/FournisseurProfilStudio";
import { useStudioLayoutOptions } from "@/contexte/StudioLayoutOptionsContext";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { useBoutiqueModal } from "@/contexte/ContexteModalBoutique";
import { capturePostHog, trackPostHogError } from "@/bibliotheque/posthog/client";
import {
  createDefaultCampaignGenerationSpec,
  normalizeCampaignGenerationSpec,
} from "@/bibliotheque/campaignGenerationSpec";
import { buildLegacyCampaignPatchFromSecteur } from "@/bibliotheque/sectorDefaults";
import { serializeCampaignSpecForPrepareGate } from "@/bibliotheque/campaignPrepareGateSerialize";
import { runStudioScriptRefinement } from "@/bibliotheque/studioScriptRefinement";
import { Check, Download, X } from "lucide-react";
import { useLocation } from "react-router-dom";

/**
 * Mémoire module (hors React) : survit au démontage de ViralWorks quand tu quittes /viralworks.
 * Les data URLs / grosses charges dépassent souvent le quota localStorage — l’UI restait vide au retour
 * alors que l’état mémoire était encore correct avant ce filet.
 */
let spaImageStepMemory = null;

/** 1 Campagne, 2 Visuel, 3 Vidéo (pas d’étape Script ni Récap). v3 = sans Récap ; v2 = avec Récap. */
const STUDIO_FLOW_VERSION = 3;
const STUDIO_V2_WITH_RECAP = 2;
const STUDIO_STEP_COUNT = 3;
const WORKFLOW_STATE_VERSION = 1;

/**
 * Au rechargement complet (F5) : vider la session studio une seule fois par chargement de page.
 * Doit s’exécuter avant la première lecture de `loadSpaUiStateFromSession` (voir ref `spaUiInitialRef`).
 */
function purgeStudioSessionIfFullReload() {
  if (typeof window === "undefined") return;
  if (!isReloadNavigation()) return;
  if (window.__vwsStudioReloadPurgeDone) return;
  window.__vwsStudioReloadPurgeDone = true;
  spaImageStepMemory = null;
  clearViralWorksTransientSessionKeys();
}

function cloneImageStep(s) {
  if (!s) return null;
  try {
    return structuredClone(s);
  } catch {
    try {
      return JSON.parse(JSON.stringify(s));
    } catch {
      return {
        ...s,
        lastGeneratedImages: s.lastGeneratedImages ? [...s.lastGeneratedImages] : null,
      };
    }
  }
}

function persistImageStepOnly(snapshot) {
  spaImageStepMemory = cloneImageStep(snapshot);
  let json;
  try {
    json = JSON.stringify(snapshot);
  } catch (err) {
    console.warn("[ViralWorks] Sérialisation étape Visuel impossible:", err);
    return;
  }
  try {
    sessionStorage.setItem(SS_IMAGE_STEP_KEY, json);
  } catch (err) {
    console.warn("[ViralWorks] sessionStorage étape Visuel (quota ?):", err);
  }
}

function readSessionImageStep() {
  try {
    const raw = sessionStorage.getItem(SS_IMAGE_STEP_KEY);
    if (!raw) return null;
    return sanitizeImageStepFromDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

function imageStepRichness(s) {
  if (!s) return -1;
  const n = s.lastGeneratedImages?.length ?? 0;
  const refW = s.refCharDataUrl ? 500 : 0;
  const promptW = s.prompt?.trim() ? 50 : 0;
  const modifyW = s.modifyInstruction?.trim() ? 5 : 0;
  return n * 10_000 + refW + promptW + modifyW;
}

function imageStepHasHookVisual(step) {
  const urls = Array.isArray(step?.lastGeneratedImages) ? step.lastGeneratedImages : [];
  return urls.some((u) => typeof u === "string" && u.trim().length > 0);
}

function normalizeValidated(v) {
  const base = { 1: false, 2: false, 3: false };
  if (!v || typeof v !== "object") return base;
  for (let i = 1; i <= STUDIO_STEP_COUNT; i += 1) {
    base[i] = Boolean(v[i]);
  }
  return base;
}

/** Migre les anciennes sessions (5 étapes, 4 étapes avec Récap) vers 3 étapes. */
function migrateSpaUiIfNeeded(raw) {
  if (!raw || typeof raw !== "object") {
    return { studioFlowVersion: STUDIO_FLOW_VERSION };
  }
  if (raw.studioFlowVersion === STUDIO_FLOW_VERSION) {
    const n = Number(raw.currentStep);
    let cs = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
    cs = Math.min(Math.max(cs, 1), STUDIO_STEP_COUNT);
    return {
      ...raw,
      currentStep: cs,
      validated: normalizeValidated(raw.validated),
    };
  }
  if (raw.studioFlowVersion === STUDIO_V2_WITH_RECAP) {
    const v = raw.validated;
    let cs = Number(raw.currentStep);
    cs = Number.isFinite(cs) && cs >= 1 ? Math.floor(cs) : 1;
    if (cs >= 4) cs = 3;
    cs = Math.min(Math.max(cs, 1), STUDIO_STEP_COUNT);
    const newV = normalizeValidated(null);
    if (v && typeof v === "object") {
      newV[1] = Boolean(v[1]);
      newV[2] = Boolean(v[2]);
      newV[3] = Boolean(v[3]) || Boolean(v[4]);
    }
    return {
      ...raw,
      currentStep: cs,
      validated: newV,
      studioFlowVersion: STUDIO_FLOW_VERSION,
    };
  }
  const v = raw.validated;
  let cs = Number(raw.currentStep);
  cs = Number.isFinite(cs) && cs >= 1 ? Math.floor(cs) : 1;
  if (cs === 1) {
    cs = 1;
  } else if (cs === 2) {
    cs = 2;
  } else if (cs === 3) {
    cs = 2;
  } else if (cs === 4) {
    cs = 3;
  } else {
    cs = 3;
  }
  cs = Math.min(Math.max(cs, 1), STUDIO_STEP_COUNT);
  const newV = normalizeValidated(null);
  if (v && typeof v === "object") {
    newV[1] = Boolean(v[1]);
    newV[2] = Boolean(v[3]);
    newV[3] = Boolean(v[4]) || Boolean(v[5]);
  }
  return {
    ...raw,
    currentStep: cs,
    validated: newV,
    studioFlowVersion: STUDIO_FLOW_VERSION,
  };
}

/** Choisit l’état le plus « riche » (images > ref > texte) — plus fiable qu’un ordre fixe. */
function pickInitialImageStep() {
  if (isReloadNavigation()) {
    const draftImg = sanitizeImageStepFromDraft(loadViralStudioDraftFromSession()?.imageStep);
    if (
      draftImg &&
      (draftImg.lastGeneratedImages?.length ||
        draftImg.refCharDataUrl ||
        String(draftImg.prompt || "").trim() ||
        String(draftImg.campaignIdeaPrompt || "").trim())
    ) {
      return draftImg;
    }
    return { ...INITIAL_IMAGE_STEP };
  }

  const mem = spaImageStepMemory ? sanitizeImageStepFromDraft(spaImageStepMemory) : null;
  const sessionS = readSessionImageStep();
  const draftS = sanitizeImageStepFromDraft(loadViralStudioDraftFromSession()?.imageStep);

  const candidates = [mem, sessionS, draftS].filter(Boolean);
  if (candidates.length === 0) return { ...INITIAL_IMAGE_STEP };
  candidates.sort((a, b) => imageStepRichness(b) - imageStepRichness(a));
  return candidates[0];
}

function loadVisualSnapshotsFromSession() {
  if (isReloadNavigation()) return [];
  try {
    const raw = sessionStorage.getItem(SS_VISUAL_SNAPSHOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e?.step?.lastGeneratedImages?.length);
  } catch {
    return [];
  }
}

function persistVisualSnapshotsToSession(list) {
  try {
    sessionStorage.setItem(SS_VISUAL_SNAPSHOTS_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("[ViralWorks] Snapshots visuels sessionStorage:", err);
  }
}

/** État initial étape Visuel (référence pour sanitize / reset). */
const INITIAL_IMAGE_STEP = {
  campaignIdeaPrompt: "",
  prompt: "",
  ratio: "9:16",
  quantity: 4,
  refCharDataUrl: null,
  productAvatarRefUrl: null,
  productAvatarRefSource: null,
  productProductRefUrl: null,
  lastGeneratedImages: null,
  lastGeneratedPrompt: "",
  selectedImageIndex: 0,
  modifyInstruction: "",
  /** Idée campagne pour laquelle la grille actuelle a été produite (nouveau contexte → reset). */
  pairedCampaignIdea: null,
  /**
   * Debug 24s (UI uniquement) : prompts/payloads envoyés pour image 1/2/3.
   * Stocke des strings/objets légers (pas de data URLs complètes).
   */
  image24sDebug: null,
  /** Hooks 24s : une image de référence par scène (1..3). */
  sceneHookImages: [null, null, null],
  /** Statut de génération auto des hooks 24s (scènes 2 & 3). */
  sceneHookStatus: {
    scene2: { status: "idle", message: "" },
    scene3: { status: "idle", message: "" },
  },
  /** Anti-boucle: clé du dernier auto-run (24s hooks). */
  sceneHookAutoKey: null,
};

function sanitizeImageStepFromDraft(raw) {
  if (!raw || typeof raw !== "object") return null;
  const urls = Array.isArray(raw.lastGeneratedImages)
    ? raw.lastGeneratedImages.filter((u) => typeof u === "string" && u.length > 0)
    : [];
  const lastGeneratedImages = urls.length > 0 ? urls : null;
  const n = urls.length;
  let selectedImageIndex = Number(raw.selectedImageIndex);
  if (!Number.isFinite(selectedImageIndex)) selectedImageIndex = 0;
  if (n > 0) selectedImageIndex = Math.max(0, Math.min(selectedImageIndex, n - 1));

  const qty = Number(raw.quantity);
  const quantity = [1, 2, 3, 4].includes(qty) ? qty : INITIAL_IMAGE_STEP.quantity;
  const ratio =
    typeof raw.ratio === "string" && raw.ratio.length > 0 ? raw.ratio : INITIAL_IMAGE_STEP.ratio;

  return {
    ...INITIAL_IMAGE_STEP,
    campaignIdeaPrompt:
      typeof raw.campaignIdeaPrompt === "string"
        ? raw.campaignIdeaPrompt
        : typeof raw.prompt === "string"
        ? raw.prompt
        : "",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "",
    ratio,
    quantity,
    refCharDataUrl: typeof raw.refCharDataUrl === "string" ? raw.refCharDataUrl : null,
    productAvatarRefUrl:
      typeof raw.productAvatarRefUrl === "string" ? raw.productAvatarRefUrl : null,
    productAvatarRefSource:
      raw.productAvatarRefSource === "library" || raw.productAvatarRefSource === "import"
        ? raw.productAvatarRefSource
        : null,
    productProductRefUrl:
      typeof raw.productProductRefUrl === "string" ? raw.productProductRefUrl : null,
    lastGeneratedImages,
    lastGeneratedPrompt:
      typeof raw.lastGeneratedPrompt === "string" ? raw.lastGeneratedPrompt : "",
    selectedImageIndex,
    modifyInstruction:
      typeof raw.modifyInstruction === "string" ? raw.modifyInstruction : "",
    pairedCampaignIdea:
      typeof raw.pairedCampaignIdea === "string" && raw.pairedCampaignIdea.trim()
        ? raw.pairedCampaignIdea.trim()
        : null,
    image24sDebug: (() => {
      const dbg = raw?.image24sDebug;
      if (!dbg || typeof dbg !== "object") return null;
      // On garde seulement un sous-ensemble simple et sûr (pas d’URLs signées, pas de data URL).
      const pickOne = (src) => {
        if (!src || typeof src !== "object") return null;
        const out = {
          prompt: typeof src.prompt === "string" ? src.prompt.slice(0, 20000) : "",
          functionUrl: typeof src.functionUrl === "string" ? src.functionUrl.slice(0, 500) : "",
          provider: typeof src.provider === "string" ? src.provider.slice(0, 40) : "",
          createdAt: typeof src.createdAt === "string" ? src.createdAt.slice(0, 40) : "",
          ratio: typeof src.ratio === "string" ? src.ratio.slice(0, 40) : "",
          model: typeof src.model === "string" ? src.model.slice(0, 80) : "",
          quantity: Number.isFinite(Number(src.quantity)) ? Number(src.quantity) : null,
          referenceUrl:
            typeof src.referenceUrl === "string" && src.referenceUrl.trim() && !isSensitiveOrTransientUrl(src.referenceUrl)
              ? src.referenceUrl.trim()
              : null,
          referenceSummary: typeof src.referenceSummary === "string" ? src.referenceSummary.slice(0, 160) : "",
          requestBody: src.requestBody && typeof src.requestBody === "object" ? deepStripSensitiveUrls(src.requestBody) : null,
        };
        return out;
      };
      return {
        image1: pickOne(dbg.image1),
        image2: pickOne(dbg.image2),
        image3: pickOne(dbg.image3),
      };
    })(),
    sceneHookImages: (() => {
      const arr = Array.isArray(raw.sceneHookImages) ? raw.sceneHookImages : [];
      const out = [null, null, null];
      for (let i = 0; i < 3; i += 1) {
        const v = typeof arr[i] === "string" && arr[i].trim() ? arr[i].trim() : null;
        out[i] = v && !isSensitiveOrTransientUrl(v) ? v : null;
      }
      return out;
    })(),
    sceneHookStatus: (() => {
      const s2 = raw?.sceneHookStatus?.scene2;
      const s3 = raw?.sceneHookStatus?.scene3;
      const normOne = (src) => {
        const st = typeof src?.status === "string" ? src.status : "idle";
        const allowed = new Set(["idle", "generating", "done", "error"]);
        return {
          status: allowed.has(st) ? st : "idle",
          message: typeof src?.message === "string" ? src.message.slice(0, 180) : "",
        };
      };
      return { scene2: normOne(s2), scene3: normOne(s3) };
    })(),
    sceneHookAutoKey:
      typeof raw.sceneHookAutoKey === "string" && raw.sceneHookAutoKey.trim()
        ? raw.sceneHookAutoKey.trim().slice(0, 240)
        : null,
  };
}

function isSensitiveOrTransientUrl(value) {
  if (typeof value !== "string") return false;
  const raw = value.trim();
  if (!raw) return false;
  if (raw.startsWith("blob:") || raw.startsWith("data:")) return true;
  if (!/^https?:\/\//i.test(raw)) return false;
  try {
    const parsed = new URL(raw);
    const signedParamCandidates = [
      "Expires",
      "X-Goog-Algorithm",
      "X-Goog-Credential",
      "X-Goog-Date",
      "X-Goog-Expires",
      "X-Goog-Signature",
      "X-Amz-Algorithm",
      "X-Amz-Credential",
      "X-Amz-Date",
      "X-Amz-Expires",
      "X-Amz-Signature",
      "token",
      "signature",
      "sig",
    ];
    return signedParamCandidates.some((k) => parsed.searchParams.has(k));
  } catch {
    return true;
  }
}

function persistableHttpsRefUrl(value) {
  const s = typeof value === "string" ? value.trim() : "";
  return s.startsWith("https://") ? s : null;
}

function sanitizeImageStepForWorkflowPersistence(raw) {
  const base = sanitizeImageStepFromDraft(raw) || { ...INITIAL_IMAGE_STEP };
  const productAvatarRefUrl = persistableHttpsRefUrl(base.productAvatarRefUrl);
  const productProductRefUrl = persistableHttpsRefUrl(base.productProductRefUrl);
  const productAvatarRefSource =
    productAvatarRefUrl &&
    (base.productAvatarRefSource === "library" || base.productAvatarRefSource === "import")
      ? base.productAvatarRefSource
      : null;
  return {
    ...base,
    refCharDataUrl: persistableHttpsRefUrl(base.refCharDataUrl),
    productAvatarRefUrl,
    productAvatarRefSource,
    productProductRefUrl,
    lastGeneratedImages: null,
  };
}

function mergeImageStepWithMediaCache(raw, mediaCacheEntry) {
  const base = sanitizeImageStepFromDraft(raw) || { ...INITIAL_IMAGE_STEP };
  const hasImages = Array.isArray(base.lastGeneratedImages) && base.lastGeneratedImages.length > 0;
  if (hasImages) return base;
  const cachedUrls = Array.isArray(mediaCacheEntry?.urls) ? mediaCacheEntry.urls : [];
  const fallbackUrls = Array.isArray(mediaCacheEntry?.fallbackData) ? mediaCacheEntry.fallbackData : [];
  const mergedUrls = cachedUrls.length > 0 ? cachedUrls : fallbackUrls;
  if (!mergedUrls.length) return base;
  return {
    ...base,
    lastGeneratedImages: mergedUrls,
    selectedImageIndex: Math.min(base.selectedImageIndex || 0, mergedUrls.length - 1),
  };
}

function sanitizeWorkflowVideoState(raw) {
  const allowed = new Set(["idle", "generating", "done", "error"]);
  const status = typeof raw?.status === "string" && allowed.has(raw.status) ? raw.status : "idle";
  const videoId =
    typeof raw?.videoId === "string" && raw.videoId.trim() && !isSensitiveOrTransientUrl(raw.videoId)
      ? raw.videoId.trim()
      : null;
  const lastError = typeof raw?.lastError === "string" ? raw.lastError.slice(0, 500) : "";
  const provider =
    typeof raw?.provider === "string" && raw.provider.trim() ? raw.provider.trim() : "veo3";
  const createdAt =
    typeof raw?.createdAt === "string" && raw.createdAt.trim() ? raw.createdAt.trim() : null;
  return { status, videoId, lastError, provider, createdAt };
}

function deepStripSensitiveUrls(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => deepStripSensitiveUrls(entry));
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && isSensitiveOrTransientUrl(value)) {
      return null;
    }
    return value;
  }
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    const lowered = key.toLowerCase();
    if (lowered.includes("url") && typeof entry === "string" && isSensitiveOrTransientUrl(entry)) {
      out[key] = null;
      continue;
    }
    out[key] = deepStripSensitiveUrls(entry);
  }
  return out;
}

function mergeVisualSnapshotsList(prevList, step) {
  const urls = step?.lastGeneratedImages;
  if (!urls?.length) return prevList;
  let sig;
  try {
    sig = JSON.stringify(urls);
  } catch {
    return prevList;
  }
  const stepClone = cloneImageStep(step);
  const entry = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    t: Date.now(),
    step: stepClone,
  };
  const deduped = prevList.filter((e) => {
    try {
      return JSON.stringify(e.step?.lastGeneratedImages) !== sig;
    } catch {
      return true;
    }
  });
  return [entry, ...deduped].slice(0, 48);
}

function scheduleVisualSnapshotFromStep(step, setVisualSnapshots) {
  setVisualSnapshots((list) => {
    const next = mergeVisualSnapshotsList(list, step);
    if (next === list) return list;
    persistVisualSnapshotsToSession(next);
    return next;
  });
}

function appendVisualSnapshotFromStep(step, setVisualSnapshots) {
  scheduleVisualSnapshotFromStep(step, setVisualSnapshots);
}

function normalizeTempoForGate(t) {
  return t === "timelapse" || t === "slow_motion" ? t : "real_time";
}

function buildLegacyCampaignDataFromSpec(spec) {
  const s = normalizeCampaignGenerationSpec(spec);
  return {
    profession: s.campaign.profession ?? "",
    lieuTournage: s.campaign.location_type ?? "neutre",
    idea: s.campaign.core_idea ?? "",
    videoFormatId: s.campaign.video_format_id ?? null,
    styleDetails: s.campaign.style_details ?? "",
    stagingChips: Array.isArray(s.campaign.staging_chips) ? [...s.campaign.staging_chips] : [],
    tempo: normalizeTempoForGate(s.rendering.tempo),
    cameraFixed: Boolean(s.rendering.camera.fixed),
    revealMode: Boolean(s.rendering.camera.reveal_mode),
    cinematicMovement: Boolean(s.rendering.camera.cinematic_movement),
    selfieMode: Boolean(s.rendering.camera.selfie_mode),
    sequenceType: s.creative.sequence_type === "three_x_8s" ? "three_x_8s" : "single_8s",
    dialogueEnabled: s.rendering.audio.dialogue_enabled !== false,
    microAnswer: s.campaign.clarification.initial_state ?? null,
    cameraViewAngle: s.campaign.clarification.camera_view_angle ?? null,
    cameraFaceMode: s.campaign.clarification.camera_face_mode ?? null,
    tempoCompressionDecision: s.rendering.tempo_resolution_decision ?? null,
    causalAgentSelection: s.campaign.clarification.causal_agent ?? null,
    cameraAerialAngle: s.campaign.clarification.camera_aerial_angle ?? null,
    initialStateSelection: s.campaign.clarification.initial_state ?? null,
    gateResult: s.trace.clarify_gate.last_result ?? null,
    clarifyAnswer: s.campaign.clarification.last_user_freeform_answer ?? null,
    clarifyMode: s.campaign.clarification.mode ?? null,
    clarifyDiagnostic: s.campaign.clarification.diagnostic ?? null,
    proceedAnyway: s.campaign.clarification.proceed_anyway === true,
    clarificationHistory: Array.isArray(s.campaign.clarification.history) ? s.campaign.clarification.history : [],
    clarifyAxesResolved: {
      modeAgent: s.campaign.clarification.resolved_axes.mode_agent === true,
      initialT0: s.campaign.clarification.resolved_axes.initial_t0 === true,
      causalAgent: s.campaign.clarification.resolved_axes.causal_agent === true,
      cameraAerialAngle: s.campaign.clarification.resolved_axes.camera_aerial_angle === true,
    },
    globalIntentProfile: s.campaign.intent_profile ?? null,
    isClarified: s.campaign.clarification.is_resolved === true,
    productSceneDecorId: s.campaign.product_scene_decor_id ?? null,
    productOpeningHookId: s.campaign.product_opening_hook_id ?? null,
  };
}

function applyLegacyCampaignPatchToSpec(prevSpec, patch) {
  if (patch?.campaignGenerationSpec) {
    return normalizeCampaignGenerationSpec(patch.campaignGenerationSpec);
  }
  const prev = normalizeCampaignGenerationSpec(prevSpec);
  const next = {
    ...prev,
    campaign: {
      ...prev.campaign,
      profession: patch?.profession ?? prev.campaign.profession,
      location_type:
        patch?.lieuTournage !== undefined
          ? (patch.lieuTournage === "chez_client" ||
            patch.lieuTournage === "etablissement" ||
            patch.lieuTournage === "neutre"
              ? patch.lieuTournage
              : "neutre")
          : prev.campaign.location_type,
      core_idea: patch?.idea ?? prev.campaign.core_idea,
      video_format_id:
        patch?.videoFormatId !== undefined
          ? patch.videoFormatId && String(patch.videoFormatId).trim()
            ? String(patch.videoFormatId).trim()
            : null
          : prev.campaign.video_format_id,
      style_details: patch?.styleDetails ?? prev.campaign.style_details,
      staging_chips:
        patch?.stagingChips !== undefined
          ? Array.isArray(patch.stagingChips)
            ? patch.stagingChips.filter((x) => typeof x === "string")
            : prev.campaign.staging_chips
          : prev.campaign.staging_chips,
      product_scene_decor_id:
        patch?.productSceneDecorId !== undefined
          ? patch.productSceneDecorId && String(patch.productSceneDecorId).trim()
            ? String(patch.productSceneDecorId).trim()
            : null
          : prev.campaign.product_scene_decor_id,
      product_opening_hook_id:
        patch?.productOpeningHookId !== undefined
          ? patch.productOpeningHookId === null || patch.productOpeningHookId === ""
            ? null
            : String(patch.productOpeningHookId)
          : prev.campaign.product_opening_hook_id,
      intent_profile:
        patch?.globalIntentProfile !== undefined ? patch.globalIntentProfile : prev.campaign.intent_profile,
      clarification: {
        ...prev.campaign.clarification,
        initial_state:
          patch?.microAnswer !== undefined
            ? patch.microAnswer
            : prev.campaign.clarification.initial_state,
        causal_agent:
          patch?.causalAgentSelection !== undefined
            ? patch.causalAgentSelection
            : prev.campaign.clarification.causal_agent,
        camera_aerial_angle:
          patch?.cameraAerialAngle !== undefined
            ? patch.cameraAerialAngle
            : prev.campaign.clarification.camera_aerial_angle,
        camera_view_angle:
          patch?.cameraViewAngle !== undefined
            ? patch.cameraViewAngle
            : prev.campaign.clarification.camera_view_angle,
        camera_face_mode:
          patch?.cameraFaceMode !== undefined
            ? patch.cameraFaceMode
            : prev.campaign.clarification.camera_face_mode,
        last_user_freeform_answer:
          patch?.clarifyAnswer !== undefined
            ? patch.clarifyAnswer
            : prev.campaign.clarification.last_user_freeform_answer,
        mode:
          patch?.clarifyMode !== undefined
            ? patch.clarifyMode
            : prev.campaign.clarification.mode,
        diagnostic:
          patch?.clarifyDiagnostic !== undefined
            ? patch.clarifyDiagnostic
            : prev.campaign.clarification.diagnostic,
        proceed_anyway:
          patch?.proceedAnyway !== undefined
            ? patch.proceedAnyway === true
            : prev.campaign.clarification.proceed_anyway,
        is_resolved:
          patch?.isClarified !== undefined
            ? patch.isClarified === true
            : prev.campaign.clarification.is_resolved,
        history:
          patch?.clarificationHistory !== undefined
            ? (Array.isArray(patch.clarificationHistory) ? patch.clarificationHistory : [])
            : prev.campaign.clarification.history,
        resolved_axes: {
          ...prev.campaign.clarification.resolved_axes,
          mode_agent:
            patch?.clarifyAxesResolved?.modeAgent !== undefined
              ? patch.clarifyAxesResolved.modeAgent === true
              : prev.campaign.clarification.resolved_axes.mode_agent,
          initial_t0:
            patch?.clarifyAxesResolved?.initialT0 !== undefined
              ? patch.clarifyAxesResolved.initialT0 === true
              : prev.campaign.clarification.resolved_axes.initial_t0,
          causal_agent:
            patch?.clarifyAxesResolved?.causalAgent !== undefined
              ? patch.clarifyAxesResolved.causalAgent === true
              : prev.campaign.clarification.resolved_axes.causal_agent,
          camera_aerial_angle:
            patch?.clarifyAxesResolved?.cameraAerialAngle !== undefined
              ? patch.clarifyAxesResolved.cameraAerialAngle === true
              : prev.campaign.clarification.resolved_axes.camera_aerial_angle,
        },
      },
    },
    creative: {
      ...prev.creative,
      sequence_type:
        patch?.sequenceType !== undefined
          ? (patch.sequenceType === "three_x_8s" ? "three_x_8s" : "single_8s")
          : prev.creative.sequence_type,
    },
    rendering: {
      ...prev.rendering,
      tempo:
        patch?.tempo !== undefined
          ? normalizeTempoForGate(patch.tempo)
          : prev.rendering.tempo,
      tempo_resolution_decision:
        patch?.tempoCompressionDecision !== undefined
          ? patch.tempoCompressionDecision
          : prev.rendering.tempo_resolution_decision,
      camera: {
        ...prev.rendering.camera,
        fixed: patch?.cameraFixed !== undefined ? Boolean(patch.cameraFixed) : prev.rendering.camera.fixed,
        reveal_mode:
          patch?.revealMode !== undefined ? Boolean(patch.revealMode) : prev.rendering.camera.reveal_mode,
        cinematic_movement:
          patch?.cinematicMovement !== undefined
            ? Boolean(patch.cinematicMovement)
            : prev.rendering.camera.cinematic_movement,
        selfie_mode:
          patch?.selfieMode !== undefined ? Boolean(patch.selfieMode) : prev.rendering.camera.selfie_mode,
      },
      audio: {
        ...prev.rendering.audio,
        dialogue_enabled:
          patch?.dialogueEnabled !== undefined
            ? patch.dialogueEnabled !== false
            : prev.rendering.audio.dialogue_enabled,
      },
    },
    trace: {
      ...prev.trace,
      clarify_gate: {
        ...prev.trace.clarify_gate,
        last_result:
          patch?.gateResult !== undefined ? patch.gateResult : prev.trace.clarify_gate.last_result,
      },
    },
  };
  return normalizeCampaignGenerationSpec(next);
}

function normalizeScriptPayload(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const scenes = Array.isArray(raw.scenes)
      ? raw.scenes.map((s) => String(s ?? "").trim()).slice(0, 3)
      : [];
    while (scenes.length < 3) scenes.push("");
    const combined =
      typeof raw.combined === "string" ? raw.combined : scenes.filter(Boolean).join("\n\n---\n\n");
    const scriptResultMeta =
      raw.scriptResultMeta && typeof raw.scriptResultMeta === "object" && !Array.isArray(raw.scriptResultMeta)
        ? raw.scriptResultMeta
        : undefined;
    return {
      mode: raw.mode === "multi" ? "multi" : "single",
      combined: String(combined ?? ""),
      scenes,
      refinementRunId: typeof raw.refinementRunId === "string" ? raw.refinementRunId : undefined,
      scriptResultMeta,
    };
  }
  if (typeof raw === "string") {
    return {
      mode: "single",
      combined: raw,
      scenes: [raw, "", ""],
    };
  }
  return {
    mode: "single",
    combined: "",
    scenes: ["", "", ""],
  };
}

const SCRIPT_STEP_VIDEO_QUOTA_MSG =
  "limite vidéo atteint pour ce mois, veuillez attendre la fin du mois pour le renouvellement des vidéos ou acheter des packs vidéos pour continuer a créer";
const SCRIPT_STEP_NON_SUB_MSG =
  "Prenez un abonnement pour profiter de ViralWorks Studio et lancer vos générations.";

function ScriptStepQuotaModal({ open, title, message, actionLabel, onClose, onGoToShop }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="studio-panel max-w-xl w-full overflow-hidden border border-amber-500/35 bg-[#131920]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-gray-200">{title || "Quota mensuel épuisé"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3">
            <p className="text-sm text-amber-100">{message || SCRIPT_STEP_VIDEO_QUOTA_MSG}</p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg btn-vws-secondary"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={onGoToShop}
              className="px-4 py-2 rounded-lg btn-vws-primary font-semibold"
            >
              {actionLabel || "Aller vers Packs vidéos"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const steps = [
  { id: 1, key: "campagne", label: "Campagne VWS", shortLabel: "Campagne" },
  { id: 2, key: "visuel", label: "Visuel d'accroche", shortLabel: "Visuel" },
  { id: 3, key: "video", label: "Vidéo virale", shortLabel: "Vidéo" },
];

export default function ViralWorks() {
  const location = useLocation();
  const spaUiInitialRef = useRef(undefined);
  const workflowInitialRef = useRef(undefined);
  const mediaCacheInitialRef = useRef(undefined);
  if (spaUiInitialRef.current === undefined) {
    purgeStudioSessionIfFullReload();
    spaUiInitialRef.current = migrateSpaUiIfNeeded(loadSpaUiStateFromSession());
  }
  if (workflowInitialRef.current === undefined) {
    workflowInitialRef.current = loadViralWorksWorkflowStateFromSession();
  }
  if (mediaCacheInitialRef.current === undefined) {
    mediaCacheInitialRef.current = {
      index: loadViralWorksMediaCacheIndex(),
      image: null,
      video: loadVideoMediaRefs(),
    };
  }
  const spaInitial = spaUiInitialRef.current;
  const workflowInitial = workflowInitialRef.current;
  const mediaCacheInitial = mediaCacheInitialRef.current;
  const workflowHydrateCandidateRef = useRef(workflowInitial);

  const { session } = useAuth();
  const { secteur, loading: profilStudioLoading } = useProfilStudio();
  const { runWithAuth } = useRequireAuthAction();
  const { setStudioLayout } = useStudioLayoutOptions();
  const [showScriptQuotaModal, setShowScriptQuotaModal] = useState(false);
  const [scriptQuotaModalMessage, setScriptQuotaModalMessage] = useState(SCRIPT_STEP_VIDEO_QUOTA_MSG);
  const { hasAccess } = usePremiumAccess();
  const { openBoutiqueModal } = useBoutiqueModal();
  /** idle | running | error — après succès on repasse à idle (navigation auto vers le Visuel). */
  const [scriptGenStatus, setScriptGenStatus] = useState("idle");
  const scriptGenInFlightRef = useRef(false);
  const lastBrainSnapshotRef = useRef(null);
  const sectorPrefillAppliedRef = useRef(false);

  const [currentStep, setCurrentStep] = useState(() => {
    const fromWorkflow = Number(workflowInitial?.currentStep);
    if (Number.isFinite(fromWorkflow) && fromWorkflow >= 1 && fromWorkflow <= STUDIO_STEP_COUNT) {
      return Math.floor(fromWorkflow);
    }
    const n = Number(spaInitial?.currentStep);
    return Number.isFinite(n) && n >= 1 && n <= STUDIO_STEP_COUNT ? Math.floor(n) : 1;
  });
  const [validated, setValidated] = useState(() =>
    normalizeValidated(workflowInitial?.validated ?? spaInitial?.validated)
  );
  const [campaignGenerationSpec, setCampaignGenerationSpec] = useState(() => {
    const workflowCampaign =
      workflowInitial?.campaignGenerationSpec && typeof workflowInitial.campaignGenerationSpec === "object"
        ? normalizeCampaignGenerationSpec(
            deepStripSensitiveUrls(workflowInitial.campaignGenerationSpec)
          )
        : null;
    const draft = loadViralStudioDraftFromSession();
    return normalizeCampaignGenerationSpec(
      workflowCampaign ??
        spaInitial?.campaignGenerationSpec ??
        spaInitial?.campaignData ??
        draft?.campaignGenerationSpec ??
        draft?.campaign ??
        createDefaultCampaignGenerationSpec()
    );
  });
  const campaignData = useMemo(
    () => buildLegacyCampaignDataFromSpec(campaignGenerationSpec),
    [campaignGenerationSpec]
  );

  useEffect(() => {
    if (!session?.user?.id || !secteur?.trim()) return;
    if (profilStudioLoading) return;
    if (sectorPrefillAppliedRef.current) return;
    setCampaignGenerationSpec((prev) => {
      const s = normalizeCampaignGenerationSpec(prev);
      const ideaEmpty = !String(s.campaign.core_idea ?? "").trim();
      const noDecor = !s.campaign.product_scene_decor_id;
      if (!(ideaEmpty && noDecor)) {
        sectorPrefillAppliedRef.current = true;
        return prev;
      }
      sectorPrefillAppliedRef.current = true;
      const patch = buildLegacyCampaignPatchFromSecteur(secteur.trim(), s.campaign.video_format_id);
      return applyLegacyCampaignPatchToSpec(s, patch);
    });
  }, [session?.user?.id, secteur, profilStudioLoading]);
  const [scriptPromptForImage, setScriptPromptForImage] = useState(() => {
    if (workflowInitial?.scriptPromptForImage !== undefined) {
      return normalizeScriptPayload(workflowInitial.scriptPromptForImage);
    }
    if (spaInitial?.scriptPromptForImage !== undefined) {
      return normalizeScriptPayload(spaInitial.scriptPromptForImage);
    }
    const d = loadViralStudioDraftFromSession();
    return normalizeScriptPayload(d?.scriptPrompt ?? "");
  });
  const [step1BrainLaunched, setStep1BrainLaunched] = useState(() =>
    Boolean(spaInitial?.step1BrainLaunched)
  );
  const [preparedCampaignSig, setPreparedCampaignSig] = useState(() => {
    return typeof spaInitial?.preparedCampaignSig === "string" && spaInitial.preparedCampaignSig.length > 0
      ? spaInitial.preparedCampaignSig
      : null;
  });
  const [campagneMountKey, setCampagneMountKey] = useState(() => {
    return Number.isFinite(Number(spaInitial?.campagneMountKey))
      ? Math.max(0, Math.floor(Number(spaInitial.campagneMountKey)))
      : 0;
  });

  const [imageStep, setImageStep] = useState(() => {
    const fromWorkflow = mergeImageStepWithMediaCache(workflowInitial?.imageStep, mediaCacheInitial?.image);
    if (fromWorkflow) {
      spaImageStepMemory = cloneImageStep(fromWorkflow);
      return fromWorkflow;
    }
    const initial = pickInitialImageStep();
    spaImageStepMemory = cloneImageStep(initial);
    return initial;
  });
  const [workflowVideoState, setWorkflowVideoState] = useState(() =>
    sanitizeWorkflowVideoState(workflowInitial?.videoState ?? mediaCacheInitial?.video)
  );
  const [mediaCacheMeta, setMediaCacheMeta] = useState(() => ({
    updatedAt: mediaCacheInitial?.index?.updatedAt || null,
    imageMediaId: mediaCacheInitial?.index?.images?.[0]?.mediaId || null,
    videoMediaId: mediaCacheInitial?.index?.videos?.[0]?.mediaId || null,
  }));
  const [showWorkflowRecoveryChoice, setShowWorkflowRecoveryChoice] = useState(() => {
    const status = workflowInitial?.videoState?.status;
    return status === "generating";
  });

  const [visualSnapshots, setVisualSnapshots] = useState(() => loadVisualSnapshotsFromSession());
  /** Incrémenté quand l’idée de campagne change au « Préparer » : force l’effacement de l’aperçu vidéo (onglet monté en mobile). */
  const [studioWorkflowSoftResetKey, setStudioWorkflowSoftResetKey] = useState(0);
  const lastSnapshottedUrlsRef = useRef(null);
  const imageStepRef = useRef(imageStep);
  imageStepRef.current = imageStep;
  const wasOnVisualLayoutRef = useRef(false);
  /** Évite un double traitement « idée campagne changée » (Strict Mode / effets en cascade). */
  const visualStaleResetOnceRef = useRef(null);
  const studioScrollAnchorRef = useRef(null);
  /** Mobile : CTA « Préparer » délégué à CampagneVWS */
  const step1PrimaryRef = useRef(null);
  /** Branchement CTA mobile « Générer la vidéo » → VEO3VideoForm */
  const videoGenerateRef = useRef(null);

  const [isMobileStudio, setIsMobileStudio] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const fn = () => setIsMobileStudio(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    setStudioLayout({ hideGlobalFooterOnMobile: currentStep === 3 });
    return () => setStudioLayout(null);
  }, [currentStep, setStudioLayout]);

  useLayoutEffect(() => {
    studioScrollAnchorRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [currentStep]);

  /**
   * Mobile studio : les étapes non actives restent dans le DOM avec `hidden` + `aria-hidden`.
   * Si le focus reste sur un contrôle de l’étape précédente, le navigateur avertit (focus dans un arbre caché).
   * On retire le focus avant le paint.
   */
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const active = document.activeElement;
    if (!active || active === document.body || !(active instanceof HTMLElement)) return;
    if (active.closest("[aria-hidden='true']")) {
      active.blur();
    }
  }, [currentStep]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SS_CAMPAIGN_IDEA_LIVE_KEY, String(campaignData?.idea ?? ""));
    } catch {
      /* ignore */
    }
  }, [campaignData?.idea]);

  useEffect(() => {
    if (preparedCampaignSig === null) return;
    const sig = serializeCampaignSpecForPrepareGate(campaignGenerationSpec);
    if (sig === preparedCampaignSig) return;
    setStep1BrainLaunched(false);
    setValidated((prev) => ({
      ...prev,
      1: false,
      2: false,
      3: false,
    }));
  }, [campaignGenerationSpec, preparedCampaignSig]);

  useLayoutEffect(() => {
    const onVisual = currentStep === 2;
    if (!onVisual) {
      wasOnVisualLayoutRef.current = false;
      visualStaleResetOnceRef.current = null;
      return;
    }
    const justEntered = !wasOnVisualLayoutRef.current;
    wasOnVisualLayoutRef.current = true;
    if (!justEntered) return;

    const ideaNow = String(campaignData?.idea ?? "").trim();
    const step = imageStepRef.current;
    const pairedRaw = step.pairedCampaignIdea;
    const pairedTrim =
      typeof pairedRaw === "string" ? pairedRaw.trim() : "";
    const hasPaired = pairedTrim.length > 0;
    const promptTrim = String(step.prompt ?? "").trim();
    const campaignIdeaTrim = String(step.campaignIdeaPrompt ?? "").trim();
    const hasAssets = Boolean(
      step.lastGeneratedImages?.length ||
        step.refCharDataUrl ||
        promptTrim ||
        campaignIdeaTrim
    );

    if (!ideaNow || !hasAssets) return;

    const stale = hasPaired ? pairedTrim !== ideaNow : promptTrim !== ideaNow;
    if (!stale) return;

    const dedupeKey = `reset-visuel|${ideaNow}|${pairedTrim}|${promptTrim}`;
    if (visualStaleResetOnceRef.current === dedupeKey) return;
    visualStaleResetOnceRef.current = dedupeKey;

    appendVisualSnapshotFromStep(step, setVisualSnapshots);

    const fresh = {
      ...INITIAL_IMAGE_STEP,
      campaignIdeaPrompt: ideaNow,
      pairedCampaignIdea: ideaNow,
    };
    spaImageStepMemory = cloneImageStep(fresh);
    lastSnapshottedUrlsRef.current = null;
    persistImageStepOnly(fresh);
    setImageStep(fresh);
  }, [currentStep, campaignData?.idea]);

  const patchImageStep = useCallback((updates) => {
    setImageStep((prev) => {
      const next = {
        ...prev,
        ...(typeof updates === "function" ? updates(prev) : updates),
      };
      persistImageStepOnly(next);
      return next;
    });
  }, []);

  const restoreVisualSnapshot = useCallback((entry) => {
    const raw = entry?.step;
    const s = raw ? sanitizeImageStepFromDraft(raw) : null;
    if (!s?.lastGeneratedImages?.length) return;
    try {
      lastSnapshottedUrlsRef.current = JSON.stringify(s.lastGeneratedImages);
    } catch {
      lastSnapshottedUrlsRef.current = null;
    }
    setImageStep(s);
    persistImageStepOnly(s);
  }, []);

  const resetImageStep = useCallback((opts = {}) => {
    const preserveVisualHistory = opts?.preserveVisualHistory === true;
    const stepBefore = imageStepRef.current;
    if (preserveVisualHistory && stepBefore?.lastGeneratedImages?.length) {
      appendVisualSnapshotFromStep(stepBefore, setVisualSnapshots);
    }
    const empty = { ...INITIAL_IMAGE_STEP, image24sDebug: null };
    spaImageStepMemory = cloneImageStep(empty);
    lastSnapshottedUrlsRef.current = null;
    if (!preserveVisualHistory) {
      setVisualSnapshots([]);
      persistVisualSnapshotsToSession([]);
    }
    persistImageStepOnly(empty);
    setImageStep(empty);
    // Empêche Image.jsx de ré-hydrater immédiatement l’ancienne grille via le cache média.
    void saveImageMediaRef({ urls: [], fallbackData: [], createdAt: new Date().toISOString() });
  }, []);

  useEffect(() => {
    const urls = imageStep?.lastGeneratedImages;
    if (!urls?.length) return;
    let sig;
    try {
      sig = JSON.stringify(urls);
    } catch {
      return;
    }
    if (lastSnapshottedUrlsRef.current === sig) return;
    lastSnapshottedUrlsRef.current = sig;
    scheduleVisualSnapshotFromStep(imageStep, setVisualSnapshots);
  }, [imageStep]);

  useEffect(() => {
    let active = true;
    const hydrateImageMediaCache = async () => {
      const cached = await loadImageMediaRefs();
      if (!active || !cached) return;
      setMediaCacheMeta((prev) => ({
        ...prev,
        updatedAt: cached.updatedAt || prev.updatedAt,
        imageMediaId: cached.mediaId || prev.imageMediaId,
      }));
      setImageStep((prev) => mergeImageStepWithMediaCache(prev, cached));
    };
    void hydrateImageMediaCache();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    saveViralStudioDraftToSession({
      campaignGenerationSpec,
      scriptPrompt: scriptPromptForImage,
      imageStep,
    });
  }, [campaignGenerationSpec, scriptPromptForImage, imageStep]);

  useEffect(() => {
    registerSpaImageStepMemoryClear(() => {
      spaImageStepMemory = null;
    });
    return () => registerSpaImageStepMemoryClear(null);
  }, []);

  useEffect(() => {
    const sanitizedSnapshot = {
      version: WORKFLOW_STATE_VERSION,
      updatedAt: Date.now(),
      currentStep,
      validated: normalizeValidated(validated),
      campaignGenerationSpec: deepStripSensitiveUrls(
        normalizeCampaignGenerationSpec(campaignGenerationSpec)
      ),
      scriptPromptForImage: normalizeScriptPayload(scriptPromptForImage),
      imageStep: sanitizeImageStepForWorkflowPersistence(imageStep),
      videoState: sanitizeWorkflowVideoState(workflowVideoState),
      mediaCache: {
        imageMediaId: mediaCacheMeta.imageMediaId,
        videoMediaId: mediaCacheMeta.videoMediaId,
        updatedAt: mediaCacheMeta.updatedAt,
      },
    };
    const ok = saveViralWorksWorkflowStateToSession(sanitizedSnapshot);
    if (!ok) {
      console.warn("[ViralWorks] Persistance workflow_state impossible.");
    }
    if (session?.user?.id) {
      touchStudioWorkflowLease(session.user.id);
    }
  }, [
    currentStep,
    validated,
    campaignGenerationSpec,
    scriptPromptForImage,
    imageStep,
    workflowVideoState,
    mediaCacheMeta,
    session?.user?.id,
  ]);

  useEffect(() => {
    const urls = Array.isArray(imageStep?.lastGeneratedImages) ? imageStep.lastGeneratedImages : [];
    if (!urls.length) return;
    const createdAt = new Date().toISOString();
    void saveImageMediaRef({
      mediaId: mediaCacheMeta.imageMediaId || undefined,
      urls,
      createdAt,
      fallbackData: [],
    }).then(async () => {
      const index = loadViralWorksMediaCacheIndex();
      setMediaCacheMeta((prev) => ({
        ...prev,
        updatedAt: index.updatedAt || prev.updatedAt,
        imageMediaId: index.images?.[0]?.mediaId || prev.imageMediaId,
      }));
    });
  }, [imageStep?.lastGeneratedImages, mediaCacheMeta.imageMediaId]);

  useEffect(() => {
    if (!workflowVideoState?.videoId) return;
    saveVideoMediaRef({
      mediaId: mediaCacheMeta.videoMediaId || undefined,
      videoId: workflowVideoState.videoId,
      provider: workflowVideoState.provider || "veo3",
      status: workflowVideoState.status || "done",
      createdAt: workflowVideoState.createdAt || new Date().toISOString(),
    });
    const index = loadViralWorksMediaCacheIndex();
    setMediaCacheMeta((prev) => ({
      ...prev,
      updatedAt: index.updatedAt || prev.updatedAt,
      videoMediaId: index.videos?.[0]?.mediaId || prev.videoMediaId,
    }));
  }, [
    workflowVideoState?.videoId,
    workflowVideoState?.provider,
    workflowVideoState?.status,
    workflowVideoState?.createdAt,
    mediaCacheMeta.videoMediaId,
  ]);

  useEffect(() => {
    const initial = workflowHydrateCandidateRef.current;
    if (!initial || typeof initial !== "object") return;
    const shouldPrompt = initial?.videoState?.status === "generating";
    if (shouldPrompt) return;
    setShowWorkflowRecoveryChoice(false);
    workflowHydrateCandidateRef.current = null;
  }, []);

  useEffect(() => {
    try {
        sessionStorage.setItem(
        SS_SPA_UI_KEY,
        JSON.stringify({
          studioFlowVersion: STUDIO_FLOW_VERSION,
          currentStep,
          validated,
          step1BrainLaunched,
          preparedCampaignSig,
          campaignGenerationSpec,
          scriptPromptForImage,
          campagneMountKey,
        })
      );
    } catch (err) {
      console.warn("[ViralWorks] Persistance session UI studio:", err);
    }
  }, [
    currentStep,
    validated,
    step1BrainLaunched,
    preparedCampaignSig,
    campaignGenerationSpec,
    scriptPromptForImage,
    campagneMountKey,
    location.pathname,
  ]);

  /**
   * Navigation entre étapes : retour arrière toujours autorisé ; pour avancer au-delà de l’étape
   * courante, toutes les étapes précédentes doivent être marquées validées (bouton global ou raccourci visuel).
   */
  const canGoToStep = (stepId) => {
    if (isMobileStudio) return true;
    if (stepId <= currentStep) return true;
    for (let i = 1; i < stepId; i += 1) {
      if (!validated[i]) return false;
    }
    return true;
  };

  const handleGoToStep = (stepId) => {
    if (canGoToStep(stepId)) {
      setCurrentStep(stepId);
    }
  };

  const handleCampaignBrainReady = useCallback(
    (snapshot) => {
      const incomingTrim = String(snapshot?.idea ?? "").trim();
      const specNow = normalizeCampaignGenerationSpec(campaignGenerationSpec);
      const lastPreparedTrim = String(specNow.trace.persistence.last_prepared_core_idea ?? "").trim();
      const shouldResetWorkflow =
        lastPreparedTrim.length > 0 && incomingTrim !== lastPreparedTrim;

      if (shouldResetWorkflow) {
        resetWorkflowUsage();
        setCurrentStep(1);
        setValidated(normalizeValidated({}));
        setScriptPromptForImage(normalizeScriptPayload(""));
        setScriptGenStatus("idle");
        scriptGenInFlightRef.current = false;
        setWorkflowVideoState({
          status: "idle",
          videoId: null,
          lastError: "",
          provider: "veo3",
          createdAt: null,
        });
        setShowWorkflowRecoveryChoice(false);
        setStudioWorkflowSoftResetKey((n) => n + 1);
        resetImageStep({ preserveVisualHistory: true });
      }

      let next = applyLegacyCampaignPatchToSpec(createDefaultCampaignGenerationSpec(), snapshot || {});
      next = normalizeCampaignGenerationSpec({
        ...next,
        trace: {
          ...next.trace,
          persistence: {
            ...next.trace.persistence,
            last_prepared_core_idea: incomingTrim || null,
          },
        },
      });
      setPreparedCampaignSig(serializeCampaignSpecForPrepareGate(next));
      setCampaignGenerationSpec(next);
      setStep1BrainLaunched(true);
      lastBrainSnapshotRef.current = snapshot || null;

      const run = async () => {
        if (scriptGenInFlightRef.current) return;
        scriptGenInFlightRef.current = true;
        setScriptGenStatus("running");
        try {
          const result = await runStudioScriptRefinement({
            idea: String(snapshot?.idea ?? "").trim(),
            campaignData: snapshot || {},
            session,
            persistHistory: true,
            consumeQuota: true,
          });
          if (!result.ok) {
            if (result.code === "credits") {
              setScriptQuotaModalMessage(
                hasAccess ? SCRIPT_STEP_VIDEO_QUOTA_MSG : SCRIPT_STEP_NON_SUB_MSG
              );
              setShowScriptQuotaModal(true);
              capturePostHog("quota_limit_reached", { step: "script", code: "credits" });
            } else if (result.code === "quota") {
              setScriptQuotaModalMessage(
                result.message ||
                  (hasAccess ? SCRIPT_STEP_VIDEO_QUOTA_MSG : SCRIPT_STEP_NON_SUB_MSG)
              );
              setShowScriptQuotaModal(true);
              capturePostHog("quota_limit_reached", { step: "script", code: "quota" });
            } else if (result.code === "validation") {
              const msg = result.message;
              alert(msg);
              trackPostHogError(msg, "/viralworks", "validation");
            } else {
              const msg = result.message || "Impossible de générer le script.";
              alert(msg);
              trackPostHogError(msg, "/viralworks", "generation");
            }
            setScriptGenStatus("error");
            return;
          }
          capturePostHog("campaign_creation_completed", {
            video_format_id: snapshot?.videoFormatId ?? null,
          });
          setScriptPromptForImage(result.payload);
          const refinedPackaging = result.payload.campaignGenerationSpec?.campaign;
          if (
            refinedPackaging?.packaging_box_appearance ||
            refinedPackaging?.packaging_opening_gesture ||
            refinedPackaging?.packaging_opening_sound
          ) {
            setCampaignGenerationSpec((prev) => {
              const next = normalizeCampaignGenerationSpec({
                ...prev,
                campaign: {
                  ...prev?.campaign,
                  packaging_box_appearance:
                    refinedPackaging.packaging_box_appearance ??
                    prev?.campaign?.packaging_box_appearance ??
                    null,
                  packaging_opening_gesture:
                    refinedPackaging.packaging_opening_gesture ??
                    prev?.campaign?.packaging_opening_gesture ??
                    null,
                  packaging_opening_sound:
                    refinedPackaging.packaging_opening_sound ??
                    prev?.campaign?.packaging_opening_sound ??
                    null,
                },
              });
              console.log("[Merge] packaging_box_appearance:", next.campaign.packaging_box_appearance);
              return next;
            });
          }
          setScriptGenStatus("idle");
        } catch (e) {
          setScriptGenStatus("error");
          const msg = e?.message || "Erreur inattendue pendant la génération du script.";
          alert(msg);
          trackPostHogError(msg, "/viralworks", "generation");
        } finally {
          scriptGenInFlightRef.current = false;
        }
      };
      void run();
    },
    [campaignGenerationSpec, resetImageStep, session, hasAccess]
  );

  const applyStudioWorkflowResetState = useCallback(() => {
    setPreparedCampaignSig(null);
    setStep1BrainLaunched(false);
    setScriptGenStatus("idle");
    scriptGenInFlightRef.current = false;
    lastBrainSnapshotRef.current = null;
    setValidated(normalizeValidated({}));
    setCurrentStep(1);
    setScriptPromptForImage(normalizeScriptPayload(""));
    sectorPrefillAppliedRef.current = true;
    let spec = normalizeCampaignGenerationSpec(createDefaultCampaignGenerationSpec());
    if (secteur?.trim()) {
      spec = normalizeCampaignGenerationSpec(
        applyLegacyCampaignPatchToSpec(spec, buildLegacyCampaignPatchFromSecteur(secteur.trim()))
      );
    }
    setCampaignGenerationSpec(spec);
    setCampagneMountKey((k) => k + 1);
    setWorkflowVideoState({ status: "idle", videoId: null, lastError: "", provider: "veo3", createdAt: null });
    setMediaCacheMeta({ updatedAt: null, imageMediaId: null, videoMediaId: null });
    setShowWorkflowRecoveryChoice(false);
    setStudioWorkflowSoftResetKey((n) => n + 1);
    resetImageStep();
  }, [resetImageStep, secteur]);

  const handleCampagneFullReset = useCallback(() => {
    clearViralWorksWorkflowStateFromSession();
    void purgeViralWorksMediaCache();
    try {
      sessionStorage.removeItem(SS_BRAIN_V2_LAST_KEY);
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem(SS_SPA_UI_KEY);
    } catch {
      /* ignore */
    }
    resetWorkflowUsage();
    applyStudioWorkflowResetState();
  }, [applyStudioWorkflowResetState]);

  useEffect(() => {
    const onStudioReset = () => applyStudioWorkflowResetState();
    window.addEventListener(STUDIO_WORKFLOW_RESET_EVENT, onStudioReset);
    return () => window.removeEventListener(STUDIO_WORKFLOW_RESET_EVENT, onStudioReset);
  }, [applyStudioWorkflowResetState]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    let cancelled = false;
    const run = async () => {
      if (!shouldResetStudioWorkflow(uid)) {
        touchStudioWorkflowLease(uid);
        return;
      }
      await clearAllViralWorksStudioPersistence();
      if (cancelled) return;
      applyStudioWorkflowResetState();
      touchStudioWorkflowLease(uid);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, applyStudioWorkflowResetState]);

  const handleResumeRecoveredWorkflow = useCallback(() => {
    setShowWorkflowRecoveryChoice(false);
    workflowHydrateCandidateRef.current = null;
  }, []);

  const handleRestartRecoveredWorkflow = useCallback(() => {
    clearViralWorksWorkflowStateFromSession();
    setShowWorkflowRecoveryChoice(false);
    workflowHydrateCandidateRef.current = null;
    handleCampagneFullReset();
  }, [handleCampagneFullReset]);

  const handleValidateAndNext = async () => {
    if (currentStep === 1 && !step1BrainLaunched) return;
    if (currentStep === 1 && scriptGenStatus === "running") return;
    if (currentStep === 2 && !imageStepHasHookVisual(imageStep)) {
      alert("Génère ou importe un visuel avant de continuer.");
      return;
    }

    // Le débit crédit « fin de parcours vidéo » est effectué dans Video.jsx au clic
    // « Télécharger la vidéo » (upload + historique). Ne pas marquer videoCreditDebited ici,
    // sinon le téléchargement ne débite plus le serveur.

    setValidated((prev) => ({ ...prev, [currentStep]: true }));
    if (currentStep < STUDIO_STEP_COUNT) {
      setCurrentStep(currentStep + 1);
    }
  };

  const validateStepBlocked =
    (currentStep === 1 && !step1BrainLaunched) ||
    scriptGenStatus === "running" ||
    (currentStep === 2 && !imageStepHasHookVisual(imageStep));

  const validateStepPromptLoading = scriptGenStatus === "running";

  const handleVideoWorkflowStateChange = useCallback((nextState) => {
    setWorkflowVideoState((prev) => {
      const incoming = sanitizeWorkflowVideoState(nextState);
      return {
        ...prev,
        ...incoming,
        createdAt: incoming.createdAt || prev?.createdAt || null,
      };
    });
  }, []);

  /** Dès que le cerveau a fini, tant que l’étape 1 n’est pas validée : griser Préparer (y compris pendant le script). */
  const awaitingStep1Validation =
    currentStep === 1 && step1BrainLaunched && !validated[1];

  const studioVideoStepActive = location.pathname === "/viralworks" && currentStep === 3;

  const imagePageProps = {
    campaignIdea: campaignData?.idea ?? "",
    campaignStagingChips: Array.isArray(campaignData?.stagingChips)
      ? [...campaignData.stagingChips]
      : [],
    campaignJobType: campaignData?.profession ?? "",
    campaignModifiers: campaignData?.styleDetails ?? "",
    campaignClarifyMode: campaignData?.clarifyMode ?? campaignData?.gateResult?.mode ?? null,
    campaignClarifyAnswer: campaignData?.clarifyAnswer ?? null,
    campaignCameraAerialAngle: campaignData?.cameraAerialAngle ?? null,
    campaignCameraViewAngle: campaignData?.cameraViewAngle ?? null,
    campaignCameraFaceMode: campaignData?.cameraFaceMode ?? null,
    campaignGlobalIntentProfile: campaignData?.globalIntentProfile ?? null,
    campaignSelfieMode: Boolean(campaignData?.selfieMode),
    sequenceType: campaignData?.sequenceType === "three_x_8s" ? "three_x_8s" : "single_8s",
    scriptScene1Idea: String(scriptPromptForImage?.scenes?.[0] ?? scriptPromptForImage?.combined ?? ""),
    scriptScene2Idea: String(scriptPromptForImage?.scenes?.[1] ?? ""),
    scriptScene3Idea: String(scriptPromptForImage?.scenes?.[2] ?? ""),
    campaignRevealMode: Boolean(campaignData?.revealMode),
    campaignMicroAnswer: campaignData?.microAnswer ?? null,
    campaignGenerationSpec,
    visualStepActive: currentStep === 2,
    imageStep,
    patchImageStep,
    resetImageStep,
    visualSnapshots,
    onRestoreVisualSnapshot: restoreVisualSnapshot,
    onUseImageAndContinue: () => {
      setValidated((prev) => ({ ...prev, 2: true }));
      setCurrentStep(3);
    },
  };

  return (
    <div
      ref={studioScrollAnchorRef}
      className="mx-auto w-full min-w-0 max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-[640px]:space-y-3"
    >
      <ScriptStepQuotaModal
        open={showScriptQuotaModal}
        title={hasAccess ? "Quota mensuel épuisé" : "Accès abonnement requis"}
        message={scriptQuotaModalMessage}
        actionLabel={hasAccess ? "Aller vers Packs vidéos" : "Voir les abonnements"}
        onClose={() => setShowScriptQuotaModal(false)}
        onGoToShop={() => {
          setShowScriptQuotaModal(false);
          openBoutiqueModal(hasAccess ? "packs-videos" : "subscription");
        }}
      />
      <div className="max-[640px]:shrink-0">
        <PageTitle
          green="ViralWorks"
          white="Studio"
          subtitle="Un seul flux pour orchestrer ta campagne vidéo : cerveau VWS, visuel d'accroche et vidéo virale."
        />
      </div>

      <div className="space-y-6 max-[640px]:space-y-3">
          {/* Navigation étapes — mêmes patrons desktop / mobile (libellés courts sous breakpoint sm) */}
          <div className="studio-panel max-[640px]:shrink-0 px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 flex flex-wrap gap-3">
              {steps.map((step) => {
                const isActive = currentStep === step.id;
                const isDone = validated[step.id];
                const disabled = !canGoToStep(step.id);
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => handleGoToStep(step.id)}
                    disabled={disabled}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs sm:text-sm transition-all duration-150 ${
                      isActive
                        ? "card-vws-active text-emerald-100 rounded-full"
                        : disabled
                          ? "bg-white/[0.03] border border-white/[0.06] text-gray-500 cursor-not-allowed"
                          : "card-vws text-gray-300 hover:bg-white/[0.06] rounded-full"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 inline-flex items-center justify-center rounded-full text-[10px] font-semibold transition-all duration-150 ${
                        isDone
                          ? "bg-gradient-to-br from-[var(--vws-primary-top)] to-[var(--vws-primary-deep)] text-white step-disk-vws-done"
                          : isActive
                            ? "bg-[var(--vws-primary)] text-gray-950 step-disk-vws-active"
                            : "bg-white/10 text-gray-200"
                      }`}
                    >
                      {isDone ? <Check className="w-3 h-3" /> : step.id}
                    </span>
                    <span className="sm:hidden">{step.shortLabel}</span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex w-full max-[640px]:flex-col max-[640px]:items-stretch sm:w-auto sm:flex-row sm:items-center gap-2 sm:justify-end">
              <span className="text-xs text-gray-400 max-[640px]:text-center sm:text-left">
                Étape {currentStep} sur 3
              </span>
              <button
                type="button"
                onClick={() => {
                  void runWithAuth(handleValidateAndNext);
                }}
                disabled={validateStepBlocked}
                aria-busy={validateStepPromptLoading}
                title={
                  validateStepBlocked
                    ? scriptGenStatus === "running"
                      ? "Génération du script en cours…"
                      : currentStep === 2 && !imageStepHasHookVisual(imageStep)
                        ? "Génère ou importe un visuel avant de continuer."
                        : currentStep === 1 && !step1BrainLaunched
                          ? "Lance d’abord le cerveau VWS avec le bouton vert dans l’étape Campagne."
                          : undefined
                    : undefined
                }
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-center leading-tight transition-colors duration-150 ${
                  validateStepBlocked
                    ? "bg-white/10 text-gray-500 border border-white/10 cursor-not-allowed opacity-70"
                    : "btn-vws-primary"
                }`}
              >
                {validateStepPromptLoading ? (
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white/20 border-t-white/95 motion-safe:animate-[spin_0.8s_linear_infinite]"
                    aria-hidden
                  />
                ) : null}
                <span className="min-w-0">
                  {currentStep < STUDIO_STEP_COUNT
                    ? "Valider cette étape et passer à la suivante"
                    : "Marquer comme terminé"}
                </span>
              </button>
            </div>
          </div>

          {scriptGenStatus === "running" ? (
            <p
              className="text-xs text-cyan-200/90 -mt-2 max-[640px]:mx-0 sm:ml-1"
              role="status"
              aria-live="polite"
            >
              Génération du script en cours…
            </p>
          ) : null}

          {scriptGenStatus === "error" && currentStep === 1 && step1BrainLaunched ? (
            <div className="flex flex-wrap items-center gap-2 -mt-2 max-[640px]:mx-0 sm:ml-1">
              <p className="text-xs text-amber-200/90">La génération du script a échoué.</p>
              <button
                type="button"
                onClick={() => {
                  const snap = lastBrainSnapshotRef.current;
                  if (!snap) return;
                  void handleCampaignBrainReady(snap);
                }}
                className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
              >
                Réessayer la génération du script
              </button>
            </div>
          ) : null}

          {showWorkflowRecoveryChoice ? (
            <div className="rounded-xl border border-cyan-500/35 bg-cyan-950/20 p-4">
              <p className="text-sm text-cyan-100">
                Une session précédente a été trouvée. Une génération vidéo était en cours.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleResumeRecoveredWorkflow}
                  className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold btn-vws-primary"
                >
                  Reprendre
                </button>
                <button
                  type="button"
                  onClick={handleRestartRecoveredWorkflow}
                  className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold btn-vws-secondary text-gray-200"
                >
                  Recommencer
                </button>
              </div>
            </div>
          ) : null}

          <div className="w-full min-w-0 space-y-6 max-[640px]:space-y-3">
            {isMobileStudio ? (
              <>
                <section
                  id="campagne"
                  className={currentStep === 1 ? "block w-full min-w-0" : "hidden"}
                  aria-hidden={currentStep !== 1}
                >
                  <CampagneVWS
                    key={campagneMountKey}
                    campaignData={campaignData}
                    onCampaignChange={(nextCampaignData) =>
                      setCampaignGenerationSpec((prev) =>
                        applyLegacyCampaignPatchToSpec(prev, nextCampaignData || {})
                      )
                    }
                    onBrainReady={handleCampaignBrainReady}
                    onCampagneFullReset={handleCampagneFullReset}
                    scriptGenerationPending={scriptGenStatus === "running"}
                    awaitingStep1Validation={awaitingStep1Validation}
                    step1PrimaryRef={step1PrimaryRef}
                    formatPickerPresentation="studioOverlay"
                  />
                </section>
                <section
                  id="visuel"
                  className={currentStep === 2 ? "block w-full min-w-0" : "hidden"}
                  aria-hidden={currentStep !== 2}
                >
                  <ImagePage {...imagePageProps} />
                </section>
                <section
                  id="video"
                  className={currentStep === 3 ? "block w-full min-w-0" : "hidden"}
                  aria-hidden={currentStep !== 3}
                >
                  <VideoPage
                    ref={videoGenerateRef}
                    studioSequenceType={campaignData?.sequenceType}
                    studioScriptPrompt={scriptPromptForImage}
                    studioImageStep={imageStep}
                    dialogueEnabled={campaignData?.dialogueEnabled !== false}
                    studioCampaignData={campaignData}
                    studioCampaignGenerationSpec={campaignGenerationSpec}
                    studioStepActive={studioVideoStepActive}
                    studioOnStartNewCampaign={handleCampagneFullReset}
                    studioOnResetImageStep={resetImageStep}
                    studioWorkflowSoftResetKey={studioWorkflowSoftResetKey}
                    onWorkflowVideoStateChange={handleVideoWorkflowStateChange}
                    initialWorkflowVideoState={workflowVideoState}
                  />
                </section>
              </>
            ) : (
              <>
                <section
                  id="campagne"
                  className={currentStep === 1 ? "block w-full min-w-0" : "hidden"}
                  aria-hidden={currentStep !== 1}
                >
                  <CampagneVWS
                    key={campagneMountKey}
                    campaignData={campaignData}
                    onCampaignChange={(nextCampaignData) =>
                      setCampaignGenerationSpec((prev) =>
                        applyLegacyCampaignPatchToSpec(prev, nextCampaignData || {})
                      )
                    }
                    onBrainReady={handleCampaignBrainReady}
                    onCampagneFullReset={handleCampagneFullReset}
                    scriptGenerationPending={scriptGenStatus === "running"}
                    awaitingStep1Validation={awaitingStep1Validation}
                  />
                </section>
                {currentStep === 2 ? (
                  <section id="visuel" aria-hidden={false}>
                    <ImagePage {...imagePageProps} />
                  </section>
                ) : null}
                {currentStep === 3 ? (
                  <section id="video" aria-hidden={false}>
                    <VideoPage
                      ref={videoGenerateRef}
                      studioSequenceType={campaignData?.sequenceType}
                      studioScriptPrompt={scriptPromptForImage}
                      studioImageStep={imageStep}
                      dialogueEnabled={campaignData?.dialogueEnabled !== false}
                      studioCampaignData={campaignData}
                      studioCampaignGenerationSpec={campaignGenerationSpec}
                      studioStepActive={studioVideoStepActive}
                      studioOnStartNewCampaign={handleCampagneFullReset}
                      studioOnResetImageStep={resetImageStep}
                      studioWorkflowSoftResetKey={studioWorkflowSoftResetKey}
                      onWorkflowVideoStateChange={handleVideoWorkflowStateChange}
                      initialWorkflowVideoState={workflowVideoState}
                    />
                  </section>
                ) : null}
              </>
            )}
          </div>

        {/* CTA mobile unifié — étape 3 vidéo (étape 2 Visuel : pas de doublon avec « Utiliser cette image » / toolbar) */}
        {currentStep === 3 ? (
          <div className="hidden max-[640px]:flex shrink-0 flex-col gap-2 border-t border-[#171e30] bg-[#0f1420] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => {
                void runWithAuth(async () => {
                  videoGenerateRef.current?.generate?.();
                });
              }}
              disabled={workflowVideoState?.status === "generating"}
              className="vws-mobile-flat-green-cta flex w-full items-center justify-center gap-2 text-center text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>
                {workflowVideoState?.status === "done"
                  ? "✦ Générer une nouvelle version"
                  : "✦ Générer la vidéo"}
              </span>
            </button>
            {workflowVideoState?.status === "done" ? (
              <button
                type="button"
                onClick={() => {
                  void runWithAuth(async () => {
                    videoGenerateRef.current?.downloadVideo?.();
                  });
                }}
                className="vws-mobile-flat-download-cta flex w-full items-center justify-center gap-2 text-center"
              >
                <Download className="h-4 w-4 shrink-0" />
                <span>Télécharger la vidéo</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

