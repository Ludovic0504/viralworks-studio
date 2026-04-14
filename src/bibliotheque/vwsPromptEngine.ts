import { getVwsEnvironmentHint } from "./vwsMetiersConfig";

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
 * Prompt réellement envoyé au modèle image (visuel d’accroche).
 * Le champ UI reste l’« idée principale » seule ; ces contraintes sont ajoutées en interne.
 */
export function buildHookImageApiPrompt(
  userIdea: string,
  options: { revealMode: boolean; initialStateMode?: "from_nothing" | "partially_built" | null }
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

  const baseIdea =
    options.initialStateMode === "from_nothing"
      ? `Ultra-realistic initial state scene ${inferEnvironment()}, with ${inferOpenSpace()}, natural composition, coherent details, and no visual clutter.`
      : idea;

  if (!options.revealMode) return baseIdea;

  const beforeOnly = [
    "Contrainte visuelle (format avant/après, image unique) :",
    "représenter uniquement l’état INITIAL / « avant » — début de chantier, terrain nu, fondations, structure inachevée, ou équivalent selon l’idée.",
    "Ne pas montrer le résultat final terminé (pas de bâtiment achevé, pas de « après » parfait).",
    "Une seule image, cohérente et réaliste, lumière naturelle, cadrage lisible.",
  ].join(" ");

  return `${baseIdea}\n\n${beforeOnly}`;
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

