import { useMemo, useState } from "react";
import { runVwsPromptEngine } from "../bibliotheque/vwsPromptEngine";
import { generateResponse } from "@/bibliotheque/openai/chatgpt-client";
import {
  VWS_METIER_LABELS,
  getVwsMetierProfile,
} from "@/bibliotheque/vwsMetiersConfig";
import { Sparkles, HelpCircle, BookOpen, X } from "lucide-react";

const VALID_TEMPOS = new Set(["real_time", "timelapse", "slow_motion"]);

function normalizeTempo(t) {
  return VALID_TEMPOS.has(t) ? t : "real_time";
}

function StabilizationOption({ checked, onChange, label, tooltip }) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-300 group/opt">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/50"
      />
      <span>{label}</span>
      <span
        className="text-gray-500 hover:text-gray-300 cursor-help inline-flex"
        title={tooltip}
        aria-label={tooltip}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </span>
    </label>
  );
}

export default function CampagneVWS({ onBrainReady, campaignData, onCampaignChange, onCampagneFullReset }) {
  const [profession, setProfessionState] = useState(campaignData?.profession ?? "");
  const [idea, setIdeaState] = useState(campaignData?.idea ?? "");
  const [styleDetails, setStyleDetails] = useState(campaignData?.styleDetails ?? "");
  const [tempo, setTempo] = useState(() => normalizeTempo(campaignData?.tempo ?? "real_time"));
  const [cameraFixed, setCameraFixed] = useState(campaignData?.cameraFixed ?? true);
  const [sequenceType, setSequenceType] = useState(campaignData?.sequenceType ?? "single_8s");
  const [revealMode, setRevealMode] = useState(campaignData?.revealMode ?? false);
  const [cinematicMovement, setCinematicMovement] = useState(campaignData?.cinematicMovement ?? false);
  const [selfieMode, setSelfieMode] = useState(campaignData?.selfieMode ?? false);
  const [dialogueEnabled, setDialogueEnabled] = useState(campaignData?.dialogueEnabled ?? true);

  const [loading, setLoading] = useState(false);
  const [inspireLoading, setInspireLoading] = useState(false);
  const [error, setError] = useState("");
  const [microQuestion, setMicroQuestion] = useState(null);
  const [microAnswer, setMicroAnswer] = useState(campaignData?.microAnswer ?? null);
  const [showSystemVideo, setShowSystemVideo] = useState(false);

  // Vidéo explicative non versionnée dans certains clones.
  const explicationCampagneVwsVideo = "";

  const metierProfile = useMemo(() => getVwsMetierProfile(profession), [profession]);
  const stylePlaceholder =
    metierProfile?.stylePlaceholder ??
    "Ex. : ambiance, lumière, style visuel, matériaux…";

  const setProfession = (v) => {
    setProfessionState(v);
    onCampaignChange?.({ profession: v, idea, styleDetails, tempo, cameraFixed, revealMode, cinematicMovement, selfieMode, sequenceType, dialogueEnabled, microAnswer });
  };
  const setIdea = (v) => {
    setIdeaState(v);
    setMicroAnswer(null);
    setMicroQuestion(null);
    onCampaignChange?.({ profession, idea: v, styleDetails, tempo, cameraFixed, revealMode, cinematicMovement, selfieMode, sequenceType, dialogueEnabled, microAnswer: null });
  };
  const syncState = (updates) => {
    if (updates.profession !== undefined) setProfessionState(updates.profession);
    if (updates.idea !== undefined) setIdeaState(updates.idea);
    if (updates.styleDetails !== undefined) setStyleDetails(updates.styleDetails);
    if (updates.tempo !== undefined) setTempo(normalizeTempo(updates.tempo));
    if (updates.cameraFixed !== undefined) setCameraFixed(updates.cameraFixed);
    if (updates.revealMode !== undefined) setRevealMode(updates.revealMode);
    if (updates.cinematicMovement !== undefined) setCinematicMovement(updates.cinematicMovement);
    if (updates.selfieMode !== undefined) setSelfieMode(updates.selfieMode);
    if (updates.sequenceType !== undefined) setSequenceType(updates.sequenceType);
    onCampaignChange?.({
      profession: updates.profession ?? profession,
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
    });
  };

  const applyPackVlog = () => {
    syncState({
      tempo: "real_time",
      sequenceType: "single_8s",
      cameraFixed: false,
      revealMode: false,
      cinematicMovement: false,
      selfieMode: true,
    });
  };

  const applyPackDemo = () => {
    syncState({
      tempo: "real_time",
      sequenceType: "single_8s",
      cameraFixed: false,
      revealMode: false,
      cinematicMovement: true,
      selfieMode: false,
    });
  };

  const applyPackAvantApres = () => {
    syncState({
      tempo: "timelapse",
      sequenceType: "single_8s",
      cameraFixed: false,
      revealMode: true,
      cinematicMovement: false,
      selfieMode: false,
    });
  };

  const handleInspire = async () => {
    const metier = profession.trim() || "professionnel";
    setInspireLoading(true);
    setError("");
    try {
      const systemPrompt = `Tu génères une seule idée d’accroche vidéo courte filmable au smartphone pour TikTok/Reels/Shorts, sous forme d’une phrase en français, sans liste, sans numérotation ni guillemets, décrivant une scène visuelle immédiate avec une action visible dès la première seconde, une situation réelle et filmable, et un geste métier clair, compréhensible visuellement en moins de 3 secondes ; interdits : toute formulation abstraite et toute scène non filmable.

Renforce ces exigences (scroll-native, pas marketing) :
- Une seule phrase : scène concrète, pas un concept ni un slogan.
- Dès la 1re seconde : mains, outil, produit, geste ou mouvement net (pas d’intro « on va voir »).
- Cadre réaliste smartphone : lieu précis (atelier, véhicule, chantier, comptoir, cuisine…), lumière et cadrage possibles en vrai.
- Geste métier identifiable : verbes d’action (couper, visser, mesurer, poser, nettoyer, soulever, montrer du doigt, corriger, brancher, étaler, etc.).
- Scroll : le spectateur comprend le sujet sans audio ni texte à l’écran.
- Accroche visuelle : la scène doit inclure un élément qui casse une attente normale (problème visible, anomalie, erreur, ou situation surprenante mais crédible) dès le premier plan, pour capter l’attention dès la première seconde — pas seulement un geste « propre » sans tension visuelle.

Interdits (même implicites) :
- Formulations abstraites : explique, présente, partage, révèle, parle de, décrit, raconte, conseille, dévoile, etc., sans action visible en même temps.
- Ton pub : expertise, passion, excellence, harmonieux, référence, leader, qualité premium, sans geste ni objet au premier plan.
- Toute scène où l’action n’est pas visible (réunion floue, plan générique, « il parle de… » sans faire quelque chose de filmable).

Réponds uniquement par la phrase d’idée, rien d’autre.`;
      const profile = getVwsMetierProfile(profession);
      let userPrompt = `Métier : ${metier}. Génère une idée d’accroche vidéo (une phrase) : scène concrète, action visible tout de suite, compatible tournage smartphone.`;
      if (profile?.inspireContext) {
        userPrompt += ` Contexte terrain à exploiter : ${profile.inspireContext}.`;
      }
      const response = await generateResponse(userPrompt, systemPrompt, {
        max_tokens: 200,
        temperature: 0.55,
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

  const handleRun = async () => {
    setError("");
    setLoading(true);
    try {
      const safeProfession = profession.trim() || "entrepreneur";
      const safeIdea = idea.trim();
      if (!safeIdea || safeIdea.length < 8) {
        throw new Error("Décris au moins une idée claire pour la vidéo (8 caractères minimum).");
      }

      const brain = runVwsPromptEngine({
        profession: safeProfession,
        idea: safeIdea,
        styleDetails: styleDetails.trim() || undefined,
        tempo,
        cameraFixed,
        revealMode,
        cinematicMovement,
        selfieMode,
        sequenceType,
        dialogueEnabled,
        microAnswerId: microAnswer,
      });

      if (brain.microQuestion && !microAnswer) {
        const questionToShow =
          brain.microQuestion.reason === "ambiguous_subject"
            ? await resolveAmbiguousMicroQuestion(safeIdea)
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
              idea: safeIdea,
              styleDetails: styleDetails.trim() || "",
              tempo,
              cameraFixed,
              revealMode,
              cinematicMovement,
              selfieMode,
              sequenceType,
              dialogueEnabled,
              microAnswer,
            },
            brain,
          })
        );
      } catch (err) {
        void err;
      }

      onBrainReady?.({
        profession: safeProfession,
        idea: safeIdea,
        styleDetails: styleDetails.trim() || "",
        tempo,
        cameraFixed,
        revealMode,
        cinematicMovement,
        selfieMode,
        sequenceType,
        dialogueEnabled,
        microAnswer,
      });
    } catch (e) {
      setError(e?.message || "Une erreur s’est produite pendant la préparation.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMicroAnswer = (optionId) => {
    setMicroAnswer(optionId);
    onCampaignChange?.({ profession, idea, styleDetails, tempo, cameraFixed, revealMode, cinematicMovement, selfieMode, sequenceType, dialogueEnabled, microAnswer: optionId });
    setError("");
  };

  return (
    <>
    <div className="studio-panel p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          Étape 1 – Votre campagne vidéo
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowSystemVideo(true)}
            className="studio-toolbar-btn !py-1.5 !px-3"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            Explication du système
          </button>
          <button
            type="button"
            onClick={applyPackVlog}
            className="studio-toolbar-btn !py-1.5 !px-3"
          >
            Pack Vlog 🤳
          </button>
          <button
            type="button"
            onClick={applyPackDemo}
            className="studio-toolbar-btn !py-1.5 !px-3"
          >
            Pack Démo Produit 📦
          </button>
          <button
            type="button"
            onClick={applyPackAvantApres}
            className="studio-toolbar-btn !py-1.5 !px-3"
          >
            Pack Avant/Après ✨
          </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">
            Ton métier
          </label>
          <select
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm bg-white/5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
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
            <p className="mt-1.5 text-[11px] text-gray-500 leading-snug" id="campagne-metier-hint">
              Ambiance typique pour ce métier (pour aider à imaginer la scène) : {metierProfile.environmentHint}
            </p>
          ) : null}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">
            Précisions (ambiance, lumière, style…)
          </label>
          <input
            type="text"
            value={styleDetails}
            onChange={(e) => {
              setStyleDetails(e.target.value);
              onCampaignChange?.({ profession, idea, styleDetails: e.target.value, tempo, cameraFixed, revealMode, cinematicMovement, selfieMode, sequenceType, dialogueEnabled, microAnswer });
            }}
            className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm bg-white/5 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
            placeholder={stylePlaceholder}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="block text-xs font-medium text-gray-300">
            Idée principale de la scène (sujet + action)
          </label>
          <button
            type="button"
            onClick={handleInspire}
            disabled={inspireLoading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 transition"
          >
            {inspireLoading ? (
              <span className="inline-block w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            M'inspirer ✨
          </button>
        </div>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          className="w-full rounded-lg border border-white/10 p-3 min-h-[120px] text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 bg-white/5 resize-none"
          placeholder="Ex : un architecte explique son nouveau projet à la caméra dans son studio, tout en dessinant les plans sur une tablette..."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">
            Vitesse à l’écran
          </label>
          <select
            value={tempo}
            onChange={(e) => {
              const v = normalizeTempo(e.target.value);
              setTempo(v);
              onCampaignChange?.({ profession, idea, styleDetails, tempo: v, cameraFixed, revealMode, cinematicMovement, selfieMode, sequenceType, dialogueEnabled, microAnswer });
            }}
            className="w-full rounded-lg border border-white/10 px-3 py-2 text-xs bg-white/5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
          >
            <option value="real_time">Comme dans la vraie vie</option>
            <option value="timelapse">Très rapide : le temps défile</option>
            <option value="slow_motion">Au ralenti</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">
            Durée de la vidéo
          </label>
          <select
            value={sequenceType}
            onChange={(e) => {
              const v = e.target.value;
              setSequenceType(v);
              onCampaignChange?.({ profession, idea, styleDetails, tempo, cameraFixed, revealMode, cinematicMovement, selfieMode, sequenceType: v, dialogueEnabled, microAnswer });
            }}
            className="w-full rounded-lg border border-white/10 px-3 py-2 text-xs bg-white/5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
          >
            <option value="single_8s">Une courte vidéo (8 secondes)</option>
            <option value="three_x_8s">Une vidéo plus longue (plusieurs moments à la suite)</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-300 mb-1">
            Ce qu’on voit dans l’image
          </label>
          <StabilizationOption
            checked={cameraFixed}
            onChange={(v) => {
              setCameraFixed(v);
              onCampaignChange?.({ profession, idea, styleDetails, tempo, cameraFixed: v, revealMode, cinematicMovement, selfieMode, sequenceType, dialogueEnabled, microAnswer });
            }}
            label="Image stable"
            tooltip="Le cadre ne bouge pas : on a l’impression que le téléphone reste posé. Idéal pour montrer un produit, une démo ou une présentation posée."
          />
          <StabilizationOption
            checked={revealMode}
            onChange={(v) => {
              setRevealMode(v);
              onCampaignChange?.({ profession, idea, styleDetails, tempo, cameraFixed, revealMode: v, cinematicMovement, selfieMode, sequenceType, dialogueEnabled, microAnswer });
            }}
            label="Avant / après visible"
            tooltip="D’abord on voit un état, puis le résultat : la différence saute aux yeux, parfait pour un chantier, une réparation ou une transformation."
          />
          <StabilizationOption
            checked={cinematicMovement}
            onChange={(v) => {
              setCinematicMovement(v);
              onCampaignChange?.({ profession, idea, styleDetails, tempo, cameraFixed, revealMode, cinematicMovement: v, selfieMode, sequenceType, dialogueEnabled, microAnswer });
            }}
            label="Mouvement doux"
            tooltip="L’image avance lentement ou zoome un peu : rendu plus soigné, comme une petite pub ou une présentation premium."
          />
          <StabilizationOption
            checked={selfieMode}
            onChange={(v) => {
              setSelfieMode(v);
              onCampaignChange?.({ profession, idea, styleDetails, tempo, cameraFixed, revealMode, cinematicMovement, selfieMode: v, sequenceType, dialogueEnabled, microAnswer });
            }}
            label="Face caméra (selfie)"
            tooltip="C’est vous (ou la personne) face à la caméra, comme un selfie : on parle ou on montre en se filmant soi-même."
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-200">Dialogue activé</p>
          <p className="text-[11px] text-gray-500">(modifiable dans Vidéo virale)</p>
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
            });
          }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            dialogueEnabled ? "bg-emerald-500/80" : "bg-white/20"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              dialogueEnabled ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleRun}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Sparkles className="w-4 h-4" />
          {loading ? "Préparation en cours…" : "Préparer ma vidéo"}
        </button>
        {typeof onCampagneFullReset === "function" ? (
          <button
            type="button"
            onClick={() => onCampagneFullReset()}
            className="px-4 py-2 rounded-lg font-medium bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-all"
          >
            Réinitialiser
          </button>
        ) : null}
      </div>

      {microQuestion && (
        <div className="mt-4 border-t border-white/10 pt-3 space-y-2">
          <p className="text-xs text-gray-300">{microQuestion.question}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {microQuestion.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectMicroAnswer(opt.id)}
                className={`px-3 py-1.5 rounded-full text-xs border transition ${
                  microAnswer === opt.id
                    ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                    : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>

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
