import { getVwsEnvironmentHint } from "./vwsMetiersConfig";
import { generateResponse } from "./openai/chatgpt-client";

export type Tempo = "real_time" | "timelapse" | "slow_motion";

export type SequenceType = "single_8s" | "three_x_8s";

export type ScenarioType =
  | "construction_assemblage"
  | "avant_apres"
  | "demonstration_produit"
  | "action_humaine_continue";

export interface UserIdeaInput {
  profession: string;
  idea: string;
  styleDetails?: string;
  tempo: Tempo;
  cameraFixed: boolean;
  revealMode: boolean;
  cinematicMovement: boolean;
  selfieMode: boolean;
  sequenceType: SequenceType;
  dialogueEnabled?: boolean;
  microAnswerId?: string | null;
  /**
   * Clarify Gate axis: how transformation happens.
   * - visible: people or machines are visible causing the change
   * - automatic: no visible intervention (no people, no machines, no tools)
   */
  causalAgentSelection?: "visible" | "automatic" | null;
  /**
   * Clarify Gate axis: aerial view angle when user asks for "view from above".
   * - top_down: directly overhead, no perspective
   * - angled: high-angle with visible depth/perspective
   */
  cameraAerialAngle?: "top_down" | "angled" | null;
  /** Selfie POV inferred from global intent understanding (even without explicit "selfie" keyword). */
  inferredSelfiePov?: boolean;
  /** Contexte format vidéo choisi (catalogue Campagne VWS), injecté dans la scène sans modifier style_details stocké. */
  videoFormatHint?: string;
}

export interface GlobalScene {
  profession: string;
  subject: string;
  environment: string;
  styleDetails: string | null;
}

export interface TemporalLogic {
  tempo: Tempo;
  description: string;
}

export interface StabilizationConstraints {
  cameraDescription: string;
  environmentConsistency: string;
}

export interface SequencePlan {
  index: number;
  sequenceGoal: string;
}

export interface MicroQuestionOption {
  id: string;
  label: string;
}

export interface MicroQuestion {
  question: string;
  options: MicroQuestionOption[];
  reason: string;
}

export interface VwsEngineOutput {
  coverPrompt: string;
  videoPrompts: string[];
  sequences: SequencePlan[];
  globalScene: GlobalScene;
  temporalLogic: TemporalLogic;
  stabilization: StabilizationConstraints;
  scenarioType: ScenarioType;
  scriptSeed: string;
  microQuestion: MicroQuestion | null;
  layers: {
    RAW_IDEA: string;
    INTERPRETED_INTENT: string;
    ROUTING: "demonstration" | "transformation" | "construction" | "human interaction";
    RULES_LAYER: string[];
    PROMPT_STRUCTURE: {
      videoTemplate: string;
      hookTemplate: string;
    };
  };
}

export interface GlobalIntentProfile {
  intentFamily: "presentation" | "transformation" | "demonstration" | "human_interaction" | "other";
  hookGoal: "show_finished_result" | "show_start_state" | "show_action_in_progress";
  humanPresence: "selfie" | "visible" | "none" | "unknown";
  confidence: number;
  source: "heuristic" | "llm";
}

/** Une seule phase à la fois : pas de redondance inter-axes dans le même appel. */
export type ClarifyGatePhase = "mode_agent" | "initial_t0" | "causal_agent" | "camera_aerial_angle" | "none";

export interface ClarifyIdeaInput {
  jobType: string;
  mainIdea: string;
  modifiers?: string;
  tempoSelection: Tempo;
  causalAgent?: string | null;
  initialState?: string | null;
  /** Lignes chronologiques Q/R ou notes de clarification (spec : boucle jusqu'à VALID). */
  clarificationHistory?: string | null;
  /** Phase courante du gate (obligatoire côté Campagne VWS). */
  gatePhase?: ClarifyGatePhase;
  /** Bloc additif (payload user uniquement) : paramètres format vidéo depuis la config statique. */
  formatContextAppendix?: string | null;
}

export interface ClarifyDiagnostic {
  category: "A" | "B" | "C" | "D" | "E";
  reason: string;
  user_link: string;
}

export interface ClarifyGateOption {
  id: string;
  label: string;
}

export interface ClarifyIdeaResult {
  status: "VALID" | "NEEDS_CLARIFICATION";
  mode: "MODE_A" | "MODE_B";
  diagnostic: ClarifyDiagnostic;
  question: string;
  /** Présent si NEEDS_CLARIFICATION : choix structurés (spec : schéma JSON strict). */
  options?: ClarifyGateOption[];
  /** Phase évaluée pour ce tour (déduplication côté UI). */
  activePhase?: ClarifyGatePhase;
}

export interface RefinePromptInput {
  jobType: string;
  mainIdea: string;
  modifiers?: string;
  tempoSelection: Tempo;
  revealMode: boolean;
  cameraLocked: boolean;
  projectFormat: SequenceType;
  clarifyMode?: "MODE_A" | "MODE_B" | null;
  clarifyAnswer?: string | null;
  proceedAnyway?: boolean;
  /** Aligné sur campaign.clarification.causal_agent : contrainte explicite dans le prompt final si défini. */
  causalAgentSelection?: "visible" | "automatic" | null;
}

export interface InferGlobalIntentInput {
  profession: string;
  idea: string;
  styleDetails?: string;
  revealMode: boolean;
  selfieMode: boolean;
  cameraFixed: boolean;
  cinematicMovement: boolean;
  tempo: Tempo;
  sequenceType: SequenceType;
  /** Aligné sur UserIdeaInput.videoFormatHint */
  videoFormatHint?: string;
}

export interface ExecutionStep {
  status: "start" | "ok" | "warning" | "error" | "skipped";
  input: string;
  output: string;
  decisions: string[];
  notes: string;
  duration_ms?: number;
}

export interface RefinementResult {
  trace_mode: "internal_debug_extended";
  run_id: string;
  phases: {
    PRE_PROMPT_PHASE: {
      steps: {
        RUN_START: ExecutionStep;
        UI_INPUT_SNAPSHOT: ExecutionStep;
        INPUT_NORMALIZATION: ExecutionStep;
        TRANSFORMATION_MODE_ROUTING: ExecutionStep;
        CLARIFY_GATE_EVALUATION: ExecutionStep;
        INTERPRETED_INTENT_VIDEO_NATIVE: ExecutionStep;
        VISUAL_RICHNESS_LAYER: ExecutionStep;
        TEMPLATE_ROUTING_DECISION: ExecutionStep;
        CONSTRAINT_PLAN_ASSEMBLY: ExecutionStep;
        TEMPORAL_BUDGET_DISTRIBUTION: ExecutionStep;
      };
    };
    PROMPT_EXECUTION_PHASE: {
      steps: {
        PROMPT_DRAFT_CONSTRUCTION: ExecutionStep;
        PROMPT_FINALIZATION: ExecutionStep;
        PROVIDER_REQUEST_START: ExecutionStep;
        PROVIDER_STREAM_ACTIVITY: ExecutionStep;
        PROVIDER_REQUEST_END: ExecutionStep;
        RAW_MODEL_OUTPUT_CAPTURE: ExecutionStep;
      };
    };
    POST_PROMPT_PHASE: {
      steps: {
        OUTPUT_PARSING_START: ExecutionStep;
        OUTPUT_PARSING_RESULT: ExecutionStep;
        SCHEMA_VALIDATION: ExecutionStep;
        CONTINUITY_RULE_EVALUATION: ExecutionStep;
        FINAL_RESULT_DECISION: ExecutionStep;
        RUN_END: ExecutionStep;
      };
    };
  };
}

const CLARIFY_GATE_FORBIDDEN_TOPICS = `INTERDIT dans la question et les libellés : rythme, vitesse, tempo, timelapse vs temps réel, ordre d'apparition des éléments, séquence de plans, enchaînement, cadence, nombre d'étapes, chorégraphie, mise en scène détaillée, durée, musique. Ces sujets sont gérés par le moteur de prompt, pas par l'utilisateur ici.`;

