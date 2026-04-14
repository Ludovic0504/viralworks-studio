import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import PageTitle from "../composants/interface/TitrePage";
import CampagneVWS from "./CampagneVWS.jsx";
import PromptAssistant from "./Prompt.jsx";
import ImagePage from "./Image.jsx";
import VideoPage from "./Video.jsx";
import RecapVWS from "./RecapVWS.jsx";
import { Check } from "lucide-react";

const LS_VIRAL_STUDIO_DRAFT = "vws_studio_draft_v1";
/** Copie locale (tous onglets) — secours si sessionStorage vide (nouvel onglet). */
const LS_IMAGE_STEP_KEY = "vws_studio_image_step_v1";
/** Copie par onglet — évite qu’un autre onglet écrase avec un état vide. */
const SS_IMAGE_STEP_KEY = "vws_studio_image_step_session_v1";
/** Dernières grilles visuelles (secours UX + restauration après navigation). */
const SS_VISUAL_SNAPSHOTS_KEY = "vws_studio_visual_snapshots_v1";
/** Miroir de l’idée campagne (le brouillon efface `idea` à l’enregistrement — pour rechargement UI). */
const SS_CAMPAIGN_IDEA_LIVE_KEY = "vws_studio_campaign_idea_live_v1";
/** Étape courante, validations, cerveau préparé — secours si le layout tableau de bord est démonté (ex. retour depuis l’accueil). */
const SS_SPA_UI_KEY = "vws_studio_spa_ui_v1";

/**
 * Mémoire module (hors React) : survit au démontage de ViralWorks quand tu quittes /viralworks.
 * Les data URLs / grosses charges dépassent souvent le quota localStorage — l’UI restait vide au retour
 * alors que l’état mémoire était encore correct avant ce filet.
 */
let spaImageStepMemory = null;

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

/** Rechargement complet : vider la session studio une seule fois par chargement de page. */
function purgeStudioSessionIfFullReload() {
  if (typeof window === "undefined") return;
  if (!isReloadNavigation()) return;
  if (window.__vwsStudioReloadPurgeDone) return;
  window.__vwsStudioReloadPurgeDone = true;
  spaImageStepMemory = null;
  try {
    sessionStorage.removeItem(SS_IMAGE_STEP_KEY);
    localStorage.removeItem(LS_IMAGE_STEP_KEY);
    sessionStorage.removeItem(SS_VISUAL_SNAPSHOTS_KEY);
    sessionStorage.removeItem(SS_SPA_UI_KEY);
  } catch {
    /* ignore */
  }
}

function loadSpaUiState() {
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
    return { ...INITIAL_IMAGE_STEP };
  }

  const mem = spaImageStepMemory ? sanitizeImageStepFromDraft(spaImageStepMemory) : null;
  const sessionS = readSessionImageStep();
  const localS = readLocalImageStepBackup();
  const draftS = sanitizeImageStepFromDraft(loadViralStudioDraft()?.imageStep);

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

