import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./CampagneVWS.css";
import {
  clarifyIdea,
  clarifyGateNeedsInitialT0,
  clarifyGateNeedsCameraAerialAngle,
  clarifyGateNeedsCausalAgent,
  clarifyGateNeedsModeAgent,
  inferGlobalIntent,
  runVwsPromptEngine,
  timelapseCameraPovNeedsQuestion,
  narrativeContinuityNeedsQuestion,
} from "../bibliotheque/vwsPromptEngine";
import { generateResponse } from "@/bibliotheque/openai/chatgpt-client";
import { getVwsMetierProfile } from "@/bibliotheque/vwsMetiersConfig";
import { isKnownMetierLabel } from "@/bibliotheque/metiersCategories";
import MetierCombobox from "@/composants/campagne/MetierCombobox";
import { PROFESSION_TO_LIEU_TOURNAGE } from "@/bibliotheque/professionLieuTournage";
import {
  createDefaultCampaignGenerationSpec,
  stampCampaignGenerationMeta,
} from "@/bibliotheque/campaignGenerationSpec";
import { SS_BRAIN_V2_LAST_KEY } from "@/bibliotheque/viralWorksStudioStorage";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { capturePostHog, trackPostHogError } from "@/bibliotheque/posthog/client";
import { useProfilStudio } from "@/contexte/FournisseurProfilStudio";
import { getIntentFromFormatCategory } from "@/bibliotheque/sectorDefaults";
import { updateUserProfile } from "@/bibliotheque/supabase/profil";
import { Sparkles, BookOpen, X, Clapperboard, MapPin, ChevronRight, Zap } from "lucide-react";
import ModaleChoixFormatVideo from "../composants/campagne/ModaleChoixFormatVideo.jsx";
import ModaleChoixDecorProduit from "../composants/campagne/ModaleChoixDecorProduit.jsx";
import ModaleChoixHookProduit from "../composants/campagne/ModaleChoixHookProduit.jsx";
import { ProductCampagneLucideIcon } from "../composants/campagne/productCampagneLucide.jsx";
import CampagneVwsExplicationSheet from "../composants/campagne/CampagneVwsExplicationSheet.jsx";
import { resolveClarifyModeForFormat } from "../bibliotheque/clarifyModeForFormat";
import {
  getFormatById,
  getFormatHintForEngine,
} from "../bibliotheque/vwsVideoFormatsCatalog";
import {
  formatVideoFormatParamsPromptAppendix,
  getVideoFormatConfigForCatalogId,
} from "@/config/videoFormats";
import {
  parseLegacyProductStyleDetails,
  stripLegacyProductStyleDetailsPrefix,
} from "../bibliotheque/vwsProductStaging";
import {
  buildProductOpeningHookSentence,
  buildProductSceneDecorSentence,
  decorCategoryLabelFr,
  getDialogueDefaultForMiseId,
  getProductDecorById,
  getProductHookById,
  getProductMiseDef,
  getProductMiseOptionsForFormat,
  hookCategoryLabelFr,
  locationTypeFromProductDecor,
  normalizeProductStagingChipsForFormat,
} from "../bibliotheque/vwsProductCampagneCatalog";

const VWS_INSPIRE_PROMESSE_PRODUCT_SYSTEM = `Tu génères une promesse courte pour une vidéo publicitaire produit.
Format de sortie : soit 3 à 6 mots séparés par des virgules (style moodboard), soit une phrase unique de 15 mots maximum.
Jamais les deux en même temps. Choisis le format le plus percutant selon le produit et l'ambiance.
Pas de ponctuation superflue. Pas d'explication. Juste la promesse, rien d'autre.`;

const VALID_TEMPOS = new Set(["real_time", "timelapse", "slow_motion"]);

function getMissingInspireProductNomDecor({ nomDuProduit, productSceneDecorId }) {
  const missing = [];
  if (!nomDuProduit) missing.push("nom");
  if (!productSceneDecorId) missing.push("decor");
  return missing;
}

function formatInspirePromesseHint(missingKeys) {
  if (!missingKeys.length) return "";
  if (missingKeys.length === 1) {
    switch (missingKeys[0]) {
      case "nom":
        return "Ajoute le nom du produit pour générer une promesse.";
      case "decor":
        return "Ajoute un décor pour générer une promesse cohérente.";
      default:
        return "";
    }
  }
  if (missingKeys.length === 2) {
    return "Il manque : le nom du produit et le décor.";
  }
  return "";
}

function normalizeTempo(t) {
  return VALID_TEMPOS.has(t) ? t : "real_time";
}

function parseClarifyAxesFromHistory(lines) {
  const merged = { modeAgent: false, initialT0: false, causalAgent: false, cameraAerialAngle: false };
  let microFromGate = null;
  let causalAgentSelectionFromGate = null;
  let cameraAerialAngleFromGate = null;
  if (!Array.isArray(lines)) return { ...merged, microFromGate, causalAgentSelectionFromGate };
  for (const line of lines) {
    if (typeof line !== "string") continue;
    if (
      line.includes("option_id=vws_gate_mode_autonomous") ||
      line.includes("option_id=vws_gate_mode_human")
    ) {
      merged.modeAgent = true;
    }
    if (line.includes("option_id=vws_gate_causal_visible")) {
      merged.causalAgent = true;
      merged.modeAgent = true;
      causalAgentSelectionFromGate = "visible";
    }
    if (line.includes("option_id=vws_gate_causal_automatic")) {
      merged.causalAgent = true;
      merged.modeAgent = true;
      causalAgentSelectionFromGate = "automatic";
    }
    if (line.includes("option_id=vws_gate_camera_top_down")) {
      merged.cameraAerialAngle = true;
      cameraAerialAngleFromGate = "top_down";
    }
    if (line.includes("option_id=vws_gate_camera_angled")) {
      merged.cameraAerialAngle = true;
      cameraAerialAngleFromGate = "angled";
    }
    if (line.includes("option_id=vws_gate_t0_pristine")) {
      merged.initialT0 = true;
      microFromGate = "from_nothing";
    }
    if (line.includes("option_id=vws_gate_t0_in_progress")) {
      merged.initialT0 = true;
      microFromGate = "partially_built";
    }
  }
  return { ...merged, microFromGate, causalAgentSelectionFromGate, cameraAerialAngleFromGate };
}

function buildMinimalIntentFallback({ idea, selfieMode }) {
  const txt = String(idea || "").toLowerCase();
  const selfieSignal = selfieMode || /\b(selfie|face cam[ée]ra|vlog|se filme)\b/.test(txt);
  return {
    intentFamily: selfieSignal ? "presentation" : "other",
    hookGoal: selfieSignal ? "show_finished_result" : "show_action_in_progress",
    humanPresence: selfieSignal ? "selfie" : "unknown",
    confidence: selfieSignal ? 0.6 : 0.5,
    source: "heuristic",
  };
}

const LIEU_TOURNAGE_OPTIONS = [
  {
    value: "chez_client",
    label: "Chez un particulier (domicile, jardin, chantier)",
    sentence: "La scène se déroule chez un client particulier (domicile, jardin ou chantier).",
  },
  {
    value: "etablissement",
    label: "Dans l'établissement du professionnel",
    sentence: "La scène se déroule dans l'établissement du professionnel (atelier, boutique, local ou cuisine).",
  },
  {
    value: "neutre",
    label: "Lieu neutre ou extérieur",
    sentence: "La scène se déroule dans un lieu neutre ou extérieur.",
  },
];

function getLieuOption(value) {
  return LIEU_TOURNAGE_OPTIONS.find((opt) => opt.value === value) || LIEU_TOURNAGE_OPTIONS[2];
}

function getContradictionDetectedLieuValue(rawLieu) {
  const txt = String(rawLieu || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!txt) return null;
  if (/(client|particulier|domicile|maison|appartement|jardin|chantier|chez lui|chez elle)/.test(txt)) {
    return "chez_client";
  }
  if (/(etablissement|atelier|boutique|local|cuisine|salon|restaurant|garage|magasin|cabinet|salle)/.test(txt)) {
    return "etablissement";
  }
  if (/(neutre|exterieur|extérieur|rue|parc|place|ville|dehors|plein air)/.test(txt)) {
    return "neutre";
  }
  return null;
}

