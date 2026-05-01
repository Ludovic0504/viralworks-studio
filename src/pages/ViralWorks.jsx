import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react";
import PageTitle from "../composants/interface/TitrePage";
import CampagneVWS from "./CampagneVWS.jsx";
import ImagePage from "./Image.jsx";
import VideoPage from "./Video.jsx";
import {
  markVideoWorkflowCreditConsumed,
  resetWorkflowUsage,
  shouldDebitVideoCredit,
} from "@/bibliotheque/workflowQuota";
import {
  LS_VIRAL_STUDIO_DRAFT,
  LS_IMAGE_STEP_KEY,
  SS_IMAGE_STEP_KEY,
  SS_VISUAL_SNAPSHOTS_KEY,
  SS_CAMPAIGN_IDEA_LIVE_KEY,
  SS_SPA_UI_KEY,
  isReloadNavigation,
  clearViralWorksTransientSessionKeys,
  loadSpaUiStateFromSession,
  loadViralStudioDraftFromLocal,
} from "@/bibliotheque/viralWorksStudioStorage";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { debitCredits, hasEnoughCredits } from "@/bibliotheque/supabase/credits";
import { getUserSubscription } from "@/bibliotheque/supabase/stripe";
import {
  createDefaultCampaignGenerationSpec,
  normalizeCampaignGenerationSpec,
} from "@/bibliotheque/campaignGenerationSpec";
import { runStudioScriptRefinement } from "@/bibliotheque/studioScriptRefinement";
import { Check, X } from "lucide-react";
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
  try {
    localStorage.setItem(LS_IMAGE_STEP_KEY, json);
  } catch (err) {
    console.warn("[ViralWorks] localStorage étape Visuel (quota ?):", err);
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

function readLocalImageStepBackup() {
  try {
    const raw = localStorage.getItem(LS_IMAGE_STEP_KEY);
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
    const draftImg = sanitizeImageStepFromDraft(loadViralStudioDraftFromLocal()?.imageStep);
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
  const localS = readLocalImageStepBackup();
  const draftS = sanitizeImageStepFromDraft(loadViralStudioDraftFromLocal()?.imageStep);

  const candidates = [mem, sessionS, localS, draftS].filter(Boolean);
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
  lastGeneratedImages: null,
  lastGeneratedPrompt: "",
  selectedImageIndex: 0,
  modifyInstruction: "",
  /** Idée campagne pour laquelle la grille actuelle a été produite (nouveau contexte → reset). */
  pairedCampaignIdea: null,
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
  };
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

/** Aligné sur les champs Campagne VWS utilisés pour « Préparer ma vidéo ». */
function normalizeTempoForGate(t) {
  return t === "timelapse" || t === "slow_motion" ? t : "real_time";
}

function serializeCampaignSpecForPrepareGate(spec) {
  const normalized = normalizeCampaignGenerationSpec(spec);
  return JSON.stringify({
    schema_version: normalized.meta.schema_version,
    profession: String(normalized.campaign.profession ?? "").trim(),
    idea: String(normalized.campaign.core_idea ?? "").trim(),
    styleDetails: String(normalized.campaign.style_details ?? "").trim(),
    tempo: normalizeTempoForGate(normalized.rendering.tempo),
    cameraFixed: Boolean(normalized.rendering.camera.fixed),
    revealMode: Boolean(normalized.rendering.camera.reveal_mode),
    cinematicMovement: Boolean(normalized.rendering.camera.cinematic_movement),
    selfieMode: Boolean(normalized.rendering.camera.selfie_mode),
    sequenceType: normalized.creative.sequence_type === "three_x_8s" ? "three_x_8s" : "single_8s",
    dialogueEnabled: normalized.rendering.audio.dialogue_enabled !== false,
    microAnswer: normalized.campaign.clarification.initial_state ?? null,
    clarifyAnswer: normalized.campaign.clarification.last_user_freeform_answer ?? null,
    clarifyMode: normalized.campaign.clarification.mode ?? null,
    clarifyDiagnostic: normalized.campaign.clarification.diagnostic ?? null,
    globalIntentProfile: normalized.campaign.intent_profile ?? null,
    proceedAnyway: normalized.campaign.clarification.proceed_anyway === true,
    isClarified: normalized.campaign.clarification.is_resolved === true,
    clarificationHistory: Array.isArray(normalized.campaign.clarification.history)
      ? normalized.campaign.clarification.history
      : [],
    clarifyAxesResolved: {
      modeAgent: normalized.campaign.clarification.resolved_axes.mode_agent === true,
      initialT0: normalized.campaign.clarification.resolved_axes.initial_t0 === true,
      causalAgent: normalized.campaign.clarification.resolved_axes.causal_agent === true,
      cameraAerialAngle: normalized.campaign.clarification.resolved_axes.camera_aerial_angle === true,
    },
  });
}

function buildLegacyCampaignDataFromSpec(spec) {
  const s = normalizeCampaignGenerationSpec(spec);
  return {
    profession: s.campaign.profession ?? "",
    idea: s.campaign.core_idea ?? "",
    styleDetails: s.campaign.style_details ?? "",
    tempo: normalizeTempoForGate(s.rendering.tempo),
    cameraFixed: Boolean(s.rendering.camera.fixed),
    revealMode: Boolean(s.rendering.camera.reveal_mode),
    cinematicMovement: Boolean(s.rendering.camera.cinematic_movement),
    selfieMode: Boolean(s.rendering.camera.selfie_mode),
    sequenceType: s.creative.sequence_type === "three_x_8s" ? "three_x_8s" : "single_8s",
    dialogueEnabled: s.rendering.audio.dialogue_enabled !== false,
    microAnswer: s.campaign.clarification.initial_state ?? null,
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
      core_idea: patch?.idea ?? prev.campaign.core_idea,
      style_details: patch?.styleDetails ?? prev.campaign.style_details,
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

const VIDEO_STEP_CREDIT_COST = 1;
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
  { id: 1, key: "campagne", label: "Campagne VWS" },
  { id: 2, key: "visuel", label: "Visuel d'accroche" },
  { id: 3, key: "video", label: "Vidéo virale" },
];

export default function ViralWorks() {
  const location = useLocation();
  const spaUiInitialRef = useRef(undefined);
  if (spaUiInitialRef.current === undefined) {
    purgeStudioSessionIfFullReload();
    spaUiInitialRef.current = migrateSpaUiIfNeeded(loadSpaUiStateFromSession());
  }
  const spaInitial = spaUiInitialRef.current;

  const { session } = useAuth();
  const { runWithAuth } = useRequireAuthAction();
  const [showScriptQuotaModal, setShowScriptQuotaModal] = useState(false);
  const [scriptQuotaModalMessage, setScriptQuotaModalMessage] = useState(SCRIPT_STEP_VIDEO_QUOTA_MSG);
  const [hasActiveSubscriptionVw, setHasActiveSubscriptionVw] = useState(false);
  /** idle | running | error — après succès on repasse à idle (navigation auto vers le Visuel). */
  const [scriptGenStatus, setScriptGenStatus] = useState("idle");
  const scriptGenInFlightRef = useRef(false);
  const lastBrainSnapshotRef = useRef(null);

  const [currentStep, setCurrentStep] = useState(() => {
    const n = Number(spaInitial?.currentStep);
    return Number.isFinite(n) && n >= 1 && n <= STUDIO_STEP_COUNT ? Math.floor(n) : 1;
  });
  const [validated, setValidated] = useState(() => normalizeValidated(spaInitial?.validated));
  const [campaignGenerationSpec, setCampaignGenerationSpec] = useState(() => {
    const draft = loadViralStudioDraftFromLocal();
    return normalizeCampaignGenerationSpec(
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
  const [scriptPromptForImage, setScriptPromptForImage] = useState(() => {
    if (spaInitial?.scriptPromptForImage !== undefined) {
      return normalizeScriptPayload(spaInitial.scriptPromptForImage);
    }
    const d = loadViralStudioDraftFromLocal();
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
    const initial = pickInitialImageStep();
    spaImageStepMemory = cloneImageStep(initial);
    return initial;
  });

  const [visualSnapshots, setVisualSnapshots] = useState(() => loadVisualSnapshotsFromSession());
  const lastSnapshottedUrlsRef = useRef(null);
  const imageStepRef = useRef(imageStep);
  imageStepRef.current = imageStep;
  const wasOnVisualLayoutRef = useRef(false);
  const studioScrollAnchorRef = useRef(null);

  useLayoutEffect(() => {
    studioScrollAnchorRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
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

  const resetImageStep = useCallback(() => {
    const empty = { ...INITIAL_IMAGE_STEP };
    spaImageStepMemory = cloneImageStep(empty);
    lastSnapshottedUrlsRef.current = null;
    setVisualSnapshots([]);
    persistVisualSnapshotsToSession([]);
    persistImageStepOnly(empty);
    setImageStep(empty);
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
    try {
      localStorage.setItem(
        LS_VIRAL_STUDIO_DRAFT,
        JSON.stringify({
          campaignGenerationSpec,
          scriptPrompt: scriptPromptForImage,
          imageStep,
        })
      );
    } catch (err) {
      console.warn("[ViralWorks] Sauvegarde brouillon studio:", err);
    }
  }, [campaignGenerationSpec, scriptPromptForImage, imageStep, campaignData]);

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

  useEffect(() => {
    let active = true;
    const loadSubscriptionState = async () => {
      if (!session?.user?.id) {
        if (active) setHasActiveSubscriptionVw(false);
        return;
      }
      try {
        const sub = await getUserSubscription();
        if (active) setHasActiveSubscriptionVw(Boolean(sub));
      } catch {
        if (active) setHasActiveSubscriptionVw(false);
      }
    };
    loadSubscriptionState();
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  /**
   * Navigation entre étapes : retour arrière toujours autorisé ; pour avancer au-delà de l’étape
   * courante, toutes les étapes précédentes doivent être marquées validées (bouton global ou raccourci visuel).
   */
  const canGoToStep = (stepId) => {
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

  const handleCampaignBrainReady = useCallback((snapshot) => {
    const next = applyLegacyCampaignPatchToSpec(
      createDefaultCampaignGenerationSpec(),
      snapshot || {}
    );
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
              hasActiveSubscriptionVw ? SCRIPT_STEP_VIDEO_QUOTA_MSG : SCRIPT_STEP_NON_SUB_MSG
            );
            setShowScriptQuotaModal(true);
          } else if (result.code === "quota") {
            setScriptQuotaModalMessage(
              result.message ||
                (hasActiveSubscriptionVw ? SCRIPT_STEP_VIDEO_QUOTA_MSG : SCRIPT_STEP_NON_SUB_MSG)
            );
            setShowScriptQuotaModal(true);
          } else if (result.code === "validation") {
            alert(result.message);
          } else {
            alert(result.message || "Impossible de générer le script.");
          }
          setScriptGenStatus("error");
          return;
        }
        setScriptPromptForImage(result.payload);
        setScriptGenStatus("idle");
      } catch (e) {
        setScriptGenStatus("error");
        alert(e?.message || "Erreur inattendue pendant la génération du script.");
      } finally {
        scriptGenInFlightRef.current = false;
      }
    };
    void run();
  }, [session, hasActiveSubscriptionVw]);

  const handleCampagneFullReset = useCallback(() => {
    try {
      localStorage.removeItem("vws_brain_v2_last");
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem(SS_SPA_UI_KEY);
    } catch {
      /* ignore */
    }
    resetWorkflowUsage();
    setPreparedCampaignSig(null);
    setStep1BrainLaunched(false);
    setScriptGenStatus("idle");
    scriptGenInFlightRef.current = false;
    lastBrainSnapshotRef.current = null;
    setValidated(normalizeValidated({}));
    setCurrentStep(1);
    setScriptPromptForImage(normalizeScriptPayload(""));
    setCampaignGenerationSpec(normalizeCampaignGenerationSpec(createDefaultCampaignGenerationSpec()));
    setCampagneMountKey((k) => k + 1);
    resetImageStep();
  }, [resetImageStep]);

  const handleValidateAndNext = async () => {
    if (currentStep === 1 && !step1BrainLaunched) return;
    if (currentStep === 1 && scriptGenStatus === "running") return;

    // Débit workflow studio une seule fois à la validation de l’étape Vidéo (dernière étape).
    if (currentStep === 3 && session?.user?.id && shouldDebitVideoCredit()) {
      const ok = await hasEnoughCredits(VIDEO_STEP_CREDIT_COST);
      if (!ok) {
        setScriptQuotaModalMessage(
          hasActiveSubscriptionVw ? SCRIPT_STEP_VIDEO_QUOTA_MSG : SCRIPT_STEP_NON_SUB_MSG
        );
        setShowScriptQuotaModal(true);
        return;
      }

      const debitResult = await debitCredits(VIDEO_STEP_CREDIT_COST, "video_generation", {
        model: "workflow_studio",
        step: "validate_step_3_final",
      });

      if (!debitResult.success) {
        alert(
          debitResult.error ||
            "Impossible de valider l'étape vidéo. Vérifie tes crédits puis réessaie."
        );
        return;
      }

      markVideoWorkflowCreditConsumed();
    }

    setValidated((prev) => ({ ...prev, [currentStep]: true }));
    if (currentStep < STUDIO_STEP_COUNT) {
      setCurrentStep(currentStep + 1);
    }
  };

  const validateStepBlocked =
    (currentStep === 1 && !step1BrainLaunched) || scriptGenStatus === "running";

  const validateStepPromptLoading = scriptGenStatus === "running";

  /** Dès que le cerveau a fini, tant que l’étape 1 n’est pas validée : griser Préparer (y compris pendant le script). */
  const awaitingStep1Validation =
    currentStep === 1 && step1BrainLaunched && !validated[1];

  const studioVideoStepActive = location.pathname === "/viralworks" && currentStep === 3;

  const imagePageProps = {
    campaignIdea: campaignData?.idea ?? "",
    campaignJobType: campaignData?.profession ?? "",
    campaignModifiers: campaignData?.styleDetails ?? "",
    campaignClarifyMode: campaignData?.clarifyMode ?? campaignData?.gateResult?.mode ?? null,
    campaignClarifyAnswer: campaignData?.clarifyAnswer ?? null,
    campaignCameraAerialAngle: campaignData?.cameraAerialAngle ?? null,
    campaignGlobalIntentProfile: campaignData?.globalIntentProfile ?? null,
    campaignSelfieMode: Boolean(campaignData?.selfieMode),
    scriptScene1Idea: String(scriptPromptForImage?.scenes?.[0] ?? scriptPromptForImage?.combined ?? ""),
    campaignRevealMode: Boolean(campaignData?.revealMode),
    campaignMicroAnswer: campaignData?.microAnswer ?? null,
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
      className="mx-auto w-full min-w-0 max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6"
    >
      <ScriptStepQuotaModal
        open={showScriptQuotaModal}
        title={hasActiveSubscriptionVw ? "Quota mensuel épuisé" : "Accès abonnement requis"}
        message={scriptQuotaModalMessage}
        actionLabel={hasActiveSubscriptionVw ? "Aller vers Packs vidéos" : "Voir les abonnements"}
        onClose={() => setShowScriptQuotaModal(false)}
        onGoToShop={() => {
          setShowScriptQuotaModal(false);
          window.location.href = hasActiveSubscriptionVw
            ? "/boutique?section=packs-videos"
            : "/boutique?section=subscription";
        }}
      />
      <PageTitle
        green="ViralWorks"
        white="Studio"
        subtitle="Un seul flux pour orchestrer ta campagne vidéo : cerveau VWS, visuel d'accroche et vidéo virale."
      />

      <div className="studio-panel px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 justify-end">
          <span className="text-xs text-gray-400 hidden sm:inline">
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
                  : "Lance d’abord le cerveau VWS avec le bouton vert dans l’étape Campagne."
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
        <p className="text-xs text-cyan-200/90 -mt-2 sm:ml-1" role="status" aria-live="polite">
          Génération du script en cours…
        </p>
      ) : null}

      {scriptGenStatus === "error" && currentStep === 1 && step1BrainLaunched ? (
        <div className="flex flex-wrap items-center gap-2 -mt-2 sm:ml-1">
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

      <div className="w-full min-w-0 space-y-6">
        {currentStep === 1 ? (
          <section id="campagne" aria-hidden={false}>
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
        ) : null}
        {currentStep === 2 ? (
          <section id="visuel" aria-hidden={false}>
            <ImagePage {...imagePageProps} />
          </section>
        ) : null}
        {currentStep === 3 ? (
          <section id="video" aria-hidden={false}>
            <VideoPage
              studioSequenceType={campaignData?.sequenceType}
              studioScriptPrompt={scriptPromptForImage}
              studioImageStep={imageStep}
              dialogueEnabled={campaignData?.dialogueEnabled !== false}
              studioCampaignData={campaignData}
              studioStepActive={studioVideoStepActive}
              studioOnStartNewCampaign={handleCampagneFullReset}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}