function loadViralStudioDraft() {
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

/** Rechargement complet (F5) : ne pas réinjecter le brouillon visuel. */
function isReloadNavigation() {
  if (typeof performance === "undefined") return false;
  const entry = performance.getEntriesByType?.("navigation")?.[0];
  if (entry && "type" in entry) return entry.type === "reload";
  const legacy = performance.navigation;
  if (legacy && typeof legacy.type === "number") return legacy.type === 1;
  return false;
}

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

function appendVisualSnapshotFromStep(step, setVisualSnapshots) {
  const urls = step?.lastGeneratedImages;
  if (!urls?.length) return;
  let sig;
  try {
    sig = JSON.stringify(urls);
  } catch {
    return;
  }
  setVisualSnapshots((list) => {
    const stepClone = cloneImageStep(step);
    const entry = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      t: Date.now(),
      step: stepClone,
    };
    const deduped = list.filter((e) => {
      try {
        return JSON.stringify(e.step?.lastGeneratedImages) !== sig;
      } catch {
        return true;
      }
    });
    const next = [entry, ...deduped].slice(0, 48);
    persistVisualSnapshotsToSession(next);
    return next;
  });
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
    dialogueEnabled: base.dialogueEnabled ?? true,
    microAnswer: base.microAnswer ?? null,
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
    return {
      mode: raw.mode === "multi" ? "multi" : "single",
      combined: String(combined ?? ""),
      scenes,
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

const steps = [
  { id: 1, key: "campagne", label: "Campagne VWS" },
  { id: 2, key: "script", label: "Script gagnant" },
  { id: 3, key: "visuel", label: "Visuel d'accroche" },
  { id: 4, key: "video", label: "Vidéo virale" },
  { id: 5, key: "recap", label: "Étape 5 — Récapitulatif" },
];

export default function ViralWorks() {
  purgeStudioSessionIfFullReload();

  const [currentStep, setCurrentStep] = useState(() => {
    const spaUi = loadSpaUiState();
    const n = Number(spaUi?.currentStep);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.floor(n) : 1;
  });
  const [validated, setValidated] = useState(() =>
    normalizeValidated(loadSpaUiState()?.validated)
  );
  const [campaignData, setCampaignData] = useState(() => {
    const spaUi = loadSpaUiState();
    if (spaUi?.campaignData && typeof spaUi.campaignData === "object") {
      return spaUi.campaignData;
    }
    const d = loadViralStudioDraft();
    return applyCampagneNonPersistedDefaults(d?.campaign);
  });
  const [scriptPromptForImage, setScriptPromptForImage] = useState(() => {
    const spaUi = loadSpaUiState();
    if (spaUi?.scriptPromptForImage !== undefined) {
      return normalizeScriptPayload(spaUi.scriptPromptForImage);
    }
    const d = loadViralStudioDraft();
    return normalizeScriptPayload(d?.scriptPrompt ?? "");
  });
  const [step1BrainLaunched, setStep1BrainLaunched] = useState(() =>
    Boolean(loadSpaUiState()?.step1BrainLaunched)
  );
  const [preparedCampaignSig, setPreparedCampaignSig] = useState(() => {
    const spaUi = loadSpaUiState();
    return typeof spaUi?.preparedCampaignSig === "string" && spaUi.preparedCampaignSig.length > 0
      ? spaUi.preparedCampaignSig
      : null;
  });
  const [campagneMountKey, setCampagneMountKey] = useState(() => {
    const spaUi = loadSpaUiState();
    return Number.isFinite(Number(spaUi?.campagneMountKey))
      ? Math.max(0, Math.floor(Number(spaUi.campagneMountKey)))
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
    setValidated((prev) => ({ ...prev, 1: false }));
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
    const hasAssets = Boolean(
      step.lastGeneratedImages?.length ||
        step.refCharDataUrl ||
        promptTrim
    );

    if (!ideaNow || !hasAssets) return;

    const stale = hasPaired ? pairedTrim !== ideaNow : promptTrim !== ideaNow;
    if (!stale) return;

    appendVisualSnapshotFromStep(step, setVisualSnapshots);

    const fresh = {
      ...INITIAL_IMAGE_STEP,
      prompt: ideaNow,
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
    setVisualSnapshots((list) => {
      const stepClone = cloneImageStep(imageStep);
      const entry = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        t: Date.now(),
        step: stepClone,
      };
      const deduped = list.filter((e) => {
        try {
          return JSON.stringify(e.step?.lastGeneratedImages) !== sig;
        } catch {
          return true;
        }
      });
      const next = [entry, ...deduped].slice(0, 48);
      persistVisualSnapshotsToSession(next);
      return next;
    });
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
    setPreparedCampaignSig(null);
    setStep1BrainLaunched(false);
    setValidated((prev) => ({ ...prev, 1: false }));
    setCampaignData(applyCampagneNonPersistedDefaults({}));
    setCampagneMountKey((k) => k + 1);
    resetImageStep();
  }, [resetImageStep]);

  const handleValidateAndNext = () => {
    if (currentStep === 1 && !step1BrainLaunched) return;
    setValidated((prev) => ({ ...prev, [currentStep]: true }));
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const validateStepBlocked =
    currentStep === 1 && !step1BrainLaunched;

  const imagePageProps = {
    campaignIdea: campaignData?.idea ?? "",
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
            onClick={handleValidateAndNext}
            disabled={validateStepBlocked}
            title={
              validateStepBlocked
                ? "Lance d’abord le cerveau VWS avec le bouton vert dans l’étape Campagne."
                : undefined
            }
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
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
            onCampaignChange={setCampaignData}
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
          />
        </section>
        <section
          id="recap"
          className={currentStep !== 5 ? "hidden" : ""}
          aria-hidden={currentStep !== 5}
        >
          <RecapVWS campaignData={campaignData} onGoToVideoStep={() => setCurrentStep(4)} />
        </section>
      </div>
    </div>
  );
}

