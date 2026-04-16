import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import PageTitle from "../composants/interface/TitrePage";
import CampagneVWS from "./CampagneVWS.jsx";
import PromptAssistant from "./Prompt.jsx";
import ImagePage from "./Image.jsx";
import VideoPage from "./Video.jsx";
import RecapVWS from "./RecapVWS.jsx";
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
import { debitCredits, hasEnoughCredits } from "@/bibliotheque/supabase/credits";
import { getUserSubscription } from "@/bibliotheque/supabase/stripe";
import { Check, X } from "lucide-react";
import { useLocation } from "react-router-dom";

/**
 * Mémoire module (hors React) : survit au démontage de ViralWorks quand tu quittes /viralworks.
 * Les data URLs / grosses charges dépassent souvent le quota localStorage — l’UI restait vide au retour
 * alors que l’état mémoire était encore correct avant ce filet.
 */
let spaImageStepMemory = null;

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
  const base = { 1: false, 2: false, 3: false, 4: false, 5: false };
  if (!v || typeof v !== "object") return base;
  for (let i = 1; i <= 5; i += 1) {
    base[i] = Boolean(v[i]);
  }
  return base;
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

/** Idée principale + options de stabilisation : pas de persistance locale (refresh = état initial). */
function applyCampagneNonPersistedDefaults(campaign) {
  const base = campaign && typeof campaign === "object" ? { ...campaign } : {};
  return {
    ...base,
    idea: "",
    cameraFixed: true,
    revealMode: false,
    cinematicMovement: false,
    selfieMode: false,
    dialogueEnabled: base.dialogueEnabled !== false,
    microAnswer: base.microAnswer ?? null,
    gateResult: base.gateResult ?? null,
    clarifyAnswer: base.clarifyAnswer ?? null,
    clarifyMode: base.clarifyMode ?? null,
    clarifyDiagnostic: base.clarifyDiagnostic ?? null,
    proceedAnyway: base.proceedAnyway === true,
    isClarified: base.isClarified === true,
    clarificationHistory: Array.isArray(base.clarificationHistory) ? base.clarificationHistory : [],
    clarifyAxesResolved: {
      modeAgent: base.clarifyAxesResolved?.modeAgent === true,
      initialT0: base.clarifyAxesResolved?.initialT0 === true,
    },
  };
}

/** Aligné sur les champs Campagne VWS utilisés pour « Préparer ma vidéo ». */
function normalizeTempoForGate(t) {
  return t === "timelapse" || t === "slow_motion" ? t : "real_time";
}

function serializeCampaignForPrepareGate(c) {
  if (!c || typeof c !== "object") return "{}";
  return JSON.stringify({
    profession: String(c.profession ?? "").trim(),
    idea: String(c.idea ?? "").trim(),
    styleDetails: String(c.styleDetails ?? "").trim(),
    tempo: normalizeTempoForGate(c.tempo),
    cameraFixed: Boolean(c.cameraFixed),
    revealMode: Boolean(c.revealMode),
    cinematicMovement: Boolean(c.cinematicMovement),
    selfieMode: Boolean(c.selfieMode),
    sequenceType: c.sequenceType === "three_x_8s" ? "three_x_8s" : "single_8s",
    dialogueEnabled: c.dialogueEnabled !== false,
    microAnswer: c.microAnswer ?? null,
    gateResult: c.gateResult ?? null,
    clarifyAnswer: c.clarifyAnswer ?? null,
    clarifyMode: c.clarifyMode ?? null,
    clarifyDiagnostic: c.clarifyDiagnostic ?? null,
    proceedAnyway: c.proceedAnyway === true,
    isClarified: c.isClarified === true,
    clarificationHistory: Array.isArray(c.clarificationHistory) ? c.clarificationHistory : [],
    clarifyAxesResolved: {
      modeAgent: c.clarifyAxesResolved?.modeAgent === true,
      initialT0: c.clarifyAxesResolved?.initialT0 === true,
    },
  });
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

const SCRIPT_STEP_CREDIT_COST = 1;
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
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={onGoToShop}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold hover:from-cyan-400 hover:to-teal-400 transition-all"
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
  { id: 2, key: "script", label: "Script gagnant" },
  { id: 3, key: "visuel", label: "Visuel d'accroche" },
  { id: 4, key: "video", label: "Vidéo virale" },
  { id: 5, key: "recap", label: "Étape 5 — Récapitulatif" },
];