function extractJsonObjectFromText(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function mapGateInferredValueToOptionId(gate, inferredValue) {
  if (!gate?.options?.length) return null;
  const normalized = String(inferredValue || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!normalized) return null;
  const byIdOrLabel = gate.options.find((opt) => {
    const id = String(opt?.id || "").toLowerCase();
    const label = String(opt?.label || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return normalized === id || label.includes(normalized);
  });
  if (byIdOrLabel?.id) return byIdOrLabel.id;

  if (gate.activePhase === "causal_agent") {
    if (/(visible|personne|personnes|humain|humains|machine|machines|outil|outils|artisan|ouvrier)/.test(normalized)) {
      return "vws_gate_causal_visible";
    }
    if (/(automatique|sans intervention|sans personne|sans humain|sans machine|autonome|seul)/.test(normalized)) {
      return "vws_gate_causal_automatic";
    }
  }
  if (gate.activePhase === "camera_aerial_angle") {
    if (/(dessus|top down|overhead|vertical|sans angle|perpendiculaire)/.test(normalized)) {
      return "vws_gate_camera_top_down";
    }
    if (/(angle|oblique|perspective|profondeur|hauteur)/.test(normalized)) {
      return "vws_gate_camera_angled";
    }
  }
  if (gate.activePhase === "initial_t0") {
    if (/(avant|intact|rien|vide|depart propre|from scratch)/.test(normalized)) {
      return "vws_gate_t0_pristine";
    }
    if (/(en cours|partiel|partiellement|deja|milieu|chantier ouvert)/.test(normalized)) {
      return "vws_gate_t0_in_progress";
    }
  }
  if (gate.activePhase === "mode_agent") {
    if (/(humain|artisan|personne|visible|machine visible)/.test(normalized)) {
      return "vws_gate_mode_human";
    }
    if (/(autonome|automatique|sans personne|sans humain|seul)/.test(normalized)) {
      return "vws_gate_mode_autonomous";
    }
  }
  return null;
}

export default function CampagneVWS({
  onBrainReady,
  campaignData,
  onCampaignChange,
  onCampagneFullReset,
  scriptGenerationPending = false,
  awaitingStep1Validation = false,
  /** Ref pour le CTA mobile unifié (parent) : `{ runPrepare: () => void }` */
  step1PrimaryRef = null,
  /** `studioOverlay` : panneau format in-tree (ViralWorks ≤640px) au lieu du portal plein écran */
  formatPickerPresentation = "portal",
}) {
  const { runWithAuth } = useRequireAuthAction();

  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 641px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 641px)");
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const [profession, setProfessionState] = useState(campaignData?.profession ?? "");
  const [lieuTournage, setLieuTournageState] = useState(() =>
    campaignData?.lieuTournage === "chez_client" ||
    campaignData?.lieuTournage === "etablissement" ||
    campaignData?.lieuTournage === "neutre"
      ? campaignData.lieuTournage
      : "neutre"
  );
  const [idea, setIdeaState] = useState(campaignData?.idea ?? "");
  const [styleDetails, setStyleDetails] = useState(() =>
    stripLegacyProductStyleDetailsPrefix(String(campaignData?.styleDetails ?? ""))
  );
  const [stagingChips, setStagingChips] = useState(() =>
    Array.isArray(campaignData?.stagingChips)
      ? [...campaignData.stagingChips]
      : parseLegacyProductStyleDetails(String(campaignData?.styleDetails ?? "")).chipIds
  );
  const [productSceneDecorId, setProductSceneDecorId] = useState(() =>
    campaignData?.productSceneDecorId && String(campaignData.productSceneDecorId).trim()
      ? String(campaignData.productSceneDecorId).trim()
      : null
  );
  const [productOpeningHookId, setProductOpeningHookId] = useState(() =>
    campaignData?.productOpeningHookId && String(campaignData.productOpeningHookId).trim()
      ? String(campaignData.productOpeningHookId).trim()
      : null
  );
  const [tempo, setTempo] = useState(() => normalizeTempo(campaignData?.tempo ?? "real_time"));
  const [cameraFixed, setCameraFixed] = useState(campaignData?.cameraFixed ?? true);
  const [sequenceType, setSequenceType] = useState(campaignData?.sequenceType ?? "single_8s");
  const [revealMode, setRevealMode] = useState(campaignData?.revealMode ?? false);
  const [cinematicMovement, setCinematicMovement] = useState(campaignData?.cinematicMovement ?? false);
  const [selfieMode, setSelfieMode] = useState(campaignData?.selfieMode ?? false);
  const [dialogueEnabled, setDialogueEnabled] = useState(
    () => campaignData?.dialogueEnabled !== false
  );
  const [causalAgentSelection, setCausalAgentSelection] = useState(
    campaignData?.causalAgentSelection ?? null
  );
  const [cameraAerialAngle, setCameraAerialAngle] = useState(
    campaignData?.cameraAerialAngle ?? null
  );
  const [cameraViewAngle, setCameraViewAngle] = useState(
    campaignData?.cameraViewAngle ?? null
  );
  const [narrativeContinuity, setNarrativeContinuity] = useState(
    campaignData?.narrativeContinuity ?? null
  );
  const [timelapseCameraPov, setTimelapseCameraPov] = useState(
    campaignData?.timelapseCameraPov ?? null
  );
  const [initialStateSelection, setInitialStateSelection] = useState(
    campaignData?.initialStateSelection ?? null
  );
  const [gateResult, setGateResult] = useState(campaignData?.gateResult ?? null);
  const [clarifyAnswer, setClarifyAnswer] = useState(campaignData?.clarifyAnswer ?? null);

  const [loading, setLoading] = useState(false);
  const [inspireLoading, setInspireLoading] = useState(false);
  /** Pendant un appel « promesse » produit : le spinner n’apparaît qu’après 2 s. */
  const [inspireProductAwaitingDelayedSpinner, setInspireProductAwaitingDelayedSpinner] =
    useState(false);
  const [inspireDelayedSpinnerVisible, setInspireDelayedSpinnerVisible] = useState(false);
  const inspireSpinnerDelayTimerRef = useRef(null);
  const [inspirePromesseHint, setInspirePromesseHint] = useState("");
  const [error, setError] = useState("");
  const [microQuestion, setMicroQuestion] = useState(null);
  const [microAnswer, setMicroAnswer] = useState(campaignData?.microAnswer ?? null);
  const [tempoCompressionDecision, setTempoCompressionDecision] = useState(
    campaignData?.tempoCompressionDecision ?? null
  );
  const [showCampagneExplication, setShowCampagneExplication] = useState(false);
  const closeCampagneExplication = useCallback(() => setShowCampagneExplication(false), []);
  const [showCampagneAidePulse, setShowCampagneAidePulse] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      return !window.localStorage.getItem("aide_seen");
    } catch {
      return true;
    }
  });
  const handleOpenCampagneAide = useCallback(() => {
    try {
      window.localStorage.setItem("aide_seen", "1");
    } catch {
      /* quota / mode privé */
    }
    setShowCampagneAidePulse(false);
    setShowCampagneExplication(true);
  }, []);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [showDecorModal, setShowDecorModal] = useState(false);
  const [showHookModal, setShowHookModal] = useState(false);
  const [videoFormatId, setVideoFormatId] = useState(campaignData?.videoFormatId ?? null);
  const [locationConflict, setLocationConflict] = useState(null);

  useEffect(() => {
    return () => {
      if (inspireSpinnerDelayTimerRef.current != null) {
        clearTimeout(inspireSpinnerDelayTimerRef.current);
      }
    };
  }, []);

  /** Parent (spec / brouillon) peut hydrater après le 1er rendu — évite métier vide alors que la campagne en a un. */
  useEffect(() => {
    const p = String(campaignData?.profession ?? "").trim();
    if (!p) return;
    setProfessionState((prev) => (prev.trim() ? prev : p));
  }, [campaignData?.profession]);

  useEffect(() => {
    const fid = campaignData?.videoFormatId ?? null;
    if (!fid) return;
    setVideoFormatId((prev) => (prev != null && prev !== "" ? prev : fid));
  }, [campaignData?.videoFormatId]);

  useEffect(() => {
    const incoming = campaignData?.lieuTournage;
    if (incoming !== "chez_client" && incoming !== "etablissement" && incoming !== "neutre") return;
    setLieuTournageState((prev) => (prev === incoming ? prev : incoming));
  }, [campaignData?.lieuTournage]);

  useEffect(() => {
    const incoming = campaignData?.cameraViewAngle;
    if (incoming !== "subjective_portee" && incoming !== "exterieure_filmee" && incoming !== null) return;
    setCameraViewAngle((prev) => (prev === incoming ? prev : incoming));
  }, [campaignData?.cameraViewAngle]);

  useEffect(() => {
    const incoming = campaignData?.productSceneDecorId;
    const next =
      incoming && String(incoming).trim() ? String(incoming).trim() : null;
    setProductSceneDecorId((prev) => (prev === next ? prev : next));
  }, [campaignData?.productSceneDecorId]);

  useEffect(() => {
    const incoming = campaignData?.productOpeningHookId;
    const next =
      incoming && String(incoming).trim() ? String(incoming).trim() : null;
    setProductOpeningHookId((prev) => (prev === next ? prev : next));
  }, [campaignData?.productOpeningHookId]);

  const ideaTextareaRef = useRef(null);
  const stagingChipsRef = useRef(stagingChips);
  stagingChipsRef.current = stagingChips;

  const adjustIdeaTextareaHeightMobile = () => {
    const el = ideaTextareaRef.current;
    if (!el || typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 640px)").matches) {
      el.style.height = "";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const metierProfile = useMemo(() => getVwsMetierProfile(profession), [profession]);
  const selectedFormatDef = useMemo(() => getFormatById(videoFormatId), [videoFormatId]);
  const selectedFormat = selectedFormatDef;
  const isProductMode = selectedFormat?.categoryId === "produit";

  useEffect(() => {
    if (!isProductMode) {
      setInspirePromesseHint("");
      return;
    }
    const professionLocal = String(profession ?? "").trim();
    const professionLegacy = String(campaignData?.profession ?? "").trim();
    const nomOk = professionLocal || professionLegacy;
    if (nomOk && productSceneDecorId) {
      setInspirePromesseHint("");
    }
  }, [isProductMode, profession, campaignData?.profession, productSceneDecorId]);

  const productMiseOptions = useMemo(
    () => (isProductMode && videoFormatId ? getProductMiseOptionsForFormat(videoFormatId) : []),
    [isProductMode, videoFormatId]
  );
  const productMiseNotice = useMemo(
    () => (isProductMode ? getProductMiseDef(stagingChips[0])?.notice ?? "" : ""),
    [isProductMode, stagingChips]
  );
  const selectedProductDecor = useMemo(
    () => (productSceneDecorId ? getProductDecorById(productSceneDecorId) : null),
    [productSceneDecorId]
  );
  const selectedProductHook = useMemo(
    () =>
      productOpeningHookId && productOpeningHookId !== "none"
        ? getProductHookById(productOpeningHookId)
        : null,
    [productOpeningHookId]
  );
  const isExplicitNoProductHook = productOpeningHookId === "none";

  useLayoutEffect(() => {
    if (isProductMode) return;
    adjustIdeaTextareaHeightMobile();
  }, [idea, isProductMode]);

  const {
    profile,
    productPromessePlaceholder: promessePlaceholderProduct,
    decorPriorityIds,
    refreshProfile,
  } = useProfilStudio();
  const ideaPlaceholder =
    selectedFormatDef?.placeholderIdea ??
    "Ex : un architecte explique son nouveau projet à la caméra dans son studio, tout en dessinant les plans sur une tablette…";
  const productPromessePlaceholder = promessePlaceholderProduct;
  const stylePlaceholder =
    metierProfile?.stylePlaceholder ??
    "Ex. : ambiance, lumière, style visuel, matériaux…";

  useEffect(() => {
    if (isProductMode) return;
    setStagingChips([]);
  }, [isProductMode]);

  const buildCampaignSnapshot = (overrides = {}) => {
    const base = {
      profession,
      lieuTournage,
      idea,
      styleDetails,
      tempo,
      cameraFixed,
      revealMode,
      cinematicMovement,
      selfieMode,
      sequenceType,
      dialogueEnabled,
      microAnswer,
      tempoCompressionDecision,
      causalAgentSelection,
      cameraAerialAngle,
      cameraViewAngle,
      narrativeContinuity,
      timelapseCameraPov,
      initialStateSelection,
      gateResult,
      clarifyAnswer,
      clarificationHistory: Array.isArray(campaignData?.clarificationHistory)
        ? campaignData.clarificationHistory
        : [],
      clarifyAxesResolved: {
        modeAgent: campaignData?.clarifyAxesResolved?.modeAgent === true,
        initialT0: campaignData?.clarifyAxesResolved?.initialT0 === true,
        causalAgent: campaignData?.clarifyAxesResolved?.causalAgent === true,
        cameraAerialAngle: campaignData?.clarifyAxesResolved?.cameraAerialAngle === true,
      },
      globalIntentProfile: campaignData?.globalIntentProfile ?? null,
      isClarified: false,
      videoFormatId,
      stagingChips,
      productSceneDecorId,
      productOpeningHookId,
    };
    const merged = { ...base, ...overrides };
    const effId = merged.videoFormatId ?? videoFormatId;
    const effProduct = getFormatById(effId)?.categoryId === "produit";
    if (!effProduct) {
      merged.productSceneDecorId = null;
      merged.productOpeningHookId = null;
    }
    return merged;
  };

  useEffect(() => {
    if (!isProductMode || !videoFormatId) return;
    const prev = stagingChipsRef.current;
    const normalized = normalizeProductStagingChipsForFormat(videoFormatId, prev);
    const unchanged =
      prev.length === normalized.length && prev.every((x, i) => x === normalized[i]);
    if (unchanged) return;
    setStagingChips(normalized);
    const d = getDialogueDefaultForMiseId(normalized[0]);
    setDialogueEnabled(d);
    onCampaignChange?.(
      buildCampaignSnapshot({
        stagingChips: normalized,
        dialogueEnabled: d,
      })
    );
  }, [isProductMode, videoFormatId]);

  const setProfession = (v) => {
    setProfessionState(v);
    const prefillLieu = PROFESSION_TO_LIEU_TOURNAGE[v];
    const nextLieu = prefillLieu || lieuTournage;
    if (prefillLieu) setLieuTournageState(prefillLieu);
    onCampaignChange?.(buildCampaignSnapshot({ profession: v, ...(prefillLieu ? { lieuTournage: nextLieu } : {}) }));
  };

  const setProfessionPlain = (v) => {
    setProfessionState(v);
    onCampaignChange?.(buildCampaignSnapshot({ profession: v }));
  };

  const selectProductMiseEnScene = (miseId) => {
    const next = [miseId];
    const d = getDialogueDefaultForMiseId(miseId);
    setStagingChips(next);
    setDialogueEnabled(d);
    onCampaignChange?.(buildCampaignSnapshot({ stagingChips: next, dialogueEnabled: d }));
  };
  const setLieuTournage = (v) => {
    const next = v === "chez_client" || v === "etablissement" || v === "neutre" ? v : "neutre";
    setLieuTournageState(next);
    onCampaignChange?.(buildCampaignSnapshot({ lieuTournage: next }));
  };
  const setIdea = (v) => {
    setIdeaState(v);
    setMicroAnswer(null);
    setTempoCompressionDecision(null);
    setMicroQuestion(null);
    setCausalAgentSelection(null);
    setCameraAerialAngle(null);
    setNarrativeContinuity(null);
    setTimelapseCameraPov(null);
    setInitialStateSelection(null);
    setGateResult(null);
    setClarifyAnswer(null);
    onCampaignChange?.(
      buildCampaignSnapshot({
        idea: v,
        microAnswer: null,
        tempoCompressionDecision: null,
        causalAgentSelection: null,
        cameraAerialAngle: null,
        narrativeContinuity: null,
        timelapseCameraPov: null,
        initialStateSelection: null,
        gateResult: null,
        clarifyAnswer: null,
        globalIntentProfile: null,
        clarificationHistory: [],
        clarifyAxesResolved: { modeAgent: false, initialT0: false, causalAgent: false, cameraAerialAngle: false },
        isClarified: false,
      })
    );
  };
  const syncState = (updates) => {
    if (updates.profession !== undefined) setProfessionState(updates.profession);
    if (updates.lieuTournage !== undefined) setLieuTournageState(updates.lieuTournage);
    if (updates.idea !== undefined) setIdeaState(updates.idea);
    if (updates.styleDetails !== undefined) setStyleDetails(updates.styleDetails);
    if (updates.stagingChips !== undefined) setStagingChips([...updates.stagingChips]);
    if (updates.productSceneDecorId !== undefined) setProductSceneDecorId(updates.productSceneDecorId);
    if (updates.productOpeningHookId !== undefined) setProductOpeningHookId(updates.productOpeningHookId);
    if (updates.tempo !== undefined) setTempo(normalizeTempo(updates.tempo));
    if (updates.cameraFixed !== undefined) setCameraFixed(updates.cameraFixed);
    if (updates.revealMode !== undefined) setRevealMode(updates.revealMode);
    if (updates.cinematicMovement !== undefined) setCinematicMovement(updates.cinematicMovement);
    if (updates.selfieMode !== undefined) setSelfieMode(updates.selfieMode);
    if (updates.sequenceType !== undefined) setSequenceType(updates.sequenceType);
    if (updates.microAnswer !== undefined) setMicroAnswer(updates.microAnswer);
    if (updates.tempoCompressionDecision !== undefined) {
      setTempoCompressionDecision(updates.tempoCompressionDecision);
    }
    if (updates.causalAgentSelection !== undefined) setCausalAgentSelection(updates.causalAgentSelection);
    if (updates.cameraAerialAngle !== undefined) setCameraAerialAngle(updates.cameraAerialAngle);
    if (updates.narrativeContinuity !== undefined) setNarrativeContinuity(updates.narrativeContinuity);
    if (updates.timelapseCameraPov !== undefined) setTimelapseCameraPov(updates.timelapseCameraPov);
    if (updates.cameraViewAngle !== undefined) setCameraViewAngle(updates.cameraViewAngle);
    if (updates.initialStateSelection !== undefined) setInitialStateSelection(updates.initialStateSelection);
    if (updates.gateResult !== undefined) setGateResult(updates.gateResult);
    if (updates.clarifyAnswer !== undefined) setClarifyAnswer(updates.clarifyAnswer);
    if (updates.videoFormatId !== undefined) setVideoFormatId(updates.videoFormatId);
    onCampaignChange?.(
      buildCampaignSnapshot({
        profession: updates.profession ?? profession,
        lieuTournage: updates.lieuTournage ?? lieuTournage,
        idea: updates.idea ?? idea,
        styleDetails: updates.styleDetails ?? styleDetails,
        stagingChips: updates.stagingChips ?? stagingChips,
        tempo: normalizeTempo(updates.tempo ?? tempo),
        cameraFixed: updates.cameraFixed ?? cameraFixed,
        revealMode: updates.revealMode ?? revealMode,
        cinematicMovement: updates.cinematicMovement ?? cinematicMovement,
        selfieMode: updates.selfieMode ?? selfieMode,
        sequenceType: updates.sequenceType ?? sequenceType,
        dialogueEnabled: updates.dialogueEnabled ?? dialogueEnabled,
        microAnswer: updates.microAnswer ?? microAnswer,
        tempoCompressionDecision:
          updates.tempoCompressionDecision ?? tempoCompressionDecision,
        causalAgentSelection:
          updates.causalAgentSelection ?? causalAgentSelection,
        cameraAerialAngle:
          updates.cameraAerialAngle ?? cameraAerialAngle,
        narrativeContinuity: updates.narrativeContinuity ?? narrativeContinuity,
        timelapseCameraPov: updates.timelapseCameraPov ?? timelapseCameraPov,
        cameraViewAngle:
          updates.cameraViewAngle ?? cameraViewAngle,
        initialStateSelection:
          updates.initialStateSelection ?? initialStateSelection,
        gateResult: updates.gateResult ?? gateResult,
        clarifyAnswer: updates.clarifyAnswer ?? clarifyAnswer,
        isClarified: updates.isClarified ?? false,
        videoFormatId: updates.videoFormatId !== undefined ? updates.videoFormatId : videoFormatId,
        ...(updates.clarificationHistory !== undefined
          ? { clarificationHistory: updates.clarificationHistory }
          : {}),
        ...(updates.globalIntentProfile !== undefined
          ? { globalIntentProfile: updates.globalIntentProfile }
          : {}),
        ...(updates.clarifyAxesResolved !== undefined
          ? { clarifyAxesResolved: updates.clarifyAxesResolved }
          : {}),
      })
    );
  };

  const applyVideoFormatChoice = (formatId) => {
    const fmt = getFormatById(formatId);
    if (!fmt) return;
    if (formatId === videoFormatId) return;

    if (profile?.user_intent == null) {
      const intent = getIntentFromFormatCategory(fmt.categoryId);
      if (intent) {
        void updateUserProfile({ user_intent: intent }).then((res) => {
          if (res.success) void refreshProfile();
        });
        capturePostHog("intent_selected", {
          intent,
          source: "first_format",
          format_id: formatId,
        });
      }
    }

    const prevFmt = getFormatById(videoFormatId);
    const wasProduct = prevFmt?.categoryId === "produit";
    const willBeProduct = fmt.categoryId === "produit";
    const r = fmt.rendering;
    const payload = {
      videoFormatId: formatId,
      tempo: normalizeTempo(r.tempo),
      sequenceType: r.sequenceType,
      cameraFixed: r.cameraFixed,
      revealMode: r.revealMode,
      cinematicMovement: r.cinematicMovement,
      selfieMode: r.selfieMode,
    };
    /** Évite de réutiliser le libellé métier (select) comme « nom du produit » — même state `profession`. */
    if (willBeProduct && !wasProduct) {
      const pTrim = String(profession ?? "").trim();
      if (pTrim && isKnownMetierLabel(pTrim)) {
        payload.profession = "";
      }
    }
    const ideaPipelineReset = {
      idea: "",
      microAnswer: null,
      tempoCompressionDecision: null,
      causalAgentSelection: null,
      cameraAerialAngle: null,
      narrativeContinuity: null,
      timelapseCameraPov: null,
      initialStateSelection: null,
      gateResult: null,
      clarifyAnswer: null,
      globalIntentProfile: null,
      clarificationHistory: [],
      clarifyAxesResolved: {
        modeAgent: false,
        initialT0: false,
        causalAgent: false,
        cameraAerialAngle: false,
      },
      isClarified: false,
    };
    setMicroQuestion(null);
    syncState({ ...payload, ...ideaPipelineReset });
  };

  const isIdeaTooDenseForRealtime = (text) => {
    const raw = String(text || "").trim();
    if (!raw) return false;
    const words = raw.split(/\s+/).filter(Boolean);
    const lower = raw.toLowerCase();
    const actionSignals =
      (lower.match(
        /\b(construire|construction|transform|rénover|renov|appara|progress|étape|phase|puis|ensuite|timelapse|montage|réparation|repair|assemblage)\b/g
      ) || []).length;
    const structureSignals =
      (raw.match(/,/g) || []).length +
      (raw.match(/\b(puis|ensuite|pendant que|au fur et à mesure|et ensuite)\b/gi) ||
        []).length;
    return words.length >= 32 || (words.length >= 24 && actionSignals >= 3) || structureSignals >= 5;
  };

  const handleInspire = async () => {
    const professionLocal = String(profession ?? "").trim();
    const professionLegacy = String(campaignData?.profession ?? "").trim();
    const effectiveProfession = professionLocal || professionLegacy;
    const effectiveFormatId = videoFormatId || campaignData?.videoFormatId || null;
    const inspireFormatDef = effectiveFormatId ? getFormatById(effectiveFormatId) : null;
    /** Même source que le libellé de format — évite le décalage videoFormatId local vs spec parent (prompt métier vs produit). */
    const isProductFormatForInspire = inspireFormatDef?.categoryId === "produit";
    const nomDuProduit = effectiveProfession;
    const precisionsTrim = String(styleDetails ?? "").trim();

    if (!effectiveFormatId || !getFormatById(effectiveFormatId)) {
      setError("Choisis d’abord un format vidéo avec « Choisir un format ».");
      return;
    }

    if (isProductFormatForInspire) {
      const missingNomDecor = getMissingInspireProductNomDecor({
        nomDuProduit,
        productSceneDecorId,
      });
      if (missingNomDecor.length > 0) {
        setInspirePromesseHint(formatInspirePromesseHint(missingNomDecor));
        return;
      }
      if (productOpeningHookId === null) {
        setInspirePromesseHint(
          "Indique comment gérer les 3 premières secondes via le sélecteur sous la promesse."
        );
        return;
      }
      setInspirePromesseHint("");
      setError("");

      const decorDef = getProductDecorById(productSceneDecorId);
      const decorPhrase = decorDef?.description?.trim() || "";
      const promptBlocks = [`Produit : ${nomDuProduit}`, `Décor : ${decorPhrase}`];
      if (productOpeningHookId && productOpeningHookId !== "none") {
        const hookName = getProductHookById(productOpeningHookId)?.name?.trim();
        if (hookName) promptBlocks.push(`Hook : ${hookName}`);
      }
      if (precisionsTrim) {
        promptBlocks.push(`Précisions : ${precisionsTrim}`);
      }
      const userPromptProduct = `${promptBlocks.join("\n")}\n\nGénère une promesse pour ce produit dans cet univers.`;

      setInspireProductAwaitingDelayedSpinner(true);
      setInspireDelayedSpinnerVisible(false);
      if (inspireSpinnerDelayTimerRef.current != null) {
        clearTimeout(inspireSpinnerDelayTimerRef.current);
        inspireSpinnerDelayTimerRef.current = null;
      }
      inspireSpinnerDelayTimerRef.current = setTimeout(() => {
        inspireSpinnerDelayTimerRef.current = null;
        setInspireDelayedSpinnerVisible(true);
      }, 2000);

      setInspireLoading(true);
      try {
        const text = await generateResponse(userPromptProduct, VWS_INSPIRE_PROMESSE_PRODUCT_SYSTEM, {
          model: "gpt-4o-mini",
          max_tokens: 120,
          temperature: 0.9,
        });
        const trimmed = String(text || "").trim();
        if (trimmed) setIdea(trimmed);
      } catch (e) {
        setError(e?.message || "Impossible de générer l'inspiration.");
      } finally {
        if (inspireSpinnerDelayTimerRef.current != null) {
          clearTimeout(inspireSpinnerDelayTimerRef.current);
          inspireSpinnerDelayTimerRef.current = null;
        }
        setInspireDelayedSpinnerVisible(false);
        setInspireProductAwaitingDelayedSpinner(false);
        setInspireLoading(false);
      }
      return;
    }

    if (!effectiveProfession) {
      setError(
        "Sélectionne d’abord ton métier dans la liste « Ton métier » pour utiliser « M'inspirer »."
      );
      return;
    }

    const metier = effectiveProfession;
    const inspireMetierProfile = getVwsMetierProfile(metier);
    const inspireContextLine = inspireMetierProfile?.inspireContext?.trim()
      ? `\nAngle narratif typique pour ce métier : ${inspireMetierProfile.inspireContext.trim()}`
      : "";
    setInspireProductAwaitingDelayedSpinner(false);
    setInspireDelayedSpinnerVisible(false);
    if (inspireSpinnerDelayTimerRef.current != null) {
      clearTimeout(inspireSpinnerDelayTimerRef.current);
      inspireSpinnerDelayTimerRef.current = null;
    }
    setInspireLoading(true);
    setError("");
    try {
      const systemPromptBase =
        "Tu appliques strictement le prompt utilisateur et tu réponds uniquement par la scène demandée.";
      const selectedLieu = getLieuOption(lieuTournage);
      const selectedFormatLabel = inspireFormatDef?.name || "Format non défini";
      const userPrompt = `Tu es un expert en création de vidéos courtes pour les réseaux sociaux.
Génère une idée de scène vidéo de 8 secondes pour un ${metier}
qui travaille ${selectedLieu.sentence}${inspireContextLine}

Le format de cette vidéo est : ${selectedFormatLabel}
Tu dois impérativement respecter ce que ce format implique :
- "Démonstration produit" → montrer un produit ou outil en action,
  gros plan sur l'objet, le professionnel l'utilise ou le présente
- "Mise en situation (lifestyle)" → montrer le professionnel dans
  son environnement naturel de travail, ambiance authentique,
  pas de mise en scène forcée
- "Erreur → correction" → montrer d'abord une mauvaise pratique
  ou un problème visible, puis la correction ou le bon geste
- "Comparatif produit" → montrer deux états, deux objets ou
  deux résultats côte à côte ou en succession rapide
- "Publicité produit (shooting esthétique)" → aucune personne visible,
  uniquement le produit ou le résultat final dans un cadre soigné
- Pour tout autre format : interpréter le libellé et adapter la scène
  en conséquence

Règles strictes :
- L'idée doit montrer une action concrète, un geste métier précis
  ou une transformation visible (avant → après, problème → solution)
- La scène doit être filmable en conditions réelles, pas en studio
- Un seul sujet, une seule action — pas de liste, pas de scène composite
- Ne jamais utiliser les mots : magnifique, parfait, élégant, sublime,
  harmonieux, spectaculaire, impressionnant, superbe, splendide,
  symétrique, esthétique
- Rédige uniquement la description de la scène, en 1 à 2 phrases maximum
- Pas d'introduction, pas de conclusion, pas de guillemets`;
      const response = await generateResponse(userPrompt, systemPromptBase, {
        max_tokens: 140,
        temperature: 0.42,
      });
      let text = (response || "").trim();
      text = text.replace(/^["«'"„]|["»'"”]$/g, "").trim();
      if (text) setIdea(text);
    } catch (e) {
      setError(e?.message || "Impossible de générer l'inspiration.");
    } finally {
      setInspireLoading(false);
    }
  };

  const resolveAmbiguousMicroQuestion = async (safeIdea) => {
    const systemPrompt = `Tu aides à lever une ambiguïté de départ pour une vidéo de transformation/construction.
Retourne UNIQUEMENT un JSON valide avec ce schéma exact :
{"question":"...","options":[{"id":"from_nothing","label":"..."},{"id":"partially_built","label":"..."}]}
Contraintes:
- question simple en français, orientée point de départ (depuis rien vs déjà partiellement construit)
- labels courts et compréhensibles
- pas d'autre texte hors JSON`;
    const userPrompt = `Idée utilisateur: ${safeIdea}
Génère une question claire et 2 choix pour préciser l'état initial.`;
    try {
      const raw = await generateResponse(userPrompt, systemPrompt, {
        max_tokens: 220,
        temperature: 0.2,
      });
      const parsed = JSON.parse(String(raw || "").trim());
      if (
        parsed &&
        typeof parsed.question === "string" &&
        Array.isArray(parsed.options) &&
        parsed.options.length >= 2
      ) {
        const normalizedOptions = parsed.options
          .map((o) => ({
            id: String(o?.id || "").trim(),
            label: String(o?.label || "").trim(),
          }))
          .filter((o) => (o.id === "from_nothing" || o.id === "partially_built") && o.label);
        if (normalizedOptions.length >= 2) {
        return {
          question: parsed.question.trim(),
          reason: "ambiguous_subject",
          options: normalizedOptions,
        };
        }
      }
    } catch (err) {
      void err;
    }
    return {
      question: "L'élément principal doit-il démarrer depuis rien, ou depuis un état déjà partiellement construit ?",
      reason: "ambiguous_subject",
      options: [
        { id: "from_nothing", label: "Partir de rien" },
        { id: "partially_built", label: "Déjà partiellement construit" },
      ],
    };
  };

  const checkGateQuestionAlreadyAnswered = async ({
    formatLabel,
    lieuSentence,
    ideaText,
    questionLabel,
  }) => {
    const verificationPrompt = `Les informations suivantes sont déjà renseignées par l'utilisateur :
- Format vidéo : ${formatLabel}
- Lieu : ${lieuSentence}
- Idée principale : ${ideaText}

La question conditionnelle suivante est-elle déjà répondue par ces informations ?
Question : ${questionLabel}

Réponds uniquement en JSON : { "already_answered": true/false, "inferred_value": "valeur déduite si true, sinon null" }`;
    try {
      const raw = await generateResponse(
        verificationPrompt,
        "Tu réponds uniquement avec un JSON valide, sans texte additionnel.",
        {
          max_tokens: 100,
          temperature: 0,
        }
      );
      const parsed = extractJsonObjectFromText(raw);
      if (!parsed || typeof parsed !== "object") {
        return { alreadyAnswered: false, inferredValue: null };
      }
      const alreadyAnswered = parsed.already_answered === true;
      const inferredValue =
        typeof parsed.inferred_value === "string" && parsed.inferred_value.trim()
          ? parsed.inferred_value.trim()
          : null;
      return { alreadyAnswered, inferredValue };
    } catch {
      return { alreadyAnswered: false, inferredValue: null };
    }
  };

  const detectPersonVisibleInIdea = async (ideaText) => {
    const prompt = `Le texte suivant décrit une scène vidéo : "${ideaText}"
Est-ce qu'une personne est visible et active dans cette scène ?
Réponds uniquement en JSON : { "person_visible": true/false }`;
    try {
      const raw = await generateResponse(
        prompt,
        "Tu réponds uniquement avec un JSON valide, sans texte additionnel.",
        {
          max_tokens: 100,
          temperature: 0,
        }
      );
      const parsed = extractJsonObjectFromText(raw);
      return parsed?.person_visible === true;
    } catch {
      return false;
    }
  };

  const handleRun = async (
    clarificationHistoryOverride = null,
    runOverrides = null,
    flowOptions = null
  ) => {
    setError("");
    setLoading(true);
    try {
      const safeProfession = profession.trim() || "entrepreneur";
      const safeIdea = idea.trim();
      if (!safeIdea || safeIdea.length < 8) {
        throw new Error("Décris au moins une idée claire pour la vidéo (8 caractères minimum).");
      }
      if (!videoFormatId || !getFormatById(videoFormatId)) {
        throw new Error("Choisis un format vidéo avant de lancer la préparation.");
      }

      capturePostHog("campaign_creation_started", {
        video_format_id: videoFormatId,
      });

      const catalogFormatDef = getFormatById(videoFormatId);
      const formatParamsConfig = getVideoFormatConfigForCatalogId(videoFormatId);
      const formatParamsAppendix = formatParamsConfig
        ? formatVideoFormatParamsPromptAppendix(formatParamsConfig)
        : "";
      const baseCatalogHint = getFormatHintForEngine(catalogFormatDef);
      const formatHint = [baseCatalogHint, formatParamsAppendix].filter(Boolean).join("\n\n");
      const effectiveLieuValue =
        flowOptions?.forceLieuTournage === "chez_client" ||
        flowOptions?.forceLieuTournage === "etablissement" ||
        flowOptions?.forceLieuTournage === "neutre"
          ? flowOptions.forceLieuTournage
          : lieuTournage;
      const selectedLieu = getLieuOption(effectiveLieuValue);
      const isProductModeRun = catalogFormatDef?.categoryId === "produit";
      const effectiveLocationType = isProductModeRun
        ? locationTypeFromProductDecor(productSceneDecorId)
        : selectedLieu.value;
      const lieuForSpec = getLieuOption(effectiveLocationType);
      const precisionsForModifiers = String(styleDetails ?? "").trim();
      const stagingLabelsRun = isProductModeRun
        ? stagingChips
            .map((id) => getProductMiseDef(id)?.label)
            .filter(Boolean)
        : [];
      const sceneDescriptionBody =
        isProductModeRun && stagingLabelsRun.length > 0
          ? `${safeIdea}\n\nMise en scène souhaitée : ${stagingLabelsRun.join(", ")}`
          : safeIdea;
      const decorLine = buildProductSceneDecorSentence(productSceneDecorId);
      const hookLineRun = buildProductOpeningHookSentence(productOpeningHookId);
      const sceneContextHeading = isProductModeRun
        ? [decorLine, hookLineRun].filter(Boolean).join("\n\n") ||
          "Environnement / décor : à déduire de la promesse produit et du format."
        : selectedLieu.sentence;
      const ideaWithSceneContext = sceneContextHeading
        ? `${sceneContextHeading}\n\n${sceneDescriptionBody}`
        : sceneDescriptionBody;
      const lieuSentenceForGate = isProductModeRun ? decorLine : selectedLieu.sentence;

      const shouldSkipContradictionCheck = flowOptions?.skipContradictionCheck === true;
      if (!shouldSkipContradictionCheck && safeIdea && !isProductModeRun) {
        const contradictionPrompt = `Tu es un assistant qui analyse si la description d'une scène vidéo contredit le lieu sélectionné par l'utilisateur.
Lieu sélectionné : ${selectedLieu.label}
Description de la scène : ${safeIdea}
Réponds uniquement en JSON :
{
"contradiction": true/false,
"lieu_dans_description": "le lieu détecté dans la description si contradiction, sinon null"
}`;
        const contradictionRaw = await generateResponse(
          contradictionPrompt,
          "Tu réponds uniquement avec un JSON valide, sans texte autour.",
          {
            max_tokens: 100,
            temperature: 0,
          }
        );
        const parsed = extractJsonObjectFromText(contradictionRaw);
        const contradiction = parsed?.contradiction === true;
        const detectedLieu = typeof parsed?.lieu_dans_description === "string"
          ? parsed.lieu_dans_description.trim()
          : "";
        if (contradiction && detectedLieu) {
          setLocationConflict({
            selectedValue: selectedLieu.value,
            selectedLabel: selectedLieu.label,
            detectedLabel: detectedLieu,
            detectedValue: getContradictionDetectedLieuValue(detectedLieu),
            clarificationHistoryOverride,
            runOverrides,
          });
          setLoading(false);
          return;
        }
      }

      let historyLines =
        clarificationHistoryOverride ??
        (Array.isArray(campaignData?.clarificationHistory) ? campaignData.clarificationHistory : []);

      const effectiveTempo =
        runOverrides?.tempo !== undefined ? normalizeTempo(runOverrides.tempo) : tempo;
      const effectiveSequenceType =
        runOverrides?.sequenceType !== undefined ? runOverrides.sequenceType : sequenceType;
      const effectiveMicroAnswer =
        runOverrides?.microAnswer !== undefined ? runOverrides.microAnswer : microAnswer;
      const effectiveCameraViewAngle =
        runOverrides?.cameraViewAngle !== undefined ? runOverrides.cameraViewAngle : cameraViewAngle;
      const effectiveTempoCompressionDecision =
        runOverrides?.tempoCompressionDecision !== undefined
          ? runOverrides.tempoCompressionDecision
          : tempoCompressionDecision;
      const effectiveNarrativeContinuity =
        runOverrides?.narrativeContinuity !== undefined
          ? runOverrides.narrativeContinuity
          : narrativeContinuity;
      const effectiveTimelapseCameraPov =
        runOverrides?.timelapseCameraPov !== undefined
          ? runOverrides.timelapseCameraPov
          : timelapseCameraPov;

      const histParsed = parseClarifyAxesFromHistory(historyLines);
      let axes = {
        modeAgent:
          campaignData?.clarifyAxesResolved?.modeAgent === true || histParsed.modeAgent,
        initialT0:
          campaignData?.clarifyAxesResolved?.initialT0 === true || histParsed.initialT0,
        causalAgent:
          campaignData?.clarifyAxesResolved?.causalAgent === true || histParsed.causalAgent,
        cameraAerialAngle:
          campaignData?.clarifyAxesResolved?.cameraAerialAngle === true || histParsed.cameraAerialAngle,
      };
      let microForBrain = effectiveMicroAnswer ?? histParsed.microFromGate ?? null;
      let causalForBrain =
        causalAgentSelection ?? histParsed.causalAgentSelectionFromGate ?? null;
      let cameraAerialForBrain =
        cameraAerialAngle ?? histParsed.cameraAerialAngleFromGate ?? null;
      let histJoined = historyLines.length ? historyLines.join("\n\n") : undefined;
      const selectedFormatLabel = catalogFormatDef?.name || String(videoFormatId || "");
      // #region agent log
      const __dbgB = {sessionId:'0480cf',runId:'pre-fix-1',hypothesisId:'B',location:'CampagneVWS.jsx:793',message:'Effective tempo/sequence before microQuestions',data:{sequenceType,runOverridesSequenceType:runOverrides?.sequenceType??null,effectiveSequenceType,effectiveTempo,tempoCompressionDecision:tempoCompressionDecision??null,effectiveTempoCompressionDecision:effectiveTempoCompressionDecision??null,videoFormatId:String(videoFormatId||''),selectedFormatLabel,formatRenderingSequenceType:catalogFormatDef?.rendering?.sequenceType??null,formatRenderingTempo:catalogFormatDef?.rendering?.tempo??null},timestamp:Date.now()};
      console.debug("[debug-0480cf]", __dbgB);
      fetch('http://127.0.0.1:7405/ingest/84f2a250-0990-480e-ba92-160ff926a4b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0480cf'},body:JSON.stringify(__dbgB)}).catch((e)=>{console.debug("[debug-0480cf] ingest failed", e?.message||String(e));});
      // #endregion agent log
      const payload = {
        profession: safeProfession,
        idea: ideaWithSceneContext,
        styleDetails: precisionsForModifiers || "",
        videoFormatHint: formatHint.trim() || undefined,
        revealMode,
        selfieMode,
        cameraFixed,
        cinematicMovement,
        tempo: effectiveTempo,
        sequenceType: effectiveSequenceType,
      };
      console.log("=== FORMAT CONFIG INJECTÉ ===", formatHint);
      console.log("=== PAYLOAD API ===", payload);
      const preIntent = await inferGlobalIntent(payload);
      const isPresentationSelfie =
        preIntent.intentFamily === "presentation" &&
        (preIntent.humanPresence === "selfie" || selfieMode === true);
      const inferredSelfiePov = preIntent.humanPresence === "selfie";

      let gate = null;
      for (;;) {
        const needCameraAerial =
          !axes.cameraAerialAngle && clarifyGateNeedsCameraAerialAngle(ideaWithSceneContext);
        const needCausal =
          !isPresentationSelfie && !axes.causalAgent && clarifyGateNeedsCausalAgent(ideaWithSceneContext);
        const needMode =
          !isPresentationSelfie && !axes.modeAgent && clarifyGateNeedsModeAgent(ideaWithSceneContext);
        const needInitial =
          !isPresentationSelfie && !axes.initialT0 && clarifyGateNeedsInitialT0(ideaWithSceneContext);

        if (!needCameraAerial && !needCausal && !needMode && !needInitial) {
          gate = await clarifyIdea({
            jobType: safeProfession,
            mainIdea: ideaWithSceneContext,
            modifiers: precisionsForModifiers,
            tempoSelection: effectiveTempo,
            clarificationHistory: histJoined,
            gatePhase: "none",
            formatContextAppendix: formatParamsAppendix || null,
          });
          break;
        }

        const phase = needCameraAerial
          ? "camera_aerial_angle"
          : needCausal
            ? "causal_agent"
            : needMode
              ? "mode_agent"
              : "initial_t0";
        gate = await clarifyIdea({
          jobType: safeProfession,
          mainIdea: ideaWithSceneContext,
          modifiers: precisionsForModifiers,
          tempoSelection: effectiveTempo,
          clarificationHistory: histJoined,
          gatePhase: phase,
          formatContextAppendix: formatParamsAppendix || null,
        });

        if (gate.status === "NEEDS_CLARIFICATION") {
          const precheck = await checkGateQuestionAlreadyAnswered({
            formatLabel: selectedFormatLabel,
            lieuSentence: lieuSentenceForGate,
            ideaText: safeIdea,
            questionLabel: gate.question,
          });
          if (precheck.alreadyAnswered === true && precheck.inferredValue) {
            const inferredOptionId = mapGateInferredValueToOptionId(gate, precheck.inferredValue);
            if (inferredOptionId) {
              const inferredOption = gate.options?.find((opt) => opt.id === inferredOptionId);
              const inferredLabel = inferredOption?.label || precheck.inferredValue;
              historyLines = [
                ...historyLines,
                `Q: ${gate.question} A: ${inferredLabel} (option_id=${inferredOptionId})`,
              ];
              histJoined = historyLines.join("\n\n");
              if (inferredOptionId === "vws_gate_t0_pristine") {
                axes.initialT0 = true;
                microForBrain = "from_nothing";
                setMicroAnswer("from_nothing");
              } else if (inferredOptionId === "vws_gate_t0_in_progress") {
                axes.initialT0 = true;
                microForBrain = "partially_built";
                setMicroAnswer("partially_built");
              } else if (inferredOptionId === "vws_gate_causal_visible") {
                axes.causalAgent = true;
                axes.modeAgent = true;
                causalForBrain = "visible";
                setCausalAgentSelection("visible");
              } else if (inferredOptionId === "vws_gate_causal_automatic") {
                axes.causalAgent = true;
                axes.modeAgent = true;
                causalForBrain = "automatic";
                setCausalAgentSelection("automatic");
              } else if (inferredOptionId === "vws_gate_camera_top_down") {
                axes.cameraAerialAngle = true;
                cameraAerialForBrain = "top_down";
                setCameraAerialAngle("top_down");
              } else if (inferredOptionId === "vws_gate_camera_angled") {
                axes.cameraAerialAngle = true;
                cameraAerialForBrain = "angled";
                setCameraAerialAngle("angled");
              } else if (inferredOptionId === "vws_gate_mode_autonomous" || inferredOptionId === "vws_gate_mode_human") {
                axes.modeAgent = true;
              }
              onCampaignChange?.(
                buildCampaignSnapshot({
                  clarificationHistory: historyLines,
                  clarifyAxesResolved: axes,
                  microAnswer: microForBrain,
                  causalAgentSelection: causalForBrain,
                  cameraAerialAngle: cameraAerialForBrain,
                })
              );
              continue;
            }
          }
          setGateResult(gate);
          setMicroQuestion({
            question: gate.question,
            reason: "clarify_gate",
            options: gate.options?.length
              ? gate.options
              : [
                  { id: "clarify_apply", label: "J’ai précisé mon idée dans le champ ci-dessus" },
                  { id: "clarify_proceed", label: "Continuer malgré ce diagnostic" },
                ],
          });
          onCampaignChange?.(
            buildCampaignSnapshot({
              gateResult: gate,
              clarifyAnswer: null,
              clarificationHistory: historyLines,
              clarifyAxesResolved: axes,
              isClarified: false,
            })
          );
          setError("Précise ce point avant de préparer la vidéo.");
          return;
        }

        if (phase === "mode_agent") axes.modeAgent = true;
        else if (phase === "causal_agent") {
          axes.causalAgent = true;
          axes.modeAgent = true;
        } else if (phase === "camera_aerial_angle") {
          axes.cameraAerialAngle = true;
        } else axes.initialT0 = true;
        onCampaignChange?.(buildCampaignSnapshot({ clarifyAxesResolved: axes }));
      }

      const isPubliciteProduitFormat =
        selectedFormatLabel.toLowerCase() === "publicité produit (shooting esthétique)".toLowerCase();
      const isSelfieFormat = Boolean(catalogFormatDef?.rendering?.selfieMode ?? selfieMode);
      if (!effectiveCameraViewAngle && !isPubliciteProduitFormat && !isSelfieFormat) {
        const personVisible = await detectPersonVisibleInIdea(safeIdea);
        if (personVisible) {
          setMicroQuestion({
            question: "Quel angle de caméra ?",
            reason: "camera_view_angle",
            options: [
              { id: "camera_view_subjective", label: "Vue subjective (caméra portée)" },
              { id: "camera_view_exterieure", label: "Vue extérieure (professionnel filmé)" },
            ],
          });
          setError("Choisis l’angle caméra pour finaliser la préparation.");
          return;
        }
      }

      if (
        preIntent.intentFamily === "presentation" &&
        effectiveSequenceType !== "three_x_8s" &&
        !effectiveTempoCompressionDecision
      ) {
        setMicroQuestion({
          question: "Cette présentation semble assez courte. Veux-tu partir sur une vidéo plus longue de 24 secondes ?",
          reason: "presentation_duration",
          info:
            "Passer en 24 secondes active 3 scènes (3 x 8s) et consomme 3 vidéos au total au lieu de 1.",
          options: [
            { id: "switch_24s", label: "Oui, passer en 24 sec" },
            { id: "keep_8s", label: "Non, garder 8 sec" },
          ],
        });
        setError("Choisis une durée adaptée à cette présentation.");
        return;
      }

      if (
        effectiveTempo === "real_time" &&
        !effectiveTempoCompressionDecision &&
        effectiveSequenceType === "single_8s" &&
        isIdeaTooDenseForRealtime(ideaWithSceneContext)
      ) {
        // #region agent log
        const __dbgC = {sessionId:'0480cf',runId:'pre-fix-1',hypothesisId:'C',location:'CampagneVWS.jsx:987',message:'Triggered timelapse_density microQuestion',data:{effectiveSequenceType,effectiveTempo,effectiveTempoCompressionDecision:effectiveTempoCompressionDecision??null,ideaLength:String(ideaWithSceneContext||'').length,videoFormatId:String(videoFormatId||''),selectedFormatLabel},timestamp:Date.now()};
        console.debug("[debug-0480cf]", __dbgC);
        fetch('http://127.0.0.1:7405/ingest/84f2a250-0990-480e-ba92-160ff926a4b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0480cf'},body:JSON.stringify(__dbgC)}).catch((e)=>{console.debug("[debug-0480cf] ingest failed", e?.message||String(e));});
        // #endregion agent log
        setMicroQuestion({
          question:
            "Cette idée semble trop dense pour 8 secondes en temps réel. Veux-tu passer en “Très rapide : le temps défile” (timelapse) ?",
          reason: "timelapse_density",
          options: [
            { id: "switch_timelapse", label: "Oui, passer en timelapse" },
            { id: "keep_realtime", label: "Non, garder le temps réel" },
          ],
        });
        setError("Choisis le mode de vitesse pour éviter une vidéo difficile à réaliser en 8 secondes.");
        return;
      }

      const textForContinuityMicro = [safeIdea, precisionsForModifiers].filter(Boolean).join("\n\n");
      if (narrativeContinuityNeedsQuestion(textForContinuityMicro, "") && !effectiveNarrativeContinuity) {
        setMicroQuestion({
          question: "La vidéo doit-elle être continue ou peut-elle avoir des coupures ?",
          reason: "narrative_continuity",
          options: [
            {
              id: "vws_cont_continuous",
              label: "Continue, sans coupure (un seul plan ou un seul mouvement de caméra)",
            },
            {
              id: "vws_cont_cuts",
              label: "Avec coupures entre différents moments ou angles",
            },
          ],
        });
        setError("Précise la continuité avant de préparer la vidéo.");
        return;
      }

      if (
        effectiveTempo === "timelapse" &&
        timelapseCameraPovNeedsQuestion(textForContinuityMicro, "", { selfieMode }) &&
        !effectiveTimelapseCameraPov
      ) {
        setMicroQuestion({
          question: "Quel angle de caméra pour ce timelapse ?",
          reason: "timelapse_camera_pov",
          options: [
            { id: "vws_tl_pov_aerial", label: "Vue aérienne / drone" },
            { id: "vws_tl_pov_ground", label: "Au sol (niveau humain)" },
            { id: "vws_tl_pov_both", label: "Les deux (alternance)" },
          ],
        });
        setError("Précise l’angle caméra timelapse avant de préparer la vidéo.");
        return;
      }


      const brain = runVwsPromptEngine({
        profession: safeProfession,
        idea: ideaWithSceneContext,
        styleDetails: precisionsForModifiers || undefined,
        videoFormatHint: formatHint.trim() || undefined,
        tempo: effectiveTempo,
        cameraFixed,
        revealMode,
        cinematicMovement,
        selfieMode,
        sequenceType: effectiveSequenceType,
        dialogueEnabled,
        microAnswerId: microForBrain,
        causalAgentSelection: causalForBrain,
        cameraAerialAngle: cameraAerialForBrain,
        inferredSelfiePov,
        narrativeContinuity: effectiveNarrativeContinuity ?? null,
        timelapseCameraPov: effectiveTimelapseCameraPov ?? null,
      });

      const globalIntentProfile = preIntent;

      const skipBrainInitialMicro = axes.initialT0 === true;
      if (brain.microQuestion && !microForBrain && !skipBrainInitialMicro) {
        const questionToShow =
          brain.microQuestion.reason === "ambiguous_subject"
            ? await resolveAmbiguousMicroQuestion(ideaWithSceneContext)
            : brain.microQuestion;
        setMicroQuestion(questionToShow);
        setError("Précise ce point avant de préparer la vidéo.");
        return;
      }
      setMicroQuestion(null);

      try {
        sessionStorage.setItem(
          SS_BRAIN_V2_LAST_KEY,
          JSON.stringify({
            input: {
              profession: safeProfession,
              idea: ideaWithSceneContext,
              styleDetails: precisionsForModifiers || "",
              tempo: effectiveTempo,
              cameraFixed,
              revealMode,
              cinematicMovement,
              selfieMode,
              sequenceType: effectiveSequenceType,
              dialogueEnabled,
              microAnswer: microForBrain,
              tempoCompressionDecision: effectiveTempoCompressionDecision,
              narrativeContinuity: effectiveNarrativeContinuity,
              timelapseCameraPov: effectiveTimelapseCameraPov,
            },
            brain,
          })
        );
      } catch (err) {
        void err;
      }

      const rawClarificationMode = gate?.status === "VALID" ? gate?.mode ?? null : null;
      const clarificationMode = resolveClarifyModeForFormat(rawClarificationMode, videoFormatId);
      const clarificationDiagnostic =
        gate?.status === "VALID" ? gate?.diagnostic ?? null : null;
      const finalPayloadSpec = stampCampaignGenerationMeta({
        ...createDefaultCampaignGenerationSpec(),
        campaign: {
          ...createDefaultCampaignGenerationSpec().campaign,
          profession: safeProfession,
          video_format_id: videoFormatId,
          location_type: lieuForSpec.value,
          core_idea: ideaWithSceneContext,
          style_details: precisionsForModifiers || "",
          staging_chips: [...stagingChips],
          product_scene_decor_id: isProductModeRun ? productSceneDecorId : null,
          product_opening_hook_id: isProductModeRun ? productOpeningHookId : null,
          intent_profile: globalIntentProfile ?? buildMinimalIntentFallback({ idea: ideaWithSceneContext, selfieMode }),
          clarification: {
            ...createDefaultCampaignGenerationSpec().campaign.clarification,
            mode: clarificationMode,
            diagnostic: clarificationDiagnostic,
            // Owner unique: microAnswer only. `initialStateSelection` is a read-only legacy alias.
            initial_state: microForBrain,
            causal_agent: causalForBrain,
            camera_aerial_angle: cameraAerialForBrain,
            camera_view_angle: effectiveCameraViewAngle,
            last_user_freeform_answer: clarifyAnswer ?? null,
            proceed_anyway: false,
            history: historyLines,
            resolved_axes: {
              mode_agent: axes.modeAgent === true,
              initial_t0: axes.initialT0 === true,
              causal_agent: axes.causalAgent === true,
              camera_aerial_angle: axes.cameraAerialAngle === true,
            },
            is_resolved: true,
          },
        },
        creative: {
          ...createDefaultCampaignGenerationSpec().creative,
          sequence_type: effectiveSequenceType === "three_x_8s" ? "three_x_8s" : "single_8s",
        },
        rendering: {
          ...createDefaultCampaignGenerationSpec().rendering,
          tempo:
            effectiveTempo === "timelapse" || effectiveTempo === "slow_motion"
              ? effectiveTempo
              : "real_time",
          tempo_resolution_decision: effectiveTempoCompressionDecision ?? null,
          camera: {
            ...createDefaultCampaignGenerationSpec().rendering.camera,
            fixed: Boolean(cameraFixed),
            reveal_mode: Boolean(revealMode),
            cinematic_movement: Boolean(cinematicMovement),
            selfie_mode: Boolean(selfieMode),
            aerial_angle: cameraAerialForBrain,
          },
          audio: {
            ...createDefaultCampaignGenerationSpec().rendering.audio,
            dialogue_enabled: dialogueEnabled !== false,
            enable_tts: dialogueEnabled !== false,
          },
        },
        trace: {
          ...createDefaultCampaignGenerationSpec().trace,
          clarify_gate: {
            ...createDefaultCampaignGenerationSpec().trace.clarify_gate,
            last_result: gate ?? null,
          },
        },
      });
      const finalPayload = {
        profession: safeProfession,
        lieuTournage: lieuForSpec.value,
        idea: ideaWithSceneContext,
        styleDetails: precisionsForModifiers || "",
        stagingChips: [...stagingChips],
        productSceneDecorId: isProductModeRun ? productSceneDecorId : null,
        productOpeningHookId: isProductModeRun ? productOpeningHookId : null,
        videoFormatId,
        tempo: effectiveTempo,
        cameraFixed,
        revealMode,
        cinematicMovement,
        selfieMode,
        sequenceType: effectiveSequenceType,
        dialogueEnabled,
        microAnswer: microForBrain,
        tempoCompressionDecision: effectiveTempoCompressionDecision,
        causalAgentSelection: causalForBrain,
        cameraAerialAngle: cameraAerialForBrain,
        narrativeContinuity: effectiveNarrativeContinuity,
        timelapseCameraPov: effectiveTimelapseCameraPov,
        cameraViewAngle: effectiveCameraViewAngle,
        initialStateSelection: null,
        gateResult: gate,
        clarifyAnswer: clarifyAnswer ?? null,
        clarifyMode: clarificationMode,
        clarifyDiagnostic: clarificationDiagnostic,
        proceedAnyway: false,
        clarificationHistory: historyLines,
        clarifyAxesResolved: axes,
        globalIntentProfile,
        isClarified: true,
        campaignGenerationSpec: finalPayloadSpec,
      };

      onCampaignChange?.(buildCampaignSnapshot(finalPayload));
      onBrainReady?.(finalPayload);
    } catch (e) {
      const msg = e?.message || "Une erreur s’est produite pendant la préparation.";
      setError(msg);
      trackPostHogError(msg, "/viralworks", "generation");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMicroAnswer = (optionId) => {
    const histBase = Array.isArray(campaignData?.clarificationHistory)
      ? [...campaignData.clarificationHistory]
      : [];

    if (microQuestion?.reason === "clarify_gate" && gateResult && optionId !== "clarify_apply" && optionId !== "clarify_proceed") {
      const opt = microQuestion.options?.find((o) => o.id === optionId);
      if (!opt) return;
      const line = `Q: ${gateResult.question} A: ${opt.label} (option_id=${opt.id})`;
      const nextHist = [...histBase, line];
      setMicroQuestion(null);
      setError("");
      setGateResult(null);
      const axesNext = {
        modeAgent:
          campaignData?.clarifyAxesResolved?.modeAgent === true ||
          String(optionId).startsWith("vws_gate_mode_"),
        initialT0:
          campaignData?.clarifyAxesResolved?.initialT0 === true ||
          String(optionId).startsWith("vws_gate_t0_"),
        causalAgent:
          campaignData?.clarifyAxesResolved?.causalAgent === true ||
          String(optionId).startsWith("vws_gate_causal_"),
        cameraAerialAngle:
          campaignData?.clarifyAxesResolved?.cameraAerialAngle === true ||
          String(optionId).startsWith("vws_gate_camera_"),
      };
      const microPatch =
        optionId === "vws_gate_t0_pristine"
          ? { microAnswer: "from_nothing" }
          : optionId === "vws_gate_t0_in_progress"
            ? { microAnswer: "partially_built" }
            : {};
      if (optionId === "vws_gate_t0_pristine") setMicroAnswer("from_nothing");
      if (optionId === "vws_gate_t0_in_progress") setMicroAnswer("partially_built");
      const causalPatch =
        optionId === "vws_gate_causal_visible"
          ? { causalAgentSelection: "visible" }
          : optionId === "vws_gate_causal_automatic"
            ? { causalAgentSelection: "automatic" }
            : {};
      if (optionId === "vws_gate_causal_visible") setCausalAgentSelection("visible");
      if (optionId === "vws_gate_causal_automatic") setCausalAgentSelection("automatic");
      const cameraAerialPatch =
        optionId === "vws_gate_camera_top_down"
          ? { cameraAerialAngle: "top_down" }
          : optionId === "vws_gate_camera_angled"
            ? { cameraAerialAngle: "angled" }
            : {};
      if (optionId === "vws_gate_camera_top_down") setCameraAerialAngle("top_down");
      if (optionId === "vws_gate_camera_angled") setCameraAerialAngle("angled");
      onCampaignChange?.(
        buildCampaignSnapshot({
          clarificationHistory: nextHist,
          gateResult: null,
          clarifyAxesResolved: axesNext,
          ...microPatch,
          ...causalPatch,
          ...cameraAerialPatch,
        })
      );
      void handleRun(nextHist);
      return;
    }

    if (optionId === "clarify_apply" || optionId === "clarify_proceed") {
      setMicroQuestion(null);
      setError("");
      const nextHist =
        optionId === "clarify_apply"
          ? [...histBase, `Réponse utilisateur : précision saisie dans le champ idée (re-validation). Texte courant : ${idea.trim()}`]
          : [
              ...histBase,
              `L'utilisateur demande de continuer sans répondre à la dernière question structurée : "${gateResult?.question || ""}". Réévalue selon Clarify Gate ; ne renvoie VALID que si l'ambiguïté est levée sans cette réponse.`,
            ];
      setClarifyAnswer(optionId === "clarify_apply" ? idea : null);
      setGateResult(null);
      onCampaignChange?.(
        buildCampaignSnapshot({
          clarificationHistory: nextHist,
          gateResult: null,
          clarifyAnswer: optionId === "clarify_apply" ? idea : null,
          ...(optionId === "clarify_apply"
            ? { clarifyAxesResolved: { modeAgent: false, initialT0: false, causalAgent: false, cameraAerialAngle: false }, microAnswer: null }
            : {}),
        })
      );
      if (optionId === "clarify_apply") setMicroAnswer(null);
      void handleRun(nextHist);
      return;
    }
    if (optionId === "switch_timelapse" || optionId === "keep_realtime") {
      const nextTempo = optionId === "switch_timelapse" ? "timelapse" : tempo;
      if (optionId === "switch_timelapse") {
        setTempo("timelapse");
      }
      setTempoCompressionDecision(optionId);
      setMicroQuestion(null);
      onCampaignChange?.(
        buildCampaignSnapshot({
          tempo: nextTempo,
          tempoCompressionDecision: optionId,
        })
      );
      setError("");
      void handleRun(null, { tempo: nextTempo, tempoCompressionDecision: optionId });
      return;
    }
    if (optionId === "switch_24s" || optionId === "keep_8s") {
      const nextSequenceType = optionId === "switch_24s" ? "three_x_8s" : "single_8s";
      // #region agent log
      const __dbgA2_dba02a = {sessionId:'dba02a',runId:'pre-fix-1',hypothesisId:'A',location:'CampagneVWS.jsx:handleSelectMicroAnswer:switch_24s',message:'User answered microQuestion presentation_duration (switch_24s/keep_8s)',data:{optionId:String(optionId||''),nextSequenceType,prevSequenceType:String(sequenceType||''),tempoCompressionDecisionPrev:String(tempoCompressionDecision||''),videoFormatId:String(videoFormatId||'')},timestamp:Date.now()};
      fetch('http://127.0.0.1:7405/ingest/84f2a250-0990-480e-ba92-160ff926a4b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dba02a'},body:JSON.stringify(__dbgA2_dba02a)}).catch(()=>{});
      // #endregion agent log
      if (optionId === "switch_24s") {
        setSequenceType("three_x_8s");
      }
      setTempoCompressionDecision(optionId);
      setMicroQuestion(null);
      onCampaignChange?.(
        buildCampaignSnapshot({
          sequenceType: nextSequenceType,
          tempoCompressionDecision: optionId,
        })
      );
      setError("");
      void handleRun(null, {
        sequenceType: nextSequenceType,
        tempoCompressionDecision: optionId,
      });
      return;
    }
    if (optionId === "camera_view_subjective" || optionId === "camera_view_exterieure") {
      const nextCameraViewAngle =
        optionId === "camera_view_subjective" ? "subjective_portee" : "exterieure_filmee";
      setCameraViewAngle(nextCameraViewAngle);
      setMicroQuestion(null);
      onCampaignChange?.(
        buildCampaignSnapshot({
          cameraViewAngle: nextCameraViewAngle,
        })
      );
      setError("");
      void handleRun(null, { cameraViewAngle: nextCameraViewAngle });
      return;
    }
    if (optionId === "vws_cont_continuous" || optionId === "vws_cont_cuts") {
      const nextCont =
        optionId === "vws_cont_continuous" ? "continuous_single_take" : "cuts_allowed";
      setNarrativeContinuity(nextCont);
      setMicroQuestion(null);
      onCampaignChange?.(buildCampaignSnapshot({ narrativeContinuity: nextCont }));
      setError("");
      void handleRun(null, { narrativeContinuity: nextCont });
      return;
    }
    if (optionId === "vws_tl_pov_aerial" || optionId === "vws_tl_pov_ground" || optionId === "vws_tl_pov_both") {
      const nextPov =
        optionId === "vws_tl_pov_aerial"
          ? "aerial_drone"
          : optionId === "vws_tl_pov_ground"
            ? "ground_human"
            : "both_alternate";
      setTimelapseCameraPov(nextPov);
      setMicroQuestion(null);
      onCampaignChange?.(buildCampaignSnapshot({ timelapseCameraPov: nextPov }));
      setError("");
      void handleRun(null, { timelapseCameraPov: nextPov });
      return;
    }
    setMicroAnswer(optionId);
    onCampaignChange?.(buildCampaignSnapshot({ microAnswer: optionId }));
    setError("");
    void handleRun(null, { microAnswer: optionId });
  };

  const rerunAfterLocationConflict = (nextLieuValue = null) => {
    const conflict = locationConflict;
    if (!conflict) return;
    const resolvedLieu =
      nextLieuValue === "chez_client" ||
      nextLieuValue === "etablissement" ||
      nextLieuValue === "neutre"
        ? nextLieuValue
        : lieuTournage;
    if (resolvedLieu !== lieuTournage) {
      setLieuTournageState(resolvedLieu);
      onCampaignChange?.(buildCampaignSnapshot({ lieuTournage: resolvedLieu }));
    }
    setLocationConflict(null);
    void handleRun(conflict.clarificationHistoryOverride ?? null, conflict.runOverrides ?? null, {
      skipContradictionCheck: true,
      forceLieuTournage: resolvedLieu,
    });
  };

  useEffect(() => {
    if (!step1PrimaryRef) return undefined;
    step1PrimaryRef.current = {
      runPrepare: () => {
        void runWithAuth(handleRun);
      },
    };
    return () => {
      step1PrimaryRef.current = null;
    };
  }, [step1PrimaryRef, runWithAuth, handleRun]);

  return (
    <>
    <div
      className={`studio-panel box-border w-full min-w-0 max-w-full p-4 max-[640px]:p-2 sm:p-6 ${
        showFormatModal && formatPickerPresentation === "studioOverlay"
          ? "relative z-0 isolate min-h-[100dvh]"
          : ""
      }`}
    >
      <div className="mb-8 hidden min-[641px]:flex flex-col gap-3 md:mb-10">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-200 sm:text-base">
          <Sparkles className="h-4 w-4 shrink-0 text-cyan-400" />
          Étape 1 – Votre campagne vidéo
        </h2>
        <div className="flex justify-start">
          <button
            type="button"
            onClick={handleOpenCampagneAide}
            className="vws-campagne-aide-btn text-sm min-h-[44px] sm:min-h-0"
          >
            <BookOpen className="vws-campagne-aide-btn__icon shrink-0" />
            {showCampagneAidePulse ? (
              <span className="pulse-dot" aria-hidden="true" />
            ) : null}
            Aide pour commencer
          </button>
        </div>
      </div>

      {/* Aligné horizontalement avec .vws-campagne-form-scroll (padding 1rem sous 768px) */}
      <div className="mb-6 flex min-[641px]:hidden flex-col gap-3 px-4">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-200">
          <Sparkles className="h-4 w-4 shrink-0 text-cyan-400" />
          <span className="truncate">Étape 1 – Votre campagne vidéo</span>
        </h2>
        <div className="flex min-w-0 justify-start">
          <button
            type="button"
            onClick={handleOpenCampagneAide}
            className="vws-campagne-aide-btn min-w-0 max-w-full text-sm min-h-[44px]"
          >
            <BookOpen className="vws-campagne-aide-btn__icon shrink-0" />
            {showCampagneAidePulse ? <span className="pulse-dot" aria-hidden="true" /> : null}
            <span className="truncate">Aide pour commencer</span>
          </button>
        </div>
      </div>

      <div className="vws-campagne-form max-[640px]:pb-4">
        <div className="vws-campagne-form-scroll space-y-0">
          {/* Bloc 1 — Format (desktop) */}
          <div className="vws-campagne-block hidden min-[641px]:block">
            <div className="vws-campagne-format-card">
              {selectedFormatDef ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <p className="text-sm text-gray-300 sm:text-[15px]">
                    <span className="text-base mr-1" aria-hidden>
                      🎬
                    </span>
                    <span className="vws-campagne-format-name">{selectedFormatDef.name}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowFormatModal(true)}
                    className="vws-campagne-format-btn shrink-0"
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <button
                    type="button"
                    onClick={() => setShowFormatModal(true)}
                    className="vws-campagne-format-choose btn-vws-primary flex w-full min-h-[48px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold md:inline-flex md:w-auto md:min-h-[40px] md:self-start md:text-xs"
                  >
                    <Clapperboard className="h-3.5 w-3.5 shrink-0" />
                    Choisir un format
                  </button>
              )}
            </div>
          </div>

          {/* Bloc 1 — Format compact (mobile ≤640px) */}
          <div className="vws-campagne-block max-[640px]:block min-[641px]:hidden">
            <span className="vws-campagne-label vws-campagne-label--fmt-mobile block uppercase tracking-wide text-[#3e4870]">
              Format de vidéo
            </span>
            {selectedFormatDef ? (
              <button
                type="button"
                onClick={() => setShowFormatModal(true)}
                className="vws-campagne-fmtbtn-mobile mt-1 flex w-full items-center justify-between gap-2 rounded-xl border border-[#1e2845] bg-[#161d2e] px-2.5 py-2 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold leading-tight text-[#00d4a0]">
                    <span className="mr-1" aria-hidden>
                      🎬
                    </span>
                    {selectedFormatDef.name}
                  </div>
                  <div className="mt-0.5 text-[9px] leading-snug text-[#3e4870]">
                    {selectedFormatDef.description}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-semibold text-[#00d4a0]">Changer</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowFormatModal(true)}
                className="vws-mobile-flat-green-cta mt-1 flex w-full items-center justify-center gap-2 text-center"
              >
                <span aria-hidden>🎬</span>
                Choisir un format
              </button>
            )}
          </div>

          {/* Bloc 2 — Métier + Durée */}
          <div className="vws-campagne-block">
            <div className="mt-0 grid grid-cols-2 max-[640px]:mt-3 max-[640px]:gap-[6px] gap-x-3 md:grid-cols-2 md:gap-x-8 md:gap-y-6">
              <div className="min-w-0">
                {isProductMode ? (
                  <>
                    <label className="vws-campagne-label" htmlFor="campagne-nom-produit">
                      Nom du produit
                    </label>
                    <input
                      id="campagne-nom-produit"
                      type="text"
                      value={profession}
                      onChange={(e) => setProfessionPlain(e.target.value)}
                      className="vws-campagne-field vws-campagne-field--touch vws-campagne-select-grid-mobile"
                      placeholder="ex. Colle XtraGrip, livre de cuisine…"
                      autoComplete="off"
                    />
                  </>
                ) : (
                  <>
                    <label className="vws-campagne-label" htmlFor="campagne-metier">
                      Ton métier
                    </label>
                    <MetierCombobox
                      id="campagne-metier"
                      value={profession}
                      onChange={setProfession}
                      placeholder="Rechercher un métier…"
                      className="vws-campagne-select-grid-mobile"
                      aria-describedby={metierProfile ? "campagne-metier-hint" : undefined}
                    />
                    {metierProfile ? (
                      <p className="vws-campagne-metier-hint min-[641px]:block max-[640px]:hidden" id="campagne-metier-hint">
                        Ambiance typique pour ce métier (pour aider à imaginer la scène) :{" "}
                        {metierProfile.environmentHint}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              <div className="min-w-0">
                <label className="vws-campagne-label" htmlFor="campagne-duree">
                  Durée de la vidéo
                </label>
                <CampagneDureeSelect
                  id="campagne-duree"
                  value={sequenceType === "three_x_8s" ? "single_8s" : sequenceType}
                  onChange={(v) => {
                    if (v === "three_x_8s") return;
                    // #region agent log
                    const __dbgA_dba02a = {sessionId:'dba02a',runId:'pre-fix-1',hypothesisId:'A',location:'CampagneVWS.jsx:sequenceType:onChange',message:'User changed sequenceType select (duration choice)',data:{nextSequenceType:String(v||''),prevSequenceType:String(sequenceType||''),tempo:String(tempo||''),videoFormatId:String(videoFormatId||'')},timestamp:Date.now()};
                    fetch('http://127.0.0.1:7405/ingest/84f2a250-0990-480e-ba92-160ff926a4b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dba02a'},body:JSON.stringify(__dbgA_dba02a)}).catch(()=>{});
                    // #endregion agent log
                    // #region agent log
                    const __dbgA = {sessionId:'0480cf',runId:'pre-fix-1',hypothesisId:'A',location:'CampagneVWS.jsx:1475',message:'User changed sequenceType',data:{nextSequenceType:v,prevSequenceType:sequenceType,videoFormatId:String(videoFormatId||''),tempo:String(tempo||'')},timestamp:Date.now()};
                    console.debug("[debug-0480cf]", __dbgA);
                    fetch('http://127.0.0.1:7405/ingest/84f2a250-0990-480e-ba92-160ff926a4b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0480cf'},body:JSON.stringify(__dbgA)}).catch((e)=>{console.debug("[debug-0480cf] ingest failed", e?.message||String(e));});
                    // #endregion agent log
                    setSequenceType(v);
                    onCampaignChange?.(buildCampaignSnapshot({ sequenceType: v }));
                  }}
                  className="vws-campagne-field vws-campagne-select vws-campagne-field--touch vws-campagne-select-grid-mobile"
                />
              </div>
            </div>
            {!isProductMode && metierProfile ? (
              <div className="mt-1.5 hidden rounded-xl border border-[#1e2845] bg-[#161d2e] px-[9px] py-[7px]">
                <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-[#3e4870]">
                  Ambiance typique
                </span>
                <p className="m-0 text-[9px] leading-[1.4] text-[#3e4870]">{metierProfile.environmentHint}</p>
              </div>
            ) : null}
          </div>

          {!isProductMode ? (
            <>
              <div
                className="h-px w-full bg-white/10"
                style={{ marginTop: "32px", marginBottom: "16px" }}
                aria-hidden="true"
              />

              <div className="vws-campagne-block">
                <div className="flex items-center gap-2">
                  <label className="vws-campagne-label !mb-0" htmlFor="campagne-lieu-tournage">
                    Où se passe la vidéo ?
                  </label>
                  <span className="relative inline-flex items-center group shrink-0">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-cyan-500/35 bg-cyan-500/10 text-[10px] font-semibold text-cyan-200 cursor-help">
                      i
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-72 -translate-x-1/2 rounded-lg border border-cyan-500/25 bg-[#0d1a22] px-2.5 py-2 text-[11px] leading-snug text-cyan-100 shadow-lg group-hover:block">
                      Le lieu du menu est la source officielle utilisée dans la génération.
                    </span>
                  </span>
                </div>
                <select
                  id="campagne-lieu-tournage"
                  value={lieuTournage}
                  onChange={(e) => setLieuTournage(e.target.value)}
                  className="vws-campagne-field vws-campagne-select vws-campagne-field--touch"
                >
                  {LIEU_TOURNAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400" style={{ marginTop: "6px", marginBottom: "12px" }}>
                  Sélectionne l'environnement principal de la scène. Le texte d'idée enrichit la scène sans redéfinir ce lieu.
                </p>
              </div>

              <div
                className="h-px w-full bg-white/10"
                style={{ marginBottom: "16px" }}
                aria-hidden="true"
              />
            </>
          ) : (
            <>
              <div
                className="h-px w-full bg-white/10"
                style={{ marginTop: "32px", marginBottom: "16px" }}
                aria-hidden="true"
              />
              <div className="vws-campagne-block" style={{ marginBottom: "12px" }}>
                <div className="vws-campagne-label mb-2">Décor de la scène</div>
                {!selectedProductDecor ? (
                  <button
                    type="button"
                    onClick={() => setShowDecorModal(true)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border border-dashed border-white/25 bg-[#161d2e] px-3 py-2.5 text-left transition-colors hover:border-emerald-500/50"
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10"
                      aria-hidden
                    >
                      <MapPin className="h-4 w-4 text-sky-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-gray-100">
                        Choisir un décor — Chambre, nature, rue, désert…
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                  </button>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-[10px] border border-emerald-500/45 bg-[#161d2e] px-3 py-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10"
                      aria-hidden
                    >
                      <ProductCampagneLucideIcon
                        name={selectedProductDecor.iconId}
                        className="h-4 w-4 text-sky-400"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400/95">
                        {decorCategoryLabelFr(selectedProductDecor.category)}
                      </div>
                      <div className="text-[12px] font-semibold text-white">{selectedProductDecor.name}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] font-medium">
                      <button
                        type="button"
                        className="text-emerald-400 hover:underline"
                        onClick={() => setShowDecorModal(true)}
                      >
                        Changer
                      </button>
                      <button
                        type="button"
                        className="text-gray-500 hover:text-red-400"
                        onClick={() => {
                          setProductSceneDecorId(null);
                          onCampaignChange?.(buildCampaignSnapshot({ productSceneDecorId: null }));
                        }}
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Bloc 3 — Idée principale */}
          <div
            className="vws-campagne-block vws-campagne-block--idea"
            style={isMobile ? { marginTop: "16px" } : {}}
          >
            <div
              className="vws-campagne-idea-heading-row flex flex-row items-center justify-between gap-2 md:items-start md:gap-4"
              style={isMobile ? { marginTop: "16px" } : {}}
            >
              <label
                className="vws-campagne-label vws-campagne-label--idea mb-0 min-w-0 flex-1 pr-2 md:flex-none md:pr-0 md:pt-0.5"
                htmlFor={isProductMode ? "campagne-promesse" : "campagne-idee"}
              >
                {isProductMode ? (
                  <>
                    <span className="md:hidden">Promesse</span>
                    <span className="hidden md:inline">Promesse du produit</span>
                  </>
                ) : (
                  <>
                    <span className="md:hidden">Ta scène</span>
                    <span className="hidden md:inline">
                      Idée principale de la scène (sujet + action)
                    </span>
                  </>
                )}
              </label>
              <button
                type="button"
                onClick={() => void runWithAuth(handleInspire)}
                disabled={inspireLoading || (!videoFormatId && !campaignData?.videoFormatId)}
                title={
                  !String(profession ?? "").trim() &&
                  !String(campaignData?.profession ?? "").trim()
                    ? isProductMode
                      ? "Indique d’abord le nom du produit pour utiliser cette action."
                      : "Choisis d’abord ton métier pour utiliser cette action."
                    : !videoFormatId && !campaignData?.videoFormatId
                      ? "Choisis d’abord un format vidéo."
                      : undefined
                }
                className="vws-campagne-inspire-btn inline-flex shrink-0 items-center gap-1.5 disabled:opacity-50 self-center md:self-auto"
              >
                {inspireLoading &&
                (!inspireProductAwaitingDelayedSpinner || inspireDelayedSpinnerVisible) ? (
                  <span className="vws-campagne-inspire-spinner shrink-0" aria-hidden />
                ) : (
                  <Sparkles className="h-3 w-3 shrink-0" />
                )}
                M&apos;inspirer →
              </button>
            </div>
            {isProductMode ? (
              <>
                <input
                  id="campagne-promesse"
                  type="text"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  className="vws-campagne-field vws-campagne-field--touch mt-1.5 w-full"
                  placeholder={productPromessePlaceholder}
                  autoComplete="off"
                />
                {inspirePromesseHint ? (
                  <p className="mt-1.5 text-[11px] leading-snug text-gray-500">{inspirePromesseHint}</p>
                ) : null}
                <hr className="my-6 border-0 border-t border-white/10 max-[640px]:my-4" />
                <div className="mb-2">
                  <div className="vws-campagne-label mb-2 flex flex-wrap items-center gap-2">
                    <span>Hook d&apos;accroche</span>
                    <span className="rounded-md border border-white/10 bg-[#161d2e] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#8a8f9a]">
                      optionnel
                    </span>
                  </div>
                  {selectedProductHook ? (
                    <div className="flex items-center gap-2.5 rounded-[10px] border border-emerald-500/45 bg-[#161d2e] px-3 py-2.5">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10"
                        aria-hidden
                      >
                        <ProductCampagneLucideIcon
                          name={selectedProductHook.iconId}
                          className="h-4 w-4 text-emerald-400"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-[11px] font-semibold uppercase tracking-wide ${
                            selectedProductHook.category === "stunt"
                              ? "text-red-400/90"
                              : "text-violet-400/90"
                          }`}
                        >
                          {hookCategoryLabelFr(selectedProductHook.category)}
                        </div>
                        <div className="text-[12px] font-semibold text-white">{selectedProductHook.name}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] font-medium">
                        <button
                          type="button"
                          className="text-emerald-400 hover:underline"
                          onClick={() => setShowHookModal(true)}
                        >
                          Changer
                        </button>
                        <button
                          type="button"
                          className="text-gray-500 hover:text-red-400"
                          onClick={() => {
                            setProductOpeningHookId(null);
                            onCampaignChange?.(buildCampaignSnapshot({ productOpeningHookId: null }));
                          }}
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                  ) : isExplicitNoProductHook ? (
                    <div className="flex items-center gap-2.5 rounded-[10px] border border-emerald-500/35 bg-[#161d2e] px-3 py-2.5">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#0f1420]"
                        aria-hidden
                      >
                        <Zap className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8f9a]">
                          Optionnel
                        </div>
                        <div className="text-[12px] font-semibold text-white">Pas de hook</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] font-medium">
                        <button
                          type="button"
                          className="text-emerald-400 hover:underline"
                          onClick={() => setShowHookModal(true)}
                        >
                          Changer
                        </button>
                        <button
                          type="button"
                          className="text-gray-500 hover:text-red-400"
                          onClick={() => {
                            setProductOpeningHookId(null);
                            onCampaignChange?.(buildCampaignSnapshot({ productOpeningHookId: null }));
                          }}
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowHookModal(true)}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border border-dashed border-white/25 bg-[#161d2e] px-3 py-2.5 text-left transition-colors hover:border-emerald-500/50"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10"
                        aria-hidden
                      >
                        <Zap className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-gray-100">
                          Choisir un hook pour les 3 premières secondes
                        </div>
                        <div className="mt-0.5 text-[10px] leading-snug text-[#8a8f9a]">
                          Les 3 premières secondes décident si la vidéo est regardée ou skippée.
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                    </button>
                  )}
                </div>
                <hr className="my-6 border-0 border-t border-white/10 max-[640px]:my-4" />
                <div className="mt-0 mb-8 max-[640px]:mb-6 md:mb-10">
                  <span className="vws-campagne-label mb-2 block">Mise en scène</span>
                  <div className="flex flex-wrap gap-2">
                    {productMiseOptions.map((opt) => {
                      const selected = stagingChips[0] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => selectProductMiseEnScene(opt.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all duration-150 ${
                            selected
                              ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                              : "border-[#1e2845] bg-[#161d2e] text-gray-300 hover:border-[#2a3555]"
                          }`}
                        >
                          <ProductCampagneLucideIcon name={opt.iconId} className="h-3.5 w-3.5 shrink-0 opacity-90" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {productMiseNotice ? (
                    <p className="mt-2 flex gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-2 text-[11px] leading-snug text-emerald-100/90">
                      <span className="shrink-0 text-emerald-400" aria-hidden>
                        ℹ
                      </span>
                      <span>{productMiseNotice}</span>
                    </p>
                  ) : null}
                </div>
              </>
            ) : (
              <textarea
                ref={ideaTextareaRef}
                id="campagne-idee"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                onInput={adjustIdeaTextareaHeightMobile}
                className="vws-campagne-field vws-campagne-textarea vws-campagne-textarea-mobile vws-campagne-idea-textarea vws-campagne-idea-textarea--auto-mobile mt-1.5 w-full"
                placeholder={ideaPlaceholder}
              />
            )}
          </div>

          {/* Bloc 4 — Précisions + Dialogue */}
          <div className="vws-campagne-block space-y-6 max-[640px]:space-y-2 max-md:space-y-7">
            <div style={isMobile ? { marginTop: "16px" } : {}}>
              <label className="vws-campagne-label" htmlFor="campagne-precisions">
                <span className="md:hidden">Précisions</span>
                <span className="hidden md:inline">
                  Précisions (ambiance, lumière, style…)
                </span>
              </label>
              <input
                id="campagne-precisions"
                type="text"
                value={styleDetails}
                onChange={(e) => {
                  const nextVal = e.target.value;
                  setStyleDetails(nextVal);
                  onCampaignChange?.(buildCampaignSnapshot({ styleDetails: nextVal }));
                }}
                className="vws-campagne-field vws-campagne-field--touch"
                placeholder={stylePlaceholder}
              />
            </div>
            <div className="vws-campagne-dialogue-row border border-[#222] rounded-xl bg-[#111]">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-200">Dialogue activé</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isProductMode ? (
                    getDialogueDefaultForMiseId(stagingChips[0]) ? (
                      <>ON par défaut — modifiable</>
                    ) : (
                      <>OFF par défaut — modifiable</>
                    )
                  ) : (
                    <>Modifiable dans Vidéo virale</>
                  )}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={dialogueEnabled}
                onClick={() => {
                  const next = !dialogueEnabled;
                  setDialogueEnabled(next);
                  onCampaignChange?.(buildCampaignSnapshot({ dialogueEnabled: next }));
                }}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                  dialogueEnabled ? "bg-emerald-500/80" : "bg-white/20"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    dialogueEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Question/réponses sous Dialogue — marginTop inline : 24px desktop / 16px mobile */}
          {microQuestion ? (
            <div
              className="vws-campagne-micro-question space-y-3"
              style={{ marginTop: isDesktop ? "24px" : "16px" }}
            >
              <div className="flex items-start gap-2">
                <p className="text-sm text-gray-300">{microQuestion.question}</p>
                {microQuestion.info ? (
                  <span className="relative inline-flex items-center group shrink-0 mt-0.5">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-cyan-500/35 bg-cyan-500/10 text-[10px] font-semibold text-cyan-200 cursor-help">
                      i
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-72 -translate-x-1/2 rounded-lg border border-cyan-500/25 bg-[#0d1a22] px-2.5 py-2 text-[11px] leading-snug text-cyan-100 shadow-lg group-hover:block">
                      {microQuestion.info}
                    </span>
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                {microQuestion.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectMicroAnswer(opt.id)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-all duration-150 ${
                      microAnswer === opt.id
                        ? "card-vws-active text-emerald-300"
                        : "card-vws text-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <p
              className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3"
              style={{ marginTop: "12px", marginBottom: "12px" }}
            >
              {error}
            </p>
          ) : null}
        </div>

        {/* Bloc 5 — CTA : marge réduite si erreur déjà présente (mb-5) pour éviter double vide */}
        <div
          className={`vws-campagne-cta-row vws-campagne-cta-row--inline flex flex-row flex-wrap items-center gap-3 min-[641px]:justify-start ${
            error
              ? "mt-0 max-[640px]:mt-0"
              : "mt-8 max-[640px]:mt-8 min-[641px]:mt-10"
          }`}
          style={error ? { marginTop: "8px" } : {}}
        >
          <button
            type="button"
            onClick={() => void runWithAuth(handleRun)}
            disabled={
              loading || scriptGenerationPending || awaitingStep1Validation || !videoFormatId
            }
            title={
              awaitingStep1Validation && !loading && !scriptGenerationPending
                ? "Valide l’étape Campagne avec le bouton en haut de page pour continuer."
                : !videoFormatId
                  ? "Choisis d’abord un format vidéo."
                  : undefined
            }
            className="vws-campagne-cta-primary max-[640px]:min-w-0 max-[640px]:flex-1 inline-flex items-center justify-center gap-2 btn-vws-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            {loading
              ? "Préparation en cours…"
              : scriptGenerationPending
                ? "Génération du script…"
                : awaitingStep1Validation
                  ? "Étape prête — valide ci-dessus"
                  : "Préparer ma vidéo"}
          </button>
          {typeof onCampagneFullReset === "function" ? (
            <button
              type="button"
              onClick={() => onCampagneFullReset()}
              className="vws-campagne-reset vws-campagne-cta-secondary shrink-0 rounded-xl btn-vws-secondary"
            >
              Réinitialiser
            </button>
          ) : null}
        </div>

      </div>

      <ModaleChoixFormatVideo
        open={showFormatModal}
        onClose={() => setShowFormatModal(false)}
        professionLabel={profession}
        onConfirm={applyVideoFormatChoice}
        presentation={formatPickerPresentation === "studioOverlay" ? "studioOverlay" : "portal"}
      />
      <ModaleChoixDecorProduit
        open={showDecorModal}
        onClose={() => setShowDecorModal(false)}
        presentation={formatPickerPresentation === "studioOverlay" ? "studioOverlay" : "portal"}
        currentId={productSceneDecorId}
        priorityIds={decorPriorityIds}
        onSelect={(id) => {
          setProductSceneDecorId(id);
          onCampaignChange?.(buildCampaignSnapshot({ productSceneDecorId: id }));
        }}
      />
      <ModaleChoixHookProduit
        open={showHookModal}
        onClose={() => setShowHookModal(false)}
        presentation={formatPickerPresentation === "studioOverlay" ? "studioOverlay" : "portal"}
        currentId={productOpeningHookId === "none" ? null : productOpeningHookId}
        onSelect={(id) => {
          const next = id === null ? "none" : id;
          setProductOpeningHookId(next);
          onCampaignChange?.(buildCampaignSnapshot({ productOpeningHookId: next }));
        }}
      />
    </div>

    {locationConflict ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={() => setLocationConflict(null)}
        role="presentation"
      >
        <div
          className="studio-panel max-w-xl w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="campagne-vws-lieu-conflict-title"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 id="campagne-vws-lieu-conflict-title" className="text-base font-semibold text-gray-200">
              Où se passe exactement la scène ?
            </h2>
            <button
              type="button"
              onClick={() => setLocationConflict(null)}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors shrink-0"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-300">
              Tu as sélectionné <strong>{locationConflict.selectedLabel}</strong> mais ta description mentionne{" "}
              <strong>{locationConflict.detectedLabel}</strong>. Lequel correspond à ce que tu veux ?
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => rerunAfterLocationConflict(locationConflict.selectedValue)}
                className="w-full px-4 py-2 rounded-lg btn-vws-primary font-semibold text-left"
              >
                {locationConflict.selectedLabel}
              </button>
              <button
                type="button"
                onClick={() => rerunAfterLocationConflict(locationConflict.detectedValue)}
                className="w-full px-4 py-2 rounded-lg btn-vws-secondary text-left"
              >
                {locationConflict.detectedLabel}
              </button>
              <button
                type="button"
                onClick={() => setLocationConflict(null)}
                className="w-full px-4 py-2 rounded-lg btn-vws-secondary text-gray-300"
              >
                Corriger moi-même
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : null}

    <CampagneVwsExplicationSheet open={showCampagneExplication} onClose={closeCampagneExplication} />
    </>
  );
}

const CAMPAGNE_DUREE_OPTIONS = [
  { value: "single_8s", label: "8 secondes" },
  { value: "three_x_8s", label: "24 secondes", disabled: true },
];

function CampagneDureeSelect({ id, value, onChange, className = "" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  const safeValue = value === "three_x_8s" ? "single_8s" : value;
  const selectedLabel =
    CAMPAGNE_DUREE_OPTIONS.find((opt) => opt.value === safeValue)?.label ?? "8 secondes";
  const enabledOptions = CAMPAGNE_DUREE_OPTIONS.filter((opt) => !opt.disabled);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSelect = (nextValue) => {
    const option = CAMPAGNE_DUREE_OPTIONS.find((opt) => opt.value === nextValue);
    if (!option || option.disabled) return;
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="vws-campagne-duree-select">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`vws-campagne-duree-select__trigger ${className}`.trim()}
      >
        {selectedLabel}
      </button>
      {open ? (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          aria-labelledby={id}
          className="vws-campagne-duree-select__dropdown"
        >
          {CAMPAGNE_DUREE_OPTIONS.map((opt) => {
            const isSelected = safeValue === opt.value;
            const optionClassName = [
              "vws-campagne-duree-select__option",
              isSelected && !opt.disabled ? "vws-campagne-duree-select__option--selected" : "",
              opt.disabled ? "vws-campagne-duree-select__option--disabled" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled || undefined}
                  disabled={opt.disabled}
                  tabIndex={opt.disabled ? -1 : 0}
                  className={optionClassName}
                  onClick={() => handleSelect(opt.value)}
                  onKeyDown={(event) => {
                    if (opt.disabled) {
                      event.preventDefault();
                      return;
                    }
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleSelect(opt.value);
                      return;
                    }
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      const currentIndex = enabledOptions.findIndex((item) => item.value === opt.value);
                      if (currentIndex < 0) return;
                      const delta = event.key === "ArrowDown" ? 1 : -1;
                      const nextIndex =
                        (currentIndex + delta + enabledOptions.length) % enabledOptions.length;
                      const nextOption = enabledOptions[nextIndex];
                      rootRef.current
                        ?.querySelector(`[data-duree-value="${nextOption.value}"]`)
                        ?.focus();
                    }
                  }}
                  data-duree-value={opt.value}
                >
                  <span>{opt.label}</span>
                  {opt.disabled ? (
                    <span className="vws-campagne-duree-select__badge">Bientôt</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
