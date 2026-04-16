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

/** Une seule phase à la fois : pas de redondance inter-axes dans le même appel. */
export type ClarifyGatePhase = "mode_agent" | "initial_t0" | "none";

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

const CLARIFY_GATE_FIXED_T0_OPTIONS: ClarifyGateOption[] = [
  { id: "vws_gate_t0_pristine", label: "État « avant » intact : rien n'est encore engagé au départ." },
  { id: "vws_gate_t0_in_progress", label: "Travaux ou transformation déjà en cours au départ (milieu de progression)." },
];

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
  return /\b(rénov|renov|construi|transform|aménag|chantier|timelapse|avant.{0,12}après|appara[iî]t|se refait|refaire|paysag|jardin|pelouse|terrasse)\b/.test(
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

function normalizeRefinementResult(rawText: string, parsed: any, input: RefinePromptInput): RefinementResult {
  const finalPrompt =
    String(parsed?.phases?.PROMPT_EXECUTION_PHASE?.steps?.PROMPT_FINALIZATION?.output || "").trim() ||
    String(parsed?.final_prompt || parsed?.prompt || "").trim() ||
    (rawText.trim().startsWith("{") ? "" : rawText.trim()) ||
    buildFallbackFinalPrompt(input);
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
  const metierEnv = getVwsEnvironmentHint(clean(input.profession));
  const envPieces: string[] = [];
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
    parts.push("The person films themselves speaking directly to the camera (selfie / vlog style).");
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

  return sequences.map((seq) => {
    const importantLines = [
      "- Describe clearly the action",
      "- Specify who the character is talking to",
      "- Describe the atmosphere",
      ...(dialogueEnabled ? ["- Dialogue in French"] : []),
      "- No exclamation marks or question marks",
      "- The video must be 8 seconds long",
    ];
    const base = [
      "Ultra realistic cinematic chaotic vlog shot",
      "",
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
  const hookTemplate = [
    "Transform my idea into an ultra-realistic prompt in English for Hailuo.",
    "",
    `Here is my idea: ${rawIdea}`,
    `Interpret it as an action in progress: ${interpretedIntent}`,
    routingGuidance(routing),
    "Keep all visual elements persistent and spatially coherent, with a stable environment throughout the scene.",
    "",
    "The result must be a complete English text describing:",
    "- Format & style (always vertical vlog 9:16, ultra-realistic, cinematic)",
    "- Camera (POV, selfie or not, lens, stability)",
    "- Subject (appearance, clothing, visual details)",
    "- Environment (location, lighting, visual atmosphere)",
    "- Atmosphere & emotions",
    "- Extras (natural movements, textures, small interactions)",
    "",
    "Give me a final prompt under 1100 characters, ready to use.",
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
  }
): string {
  const idea = clean(userIdea);
  if (!idea) return idea;
  const lower = idea.toLowerCase();

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

  const hasProgressiveTransformationSignal =
    /\b(remplit|se remplit|progressivement|timelapse|construction|construit|rénov|renov|assembl|apparaît|apparaissent|pose|se pose|avant|après|vide|nu)\b/.test(
      lower
    );
  const explicitEmptyStart =
    /\b(vide|à partir de rien|depuis rien|terrain nu|pièce nue|sol nu|empty)\b/.test(
      lower
    );
  const forceInitialStateView =
    options.initialStateMode === "from_nothing" ||
    options.revealMode ||
    hasProgressiveTransformationSignal;

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

  if (options.lockedVideoScriptScene0?.trim()) {
    assembled += `\n\n${freezeVideoScriptForHookStill(options.lockedVideoScriptScene0)}`;
  }
  return applyViewpointSafetyGate(assembled, options.jobTypeLabel || "");
}

export async function clarifyIdea(input: ClarifyIdeaInput): Promise<ClarifyIdeaResult> {
  const phase: ClarifyGatePhase = input.gatePhase ?? "none";
  const lines = [`Métier: ${input.jobType}`, `Idée: ${input.mainIdea}`, `Paramètres: ${input.modifiers || ""}`];
  if (input.clarificationHistory?.trim()) {
    lines.push(`Historique de clarification (chronologique):\n${input.clarificationHistory.trim()}`);
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
  const interpretedIntent = buildInterpretedIntent(rawIdea);
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

