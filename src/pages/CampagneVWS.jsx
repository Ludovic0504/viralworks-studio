import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./CampagneVWS.css";
import {
  clarifyIdea,
  clarifyGateNeedsInitialT0,
  clarifyGateNeedsCameraAerialAngle,
  clarifyGateNeedsCausalAgent,
  clarifyGateNeedsModeAgent,
  inferGlobalIntent,
  runVwsPromptEngine,
} from "../bibliotheque/vwsPromptEngine";
import { generateResponse } from "@/bibliotheque/openai/chatgpt-client";
import {
  VWS_METIER_LABELS,
  getVwsMetierProfile,
} from "@/bibliotheque/vwsMetiersConfig";
import {
  createDefaultCampaignGenerationSpec,
  stampCampaignGenerationMeta,
} from "@/bibliotheque/campaignGenerationSpec";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { Sparkles, BookOpen, X, Clapperboard } from "lucide-react";
import ModaleChoixFormatVideo from "../composants/campagne/ModaleChoixFormatVideo.jsx";
import {
  getFormatById,
  getFormatHintForEngine,
} from "../bibliotheque/vwsVideoFormatsCatalog";
import {
  formatVideoFormatParamsPromptAppendix,
  getVideoFormatConfigForCatalogId,
} from "@/config/videoFormats";

const VALID_TEMPOS = new Set(["real_time", "timelapse", "slow_motion"]);

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