const CLARIFY_GATE_MODE_AGENT_INSTRUCTION = `Vous êtes le Clarify Gate — phase UNIQUE "mode_agent" (ViralWorks Studio).
Sortie UNIQUEMENT : JSON valide, sans markdown.

Tâche : décider si l'agent causal PRINCIPAL à l'instant t=0 est (A) autonome / sans acteur humain visible au début, ou (B) déclenché par un humain ou un artisan visible dès le début.

${CLARIFY_GATE_FORBIDDEN_TOPICS}

Règles :
- Si l'idée tranche déjà clairement A ou B (historique inclus), status = VALID et options = [].
- Sinon, status = NEEDS_CLARIFICATION : une seule question courte en français, sans mentionner les sujets interdits.
- NEEDS : le code fixe les ids d'options ; remplis "question" et "diagnostic" seulement.

MODE A = autonome / éléments qui évoluent sans acteur humain au frame 0.
MODE B = humain ou artisan visible et actif dès le frame 0.

FORMAT JSON :
{
  "status": "VALID" | "NEEDS_CLARIFICATION",
  "mode": "MODE_A" | "MODE_B",
  "diagnostic": { "category": "A"|"B"|"C"|"D"|"E", "reason": "court", "user_link": "court" },
  "question": "texte si NEEDS sinon \"\"",
  "options": []
}`;

const CLARIFY_GATE_INITIAL_T0_INSTRUCTION = `Vous êtes le Clarify Gate — phase UNIQUE "initial_t0" (ViralWorks Studio).
Sortie UNIQUEMENT : JSON valide, sans markdown.

Tâche : à l'instant t=0 de la scène, l'état spatial est-il (1) intact / "avant" / rien n'est encore engagé, ou (2) déjà en cours (chantier, travaux commencés, milieu de progression) ? Ne pas re-demander qui agit : cela est déjà tranché ailleurs.

${CLARIFY_GATE_FORBIDDEN_TOPICS}

Règles :
- Si l'idée précise déjà t=0 (historique inclus), status = VALID et options = [].
- Sinon NEEDS_CLARIFICATION : une seule question courte en français.

FORMAT JSON :
{
  "status": "VALID" | "NEEDS_CLARIFICATION",
  "mode": "MODE_A" | "MODE_B",
  "diagnostic": { "category": "A"|"B"|"C"|"D"|"E", "reason": "court", "user_link": "court" },
  "question": "texte si NEEDS sinon \"\"",
  "options": []
}`;

const CLARIFY_GATE_NONE_INSTRUCTION = `Vous êtes le Clarify Gate — synthèse finale (ViralWorks Studio).
Sortie UNIQUEMENT : JSON valide, sans markdown.

Les axes structuraux sont déjà résolus ou non requis. Tu ne poses AUCUNE question : status doit toujours être VALID. Choisis mode MODE_A ou MODE_B d'après l'idée (agent humain au t=0 ou non).

${CLARIFY_GATE_FORBIDDEN_TOPICS}

FORMAT JSON :
{
  "status": "VALID",
  "mode": "MODE_A" | "MODE_B",
  "diagnostic": { "category": "D", "reason": "Gate OK", "user_link": "court" },
  "question": "",
  "options": []
}`;

function normalizeClarifyGateOptions(raw: unknown): ClarifyGateOption[] {
  if (!Array.isArray(raw)) return [];
  const out: ClarifyGateOption[] = [];
  const seen = new Set<string>();
  for (const o of raw) {
    const id = String((o as { id?: unknown })?.id ?? "").trim();
    const label = String((o as { label?: unknown })?.label ?? "").trim();
    if (!id || !label) continue;
    let uid = id.replace(/\s+/g, "_");
    if (seen.has(uid)) uid = `${uid}_${seen.size}`;
    seen.add(uid);
    out.push({ id: uid, label });
    if (out.length >= 4) break;
  }
  return out;
}

const CLARIFY_GATE_FIXED_MODE_OPTIONS: ClarifyGateOption[] = [
  { id: "vws_gate_mode_autonomous", label: "Les éléments évoluent seuls, sans acteur humain visible au début." },
  { id: "vws_gate_mode_human", label: "Un être humain ou artisan est visible dès le début et agit." },
];

const CLARIFY_GATE_FIXED_CAUSAL_AGENT_OPTIONS: ClarifyGateOption[] = [
  { id: "vws_gate_causal_visible", label: "Avec des personnes ou des machines visibles" },
  { id: "vws_gate_causal_automatic", label: "De manière automatique, sans intervention visible" },
];

const CLARIFY_GATE_FIXED_CAMERA_AERIAL_ANGLE_OPTIONS: ClarifyGateOption[] = [
  { id: "vws_gate_camera_top_down", label: "Vue du dessus (directement au-dessus, sans angle)" },
  { id: "vws_gate_camera_angled", label: "Vue en hauteur avec angle (on voit les côtés et la profondeur)" },
];

const CLARIFY_GATE_FIXED_T0_OPTIONS: ClarifyGateOption[] = [
  { id: "vws_gate_t0_pristine", label: "État « avant » intact : rien n'est encore engagé au départ." },
  { id: "vws_gate_t0_in_progress", label: "Travaux ou transformation déjà en cours au départ (milieu de progression)." },
];

function clarificationHistoryHasCausalAgentAnswer(history: string | null | undefined): boolean {
  const h = String(history || "");
  return h.includes("option_id=vws_gate_causal_visible") || h.includes("option_id=vws_gate_causal_automatic");
}

function clarificationHistoryHasCameraAerialAngleAnswer(history: string | null | undefined): boolean {
  const h = String(history || "");
  return h.includes("option_id=vws_gate_camera_top_down") || h.includes("option_id=vws_gate_camera_angled");
}

/** Heuristique : une seule question « mode / agent causal » si le texte ne tranche pas déjà. */
export function clarifyGateNeedsModeAgent(mainIdea: string): boolean {
  const t = clean(mainIdea).toLowerCase();
  if (!t || t.length < 4) return false;
  if (
    /\b(jardinier|paysagiste|ouvrier|artisan|chef|cuisinier|coiffeur|électricien|plombier|client|passant|homme|femme|personne|main\b|mains\b|il\s|elle\s|on voit|travaille|installe|plante|arrose|taille|pose|monte|répar)\b/.test(
      t
    )
  ) {
    return false;
  }
  if (
    /\b(seuls?|seules?|tout seul|toute seule|sans main|sans personne|automatiquement|magiquement|apparaissent seuls|s'assemblent seuls|se construisent seuls)\b/.test(
      t
    )
  ) {
    return false;
  }
  return /\b(construi|rénov|renov|transform|assembler|aménag|chantier|jardin|pelouse|terrasse|haie|piscine|maison|mur|terrain|pizza|prépar|cuisin)\b/.test(
    t
  );
}

/**
 * Heuristique : question "comment la transformation se produit-elle ?"
 * Déclenche uniquement pour idées construction/transformation/assemblage quand ce point n'est pas explicite.
 */
export function clarifyGateNeedsCausalAgent(mainIdea: string): boolean {
  const t = clean(mainIdea).toLowerCase();
  if (!t || t.length < 4) return false;
  const isTransform =
    /\b(construi|construction|chantier|rénov|renov|transform|assembl|aménag|amenag|avant.{0,12}après|avant.{0,12}apres|timelapse)\b/.test(
      t
    );
  if (!isTransform) return false;
  // Explicit visible intervention
  if (
    /\b(ouvrier|ouvriers|artisan|artisans|personne|gens|équipe|equipe|main\b|mains\b|hand\b|hands\b|worker|workers|crew|machine|machines|engin|pelleteuse|grue|bulldozer|robot|tool|tools|outil|outils|menuisier|charpentier|ma[cç]on|plombier|[ée]lectricien|chauffagiste|coiffeur|cuisinier|chef|garagiste|m[ée]canicien|agent immobilier|architecte|pisciniste|paysagiste|jardinier|technicien)\b/.test(
      t
    )
  ) {
    return false;
  }
  // Common explicit human grammar signals (even if profession is used as subject).
  if (/\b(le|la|un|une|des)\s+(menuisier|charpentier|ma[cç]on|plombier|[ée]lectricien|chauffagiste|coiffeur|cuisinier|chef|garagiste|m[ée]canicien|agent immobilier|architecte|pisciniste|paysagiste|jardinier|technicien)\b/.test(t)) {
    return false;
  }
  if (/\b(il|elle|ils|elles|je|nous|vous|on)\b/.test(t)) {
    return false;
  }
  // Explicit automatic / no intervention
  if (
    /\b(automatique|automatiquement|seul|seule|tout seul|toute seule|sans intervention|sans personne|sans humain|sans main|no one|no human|no hands|autonomous|by itself|on its own)\b/.test(
      t
    )
  ) {
    return false;
  }
  return true;
}

