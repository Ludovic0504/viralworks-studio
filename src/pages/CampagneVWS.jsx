import { useMemo, useState } from "react";
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
import { Sparkles, HelpCircle, BookOpen, X } from "lucide-react";

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

function StabilizationOption({ checked, onChange, label, tooltip }) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-300 group/opt">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-white/20 bg-white/5 text-emerald-500 input-vws-check"
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
  const { runWithAuth } = useRequireAuthAction();
  const [profession, setProfessionState] = useState(campaignData?.profession ?? "");
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

  // Vidéo explicative non versionnée dans certains clones.
  const explicationCampagneVwsVideo = "";

  const metierProfile = useMemo(() => getVwsMetierProfile(profession), [profession]);
  const stylePlaceholder =
    metierProfile?.stylePlaceholder ??
    "Ex. : ambiance, lumière, style visuel, matériaux…";

  const buildCampaignSnapshot = (overrides = {}) => ({
    profession,
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
    ...overrides,
  });

  const setProfession = (v) => {
    setProfessionState(v);
    onCampaignChange?.(buildCampaignSnapshot({ profession: v }));
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
    if (updates.initialStateSelection !== undefined) setInitialStateSelection(updates.initialStateSelection);
    if (updates.gateResult !== undefined) setGateResult(updates.gateResult);
    if (updates.clarifyAnswer !== undefined) setClarifyAnswer(updates.clarifyAnswer);
    onCampaignChange?.(
      buildCampaignSnapshot({
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
        tempoCompressionDecision:
          updates.tempoCompressionDecision ?? tempoCompressionDecision,
        causalAgentSelection:
          updates.causalAgentSelection ?? causalAgentSelection,
        cameraAerialAngle:
          updates.cameraAerialAngle ?? cameraAerialAngle,
        initialStateSelection:
          updates.initialStateSelection ?? initialStateSelection,
        gateResult: updates.gateResult ?? gateResult,
        clarifyAnswer: updates.clarifyAnswer ?? clarifyAnswer,
        isClarified: updates.isClarified ?? false,
      })
    );
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
    if (!String(profession ?? "").trim()) {
      alert(
        "Sélectionne d’abord ton métier dans la liste « Ton métier » pour utiliser « M'inspirer »."
      );
      return;
    }
    const metier = profession.trim();
    setInspireLoading(true);
    setError("");
    try {
      const systemPrompt = `Tu génères UNE SEULE idée pour une vidéo très courte (8 secondes), type TikTok/Reels/Shorts.

Règle absolue : la phrase décrit une scène directement filmable en UNE SEULE PRISE (plan fixe OU plan-séquence où caméra + contenu ne font qu’un seul geste global). Zéro mini-récit, zéro enchaînement d’événements indépendants.

Deux types d’idées valides (choisis l’un ou l’autre ; varie ; le type 1 reste le plus fréquent) :

Type 1 — Transformation fixe (par défaut) : caméra fixe ou quasi fixe ; une seule logique visuelle globale parmi par exemple remplissage, construction, assemblage, remise en place en timelapse. Tu peux nommer plusieurs éléments (sol, murs, mobilier, objets, matériaux) s’ils obéissent tous au même type de progression (ex. tout se remplit progressivement, tout se construit en accéléré, tout s’assemble).

Type 2 — Révélation par caméra (cas explicite autorisé) : mouvement caméra continu (la caméra avance, travelling, travelling latéral) ; découverte progressive d’un espace ; meubles, décor, structure ou matériaux se révèlent / se posent / se montent au fil du déplacement dans UNE seule logique globale (effet type pub IKEA : un seul flux synchronisé). Pas d’activité humaine indépendante ni de narration en parallèle.

Une idée = UNE seule logique visuelle globale (un seul « moteur » de scène : remplissage, construction, assemblage, révélation synchronisée, etc.). Plusieurs éléments visuels dans la même phrase sont encouragés s’ils suivent tous cette même logique (cohérence : tout avance de la même façon).

Interdit uniquement de mélanger plusieurs logiques différentes : ex. construction ou remplissage accéléré + action humaine indépendante (installer, cuisiner, parler, expliquer) ; apparition automatique + interaction manuelle réaliste + couche narrative ; « la caméra avance » + chef qui fait autre chose + objets qui apparaissent sans lien comme deux histoires séparées.

Impact immédiat : dès la première seconde, le spectateur doit comprendre le lieu + ce qui bouge ou se construit, sans audio ni texte.

La scène doit rester lisible et percutante visuellement même sans contexte métier ; privilégier des détails concrets filmables, pas une idée plate ni des formules d’accroche creuses.

Élément visuel marquant ou satisfaisant (obligatoire, formulé dans la phrase) : au moins un détail concret et visible — répétition rythmée, alignement net, remplissage très lisible, symétrie, motif géométrique, contraste matière/couleur, lignes qui se complètent — décrit factuellement, sans adjectifs de jugement. Ne pas se contenter d’une action générique sans ce « pic » visuel.

Précision anti-générique : éviter les formulations pauvres seules du type « une maison », « un toit », « un bâtiment », « un mur », « une voiture » sans ancrage visuel. Préférer matériau, couleur, style, forme, échelle ou motif distinctifs (ex. tuiles rouges, bardage sombre, verrière, ossature bois clair, carrelage graphique, lignes de parking, etc.) tant que tous les détails restent dans la même logique globale.

Langage de la phrase finale : chaque mot doit soit décrire quelque chose de visible à l’image, soit préciser utilement le type de scène (lieu, type d’objet, matériau, cadrage ou mode de prise utile à la génération). Pas de remplissage décoratif.

Autorisé et utile : qualificatifs factuels — type d’objet ou d’architecture (bâtiment moderne, cuisine professionnelle, hangar agricole), matériaux (bois, zinc, béton, briques rouges, verre), contexte spatial (garage, chantier, appartement nu, toiture, quai), indications de prise non subjectives (vue aérienne, travelling avant, plan large, timelapse) lorsqu’elles clarifient ce qu’on voit.

Interdit dans la phrase finale (bruit inutile) : adjectifs ou jugements subjectifs (harmonieux, captivant, magnifique, esthétique, élégant, immersif, spectaculaire, saisissant, etc.) ; tournures d’interprétation (« créant… », « donnant… », « avec un rendu… », « pour une ambiance… », « visuellement impressionnant ») ; concepts abstraits ou processus invisibles (« en respectant chaque étape », « optimisé », « parfaitement conçu », « une expérience », « pensé pour », « met en valeur », « professionnalisme »).

Structure obligatoire dans la même phrase courte, tous les éléments explicites :
1) Un lieu précis et concret (ex. garage, chantier, appartement nu, jardin de villa, atelier, comptoir).
2) Un objet ou support principal ancré visuellement (type précis + au moins un trait distinctif : matériau, couleur, motif ou style — pas un nom générique nu).
3) UNE action / progression visible immédiatement : soit mécanique fixe (type 1), soit mouvement caméra couplé à une seule révélation progressive (type 2).
4) Mécanique concrète et continue (timelapse, pièces qui s’emboîtent, éléments qui sortent du sol, pièce par pièce dans le même mouvement d’ensemble ; ou apparition synchronisée au travelling), avec le détail « satisfying » ou marquant intégré naturellement.

Mécaniques visuelles à utiliser (une seule logique globale par idée ; plusieurs éléments possibles dans cette logique) :
- Type 1 — Timelapse / assemblage / remplissage / remise en place sur cadre stable ; tu peux enchaîner sol + murs + mobilier si tout obéit au même mouvement (ex. tout se met en place en accéléré).
- Type 2 — Travelling ou avancée caméra : uniquement si elle déroule le même flux unique (découverte d’un espace qui se remplit ou se monte au passage), sans personnage qui mène une autre activité parallèle.
- Apparition structurée seulement si tu précises le geste visible (ex. sortent du sol, s’emboîtent, se vissent, se posent en rangées) — jamais un « pop » magique sans geste.

Formulations INTERDITES dans la phrase finale (narration, effet « doc ») : « permettant de », « afin de », « grâce à », « montrant que », « illustrant », « on découvre », « on comprend », « on voit comment », « révélant », « dévoilant » — et tout ce qui n’est pas une image directe. Ne décris que ce qui est visible à l’écran, mot pour mot filmable.

Liaisons : « alors que » et « tout en » : interdit s’ils opposent ou combinent deux logiques visuelles différentes. « pendant que » : autorisé en type 2 pour coupler mouvement caméra et révélation progressive (un seul flux) ; en type 1, « avec » ou coordonnées du même type vont souvent mieux pour lier plusieurs éléments sous la même logique. Interdit dès qu’une liaison introduit une activité humaine ou une narration indépendante de la logique principale.

Dans la phrase finale, INTERDIT d’employer ces mots ou formulations vagues (même implicites) — en plus des interdits « langage » ci-dessus :
transformation, se transforme, changement, amélioration, optimisation, métamorphose, magie, réparation / se répare / « ça se répare » sans décrire la mécanique, disparaît, disparaissent, « les pièces disparaissent », apparaît / apparaissent seuls sans dire comment (matériaux, geste, assemblage), devient, évolue, se convertit, abstraction du type « tout s’arrange ».

INTERDIT aussi :
- Enchaînements narratifs : « puis », « ensuite », « après », « suivi de », « d’abord… puis », « enfin » (séquence d’étapes indépendantes, pas une seule progression continue).
- Mélange de plusieurs logiques visuelles différentes (construction / remplissage / assemblage automatique d’un côté, geste humain réel ou parole de l’autre ; ou apparition + interaction + commentaire comme couches séparées).
- Idées non visibles : diagnostic, analyse, réflexion, stratégie, conseil, narration, voix off, texte à l’écran décrit.
- Conclusion sur le résultat raconté après coup (« rendu final », « comme neuf », « parfait » comme fin d’histoire) : rester sur ce que la caméra voit en continu.
- Listes, numérotation, guillemets.

Métier : inspiration uniquement pour choisir lieu + objet + mécanique ; ne jamais écrire le nom du métier ni « métier : » ni parenthèses métier.

Sortie : exactement une phrase courte en français, compréhensible sans audio dès la première seconde, sans préambule.

Réponds uniquement par cette phrase, rien d’autre.`;
      const profile = getVwsMetierProfile(profession);
      let userPrompt = `Métier ou domaine (caché : ne jamais l’écrire dans la phrase) : ${metier}.

Produis une idée nouvelle, concrète, filmable et lisible au premier regard. Choisis soit le type 1 (transformation fixe : caméra fixe, une seule logique globale — tu peux détailler plusieurs éléments qui suivent tous cette logique), soit le type 2 (révélation par caméra : avancée ou travelling + un seul flux d’apparition progressive, style IKEA). Varie entre les deux ; le type 1 peut rester majoritaire. Cohérence : un seul type de progression pour toute la scène. Langage : mots utiles à l’image (lieu, type d’objet, matériau, cadrage factuel) ; zéro adjectif décoratif ou phrase d’effet.

BON — langage factuel utile (ne pas recopier) :
« Un bâtiment moderne se construit progressivement en timelapse avec une vue aérienne ».

MAUVAIS — bruit abstrait / subjectif (ne pas faire) :
« Un bâtiment se construit en respectant chaque étape avec un rendu moderne et captivant ».

BON — plusieurs éléments, une seule logique (remplissage / mise en place), ne pas recopier :
« Une salle de bain vide se remplit progressivement en timelapse avec des carreaux au sol et du mobilier qui se met en place ».

MAUVAIS — plusieurs logiques mélangées :
« Une salle de bain se construit pendant que quelqu’un installe des objets et parle » — construction + geste humain + parole : incohérent.

MAUVAIS — type 2 raté, plusieurs logiques indépendantes :
« La caméra avance et le chef cuisine pendant que les objets apparaissent » — cuisine + apparition : deux logiques.

BON — type 2, une seule logique couplée (ne pas recopier ; inventer autre chose) :
« La caméra avance dans un appartement vide pendant que les meubles et éléments apparaissent progressivement dans chaque pièce ».

MAUVAIS — trop basique / pas assez distinctif (ne pas faire) :
« Un toit se couvre progressivement en tuiles » — générique, peu d’impact.

BON — même mécanique mais pic visuel et précision (ne pas recopier ; inventer autre chose) :
« Un toit vide se remplit en timelapse avec des tuiles rouges qui s’emboîtent parfaitement ligne par ligne ».

MAUVAIS — deux actions (ne jamais faire) :
« Une cuisine se remplit pendant que le chef prépare un plat » — remplissage + cuisine : deux actions (même pattern interdit en type 2).

BON — une seule logique, plusieurs éléments (ustensiles + ingrédients) (ne pas recopier ; inventer autre chose) :
« Une cuisine professionnelle vide se remplit progressivement avec les ustensiles et ingrédients qui se placent sur le plan de travail ».

MAUVAIS — abstrait / non filmable :
« Une voiture se transforme et ses pièces défectueuses disparaissent ».

BON — une mécanique, un lieu, un objet (ne pas recopier ; inventer autre chose) :
« Une Clio 2 démontée dans un garage se réassemble progressivement en timelapse avec les pièces qui reviennent en place ».

Autres repères (inventer une variante ; une seule logique ; détail marquant ; pas de narration « on découvre », « permet de ») :
- Type 1, jardin : fosse bleue, liner lisse et lames bois chaud d’une piscine semi-enterrée s’emboîtent en flux continu accéléré.
- Type 1, îlot urbain : façade vitrée et noyau béton d’une tour étroite montent en timelapse, grue fixe, rythme d’étages symétrique vue aérienne.
- Type 2, appartement : la caméra avance dans les volumes vides pendant que mobilier bas blanc et touches vert émeraude se posent en rangées nettes pièce par pièce.`;
      if (profile?.inspireContext) {
        userPrompt += ` Indices de contexte réaliste (ne pas citer tel quel si ce sont des labels ; en extraire seulement lieux/objets visuels) : ${profile.inspireContext}.`;
      }
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

  const handleRun = async (clarificationHistoryOverride = null) => {
    setError("");
    setLoading(true);
    try {
      const safeProfession = profession.trim() || "entrepreneur";
      const safeIdea = idea.trim();
      if (!safeIdea || safeIdea.length < 8) {
        throw new Error("Décris au moins une idée claire pour la vidéo (8 caractères minimum).");
      }

      const historyLines =
        clarificationHistoryOverride ??
        (Array.isArray(campaignData?.clarificationHistory) ? campaignData.clarificationHistory : []);

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
      const microForBrain = microAnswer ?? histParsed.microFromGate ?? null;
      const causalForBrain =
        causalAgentSelection ?? histParsed.causalAgentSelectionFromGate ?? null;
      const cameraAerialForBrain =
        cameraAerialAngle ?? histParsed.cameraAerialAngleFromGate ?? null;
      const histJoined = historyLines.length ? historyLines.join("\n\n") : undefined;
      const preIntent = await inferGlobalIntent({
        profession: safeProfession,
        idea: safeIdea,
        styleDetails: styleDetails.trim() || "",
        revealMode,
        selfieMode,
        cameraFixed,
        cinematicMovement,
        tempo,
        sequenceType,
      });
      const isPresentationSelfie =
        preIntent.intentFamily === "presentation" &&
        (preIntent.humanPresence === "selfie" || selfieMode === true);
      const inferredSelfiePov = preIntent.humanPresence === "selfie";

      let gate = null;
      for (;;) {
        const needCameraAerial =
          !axes.cameraAerialAngle && clarifyGateNeedsCameraAerialAngle(safeIdea);
        const needCausal =
          !isPresentationSelfie && !axes.causalAgent && clarifyGateNeedsCausalAgent(safeIdea);
        const needMode =
          !isPresentationSelfie && !axes.modeAgent && clarifyGateNeedsModeAgent(safeIdea);
        const needInitial =
          !isPresentationSelfie && !axes.initialT0 && clarifyGateNeedsInitialT0(safeIdea);

        if (!needCameraAerial && !needCausal && !needMode && !needInitial) {
          gate = await clarifyIdea({
            jobType: safeProfession,
            mainIdea: safeIdea,
            modifiers: styleDetails.trim(),
            tempoSelection: tempo,
            clarificationHistory: histJoined,
            gatePhase: "none",
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
          mainIdea: safeIdea,
          modifiers: styleDetails.trim(),
          tempoSelection: tempo,
          clarificationHistory: histJoined,
          gatePhase: phase,
        });

        if (gate.status === "NEEDS_CLARIFICATION") {
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

      if (
        preIntent.intentFamily === "presentation" &&
        sequenceType !== "three_x_8s" &&
        !tempoCompressionDecision
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
        tempo !== "timelapse" &&
        !tempoCompressionDecision &&
        isIdeaTooDenseForRealtime(safeIdea)
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
        idea: safeIdea,
        styleDetails: styleDetails.trim() || undefined,
        tempo,
        cameraFixed,
        revealMode,
        cinematicMovement,
        selfieMode,
        sequenceType,
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
              microAnswer: microForBrain,
              tempoCompressionDecision,
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
          core_idea: safeIdea,
          style_details: styleDetails.trim() || "",
          intent_profile: globalIntentProfile ?? buildMinimalIntentFallback({ idea: safeIdea, selfieMode }),
          clarification: {
            ...createDefaultCampaignGenerationSpec().campaign.clarification,
            mode: clarificationMode,
            diagnostic: clarificationDiagnostic,
            // Owner unique: microAnswer only. `initialStateSelection` is a read-only legacy alias.
            initial_state: microForBrain,
            causal_agent: causalForBrain,
            camera_aerial_angle: cameraAerialForBrain,
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
          sequence_type: sequenceType === "three_x_8s" ? "three_x_8s" : "single_8s",
        },
        rendering: {
          ...createDefaultCampaignGenerationSpec().rendering,
          tempo: tempo === "timelapse" || tempo === "slow_motion" ? tempo : "real_time",
          tempo_resolution_decision: tempoCompressionDecision ?? null,
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
        idea: safeIdea,
        styleDetails: styleDetails.trim() || "",
        tempo,
        cameraFixed,
        revealMode,
        cinematicMovement,
        selfieMode,
        sequenceType,
        dialogueEnabled,
        microAnswer: microForBrain,
        tempoCompressionDecision,
        causalAgentSelection: causalForBrain,
        cameraAerialAngle: cameraAerialForBrain,
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
      return;
    }
    setMicroAnswer(optionId);
    onCampaignChange?.(buildCampaignSnapshot({ microAnswer: optionId }));
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
            className="w-full rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none input-vws"
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
              onCampaignChange?.({ profession, idea, styleDetails: e.target.value, tempo, cameraFixed, revealMode, cinematicMovement, selfieMode, sequenceType, dialogueEnabled, microAnswer, tempoCompressionDecision });
            }}
            className="w-full rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none input-vws"
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
            onClick={() => void runWithAuth(handleInspire)}
            disabled={inspireLoading}
            title={
              !String(profession ?? "").trim()
                ? "Choisis d’abord ton métier pour utiliser cette action."
                : undefined
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium btn-vws-primary disabled:opacity-50"
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
          className="w-full rounded-lg p-3 min-h-[120px] text-sm text-gray-200 placeholder-gray-500 focus:outline-none resize-none input-vws"
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
              onCampaignChange?.({ profession, idea, styleDetails, tempo: v, cameraFixed, revealMode, cinematicMovement, selfieMode, sequenceType, dialogueEnabled, microAnswer, tempoCompressionDecision });
            }}
            className="w-full rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none input-vws"
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
              onCampaignChange?.({ profession, idea, styleDetails, tempo, cameraFixed, revealMode, cinematicMovement, selfieMode, sequenceType: v, dialogueEnabled, microAnswer, tempoCompressionDecision });
            }}
            className="w-full rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none input-vws"
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
              onCampaignChange?.({ profession, idea, styleDetails, tempo, cameraFixed: v, revealMode, cinematicMovement, selfieMode, sequenceType, dialogueEnabled, microAnswer, tempoCompressionDecision });
            }}
            label="Caméra fixe"
            tooltip="Le cadre ne bouge pas : on a l’impression que le téléphone reste posé. Idéal pour montrer un produit, une démo ou une présentation posée."
          />
          <StabilizationOption
            checked={revealMode}
            onChange={(v) => {
              setRevealMode(v);
              onCampaignChange?.({ profession, idea, styleDetails, tempo, cameraFixed, revealMode: v, cinematicMovement, selfieMode, sequenceType, dialogueEnabled, microAnswer, tempoCompressionDecision });
            }}
            label="Avant / après visible"
            tooltip="D’abord on voit un état, puis le résultat : la différence saute aux yeux, parfait pour un chantier, une réparation ou une transformation."
          />
          <StabilizationOption
            checked={cinematicMovement}
            onChange={(v) => {
              setCinematicMovement(v);
              onCampaignChange?.({ profession, idea, styleDetails, tempo, cameraFixed, revealMode, cinematicMovement: v, selfieMode, sequenceType, dialogueEnabled, microAnswer, tempoCompressionDecision });
            }}
            label="Mouvement doux"
            tooltip="L’image avance lentement ou zoome un peu : rendu plus soigné, comme une petite pub ou une présentation premium."
          />
          <StabilizationOption
            checked={selfieMode}
            onChange={(v) => {
              setSelfieMode(v);
              onCampaignChange?.({ profession, idea, styleDetails, tempo, cameraFixed, revealMode, cinematicMovement, selfieMode: v, sequenceType, dialogueEnabled, microAnswer, tempoCompressionDecision });
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
              tempoCompressionDecision,
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
          onClick={() => void runWithAuth(handleRun)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold btn-vws-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4" />
          {loading ? "Préparation en cours…" : "Préparer ma vidéo"}
        </button>
        {typeof onCampagneFullReset === "function" ? (
          <button
            type="button"
            onClick={() => onCampagneFullReset()}
            className="px-4 py-2 rounded-lg font-medium btn-vws-secondary"
          >
            Réinitialiser
          </button>
        ) : null}
      </div>

      {microQuestion && (
        <div className="mt-4 border-t border-white/10 pt-3 space-y-2">
          <div className="flex items-start gap-2">
            <p className="text-xs text-gray-300">{microQuestion.question}</p>
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