export default function ViralWorks() {
  const location = useLocation();
  const spaUiInitialRef = useRef(undefined);
  if (spaUiInitialRef.current === undefined) {
    purgeStudioSessionIfFullReload();
    spaUiInitialRef.current = loadSpaUiStateFromSession();
  }
  const spaInitial = spaUiInitialRef.current;

  const { session } = useAuth();
  const [showScriptQuotaModal, setShowScriptQuotaModal] = useState(false);
  const [scriptQuotaModalMessage, setScriptQuotaModalMessage] = useState(SCRIPT_STEP_VIDEO_QUOTA_MSG);
  const [hasActiveSubscriptionVw, setHasActiveSubscriptionVw] = useState(false);

  const [currentStep, setCurrentStep] = useState(() => {
    const n = Number(spaInitial?.currentStep);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.floor(n) : 1;
  });
  const [validated, setValidated] = useState(() => normalizeValidated(spaInitial?.validated));
  const [campaignData, setCampaignData] = useState(() => {
    if (spaInitial?.campaignData && typeof spaInitial.campaignData === "object") {
      const c = spaInitial.campaignData;
      return {
        ...c,
        dialogueEnabled: c.dialogueEnabled !== false,
      };
    }
    const d = loadViralStudioDraftFromLocal();
    return applyCampagneNonPersistedDefaults(d?.campaign);
  });
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
  const wasOn3LayoutRef = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(SS_CAMPAIGN_IDEA_LIVE_KEY, String(campaignData?.idea ?? ""));
    } catch {
      /* ignore */
    }
  }, [campaignData?.idea]);

  useEffect(() => {
    if (preparedCampaignSig === null) return;
    const sig = serializeCampaignForPrepareGate(campaignData);
    if (sig === preparedCampaignSig) return;
    setStep1BrainLaunched(false);
    setValidated((prev) => ({
      ...prev,
      1: false,
      2: false,
      3: false,
      4: false,
      5: false,
    }));
  }, [campaignData, preparedCampaignSig]);

  useLayoutEffect(() => {
    const on3 = currentStep === 3;
    if (!on3) {
      wasOn3LayoutRef.current = false;
      return;
    }
    const justEntered = !wasOn3LayoutRef.current;
    wasOn3LayoutRef.current = true;
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
          campaign: applyCampagneNonPersistedDefaults(campaignData),
          scriptPrompt: scriptPromptForImage,
          imageStep,
        })
      );
    } catch (err) {
      console.warn("[ViralWorks] Sauvegarde brouillon studio:", err);
    }
  }, [campaignData, scriptPromptForImage, imageStep]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        SS_SPA_UI_KEY,
        JSON.stringify({
          currentStep,
          validated,
          step1BrainLaunched,
          preparedCampaignSig,
          campaignData,
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
    campaignData,
    scriptPromptForImage,
    campagneMountKey,
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
    const next = {
      profession: snapshot.profession ?? "",
      idea: snapshot.idea ?? "",
      styleDetails: snapshot.styleDetails ?? "",
      tempo: normalizeTempoForGate(snapshot.tempo),
      cameraFixed: Boolean(snapshot.cameraFixed),
      revealMode: Boolean(snapshot.revealMode),
      cinematicMovement: Boolean(snapshot.cinematicMovement),
      selfieMode: Boolean(snapshot.selfieMode),
      sequenceType: snapshot.sequenceType === "three_x_8s" ? "three_x_8s" : "single_8s",
      dialogueEnabled: snapshot.dialogueEnabled !== false,
      microAnswer: snapshot.microAnswer ?? null,
      gateResult: snapshot.gateResult ?? null,
      clarifyAnswer: snapshot.clarifyAnswer ?? null,
      clarifyMode: snapshot.clarifyMode ?? null,
      clarifyDiagnostic: snapshot.clarifyDiagnostic ?? null,
      proceedAnyway: snapshot.proceedAnyway === true,
      isClarified: snapshot.isClarified === true,
      clarificationHistory: Array.isArray(snapshot.clarificationHistory)
        ? snapshot.clarificationHistory
        : [],
      clarifyAxesResolved: {
        modeAgent: snapshot.clarifyAxesResolved?.modeAgent === true,
        initialT0: snapshot.clarifyAxesResolved?.initialT0 === true,
      },
    };
    setPreparedCampaignSig(serializeCampaignForPrepareGate(next));
    setCampaignData((prev) => ({ ...prev, ...next }));
    setStep1BrainLaunched(true);
  }, []);

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
    setValidated(normalizeValidated({}));
    setCurrentStep(1);
    setScriptPromptForImage(normalizeScriptPayload(""));
    setCampaignData(applyCampagneNonPersistedDefaults({}));
    setCampagneMountKey((k) => k + 1);
    resetImageStep();
  }, [resetImageStep]);

  const handleValidateAndNext = async () => {
    if (currentStep === 1 && !step1BrainLaunched) return;

    if (currentStep === 2 && session?.user?.id) {
      const ok = await hasEnoughCredits(SCRIPT_STEP_CREDIT_COST);
      if (!ok) {
        setScriptQuotaModalMessage(
          hasActiveSubscriptionVw ? SCRIPT_STEP_VIDEO_QUOTA_MSG : SCRIPT_STEP_NON_SUB_MSG
        );
        setShowScriptQuotaModal(true);
        return;
      }
    }

    // Dans le flow Studio, l'utilisateur peut valider via le bouton global d'étape.
    // On débite donc ici au passage de l'étape Vidéo vers le récap (une seule fois par workflow).
    if (currentStep === 4 && session?.user?.id && shouldDebitVideoCredit()) {
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
        step: "validate_step_4_to_5",
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
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const validateStepBlocked =
    currentStep === 1 && !step1BrainLaunched;

  const studioVideoStepActive = location.pathname === "/viralworks" && currentStep === 4;

  const imagePageProps = {
    campaignIdea: campaignData?.idea ?? "",
    campaignJobType: campaignData?.profession ?? "",
    campaignModifiers: campaignData?.styleDetails ?? "",
    campaignClarifyMode: campaignData?.clarifyMode ?? campaignData?.gateResult?.mode ?? null,
    campaignClarifyAnswer: campaignData?.clarifyAnswer ?? null,
    campaignCameraAerialAngle: campaignData?.cameraAerialAngle ?? null,
    scriptScene1Idea: String(scriptPromptForImage?.scenes?.[0] ?? scriptPromptForImage?.combined ?? ""),
    campaignRevealMode: Boolean(campaignData?.revealMode),
    campaignMicroAnswer: campaignData?.microAnswer ?? null,
    visualStepActive: currentStep === 3,
    imageStep,
    patchImageStep,
    resetImageStep,
    visualSnapshots,
    onRestoreVisualSnapshot: restoreVisualSnapshot,
    onUseImageAndContinue: () => {
      setValidated((prev) => ({ ...prev, 3: true }));
      setCurrentStep(4);
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
        subtitle="Un seul flux pour orchestrer ta campagne vidéo : cerveau VWS, script gagnant, visuel d'accroche et vidéo."
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
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-all ${
                  isActive
                    ? "bg-cyan-500/15 border-cyan-400/45 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
                    : disabled
                    ? "bg-white/[0.03] border-white/[0.06] text-gray-500 cursor-not-allowed"
                    : "bg-white/[0.04] border-white/10 text-gray-300 hover:bg-white/[0.08] hover:border-cyan-500/20"
                }`}
              >
                <span
                  className={`w-5 h-5 inline-flex items-center justify-center rounded-full text-[10px] font-semibold ${
                    isDone
                      ? "bg-gradient-to-br from-cyan-500 to-teal-600 text-white"
                      : isActive
                      ? "bg-cyan-400/90 text-gray-950"
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
            Étape {currentStep} sur 5
          </span>
          <button
            type="button"
            onClick={() => {
              void handleValidateAndNext();
            }}
            disabled={validateStepBlocked}
            title={
              validateStepBlocked
                ? "Lance d’abord le cerveau VWS avec le bouton vert dans l’étape Campagne."
                : undefined
            }
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-center leading-tight transition ${
              validateStepBlocked
                ? "bg-white/10 text-gray-500 border border-white/10 cursor-not-allowed opacity-70"
                : "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-950/35 hover:from-cyan-400 hover:to-teal-400"
            }`}
          >
            {currentStep < 5 ? "Valider cette étape et passer à la suivante" : "Marquer comme terminé"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <section
          id="campagne"
          className={currentStep !== 1 ? "hidden" : ""}
          aria-hidden={currentStep !== 1}
        >
          <CampagneVWS
            key={campagneMountKey}
            campaignData={campaignData}
            onCampaignChange={(nextCampaignData) =>
              setCampaignData((prev) => ({
                ...prev,
                ...(nextCampaignData || {}),
              }))
            }
            onBrainReady={handleCampaignBrainReady}
            onCampagneFullReset={handleCampagneFullReset}
          />
        </section>
        <section
          id="script"
          className={currentStep !== 2 ? "hidden" : ""}
          aria-hidden={currentStep !== 2}
        >
          <PromptAssistant
            initialIdea={campaignData?.idea ?? ""}
            sequenceType={campaignData?.sequenceType}
            dialogueEnabled={campaignData?.dialogueEnabled !== false}
            campaignData={campaignData}
            onScriptOutput={setScriptPromptForImage}
          />
        </section>
        <section
          id="visuel"
          className={currentStep !== 3 ? "hidden" : ""}
          aria-hidden={currentStep !== 3}
        >
          <ImagePage {...imagePageProps} />
        </section>
        <section
          id="video"
          className={currentStep !== 4 ? "hidden" : ""}
          aria-hidden={currentStep !== 4}
        >
          <VideoPage
            studioSequenceType={campaignData?.sequenceType}
            studioScriptPrompt={scriptPromptForImage}
            studioImageStep={imageStep}
            dialogueEnabled={campaignData?.dialogueEnabled !== false}
            studioCampaignData={campaignData}
            studioStepActive={studioVideoStepActive}
          />
        </section>
        <section
          id="recap"
          className={currentStep !== 5 ? "hidden" : ""}
          aria-hidden={currentStep !== 5}
        >
          <RecapVWS campaignData={campaignData} onStartNewCampaign={handleCampagneFullReset} />
        </section>
      </div>
    </div>
  );
}