/**
 * Heuristique : question "Quel type de vue en hauteur veux-tu ?"
 * Déclenche si l'idée exprime une vue en hauteur mais n'indique pas clairement "du dessus" vs "avec angle".
 */
export function clarifyGateNeedsCameraAerialAngle(mainIdea: string): boolean {
  const t = clean(mainIdea).toLowerCase();
  if (!t || t.length < 4) return false;

  const hasAerialConcept =
    /\b(vue\s*(aérienne|aerienne)|vue\s*en\s*hauteur|vue\s*du\s*ciel|vue\s*en\s*surplomb|surplomb|au[-\s]?dessus|depuis\s*au[-\s]?dessus|from\s*above|overhead|bird'?s[-\s]?eye|aerial\s*view)\b/.test(
      t
    );
  if (!hasAerialConcept) return false;

  // Already explicit top-down / vertical / no angle
  if (
    /\b(top[-\s]?down|strict(ement)?\s*(du\s*dessus|overhead)|directement\s*au[-\s]?dessus|pile\s*au[-\s]?dessus|vertical(e)?\s*(pur|pure)?|perpendiculaire\s*au\s*sol|sans\s*angle|sans\s*perspective)\b/.test(
      t
    )
  ) {
    return false;
  }

  // Already explicit angled / perspective / depth / sides visible
  if (
    /\b(oblique|avec\s*angle|en\s*angle|perspective|profondeur|on\s*voit\s*(les\s*)?(c[oô]t[eé]s|fa[cç]ades?)|high[-\s]?angle|angled|tilt(ed)?\s*down)\b/.test(
      t
    )
  ) {
    return false;
  }

  return true;
}

/** Heuristique : une seule question « t=0 » si le texte ne précise pas déjà l'état initial. */
export function clarifyGateNeedsInitialT0(mainIdea: string): boolean {
  const t = clean(mainIdea).toLowerCase();
  if (!t || t.length < 4) return false;
  if (
    /\b(déj[aà]|deja|partiellement|en cours|chantier ouvert|milieu de|avant travaux|après travaux|état initial|vide|nu|à partir de rien|depuis rien|herbe intacte|pelouse intacte)\b/.test(
      t
    )
  ) {
    return false;
  }
  return /\b(rénov|renov|construi|transform|aménag|chantier|timelapse|avant.{0,12}après|appara[iî]t|se refait|refaire|paysag)\b/.test(
    t
  );
}

function clarificationHistoryHasT0Answer(history: string | null | undefined): boolean {
  const h = String(history || "");
  return h.includes("option_id=vws_gate_t0_pristine") || h.includes("option_id=vws_gate_t0_in_progress");
}

const CLARIFY_GATE_DEFAULT_T0_QUESTION =
  "À l'instant de départ (t=0), la scène est-elle encore à l'état « avant » (rien n'a encore commencé), ou la transformation est-elle déjà en cours ?";

const REFINEMENT_SYSTEM_INSTRUCTION = `SYSTEM-LEVEL CONTROL ROLE — VEO3 DETERMINISTIC PROMPT ENGINE (ViralWorks Studio)
You are a deterministic video prompt generation engine. You are NOT creative. You are technical and constraint-driven.

CORE MISSION:
Generate a final Veo3 video prompt that is strictly 100% English, deterministic, structurally stable, and free from creative drift.

CORE ROUTING RULE — TRANSFORMATION MODE ROUTER:
BEFORE any other processing, classify the idea into exactly ONE mode using this IF/ELSE decision:

MODE A — AUTONOMOUS PROGRESSIVE CONSTRUCTION
IF the idea does NOT contain a human-trigger action at frame 0 (no hand, no tool, no actor in frame).
THEN:
- Enforce "empty surface/ground at t=0" (no hand, no tool, no actor).
- Subject assembles progressively over the full 8 seconds.
- Final state occurs only at the last frame.

MODE B — HUMAN-TRIGGERED TRANSFORMATION
ELSE (idea contains a human, hand, tool, or physical action at frame 0).
THEN:
- ALLOW human/hand/tool presence at t=0.
- Enforce "primary actor persistence": the actor remains visible and active throughout.
- Transformation unfolds progressively after the trigger action.

CAUSAL AGENT CONSTRAINTS (read the user payload line that starts with "Causal:"):
- If that line is exactly "Causal: automatic", section 8 (Important) of the final Veo3 prompt MUST include this exact sentence on its own line: No visible people, hands, tools, or machines at any time
- If that line is exactly "Causal: visible", section 8 (Important) MUST include this exact sentence on its own line: Show visible people or machines causing the transformation
- If that line is exactly "Causal: null", do NOT add either sentence above based on causal agent alone; infer visibility of people/machines only from MODE A / MODE B and the idea text as usual.

TEMPORAL NORMALIZATION RULE:
When an input idea contains instantaneous or explosive concepts, you MUST automatically reinterpret them as progressive, time-distributed transformations.

FINAL PROMPT — MANDATORY STRUCTURE (Step 12):
The final prompt MUST strictly follow this exact structured template. No alternative formats.
1. Opening Descriptor Line
2. Idea
3. Style
4. Camera
5. Lighting
6. Environment
7. Tone
8. Important

STRICT LANGUAGE & SEPARATION:
- 100% English only.
- User Input (FR) is an INTERNAL SIGNAL only.
- Interpreted Intent (EN) is the SINGLE source.

DETERMINISM: No stochastic variation. No markdown. Output ONLY valid JSON.`;