const PROFESSION_TO_LIEU_TOURNAGE = {
  "Plombier": "chez_client",
  "Électricien": "chez_client",
  "Chauffagiste / climatisation": "chez_client",
  "Menuisier": "chez_client",
  "Maçon": "chez_client",
  "Restaurateur": "etablissement",
  "Coiffeur / barbier": "etablissement",
  "Garagiste / mécanicien": "etablissement",
  "Magasin de meubles / décoration": "etablissement",
  "Coach sportif / salle de sport": "etablissement",
  "Agent immobilier": "neutre",
  "Pisciniste": "neutre",
  "Paysagiste / jardinier": "neutre",
  "Couvreur": "neutre",
  "Architecte / architecte d'intérieur": "neutre",
};

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
  const [styleDetails, setStyleDetails] = useState(campaignData?.styleDetails ?? "");
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
  const [initialStateSelection, setInitialStateSelection] = useState(
    campaignData?.initialStateSelection ?? null
  );
  const [gateResult, setGateResult] = useState(campaignData?.gateResult ?? null);
  const [clarifyAnswer, setClarifyAnswer] = useState(campaignData?.clarifyAnswer ?? null);

  const [loading, setLoading] = useState(false);
  const [inspireLoading, setInspireLoading] = useState(false);
  const [error, setError] = useState("");
  const [microQuestion, setMicroQuestion] = useState(null);
  const [microAnswer, setMicroAnswer] = useState(campaignData?.microAnswer ?? null);
  const [tempoCompressionDecision, setTempoCompressionDecision] = useState(
    campaignData?.tempoCompressionDecision ?? null
  );
  const [showSystemVideo, setShowSystemVideo] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [videoFormatId, setVideoFormatId] = useState(campaignData?.videoFormatId ?? null);
  const [locationConflict, setLocationConflict] = useState(null);

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

  const ideaTextareaRef = useRef(null);
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

  useLayoutEffect(() => {
    adjustIdeaTextareaHeightMobile();
  }, [idea]);

  // Vidéo explicative non versionnée dans certains clones.
  const explicationCampagneVwsVideo = "";

  const metierProfile = useMemo(() => getVwsMetierProfile(profession), [profession]);
  const selectedFormatDef = useMemo(() => getFormatById(videoFormatId), [videoFormatId]);
  const ideaPlaceholder =
    selectedFormatDef?.placeholderIdea ??
    "Ex : un architecte explique son nouveau projet à la caméra dans son studio, tout en dessinant les plans sur une tablette…";
  const stylePlaceholder =
    metierProfile?.stylePlaceholder ??
    "Ex. : ambiance, lumière, style visuel, matériaux…";

  const buildCampaignSnapshot = (overrides = {}) => ({
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
    ...overrides,
  });

  const setProfession = (v) => {
    setProfessionState(v);
    const prefillLieu = PROFESSION_TO_LIEU_TOURNAGE[v];
    const nextLieu = prefillLieu || lieuTournage;
    if (prefillLieu) setLieuTournageState(prefillLieu);
    onCampaignChange?.(buildCampaignSnapshot({ profession: v, ...(prefillLieu ? { lieuTournage: nextLieu } : {}) }));
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
    if (updates.tempo !== undefined) setTempo(normalizeTempo(updates.tempo));
    if (updates.cameraFixed !== undefined) setCameraFixed(updates.cameraFixed);
    if (updates.revealMode !== undefined) setRevealMode(updates.revealMode);
    if (updates.cinematicMovement !== undefined) setCinematicMovement(updates.cinematicMovement);
    if (updates.selfieMode !== undefined) setSelfieMode(updates.selfieMode);
    if (updates.sequenceType !== undefined) setSequenceType(updates.sequenceType);
    if (updates.causalAgentSelection !== undefined) setCausalAgentSelection(updates.causalAgentSelection);
    if (updates.cameraAerialAngle !== undefined) setCameraAerialAngle(updates.cameraAerialAngle);
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
        cameraViewAngle:
          updates.cameraViewAngle ?? cameraViewAngle,
        initialStateSelection:
          updates.initialStateSelection ?? initialStateSelection,
        gateResult: updates.gateResult ?? gateResult,
        clarifyAnswer: updates.clarifyAnswer ?? clarifyAnswer,
        isClarified: updates.isClarified ?? false,
        videoFormatId: updates.videoFormatId !== undefined ? updates.videoFormatId : videoFormatId,
      })
    );
  };

  const applyVideoFormatChoice = (formatId) => {
    const fmt = getFormatById(formatId);
    if (!fmt) return;
    const r = fmt.rendering;
    syncState({
      videoFormatId: formatId,
      tempo: normalizeTempo(r.tempo),
      sequenceType: r.sequenceType,
      cameraFixed: r.cameraFixed,
      revealMode: r.revealMode,
      cinematicMovement: r.cinematicMovement,
      selfieMode: r.selfieMode,
    });
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
    const effectiveProfession =
      String(profession ?? "").trim() ||
      String(campaignData?.profession ?? "").trim();
    const effectiveFormatId = videoFormatId || campaignData?.videoFormatId || null;

    if (!effectiveProfession) {
      setError(
        "Sélectionne d’abord ton métier dans la liste « Ton métier » pour utiliser « M'inspirer »."
      );
      return;
    }
    if (!effectiveFormatId || !getFormatById(effectiveFormatId)) {
      setError("Choisis d’abord un format vidéo avec « Choisir un format ».");
      return;
    }
    const metier = effectiveProfession;
    setInspireLoading(true);
    setError("");
    try {
      const systemPrompt = "Tu appliques strictement le prompt utilisateur et tu réponds uniquement par la scène demandée.";
      const selectedLieu = getLieuOption(lieuTournage);
      const selectedFormatLabel = getFormatById(effectiveFormatId)?.name || "Format non défini";
      const userPrompt = `Tu es un expert en création de vidéos courtes pour les réseaux sociaux.
Génère une idée de scène vidéo de 8 secondes pour un ${metier}
qui travaille ${selectedLieu.sentence}

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
      const response = await generateResponse(userPrompt, systemPrompt, {
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
      const ideaWithSceneContext = `LIEU DE LA SCÈNE : ${selectedLieu.sentence}

DESCRIPTION DE LA SCÈNE : ${safeIdea}`;

      const shouldSkipContradictionCheck = flowOptions?.skipContradictionCheck === true;
      if (!shouldSkipContradictionCheck && safeIdea) {
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
      const payload = {
        profession: safeProfession,
        idea: ideaWithSceneContext,
        styleDetails: styleDetails.trim() || "",
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
            modifiers: styleDetails.trim(),
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
          modifiers: styleDetails.trim(),
          tempoSelection: effectiveTempo,
          clarificationHistory: histJoined,
          gatePhase: phase,
          formatContextAppendix: formatParamsAppendix || null,
        });

        if (gate.status === "NEEDS_CLARIFICATION") {
          const precheck = await checkGateQuestionAlreadyAnswered({
            formatLabel: selectedFormatLabel,
            lieuSentence: selectedLieu.sentence,
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
      if (!effectiveCameraViewAngle && !isPubliciteProduitFormat) {
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
            "Passer en 24 secondes active 3 scènes (3 x 8s) et consomme 3 crédits au total au lieu de 1.",
          options: [
            { id: "switch_24s", label: "Oui, passer en 24 sec" },
            { id: "keep_8s", label: "Non, garder 8 sec" },
          ],
        });
        setError("Choisis une durée adaptée à cette présentation.");
        return;
      }

      if (
        effectiveTempo !== "timelapse" &&
        !effectiveTempoCompressionDecision &&
        isIdeaTooDenseForRealtime(ideaWithSceneContext)
      ) {
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

      const brain = runVwsPromptEngine({
        profession: safeProfession,
        idea: ideaWithSceneContext,
        styleDetails: styleDetails.trim() || undefined,
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
        localStorage.setItem(
          "vws_brain_v2_last",
          JSON.stringify({
            input: {
              profession: safeProfession,
              idea: ideaWithSceneContext,
              styleDetails: styleDetails.trim() || "",
              tempo: effectiveTempo,
              cameraFixed,
              revealMode,
              cinematicMovement,
              selfieMode,
              sequenceType: effectiveSequenceType,
              dialogueEnabled,
              microAnswer: microForBrain,
              tempoCompressionDecision: effectiveTempoCompressionDecision,
            },
            brain,
          })
        );
      } catch (err) {
        void err;
      }

      const clarificationMode = gate?.status === "VALID" ? gate?.mode ?? null : null;
      const clarificationDiagnostic =
        gate?.status === "VALID" ? gate?.diagnostic ?? null : null;
      const finalPayloadSpec = stampCampaignGenerationMeta({
        ...createDefaultCampaignGenerationSpec(),
        campaign: {
          ...createDefaultCampaignGenerationSpec().campaign,
          profession: safeProfession,
          video_format_id: videoFormatId,
          location_type: selectedLieu.value,
          core_idea: ideaWithSceneContext,
          style_details: styleDetails.trim() || "",
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
        lieuTournage: selectedLieu.value,
        idea: ideaWithSceneContext,
        styleDetails: styleDetails.trim() || "",
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
      setError(e?.message || "Une erreur s’est produite pendant la préparation.");
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
      <div className="hidden min-[641px]:flex flex-wrap items-center justify-between gap-4 mb-8 md:mb-10">
        <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2 sm:text-base">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          Étape 1 – Votre campagne vidéo
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSystemVideo(true)}
            className="studio-toolbar-btn !py-1.5 !px-3 text-sm min-h-[44px] sm:min-h-0"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            Explication du système
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
                <label className="vws-campagne-label" htmlFor="campagne-metier">
                  Ton métier
                </label>
                <select
                  id="campagne-metier"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  className="vws-campagne-field vws-campagne-select vws-campagne-field--touch vws-campagne-select-grid-mobile"
                  aria-describedby={metierProfile ? "campagne-metier-hint" : undefined}
                >
                  <option value="">Choisir un métier...</option>
                  {VWS_METIER_LABELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                {metierProfile ? (
                  <p className="vws-campagne-metier-hint min-[641px]:block max-[640px]:hidden" id="campagne-metier-hint">
                    Ambiance typique pour ce métier (pour aider à imaginer la scène) :{" "}
                    {metierProfile.environmentHint}
                  </p>
                ) : null}
              </div>
              <div className="min-w-0">
                <label className="vws-campagne-label" htmlFor="campagne-duree">
                  Durée de la vidéo
                </label>
                <select
                  id="campagne-duree"
                  value={sequenceType}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSequenceType(v);
                    onCampaignChange?.({
                      profession,
                      idea,
                      styleDetails,
                      tempo,
                      cameraFixed,
                      revealMode,
                      cinematicMovement,
                      selfieMode,
                      sequenceType: v,
                      dialogueEnabled,
                      microAnswer,
                      tempoCompressionDecision,
                    });
                  }}
                  className="vws-campagne-field vws-campagne-select vws-campagne-field--touch vws-campagne-select-grid-mobile"
                >
                  <option value="single_8s">Une courte vidéo (8 secondes)</option>
                  <option value="three_x_8s">
                    Une vidéo plus longue (plusieurs moments à la suite)
                  </option>
                </select>
              </div>
            </div>
            {metierProfile ? (
              <div className="mt-1.5 hidden rounded-xl border border-[#1e2845] bg-[#161d2e] px-[9px] py-[7px]">
                <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-[#3e4870]">
                  Ambiance typique
                </span>
                <p className="m-0 text-[9px] leading-[1.4] text-[#3e4870]">{metierProfile.environmentHint}</p>
              </div>
            ) : null}
          </div>

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
                htmlFor="campagne-idee"
              >
                <span className="md:hidden">Ta scène</span>
                <span className="hidden md:inline">
                  Idée principale de la scène (sujet + action)
                </span>
              </label>
              <button
                type="button"
                onClick={() => void runWithAuth(handleInspire)}
                disabled={inspireLoading || (!videoFormatId && !campaignData?.videoFormatId)}
                title={
                  !String(profession ?? "").trim() &&
                  !String(campaignData?.profession ?? "").trim()
                    ? "Choisis d’abord ton métier pour utiliser cette action."
                    : !videoFormatId && !campaignData?.videoFormatId
                      ? "Choisis d’abord un format vidéo."
                      : undefined
                }
                className="vws-campagne-inspire-btn vws-mobile-flat-green-cta inline-flex shrink-0 items-center gap-2 btn-vws-primary text-white max-[640px]:text-white disabled:opacity-50 self-center md:min-h-[44px] md:self-auto"
              >
                {inspireLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                M&apos;inspirer →
              </button>
            </div>
            <textarea
              ref={ideaTextareaRef}
              id="campagne-idee"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onInput={adjustIdeaTextareaHeightMobile}
              className="vws-campagne-field vws-campagne-textarea vws-campagne-textarea-mobile vws-campagne-idea-textarea vws-campagne-idea-textarea--auto-mobile mt-1.5 w-full"
              placeholder={ideaPlaceholder}
            />
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
                  setStyleDetails(e.target.value);
                  onCampaignChange?.({
                    profession,
                    idea,
                    styleDetails: e.target.value,
                    tempo,
                    cameraFixed,
                    revealMode,
                    cinematicMovement,
                    selfieMode,
                    sequenceType,
                    dialogueEnabled,
                    microAnswer,
                    tempoCompressionDecision,
                  });
                }}
                className="vws-campagne-field vws-campagne-field--touch"
                placeholder={stylePlaceholder}
              />
            </div>
            <div className="vws-campagne-dialogue-row border border-[#222] rounded-xl bg-[#111]">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-200">Dialogue activé</p>
                <p className="text-sm text-gray-500 mt-0.5">(modifiable dans Vidéo virale)</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={dialogueEnabled}
                onClick={() => {
                  const next = !dialogueEnabled;
                  setDialogueEnabled(next);
                  onCampaignChange?.({
                    profession,
                    idea,
                    styleDetails,
                    tempo,
                    cameraFixed,
                    revealMode,
                    cinematicMovement,
                    selfieMode,
                    sequenceType,
                    dialogueEnabled: next,
                    microAnswer,
                    tempoCompressionDecision,
                  });
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

    {showSystemVideo && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={() => setShowSystemVideo(false)}
        role="presentation"
      >
        <div
          className="studio-panel max-w-3xl w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="campagne-vws-explication-title"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div>
              <h2 id="campagne-vws-explication-title" className="text-base font-semibold text-gray-200">
                Explication du système
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Cette vidéo explique cette étape pas à pas : choix du métier, idée de scène, réglages simples, puis le
                bouton qui lance la préparation pour la suite du studio.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSystemVideo(false)}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors shrink-0"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6">
            {explicationCampagneVwsVideo ? (
              <video
                className="w-full rounded-xl border border-white/10 bg-black/60 aspect-video object-contain"
                src={explicationCampagneVwsVideo}
                controls
                playsInline
                preload="metadata"
              >
                Ton navigateur ne lit pas la vidéo intégrée.
              </video>
            ) : (
              <div className="w-full rounded-xl border border-white/10 bg-black/40 aspect-video flex items-center justify-center">
                <p className="text-xs text-gray-400 px-4 text-center">
                  Vidéo d’explication non incluse dans ce clone (fichier média manquant).
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