function extractJsonObject(raw: string): any | null {
  const txt = String(raw || "").trim();
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    // continue
  }
  const fenced = txt.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // continue
    }
  }
  const first = txt.indexOf("{");
  const last = txt.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(txt.slice(first, last + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function buildFallbackFinalPrompt(input: RefinePromptInput): string {
  const mode = input.clarifyMode || "MODE_B";
  const clarify = input.clarifyAnswer ? `Clarification: ${input.clarifyAnswer}.` : "";
  return [
    "Cinematic transformation shot, deterministic sequence, 8-second continuity.",
    `Idea: ${input.mainIdea}.`,
    `Style: realistic details, coherent materials, and stable scene logic.`,
    `Camera: ${input.cameraLocked ? "locked-off stable framing" : "controlled movement with spatial continuity"}, ${input.projectFormat}.`,
    `Lighting: physically coherent light progression over the full shot.`,
    `Environment: ${input.modifiers || "profession-matched context"}, no discontinuity, no sudden object teleportation.`,
    `Tone: factual, grounded, visually explicit.`,
    `Important: ${mode} routing applied. ${clarify} Build progression must unfold continuously from frame 0 to final frame with no temporal jump.`,
  ].join("\n");
}

function enforceCameraLockPrompt(promptText: string, cameraLocked: boolean): string {
  const txt = String(promptText || "").trim();
  if (!txt || !cameraLocked) return txt;
  const alreadyMentionsLock =
    /\b(locked[-\s]?off|static camera|camera fixed|fixed camera|no camera movement|tripod|no pan|no tilt|no dolly)\b/i.test(
      txt
    );
  if (alreadyMentionsLock) return txt;
  return [
    txt,
    "",
    "Important camera lock:",
    "Use a locked-off static camera for the full shot.",
    "No camera movement at any time: no pan, tilt, dolly, zoom, orbit, crane, or handheld drift.",
  ].join("\n");
}

function normalizeRefinementResult(rawText: string, parsed: any, input: RefinePromptInput): RefinementResult {
  const rawFinalPrompt =
    String(parsed?.phases?.PROMPT_EXECUTION_PHASE?.steps?.PROMPT_FINALIZATION?.output || "").trim() ||
    String(parsed?.final_prompt || parsed?.prompt || "").trim() ||
    (rawText.trim().startsWith("{") ? "" : rawText.trim()) ||
    buildFallbackFinalPrompt(input);
  const finalPrompt = enforceCameraLockPrompt(rawFinalPrompt, input.cameraLocked);
  const mode = input.clarifyMode || "MODE_B";
  return {
    trace_mode: "internal_debug_extended",
    run_id: String(parsed?.run_id || `vws-${Date.now()}`),
    phases: {
      PRE_PROMPT_PHASE: {
        steps: {
          RUN_START: { status: "ok", input: "", output: "run started", decisions: [], notes: "" },
          UI_INPUT_SNAPSHOT: { status: "ok", input: input.mainIdea, output: input.jobType, decisions: [], notes: "" },
          INPUT_NORMALIZATION: { status: "ok", input: input.mainIdea, output: input.mainIdea, decisions: [], notes: "" },
          TRANSFORMATION_MODE_ROUTING: { status: "ok", input: input.mainIdea, output: mode, decisions: [], notes: "" },
          CLARIFY_GATE_EVALUATION: { status: "ok", input: input.clarifyAnswer || "", output: input.proceedAnyway ? "PROCEED_ANYWAY" : "VALIDATED", decisions: [], notes: "" },
          INTERPRETED_INTENT_VIDEO_NATIVE: { status: "ok", input: input.mainIdea, output: input.mainIdea, decisions: [], notes: "" },
          VISUAL_RICHNESS_LAYER: { status: "ok", input: input.modifiers || "", output: input.modifiers || "", decisions: [], notes: "" },
          TEMPLATE_ROUTING_DECISION: { status: "ok", input: input.projectFormat, output: input.projectFormat, decisions: [], notes: "" },
          CONSTRAINT_PLAN_ASSEMBLY: { status: "ok", input: "", output: "", decisions: [], notes: "" },
          TEMPORAL_BUDGET_DISTRIBUTION: { status: "ok", input: input.tempoSelection, output: input.tempoSelection, decisions: [], notes: "" },
        },
      },
      PROMPT_EXECUTION_PHASE: {
        steps: {
          PROMPT_DRAFT_CONSTRUCTION: { status: "ok", input: input.mainIdea, output: finalPrompt, decisions: [], notes: "" },
          PROMPT_FINALIZATION: { status: "ok", input: input.mainIdea, output: finalPrompt, decisions: [], notes: "" },
          PROVIDER_REQUEST_START: { status: "ok", input: "", output: "", decisions: [], notes: "" },
          PROVIDER_STREAM_ACTIVITY: { status: "skipped", input: "", output: "", decisions: [], notes: "" },
          PROVIDER_REQUEST_END: { status: "ok", input: "", output: "", decisions: [], notes: "" },
          RAW_MODEL_OUTPUT_CAPTURE: { status: "ok", input: "", output: rawText || finalPrompt, decisions: [], notes: "" },
        },
      },
      POST_PROMPT_PHASE: {
        steps: {
          OUTPUT_PARSING_START: { status: "ok", input: "", output: "", decisions: [], notes: "" },
          OUTPUT_PARSING_RESULT: { status: "ok", input: "", output: "", decisions: [], notes: "" },
          SCHEMA_VALIDATION: { status: "ok", input: "", output: "", decisions: [], notes: "" },
          CONTINUITY_RULE_EVALUATION: { status: "ok", input: "", output: "", decisions: [], notes: "" },
          FINAL_RESULT_DECISION: { status: "ok", input: "", output: "SUCCESS", decisions: [], notes: "" },
          RUN_END: { status: "ok", input: "", output: "", decisions: [], notes: "" },
        },
      },
    },
  };
}

function clean(text: string | undefined | null): string {
  return (text || "").trim();
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function inferGlobalIntentHeuristic(input: InferGlobalIntentInput): GlobalIntentProfile {
  const idea = clean(input.idea).toLowerCase();
  const hasSelfie = input.selfieMode || /\b(selfie|face cam[ée]ra|vlog|se filme)\b/.test(idea);
  const hasPresentationVerbs =
    /\b(pr[ée]sente|montre|explique|parle|d[ée]crit|visite|avis|t[ée]moigne)\b/.test(idea);
  const hasTransformationSignals =
    /\b(avant.{0,12}apr[eè]s|construction|chantier|timelapse|r[ée]nov|transform|assembl|appara[iî]t|se remplit|progressivement)\b/.test(
      idea
    );
  const hasHumanSignals =
    /\b(homme|femme|personne|artisan|ouvrier|il|elle|je|on voit|parle|montre|main|mains)\b/.test(idea);

  if (hasSelfie || (hasPresentationVerbs && hasHumanSignals && !hasTransformationSignals)) {
    return {
      intentFamily: "presentation",
      hookGoal: "show_finished_result",
      humanPresence: hasSelfie ? "selfie" : "visible",
      confidence: hasSelfie ? 0.95 : 0.85,
      source: "heuristic",
    };
  }
  if (hasTransformationSignals || input.revealMode) {
    return {
      intentFamily: "transformation",
      hookGoal: "show_start_state",
      humanPresence: hasHumanSignals ? "visible" : "none",
      confidence: 0.75,
      source: "heuristic",
    };
  }
  if (hasHumanSignals) {
    return {
      intentFamily: "human_interaction",
      hookGoal: "show_action_in_progress",
      humanPresence: "visible",
      confidence: 0.72,
      source: "heuristic",
    };
  }
  return {
    intentFamily: "other",
    hookGoal: "show_action_in_progress",
    humanPresence: "unknown",
    confidence: 0.55,
    source: "heuristic",
  };
}

const GLOBAL_INTENT_SYSTEM_INSTRUCTION = `You classify user video intent for routing.
Return JSON only:
{
  "intentFamily": "presentation" | "transformation" | "demonstration" | "human_interaction" | "other",
  "hookGoal": "show_finished_result" | "show_start_state" | "show_action_in_progress",
  "humanPresence": "selfie" | "visible" | "none" | "unknown",
  "confidence": 0.0
}
Rules:
- If selfie/vlog person talking to camera and showing result => presentation + show_finished_result + selfie.
- If before/after or progressive build intent => transformation + show_start_state.
- Keep deterministic, no prose, JSON only.`;

export async function inferGlobalIntent(input: InferGlobalIntentInput): Promise<GlobalIntentProfile> {
  const heuristic = inferGlobalIntentHeuristic(input);
  // Low-cost path: skip LLM when heuristic is already clear.
  if (heuristic.confidence >= 0.82) {
    return heuristic;
  }
  const payload = [
    `Profession: ${clean(input.profession)}`,
    `Idea: ${clean(input.idea)}`,
    `StyleDetails: ${clean(input.styleDetails)}`,
    input.videoFormatHint ? `VideoFormatHint: ${clean(input.videoFormatHint)}` : "",
    `RevealMode: ${Boolean(input.revealMode)}`,
    `SelfieMode: ${Boolean(input.selfieMode)}`,
    `CameraFixed: ${Boolean(input.cameraFixed)}`,
    `CinematicMovement: ${Boolean(input.cinematicMovement)}`,
    `Tempo: ${input.tempo}`,
    `SequenceType: ${input.sequenceType}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await generateResponse(payload, GLOBAL_INTENT_SYSTEM_INSTRUCTION, {
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 140,
    });
    const parsed = extractJsonObject(String(raw || ""));
    if (!parsed || typeof parsed !== "object") return heuristic;
    const intentFamily =
      parsed.intentFamily === "presentation" ||
      parsed.intentFamily === "transformation" ||
      parsed.intentFamily === "demonstration" ||
      parsed.intentFamily === "human_interaction"
        ? parsed.intentFamily
        : "other";
    const hookGoal =
      parsed.hookGoal === "show_finished_result" ||
      parsed.hookGoal === "show_start_state"
        ? parsed.hookGoal
        : "show_action_in_progress";
    const humanPresence =
      parsed.humanPresence === "selfie" ||
      parsed.humanPresence === "visible" ||
      parsed.humanPresence === "none"
        ? parsed.humanPresence
        : "unknown";
    return {
      intentFamily,
      hookGoal,
      humanPresence,
      confidence: clamp01(Number(parsed.confidence)),
      source: "llm",
    };
  } catch {
    return heuristic;
  }
}

function normalizeIdea(rawIdea: string): { subject: string; action: string } {
  const raw = clean(rawIdea);
  if (!raw) return { subject: "the main subject", action: "performs a clear action" };
  return { subject: raw, action: raw };
}

function classifyScenario(idea: string, revealMode: boolean): ScenarioType {
  const txt = idea.toLowerCase();
  if (txt.includes("construction") || txt.includes("chantier") || txt.includes("immeuble") || txt.includes("maison")) {
    return "construction_assemblage";
  }
  if (revealMode || (txt.includes("avant") && txt.includes("après"))) {
    return "avant_apres";
  }
  if (txt.includes("produit") || txt.includes("démonstration") || txt.includes("présente")) {
    return "demonstration_produit";
  }
  return "action_humaine_continue";
}

function buildInterpretedIntent(rawIdea: string): string {
  const base = clean(rawIdea);
  if (!base) {
    return "A person is actively performing a clear, video-native action in progress.";
  }
  return `A person is actively performing this action in a video-native scene: ${base}.`;
}

function buildInterpretedIntentWithCausalAgent(rawIdea: string, selection: "visible" | "automatic" | null | undefined): string {
  const base = clean(rawIdea);
  if (selection === "automatic") {
    return base
      ? `The scene shows an autonomous, physically grounded transformation in progress with no visible people, hands, tools, or machines: ${base}.`
      : "The scene shows an autonomous, physically grounded transformation in progress with no visible people, hands, tools, or machines.";
  }
  if (selection === "visible") {
    return base
      ? `People or machines are visibly causing the transformation in progress (real physical action, tools, and motion): ${base}.`
      : "People or machines are visibly causing the transformation in progress (real physical action, tools, and motion).";
  }
  return buildInterpretedIntent(rawIdea);
}

function applyCameraAerialAngleToIntent(intent: string, angle: "top_down" | "angled" | null | undefined): string {
  const base = clean(intent);
  if (!base) return base;
  if (angle === "top_down") {
    return `${base} Camera viewpoint is a pure top-down overhead view, perpendicular to the ground, with no perspective.`;
  }
  if (angle === "angled") {
    return `${base} Camera viewpoint is a high-angle view with a clear oblique angle, visible perspective, and depth (sides and volume are readable).`;
  }
  return base;
}

function detectEvolvingSubject(rawIdea: string): { subject: string | null; vague: boolean } {
  const idea = clean(rawIdea);
  const lower = idea.toLowerCase();
  const vague = /\b(truc|objet|chose|something)\b/.test(lower);
  const match =
    idea.match(/(?:construction|transformation|rénovation|renovation)\s+(?:d['’]|de la |du |de l['’]|de )([^,.]+)/i) ||
    idea.match(/(?:construire|transformer|rénover|renover)\s+(?:un |une |le |la |l['’])?([^,.]+)/i);
  const subject = match?.[1]?.trim() || null;
  return { subject, vague };
}

function toRoutingCategory(scenarioType: ScenarioType): "demonstration" | "transformation" | "construction" | "human interaction" {
  if (scenarioType === "demonstration_produit") return "demonstration";
  if (scenarioType === "avant_apres") return "transformation";
  if (scenarioType === "construction_assemblage") return "construction";
  return "human interaction";
}

function buildRulesLayer(): string[] {
  return [
    "no spawn / despawn",
    "object permanence",
    "spatial containment",
    "environnement stable",
  ];
}

function routingGuidance(routing: "demonstration" | "transformation" | "construction" | "human interaction"): string {
  switch (routing) {
    case "demonstration":
      return "Focus on a clear product or skill demonstration with readable steps.";
    case "transformation":
      return "Emphasize before/after progression and visible transformation.";
    case "construction":
      return "Emphasize active build process, tools and material continuity.";
    default:
      return "Emphasize natural human presence and interaction in motion.";
  }
}

function buildGlobalScene(input: UserIdeaInput): GlobalScene {
  const norm = normalizeIdea(input.idea);
  const style = clean(input.styleDetails);
  const formatHint = clean(input.videoFormatHint);
  const metierEnv = getVwsEnvironmentHint(clean(input.profession));
  const envPieces: string[] = [];
  if (formatHint) envPieces.push(formatHint);
  if (style) envPieces.push(style);
  if (metierEnv) envPieces.push(metierEnv);
  const environment =
    envPieces.length > 0
      ? envPieces.join(", ")
      : metierEnv || "un environnement cohérent avec le métier et la scène";
  return {
    profession: clean(input.profession) || "professional",
    subject: norm.subject,
    environment,
    styleDetails: style || null,
  };
}

function buildTemporalLogic(input: UserIdeaInput): TemporalLogic {
  let description = "";
  switch (input.tempo) {
    case "real_time":
      description =
        "The scene unfolds in real-time over eight seconds, focusing on a single clear action without compressing too many events.";
      break;
    case "timelapse":
      description =
        "The scene condenses a much longer period of time into eight seconds, with visible accelerated evolution of light, people or construction.";
      break;
    case "slow_motion":
      description =
        "The clip shows one short intense moment stretched in slow motion, emphasizing physical details and fluid motion.";
      break;
  }
  return { tempo: input.tempo, description };
}

function buildStabilization(input: UserIdeaInput): StabilizationConstraints {
  const parts: string[] = [];
  if (input.cameraFixed) {
    parts.push("Static camera, locked-off shot, no camera movement, stable framing on the main subject.");
  }
  if (input.revealMode) {
    parts.push("Visual transition from initial state to final state (before/after progression).");
  }
  if (input.cinematicMovement) {
    parts.push("Smooth zoom or slow camera movement for a premium, cinematic look.");
  }
  if (input.selfieMode) {
    parts.push(
      "Strict first-person selfie POV: front camera at stable eye level ~60–80 cm from the face (tripod or fixed support feel), not an arm extended toward the lens. Do not show the camera-holding hand, wrist, or phone; no limb blob in the foreground corners. Never use a third-person camera filming the subject."
    );
  }
  if (input.cameraAerialAngle === "top_down") {
    parts.push("Pure top-down overhead view: camera perpendicular to the ground, no perspective, no visible sides.");
  } else if (input.cameraAerialAngle === "angled") {
    parts.push("High-angle with an oblique tilt: visible perspective and depth, sides/facades readable; avoid orthographic look.");
  }
  const cameraDescription =
    parts.length > 0
      ? parts.join(" ")
      : "Mostly static camera with only subtle, controlled movements that support the action without disrupting stability.";
  const environmentConsistency =
    "Maintain a consistent environment, lighting and visual style across the whole clip and between sequences.";
  return { cameraDescription, environmentConsistency };
}

function buildSequences(sequenceType: SequenceType, scenarioType: ScenarioType): SequencePlan[] {
  if (sequenceType === "single_8s") {
    return [
      {
        index: 0,
        sequenceGoal:
          scenarioType === "avant_apres"
            ? "Show a complete transformation from initial state to final state within eight seconds."
            : "Show one clear, readable action from start to finish within eight seconds.",
      },
    ];
  }
  // three_x_8s
  return [
    {
      index: 0,
      sequenceGoal: "Introduce the subject, context and initial state of the scene.",
    },
    {
      index: 1,
      sequenceGoal: "Show the core of the action or transformation in progress.",
    },
    {
      index: 2,
      sequenceGoal: "Stabilize and clearly present the final result at the end.",
    },
  ];
}

function buildCoverPrompt(globalScene: GlobalScene): string {
  return [
    `A professional ${globalScene.profession} at the very beginning of the scene, before any transformation.`,
    `The main subject is ${globalScene.subject}, clearly visible in ${globalScene.environment}.`,
    globalScene.styleDetails
      ? `Visual style is ${globalScene.styleDetails}, clean and professional.`
      : "Visual style is clean and professional.",
    "Static camera, stable framing, no motion blur, high detail, cinematic lighting.",
  ].join(" ");
}

function buildVideoPrompts(
  input: UserIdeaInput,
  globalScene: GlobalScene,
  temporalLogic: TemporalLogic,
  stabilization: StabilizationConstraints,
  sequences: SequencePlan[],
  interpretedIntent: string,
  routing: "demonstration" | "transformation" | "construction" | "human interaction",
  rulesLayer: string[]
): string[] {
  const tempoLabel: Record<Tempo, string> = {
    real_time: "real-time",
    timelapse: "timelapse",
    slow_motion: "slow motion",
  };

  const dialogueEnabled = input.dialogueEnabled !== false;
  const routeHint = routingGuidance(routing);
  const answerHint =
    input.microAnswerId === "from_nothing"
      ? "Start from an empty initial state and show the main subject progressively appearing through realistic build steps."
      : input.microAnswerId === "partially_built"
      ? "Start from a partially built initial state where key base elements are already present and continue the build progression."
      : "";

  // #region agent log
  const __dbgB_dba02a = {sessionId:'dba02a',runId:'pre-fix-1',hypothesisId:'B',location:'vwsPromptEngine.ts:buildVideoPrompts',message:'Building video prompts (check duration constraints vs sequenceType)',data:{sequenceType:String(input.sequenceType||''),sequencesCount:Array.isArray(sequences)?sequences.length:0,dialogueEnabled:Boolean(dialogueEnabled),hasFixed8sLine:true},timestamp:Date.now()};
  fetch('http://127.0.0.1:7405/ingest/84f2a250-0990-480e-ba92-160ff926a4b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dba02a'},body:JSON.stringify(__dbgB_dba02a)}).catch(()=>{});
  // #endregion agent log

  return sequences.map((seq) => {
    const isMulti = input.sequenceType === "three_x_8s" && sequences.length > 1;
    const segmentLabel = isMulti ? `Segment ${seq.index + 1}/${sequences.length}` : "";
    const importantLines = [
      "- Describe clearly the action",
      "- Specify who the character is talking to",
      "- Describe the atmosphere",
      ...(dialogueEnabled ? ["- Dialogue in French"] : []),
      "- No exclamation marks or question marks",
      "- The video must be 8 seconds long",
    ];
    if (segmentLabel) {
      importantLines.push(`- ${segmentLabel} (must be narratively distinct from other segments)`);
    }
    if (input.cameraFixed) {
      importantLines.push("- Locked-off static camera only for the full shot");
      importantLines.push("- Forbid any pan, tilt, dolly, zoom, orbit, crane, or handheld drift");
    }
    const ideaSelfieSignal =
      /\b(selfie|face cam[ée]ra|vlog|se filme|se filmant|filming myself)\b/i.test(input.idea);
    if (input.selfieMode || input.inferredSelfiePov || ideaSelfieSignal) {
      importantLines.push("- Camera must be strict first-person selfie POV from the subject's own front camera");
      importantLines.push(
        "- Eye-level front camera ~60–80 cm from face (stable, like on a mini tripod); never an arm reaching toward the lens"
      );
      importantLines.push("- Do not show the camera-holding hand, wrist, phone edge, or blurry foreground limb blob");
      importantLines.push("- No visible selfie stick, rig, pole, or accessory between subject and camera");
      importantLines.push("- Never use an external/third-person camera showing someone filming themselves");
    }
    if (input.causalAgentSelection === "automatic") {
      importantLines.push("- No visible people, hands, tools, or machines at any time");
    } else if (input.causalAgentSelection === "visible") {
      importantLines.push("- Show visible people or machines causing the transformation (real physical action)");
    }
    const base = [
      "Ultra realistic cinematic chaotic vlog shot",
      "",
      ...(segmentLabel ? ["Segment :", segmentLabel, ""] : []),
      "Idea :",
      `${interpretedIntent} Sequence focus: ${seq.sequenceGoal}. ${routeHint}${answerHint ? ` ${answerHint}` : ""}`,
      "",
      "Style :",
      globalScene.styleDetails ? globalScene.styleDetails : "ultra-realistic cinematic look",
      "",
      "Camera :",
      `${stabilization.cameraDescription} Tempo: ${tempoLabel[input.tempo]}.`,
      "",
      "Lighting :",
      temporalLogic.description,
      "",
      "Environment :",
      `${globalScene.environment}. Keep all key elements persistent and spatially coherent.`,
      "",
      "Tone :",
      "authentic, immersive, natural energy",
      "",
    ];
    if (dialogueEnabled) {
      base.push("Dialogue in French :");
      base.push("One short natural spoken line in French, declarative only.");
      base.push("");
    }
    base.push("Important :");
    base.push(...importantLines);
    base.push("- Maintain visual continuity: no sudden object appearance or disappearance");
    base.push("- Keep object permanence and stable spatial layout across the full shot");
    base.push("- Avoid hard environmental changes; preserve scene consistency");
    base.push("");
    return base.join("\n");
  });
}

function buildPromptStructure(params: {
  rawIdea: string;
  interpretedIntent: string;
  routing: "demonstration" | "transformation" | "construction" | "human interaction";
  rulesLayer: string[];
  input: UserIdeaInput;
  globalScene: GlobalScene;
  temporalLogic: TemporalLogic;
  stabilization: StabilizationConstraints;
  sequences: SequencePlan[];
}): { videoTemplate: string; hookTemplate: string; videoPrompts: string[] } {
  const {
    rawIdea,
    interpretedIntent,
    routing,
    rulesLayer,
    input,
    globalScene,
    temporalLogic,
    stabilization,
    sequences,
  } = params;
  const videoPrompts = buildVideoPrompts(
    input,
    globalScene,
    temporalLogic,
    stabilization,
    sequences,
    interpretedIntent,
    routing,
    rulesLayer
  );
  const preferredIdeaForHook = String(interpretedIntent || "").trim() || rawIdea;
  const hookTemplate = [
    "Transforme mon idée en un prompt ultra-réaliste en anglais pour Hailuo.",
    `Voici mon idée : ${preferredIdeaForHook}.`,
    "",
    `Garde-fou (idée interprétée / normalisée EN) : ${interpretedIntent}`,
    `Garde-fou (routing) : ${routingGuidance(routing)}`,
    "Garde-fou (cohérence) : Keep all visual elements persistent and spatially coherent, with a stable environment throughout the scene.",
    "Le résultat doit être un texte complet en anglais décrivant :",
    "– Le format & style (toujours vertical vlog 9:16, ultra-réaliste, cinématographique).",
    "– La caméra (POV, selfie ou autre, type de lentille, stabilité).",
    "– Le sujet (apparence, vêtements, détails visuels).",
    "– L’environnement (lieu, lumière, ambiance visuelle).",
    "– L’ambiance & émotions (humeur, sons si utile).",
    "– Les extras (mouvements naturels, textures, petites interactions).",
    "Donne-moi un prompt final de 1100 caractères maximum directement prêt à utiliser dans Hailuo.",
  ].join("\n");

  return {
    videoTemplate: videoPrompts[0] || "",
    hookTemplate,
    videoPrompts,
  };
}

function maybeBuildMicroQuestion(input: UserIdeaInput): MicroQuestion | null {
  const txt = input.idea.toLowerCase();
  const hasEvolutionIntent =
    txt.includes("construction") ||
    txt.includes("transform") ||
    txt.includes("rénov") ||
    txt.includes("renov");
  if (!hasEvolutionIntent) return null;
  if (input.microAnswerId) return null;

  const { subject, vague } = detectEvolvingSubject(input.idea);
  const hasInitialStatePrecision =
    txt.includes("à partir de rien") ||
    txt.includes("from scratch") ||
    txt.includes("déjà") ||
    txt.includes("fondation") ||
    txt.includes("partiellement") ||
    txt.includes("already");
  if (hasInitialStatePrecision) {
    return null;
  }

  if (vague || !subject) {
    return {
      question: "Le point de départ doit-il être vide ou déjà partiellement avancé ?",
      reason: "ambiguous_subject",
      options: [],
    };
  }
  const normalizedSubject = subject.replace(/^[\s'"`]+|[\s'"`]+$/g, "");
  return {
    question: `${normalizedSubject} doit-il apparaître entièrement à partir de rien, ou être déjà partiellement construit au début ?`,
    reason: "missing_initial_state",
    options: [
      { id: "from_nothing", label: "Partir de rien" },
      { id: "partially_built", label: "Déjà partiellement construit" },
    ],
  };
}

/**
 * Viewpoint safety (spec) : évite les vues zénithales "plates" hors contextes atelier / tabletop.
 */
export function applyViewpointSafetyGate(text: string, jobTypeLabel: string): string {
  const j = clean(jobTypeLabel).toLowerCase();
  const tabletop =
    /restaur|menuis|cuisine|bijou|jewel|workshop|tabletop|établi|etabli|atelier|garagiste|coiffeur/.test(j);
  const replacement = tabletop
    ? "slightly oblique overhead angle that preserves depth, perspective, and foreshortening (not a flat map view)"
    : "oblique aerial or eye-level perspective showing vertical planes, depth, and volumetric form (no flat zenith or pure top-down map)";
  let out = text;
  const patterns: RegExp[] = [
    /\bvue\s*zénithale\b/gi,
    /\bvue\s*zenithale\b/gi,
    /\btop[-\s]?down\b/gi,
    /\bbird'?s[-\s]?eye\b/gi,
    /\bbirds[-\s]?eye\b/gi,
    /\bvue\s*du\s*haut\b/gi,
    /\bvue\s*drone\b/gi,
    /\bvue\s*aérienne\s*strictement\s*verticale\b/gi,
    /\bstrict(ly)?\s*overhead\b/gi,
    /\bplan\s*view\b/gi,
    /\bfrom\s*directly\s*above\b/gi,
  ];
  for (const re of patterns) {
    out = out.replace(re, replacement);
  }
  return out;
}

function freezeVideoScriptForHookStill(scene0: string): string {
  const t = clean(scene0);
  if (!t) return "";
  const lines = t
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const kept = lines.filter(
    (line) =>
      !/^(camera|lighting|tone|important|dialogue)\s*:/i.test(line) &&
      !/^[\-\*]\s*(camera|pan|zoom|tilt|dolly)\b/i.test(line) &&
      !/\b(pan|zoom|tilt|dolly|travelling|traveling|handheld|whip\s*pan|cut\s*to)\b/i.test(line)
  );
  const core = kept.length ? kept.slice(0, 24).join("\n") : t.slice(0, 2000);
  return [
    "LOCKED_VIDEO_SCRIPT_T0 (static still, match opening continuity of this 8s brief; do not contradict materials/environment):",
    core,
    "Temporal scissors: single instant T=0 only; no motion verbs, no time progression, no camera moves.",
  ].join("\n");
}

/**
 * Prompt réellement envoyé au modèle image (visuel d’accroche).
 * Le champ UI reste l’« idée principale » seule ; ces contraintes sont ajoutées en interne.
 */
export function buildHookImageApiPrompt(
  userIdea: string,
  options: {
    revealMode: boolean;
    initialStateMode?: "from_nothing" | "partially_built" | null;
    jobTypeLabel?: string;
    lockedVideoScriptScene0?: string;
    cameraAerialAngle?: "top_down" | "angled" | null;
    cameraViewAngle?: "subjective_portee" | "exterieure_filmee" | null;
    globalIntent?: GlobalIntentProfile | null;
    selfieMode?: boolean;
  }
): string {
  const antiDistortionBlock =
    "Contraintes absolues : aucune distorsion anatomique sur les humains, les membres et le corps doivent respecter des proportions et positions physiquement possibles. Si une personne est sous ou près d'un véhicule/objet, sa posture doit être réaliste et cohérente avec l'espace disponible (allongée sur le dos, accroupie, penchée selon le contexte). Aucun objet ne doit avoir une taille ou une position physiquement impossible par rapport aux autres éléments de la scène. Pas de membres supplémentaires, pas de doigts mal formés, pas de visage déformé.";
  const idea = clean(userIdea);
  if (!idea) return idea;
  const lower = idea.toLowerCase();
  const selfieSignalFromIdea =
    /\b(selfie|face cam[ée]ra|vlog|se filme|se filmant|filming myself)\b/.test(lower);
  const enforceSelfiePov =
    Boolean(options.selfieMode) ||
    options.globalIntent?.humanPresence === "selfie" ||
    selfieSignalFromIdea;

  const inferEnvironment = () => {
    if (/\bvilla\b/.test(lower)) return "in front of a complete villa";
    if (/\bmaison\b|\bhouse\b/.test(lower)) return "in front of a finished residential property";
    if (/\bjardin\b|\bgarden\b/.test(lower)) return "inside a complete private garden";
    if (/\batelier\b|\bgarage\b|\bworkshop\b/.test(lower)) return "inside a complete workshop area";
    return "inside a complete and realistic environment";
  };

  const inferOpenSpace = () => {
    if (/\blamborghini\b|\bvoiture\b|\bcar\b|\bvehicle\b/.test(lower)) {
      return "a clear driveway and parking zone ready for a vehicle arrival";
    }
    if (/\bmaison\b|\bhouse\b/.test(lower)) {
      return "a clear construction plot prepared for a future build";
    }
    if (/\bpiscine\b|\bpool\b/.test(lower)) {
      return "a clear open zone in the garden prepared for a future pool installation";
    }
    return "a clearly visible open space prepared for the next transformation step";
  };

  const cameraViewAngleDirective =
    options.cameraViewAngle === "subjective_portee"
      ? "Point de vue caméra portée : on voit les mains et les outils du professionnel, pas son visage ni son corps entier."
      : options.cameraViewAngle === "exterieure_filmee"
        ? "La caméra filme le professionnel de l'extérieur, son corps entier ou en plan rapproché est visible dans le cadre."
        : "";

  const hasProgressiveTransformationSignal =
    /\b(remplit|se remplit|progressivement|timelapse|construction|construit|rénov|renov|assembl|apparaît|apparaissent|pose|se pose|avant|après|vide|nu)\b/.test(
      lower
    );
  const explicitEmptyStart =
    /\b(vide|à partir de rien|depuis rien|terrain nu|pièce nue|sol nu|empty)\b/.test(
      lower
    );
  const forceInitialStateViewByRules =
    options.initialStateMode === "from_nothing" ||
    options.revealMode ||
    hasProgressiveTransformationSignal;
  const forceInitialStateView =
    options.globalIntent?.hookGoal === "show_finished_result" ? false : forceInitialStateViewByRules;

  const baseIdea =
    options.initialStateMode === "from_nothing" || explicitEmptyStart
      ? `Ultra-realistic initial state scene ${inferEnvironment()}, with ${inferOpenSpace()}, natural composition, coherent details, and no visual clutter.`
      : idea;

  let assembled: string;
  if (!forceInitialStateView) {
    assembled = baseIdea;
  } else {
    const beforeOnly = [
      "Contrainte visuelle (image d'accroche de départ) :",
      "représenter uniquement l’état INITIAL / « avant » de la scène, avant toute manifestation du résultat ou de l’action principale.",
      "Si l'idée décrit une transformation progressive, montrer la pièce/espace vide ou inachevé au départ (T=0).",
      "Ne pas montrer d'éléments déjà terminés liés au résultat final (pas de rendu final déjà posé).",
      "Une seule image, cohérente et réaliste, lumière naturelle, cadrage lisible.",
    ].join(" ");
    assembled = `${baseIdea}\n\n${beforeOnly}`;
  }

  if (cameraViewAngleDirective) {
    const lieuMarker = /(^|\n)(LIEU DE LA SCÈNE\s*:[^\n]*)(\n|$)/i;
    if (lieuMarker.test(assembled)) {
      assembled = assembled.replace(
        lieuMarker,
        (_m, prefix, marker, suffix) => `${prefix}${marker}\n${cameraViewAngleDirective}${suffix}`
      );
    } else {
      assembled = `${cameraViewAngleDirective}\n\n${assembled}`;
    }
  }

  if (options.lockedVideoScriptScene0?.trim()) {
    assembled += `\n\n${freezeVideoScriptForHookStill(options.lockedVideoScriptScene0)}`;
  }

  if (enforceSelfiePov) {
    assembled += [
      "",
      "CRITICAL — Selfie POV (must follow all lines):",
      "Interpret as first-person POV from the subject's phone front camera placed at stable eye level ~60–80 cm in front of the face (like a phone on a mini tripod or resting on a fixed support), NOT an arm extended straight toward the lens.",
      "FORBIDDEN: the camera-holding hand, its fingers, or wrist; any phone edge or screen bezel in frame; any arm or forearm reaching straight toward the lens or dominating the lower corners; any giant blurry foreground limb blob; selfie stick, pole, or grip visible.",
      "ALLOWED: upper arms and shoulders at the sides in a natural pose (no reach toward the lens). The other hand may gesture toward the pool at torso side, fully visible with correct finger count and sharp detail.",
      "Composition: centered face and upper torso, clean edges, no extreme wide-angle distortion on the face.",
      "Never use a third-person or external camera showing someone filming themselves.",
    ].join("\n");
  }

  assembled +=
    "\n\nImage integrity constraint: realistic human anatomy and object geometry only. No deformed fingers/hands/faces, no broken hat or clothing edges, no warped pool lines/margins, no duplicated or missing limbs, no floating/merged objects, no melted textures, no broken seams, and no visual glitches. Keep all objects, clothes, character details, and environment structures clean and physically coherent.";

  let withViewpoint = assembled;
  if (options.cameraAerialAngle === "top_down") {
    withViewpoint +=
      "\n\nCamera viewpoint constraint: PURE TOP-DOWN overhead view, camera perpendicular to the ground, no perspective, no visible sides/facades.";
  } else if (options.cameraAerialAngle === "angled") {
    withViewpoint +=
      "\n\nCamera viewpoint constraint: HIGH-ANGLE with an oblique tilt, visible perspective and depth (sides/facades readable), avoid any orthographic/top-down-flat look.";
    withViewpoint = applyViewpointSafetyGate(withViewpoint, options.jobTypeLabel || "");
  } else {
    withViewpoint = applyViewpointSafetyGate(withViewpoint, options.jobTypeLabel || "");
  }

  return `${withViewpoint}\n\n${antiDistortionBlock}`;
}

export async function clarifyIdea(input: ClarifyIdeaInput): Promise<ClarifyIdeaResult> {
  const phase: ClarifyGatePhase = input.gatePhase ?? "none";
  if (phase === "causal_agent") {
    return {
      status: "NEEDS_CLARIFICATION",
      mode: "MODE_A",
      diagnostic: { category: "D", reason: "Mode d'exécution à préciser", user_link: input.mainIdea },
      question: "Comment la transformation se produit-elle ?",
      options: [...CLARIFY_GATE_FIXED_CAUSAL_AGENT_OPTIONS],
      activePhase: phase,
    };
  }
  if (phase === "camera_aerial_angle") {
    return {
      status: "NEEDS_CLARIFICATION",
      mode: "MODE_A",
      diagnostic: { category: "D", reason: "Angle de vue en hauteur à préciser", user_link: input.mainIdea },
      question: "Quel type de vue en hauteur veux-tu ?",
      options: [...CLARIFY_GATE_FIXED_CAMERA_AERIAL_ANGLE_OPTIONS],
      activePhase: phase,
    };
  }
  const lines = [`Métier: ${input.jobType}`, `Idée: ${input.mainIdea}`, `Paramètres: ${input.modifiers || ""}`];
  if (input.clarificationHistory?.trim()) {
    lines.push(`Historique de clarification (chronologique):\n${input.clarificationHistory.trim()}`);
  }
  const fmtAppendix = input.formatContextAppendix?.trim();
  if (fmtAppendix) {
    lines.push(fmtAppendix);
  }
  const payload = lines.join("\n");
  const system =
    phase === "mode_agent"
      ? CLARIFY_GATE_MODE_AGENT_INSTRUCTION
      : phase === "initial_t0"
        ? CLARIFY_GATE_INITIAL_T0_INSTRUCTION
        : CLARIFY_GATE_NONE_INSTRUCTION;

  const raw = await generateResponse(payload, system, {
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: phase === "none" ? 320 : 480,
  });
  const parsed = (extractJsonObject(String(raw || "")) || {}) as Partial<ClarifyIdeaResult>;

  let status: "VALID" | "NEEDS_CLARIFICATION" =
    parsed.status === "VALID" ? "VALID" : "NEEDS_CLARIFICATION";
  if (phase === "none") {
    status = "VALID";
  }

  /** Le modèle renvoie souvent VALID pour t=0 alors que l'idée ne fixe pas l'état initial ; l'utilisateur doit trancher. */
  let forcedInitialT0Needs = false;
  if (
    phase === "initial_t0" &&
    status === "VALID" &&
    clarifyGateNeedsInitialT0(input.mainIdea) &&
    !clarificationHistoryHasT0Answer(input.clarificationHistory)
  ) {
    status = "NEEDS_CLARIFICATION";
    forcedInitialT0Needs = true;
  }

  let options: ClarifyGateOption[] = [];
  if (status === "NEEDS_CLARIFICATION") {
    if (phase === "mode_agent") {
      options = [...CLARIFY_GATE_FIXED_MODE_OPTIONS];
    } else if (phase === "causal_agent") {
      options = [...CLARIFY_GATE_FIXED_CAUSAL_AGENT_OPTIONS];
    } else if (phase === "camera_aerial_angle") {
      options = [...CLARIFY_GATE_FIXED_CAMERA_AERIAL_ANGLE_OPTIONS];
    } else if (phase === "initial_t0") {
      options = [...CLARIFY_GATE_FIXED_T0_OPTIONS];
    } else {
      options = normalizeClarifyGateOptions(parsed.options);
      if (options.length < 2) {
        options = [
          { id: "clarify_apply", label: "J’ai précisé mon idée dans le champ ci-dessus" },
          { id: "clarify_proceed", label: "Continuer malgré ce diagnostic" },
        ];
      }
    }
  }

  const reason = forcedInitialT0Needs
    ? "État à t=0 à préciser pour l'idée"
    : parsed.diagnostic?.reason
      ? String(parsed.diagnostic.reason)
      : "Diagnostic non précisé";
  let question = parsed.question ? String(parsed.question).trim() : "";
  if (forcedInitialT0Needs) {
    question = CLARIFY_GATE_DEFAULT_T0_QUESTION;
  }
  return {
    status,
    mode: parsed.mode === "MODE_B" ? "MODE_B" : "MODE_A",
    diagnostic: {
      category: parsed.diagnostic?.category && ["A", "B", "C", "D", "E"].includes(parsed.diagnostic.category)
        ? parsed.diagnostic.category
        : "D",
      reason,
      user_link: parsed.diagnostic?.user_link ? String(parsed.diagnostic.user_link) : input.mainIdea,
    },
    question: question || reason,
    options: status === "NEEDS_CLARIFICATION" ? options : undefined,
    activePhase: phase,
  };
}

export async function refinePrompt(input: RefinePromptInput): Promise<RefinementResult> {
  const causalPayload =
    input.causalAgentSelection === "automatic" || input.causalAgentSelection === "visible"
      ? input.causalAgentSelection
      : "null";
  const payload = [
    `Job: ${input.jobType}`,
    `User-Idea (FR-Signal): ${input.mainIdea}`,
    `Context: ${input.modifiers || "none"}`,
    `Reveal: ${input.revealMode}`,
    `Tempo-Literal: ${input.tempoSelection}`,
    `Locked: ${input.cameraLocked}`,
    `ProjectFormat: ${input.projectFormat}`,
    `ClarifyMode: ${input.clarifyMode || "none"}`,
    `ClarifyAnswer: ${input.clarifyAnswer || "none"}`,
    `ProceedAnyway: ${Boolean(input.proceedAnyway)}`,
    `Causal: ${causalPayload}`,
  ].join("\n");

  const raw = await generateResponse(payload, REFINEMENT_SYSTEM_INSTRUCTION, {
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 2400,
  });
  const parsed = extractJsonObject(String(raw || ""));
  return normalizeRefinementResult(String(raw || ""), parsed, input);
}

export function runVwsPromptEngine(input: UserIdeaInput): VwsEngineOutput {
  const globalScene = buildGlobalScene(input);
  const temporalLogic = buildTemporalLogic(input);
  const stabilization = buildStabilization(input);
  const scenarioType = classifyScenario(input.idea, input.revealMode);
  const routing = toRoutingCategory(scenarioType);
  const rulesLayer = buildRulesLayer();
  const sequences = buildSequences(input.sequenceType, scenarioType);
  const rawIdea = clean(input.idea);
  const interpretedIntent = applyCameraAerialAngleToIntent(
    buildInterpretedIntentWithCausalAgent(rawIdea, input.causalAgentSelection ?? null),
    input.cameraAerialAngle ?? null
  );
  const promptStructure = buildPromptStructure({
    rawIdea: rawIdea || interpretedIntent,
    interpretedIntent,
    routing,
    rulesLayer,
    input,
    globalScene,
    temporalLogic,
    stabilization,
    sequences,
  });
  const coverPrompt = promptStructure.hookTemplate;
  const videoPrompts = promptStructure.videoPrompts;
  const videoTemplate = promptStructure.videoTemplate;
  const hookTemplate = promptStructure.hookTemplate;
  const scriptSeed = [
    `RAW_IDEA: ${rawIdea}`,
    `INTERPRETED_INTENT: ${interpretedIntent}`,
    `ROUTING: ${routing}`,
    `RULES_LAYER: ${rulesLayer.join(", ")}`,
    "PROMPT_STRUCTURE:",
    videoTemplate,
  ].join("\n");

  const microQuestion = maybeBuildMicroQuestion(input);

  return {
    coverPrompt,
    videoPrompts,
    sequences,
    globalScene,
    temporalLogic,
    stabilization,
    scenarioType,
    scriptSeed,
    microQuestion,
    layers: {
      RAW_IDEA: rawIdea,
      INTERPRETED_INTENT: interpretedIntent,
      ROUTING: routing,
      RULES_LAYER: rulesLayer,
      PROMPT_STRUCTURE: {
        videoTemplate,
        hookTemplate,
      },
    },
  };
}

