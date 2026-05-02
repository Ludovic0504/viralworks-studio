import type { GlobalIntentProfile } from "./vwsPromptEngine";

export const CAMPAIGN_GENERATION_SPEC_VERSION = "1.0.0";

export type CampaignClarifyMode = "MODE_A" | "MODE_B" | null;
export type CampaignClarifyAxis = "mode_agent" | "initial_t0" | "causal_agent" | "camera_aerial_angle";
export type CampaignClarifyInitialState = "from_nothing" | "partially_built" | null;
export type CampaignClarifyCausalAgent = "visible" | "automatic" | null;
export type CampaignClarifyCameraAerialAngle = "top_down" | "angled" | null;
export type RenderingTempo = "real_time" | "timelapse" | "slow_motion";
export type CreativeSequenceType = "single_8s" | "three_x_8s";
export type RenderingAspectRatio = "9:16" | "16:9" | "1:1";
export type RenderingGenerationMode = "text_to_video" | "image_to_video";
export type CreativeDialogueMode = "auto" | "manual_global" | "manual_per_scene";

export interface CampaignGenerationMeta {
  schema_version: string;
  request_id: string | null;
  created_at: string | null;
}

export interface CampaignClarifyDiagnostic {
  category: "A" | "B" | "C" | "D" | "E";
  reason: string;
  user_link: string;
}

export interface CampaignClarification {
  mode: CampaignClarifyMode;
  diagnostic: CampaignClarifyDiagnostic | null;
  initial_state: CampaignClarifyInitialState;
  causal_agent: CampaignClarifyCausalAgent;
  camera_aerial_angle: CampaignClarifyCameraAerialAngle;
  last_user_freeform_answer: string | null;
  proceed_anyway: boolean;
  history: string[];
  resolved_axes: Record<CampaignClarifyAxis, boolean>;
  is_resolved: boolean;
}

export interface CampaignSection {
  profession: string;
  objective: string | null;
  /** Identifiant du format vidéo choisi à l’étape Campagne VWS (catalogue `vwsVideoFormatsCatalog`). */
  video_format_id: string | null;
  core_idea: string;
  style_details: string;
  intent_profile: GlobalIntentProfile | null;
  clarification: CampaignClarification;
}

export interface CreativeScene {
  scene_id: string;
  scene_goal: string | null;
  script_text: string;
  dialogue_text: string;
  timing_hint: string | null;
}

export interface CreativeScriptBundle {
  mode: "single" | "multi";
  combined_text: string;
}

export interface CreativeHookVisual {
  prompt_text: string;
  provider_prompt_raw: string;
  reference_image_data_url: string | null;
  image_variants: string[];
  selected_variant_index: number;
  selected_image_url: string;
  last_generation_prompt: string;
  modification_instruction: string;
}

export interface CreativeDialogueConfig {
  mode: CreativeDialogueMode;
  global_text: string;
  per_scene_enabled: boolean;
}

export interface CreativeSection {
  sequence_type: CreativeSequenceType;
  selected_scene_index: number;
  script_bundle: CreativeScriptBundle;
  scenes: CreativeScene[];
  hook_visual: CreativeHookVisual;
  dialogue: CreativeDialogueConfig;
}

export interface RenderingCamera {
  fixed: boolean;
  reveal_mode: boolean;
  cinematic_movement: boolean;
  selfie_mode: boolean;
  aerial_angle: CampaignClarifyCameraAerialAngle;
}

export interface RenderingAudio {
  dialogue_enabled: boolean;
  music_style: string;
  enable_music: boolean;
  enable_tts: boolean;
}

export interface RenderingSection {
  tempo: RenderingTempo;
  tempo_resolution_decision: string | null;
  aspect_ratio: RenderingAspectRatio;
  duration_seconds: number;
  generation_mode: RenderingGenerationMode;
  camera: RenderingCamera;
  audio: RenderingAudio;
}

export interface HailuoImageOverrides {
  model: string;
  prompt: string;
  ratio: RenderingAspectRatio;
  quantity: number;
  reference_character_image: string | null;
}

export interface Veo3StatusPoll {
  task_id: string;
  model: string;
}

export interface Veo3Overrides {
  model: string;
  prompt: string;
  duration_seconds: number;
  aspect_ratio: Exclude<RenderingAspectRatio, "1:1">;
  initial_image_url: string | null;
  generation_mode: RenderingGenerationMode;
  status_poll: Veo3StatusPoll;
}

export interface ProviderOverridesSection {
  hailuo: {
    image: HailuoImageOverrides;
  };
  veo3: Veo3Overrides;
}

export interface TracePromptRefinement {
  run_id: string | null;
  input_snapshot: string | null;
  output_snapshot: string | null;
}

export interface TraceClarifyGate {
  last_result: Record<string, unknown> | null;
  history_snapshots: Array<Record<string, unknown>>;
}

export interface TraceHookVisual {
  paired_campaign_idea: string | null;
}

export interface TraceVideoGeneration {
  task_id: string | null;
  provider_model_resolved: string | null;
  last_error: string;
  audio_postprocess_status: string;
}

export interface TracePersistence {
  prepared_campaign_sig: string | null;
  step1_brain_launched: boolean;
}

export interface TraceSection {
  clarify_gate: TraceClarifyGate;
  prompt_refinement: TracePromptRefinement;
  hook_visual: TraceHookVisual;
  video_generation: TraceVideoGeneration;
  persistence: TracePersistence;
}

export interface CampaignGenerationSpec {
  meta: CampaignGenerationMeta;
  campaign: CampaignSection;
  creative: CreativeSection;
  rendering: RenderingSection;
  provider_overrides: ProviderOverridesSection;
  trace: TraceSection;
}

export function createDefaultCampaignGenerationSpec(): CampaignGenerationSpec {
  return {
    meta: {
      schema_version: CAMPAIGN_GENERATION_SPEC_VERSION,
      request_id: null,
      created_at: null,
    },
    campaign: {
      profession: "",
      objective: null,
      video_format_id: null,
      core_idea: "",
      style_details: "",
      intent_profile: null,
      clarification: {
        mode: null,
        diagnostic: null,
        initial_state: null,
        causal_agent: null,
        camera_aerial_angle: null,
        last_user_freeform_answer: null,
        proceed_anyway: false,
        history: [],
        resolved_axes: {
          mode_agent: false,
          initial_t0: false,
          causal_agent: false,
          camera_aerial_angle: false,
        },
        is_resolved: false,
      },
    },
    creative: {
      sequence_type: "single_8s",
      selected_scene_index: 0,
      script_bundle: {
        mode: "single",
        combined_text: "",
      },
      scenes: [
        { scene_id: "scene_1", scene_goal: null, script_text: "", dialogue_text: "", timing_hint: null },
        { scene_id: "scene_2", scene_goal: null, script_text: "", dialogue_text: "", timing_hint: null },
        { scene_id: "scene_3", scene_goal: null, script_text: "", dialogue_text: "", timing_hint: null },
      ],
      hook_visual: {
        prompt_text: "",
        provider_prompt_raw: "",
        reference_image_data_url: null,
        image_variants: [],
        selected_variant_index: 0,
        selected_image_url: "",
        last_generation_prompt: "",
        modification_instruction: "",
      },
      dialogue: {
        mode: "auto",
        global_text: "",
        per_scene_enabled: false,
      },
    },
    rendering: {
      tempo: "real_time",
      tempo_resolution_decision: null,
      aspect_ratio: "9:16",
      duration_seconds: 8,
      generation_mode: "text_to_video",
      camera: {
        fixed: true,
        reveal_mode: false,
        cinematic_movement: false,
        selfie_mode: false,
        aerial_angle: null,
      },
      audio: {
        dialogue_enabled: true,
        music_style: "cinematic",
        enable_music: true,
        enable_tts: true,
      },
    },
    provider_overrides: {
      hailuo: {
        image: {
          model: "Image-01",
          prompt: "",
          ratio: "9:16",
          quantity: 4,
          reference_character_image: null,
        },
      },
      veo3: {
        model: "",
        prompt: "",
        duration_seconds: 8,
        aspect_ratio: "9:16",
        initial_image_url: null,
        generation_mode: "text_to_video",
        status_poll: {
          task_id: "",
          model: "",
        },
      },
    },
    trace: {
      clarify_gate: {
        last_result: null,
        history_snapshots: [],
      },
      prompt_refinement: {
        run_id: null,
        input_snapshot: null,
        output_snapshot: null,
      },
      hook_visual: {
        paired_campaign_idea: null,
      },
      video_generation: {
        task_id: null,
        provider_model_resolved: null,
        last_error: "",
        audio_postprocess_status: "",
      },
      persistence: {
        prepared_campaign_sig: null,
        step1_brain_launched: false,
      },
    },
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asArrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x) => typeof x === "string");
}

function asOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeScenes(raw: unknown): CreativeScene[] {
  const defaults = createDefaultCampaignGenerationSpec().creative.scenes;
  const incoming = Array.isArray(raw) ? raw : [];
  const out: CreativeScene[] = [];
  for (let i = 0; i < 3; i += 1) {
    const src = isObjectRecord(incoming[i]) ? incoming[i] : {};
    const base = defaults[i];
    out.push({
      scene_id: asString(src.scene_id, base.scene_id),
      scene_goal: asNullableString(src.scene_goal),
      script_text: asString(src.script_text),
      dialogue_text: asString(src.dialogue_text),
      timing_hint: asNullableString(src.timing_hint),
    });
  }
  return out;
}

function normalizeIntentProfile(raw: unknown): GlobalIntentProfile | null {
  if (!isObjectRecord(raw)) return null;
  const intentFamily = asOneOf(
    raw.intentFamily,
    ["presentation", "transformation", "demonstration", "human_interaction", "other"] as const,
    "other"
  );
  const hookGoal = asOneOf(
    raw.hookGoal,
    ["show_finished_result", "show_start_state", "show_action_in_progress"] as const,
    "show_action_in_progress"
  );
  const humanPresence = asOneOf(
    raw.humanPresence,
    ["selfie", "visible", "none", "unknown"] as const,
    "unknown"
  );
  const confidence = typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : 0;
  const source = asOneOf(raw.source, ["heuristic", "llm"] as const, "heuristic");
  return { intentFamily, hookGoal, humanPresence, confidence, source };
}

function normalizeClarifyDiagnostic(raw: unknown): CampaignClarifyDiagnostic | null {
  if (!isObjectRecord(raw)) return null;
  return {
    category: asOneOf(raw.category, ["A", "B", "C", "D", "E"] as const, "D"),
    reason: asString(raw.reason),
    user_link: asString(raw.user_link),
  };
}

/**
 * Compat legacy explicite :
 * - source canonique : microAnswer
 * - alias transitoire : initialStateSelection
 */
function normalizeInitialState(clarification: Record<string, unknown>, root: Record<string, unknown>): CampaignClarifyInitialState {
  const canonical = clarification.initial_state;
  if (canonical === "from_nothing" || canonical === "partially_built") return canonical;
  const microAnswer = root.microAnswer;
  if (microAnswer === "from_nothing" || microAnswer === "partially_built") return microAnswer;
  const legacyAlias = root.initialStateSelection;
  if (legacyAlias === "from_nothing" || legacyAlias === "partially_built") return legacyAlias;
  return null;
}

export function normalizeCampaignGenerationSpec(raw: unknown): CampaignGenerationSpec {
  const defaults = createDefaultCampaignGenerationSpec();
  if (!isObjectRecord(raw)) return defaults;

  const meta = isObjectRecord(raw.meta) ? raw.meta : {};
  const campaign = isObjectRecord(raw.campaign) ? raw.campaign : raw;
  const clarification = isObjectRecord(campaign.clarification) ? campaign.clarification : {};
  const creative = isObjectRecord(raw.creative) ? raw.creative : {};
  const scriptBundle = isObjectRecord(creative.script_bundle) ? creative.script_bundle : {};
  const hookVisual = isObjectRecord(creative.hook_visual) ? creative.hook_visual : {};
  const dialogue = isObjectRecord(creative.dialogue) ? creative.dialogue : {};
  const rendering = isObjectRecord(raw.rendering) ? raw.rendering : {};
  const camera = isObjectRecord(rendering.camera) ? rendering.camera : {};
  const audio = isObjectRecord(rendering.audio) ? rendering.audio : {};
  const overrides = isObjectRecord(raw.provider_overrides) ? raw.provider_overrides : {};
  const hailuo = isObjectRecord(overrides.hailuo) ? overrides.hailuo : {};
  const hailuoImage = isObjectRecord(hailuo.image) ? hailuo.image : {};
  const veo3 = isObjectRecord(overrides.veo3) ? overrides.veo3 : {};
  const veo3StatusPoll = isObjectRecord(veo3.status_poll) ? veo3.status_poll : {};
  const trace = isObjectRecord(raw.trace) ? raw.trace : {};
  const traceClarify = isObjectRecord(trace.clarify_gate) ? trace.clarify_gate : {};
  const tracePromptRefinement = isObjectRecord(trace.prompt_refinement) ? trace.prompt_refinement : {};
  const traceHookVisual = isObjectRecord(trace.hook_visual) ? trace.hook_visual : {};
  const traceVideoGeneration = isObjectRecord(trace.video_generation) ? trace.video_generation : {};
  const tracePersistence = isObjectRecord(trace.persistence) ? trace.persistence : {};

  return {
    meta: {
      schema_version: asString(meta.schema_version, CAMPAIGN_GENERATION_SPEC_VERSION),
      request_id: asNullableString(meta.request_id),
      created_at: asNullableString(meta.created_at),
    },
    campaign: {
      profession: asString(campaign.profession),
      objective: asNullableString(campaign.objective),
      video_format_id: asNullableString(
        (campaign as Record<string, unknown>).video_format_id ?? (campaign as Record<string, unknown>).videoFormatId
      ),
      core_idea: asString(campaign.core_idea, asString(campaign.idea)),
      style_details: asString(campaign.style_details, asString(campaign.styleDetails)),
      intent_profile: normalizeIntentProfile(campaign.intent_profile ?? campaign.globalIntentProfile),
      clarification: {
        mode: asOneOf(clarification.mode ?? campaign.clarifyMode, ["MODE_A", "MODE_B", null] as const, null),
        diagnostic: normalizeClarifyDiagnostic(clarification.diagnostic ?? campaign.clarifyDiagnostic),
        initial_state: normalizeInitialState(clarification, campaign),
        causal_agent: asOneOf(
          clarification.causal_agent ?? campaign.causalAgentSelection,
          ["visible", "automatic", null] as const,
          null
        ),
        camera_aerial_angle: asOneOf(
          clarification.camera_aerial_angle ?? campaign.cameraAerialAngle,
          ["top_down", "angled", null] as const,
          null
        ),
        last_user_freeform_answer: asNullableString(
          clarification.last_user_freeform_answer ?? campaign.clarifyAnswer
        ),
        proceed_anyway: asBoolean(clarification.proceed_anyway ?? campaign.proceedAnyway, false),
        history: asArrayOfStrings(clarification.history ?? campaign.clarificationHistory),
        resolved_axes: {
          mode_agent: asBoolean(
            (isObjectRecord(clarification.resolved_axes) ? clarification.resolved_axes.mode_agent : undefined) ??
              (isObjectRecord(campaign.clarifyAxesResolved) ? campaign.clarifyAxesResolved.modeAgent : undefined),
            false
          ),
          initial_t0: asBoolean(
            (isObjectRecord(clarification.resolved_axes) ? clarification.resolved_axes.initial_t0 : undefined) ??
              (isObjectRecord(campaign.clarifyAxesResolved) ? campaign.clarifyAxesResolved.initialT0 : undefined),
            false
          ),
          causal_agent: asBoolean(
            (isObjectRecord(clarification.resolved_axes) ? clarification.resolved_axes.causal_agent : undefined) ??
              (isObjectRecord(campaign.clarifyAxesResolved) ? campaign.clarifyAxesResolved.causalAgent : undefined),
            false
          ),
          camera_aerial_angle: asBoolean(
            (isObjectRecord(clarification.resolved_axes) ? clarification.resolved_axes.camera_aerial_angle : undefined) ??
              (isObjectRecord(campaign.clarifyAxesResolved) ? campaign.clarifyAxesResolved.cameraAerialAngle : undefined),
            false
          ),
        },
        is_resolved: asBoolean(clarification.is_resolved ?? campaign.isClarified, false),
      },
    },
    creative: {
      sequence_type: asOneOf(
        creative.sequence_type ?? campaign.sequenceType,
        ["single_8s", "three_x_8s"] as const,
        "single_8s"
      ),
      selected_scene_index: Math.max(0, Math.min(2, Number(creative.selected_scene_index) || 0)),
      script_bundle: {
        mode: asOneOf(scriptBundle.mode, ["single", "multi"] as const, "single"),
        combined_text: asString(scriptBundle.combined_text),
      },
      scenes: normalizeScenes(creative.scenes),
      hook_visual: {
        prompt_text: asString(hookVisual.prompt_text),
        provider_prompt_raw: asString(hookVisual.provider_prompt_raw),
        reference_image_data_url: asNullableString(hookVisual.reference_image_data_url),
        image_variants: asArrayOfStrings(hookVisual.image_variants),
        selected_variant_index: Math.max(0, Number(hookVisual.selected_variant_index) || 0),
        selected_image_url: asString(hookVisual.selected_image_url),
        last_generation_prompt: asString(hookVisual.last_generation_prompt),
        modification_instruction: asString(hookVisual.modification_instruction),
      },
      dialogue: {
        mode: asOneOf(dialogue.mode, ["auto", "manual_global", "manual_per_scene"] as const, "auto"),
        global_text: asString(dialogue.global_text),
        per_scene_enabled: asBoolean(dialogue.per_scene_enabled, false),
      },
    },
    rendering: {
      tempo: asOneOf(rendering.tempo, ["real_time", "timelapse", "slow_motion"] as const, "real_time"),
      tempo_resolution_decision: asNullableString(rendering.tempo_resolution_decision),
      aspect_ratio: asOneOf(rendering.aspect_ratio, ["9:16", "16:9", "1:1"] as const, "9:16"),
      duration_seconds: [4, 6, 8].includes(Number(rendering.duration_seconds)) ? Number(rendering.duration_seconds) : 8,
      generation_mode: asOneOf(rendering.generation_mode, ["text_to_video", "image_to_video"] as const, "text_to_video"),
      camera: {
        fixed: asBoolean(camera.fixed ?? campaign.cameraFixed, true),
        reveal_mode: asBoolean(camera.reveal_mode ?? campaign.revealMode, false),
        cinematic_movement: asBoolean(camera.cinematic_movement ?? campaign.cinematicMovement, false),
        selfie_mode: asBoolean(camera.selfie_mode ?? campaign.selfieMode, false),
        aerial_angle: asOneOf(
          camera.aerial_angle ?? clarification.camera_aerial_angle ?? campaign.cameraAerialAngle,
          ["top_down", "angled", null] as const,
          null
        ),
      },
      audio: {
        dialogue_enabled: asBoolean(audio.dialogue_enabled ?? campaign.dialogueEnabled, true),
        music_style: asString(audio.music_style, "cinematic"),
        enable_music: asBoolean(audio.enable_music, true),
        enable_tts: asBoolean(audio.enable_tts, true),
      },
    },
    provider_overrides: {
      hailuo: {
        image: {
          model: asString(hailuoImage.model, "Image-01"),
          prompt: asString(hailuoImage.prompt),
          ratio: asOneOf(hailuoImage.ratio, ["9:16", "16:9", "1:1"] as const, "9:16"),
          quantity: [1, 2, 3, 4].includes(Number(hailuoImage.quantity)) ? Number(hailuoImage.quantity) : 4,
          reference_character_image: asNullableString(hailuoImage.reference_character_image),
        },
      },
      veo3: {
        model: asString(veo3.model),
        prompt: asString(veo3.prompt),
        duration_seconds: [4, 6, 8].includes(Number(veo3.duration_seconds)) ? Number(veo3.duration_seconds) : 8,
        aspect_ratio: asOneOf(veo3.aspect_ratio, ["9:16", "16:9"] as const, "9:16"),
        initial_image_url: asNullableString(veo3.initial_image_url),
        generation_mode: asOneOf(veo3.generation_mode, ["text_to_video", "image_to_video"] as const, "text_to_video"),
        status_poll: {
          task_id: asString(veo3StatusPoll.task_id),
          model: asString(veo3StatusPoll.model),
        },
      },
    },
    trace: {
      clarify_gate: {
        last_result: isObjectRecord(traceClarify.last_result) ? traceClarify.last_result : null,
        history_snapshots: Array.isArray(traceClarify.history_snapshots)
          ? traceClarify.history_snapshots.filter(isObjectRecord)
          : [],
      },
      prompt_refinement: {
        run_id: asNullableString(tracePromptRefinement.run_id),
        input_snapshot: asNullableString(tracePromptRefinement.input_snapshot),
        output_snapshot: asNullableString(tracePromptRefinement.output_snapshot),
      },
      hook_visual: {
        paired_campaign_idea: asNullableString(traceHookVisual.paired_campaign_idea),
      },
      video_generation: {
        task_id: asNullableString(traceVideoGeneration.task_id),
        provider_model_resolved: asNullableString(traceVideoGeneration.provider_model_resolved),
        last_error: asString(traceVideoGeneration.last_error),
        audio_postprocess_status: asString(traceVideoGeneration.audio_postprocess_status),
      },
      persistence: {
        prepared_campaign_sig: asNullableString(tracePersistence.prepared_campaign_sig),
        step1_brain_launched: asBoolean(tracePersistence.step1_brain_launched, false),
      },
    },
  };
}

export function createCampaignGenerationRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function stampCampaignGenerationMeta(
  spec: CampaignGenerationSpec,
  opts: { preserveRequestId?: boolean } = {}
): CampaignGenerationSpec {
  const requestId = opts.preserveRequestId && spec.meta.request_id
    ? spec.meta.request_id
    : createCampaignGenerationRequestId();
  return {
    ...spec,
    meta: {
      ...spec.meta,
      schema_version: CAMPAIGN_GENERATION_SPEC_VERSION,
      request_id: requestId,
      created_at: new Date().toISOString(),
    },
  };
}

/**
 * Guard read-before-write:
 * always returns 3 addressable scenes.
 */
export function getSafeScenes(spec: CampaignGenerationSpec): [CreativeScene, CreativeScene, CreativeScene] {
  const normalized = normalizeScenes(spec?.creative?.scenes);
  return [normalized[0], normalized[1], normalized[2]];
}

/**
 * Guard read-before-write:
 * can be null before step 1 "Préparer ma vidéo".
 */
export function getSafeIntentProfile(spec: CampaignGenerationSpec): GlobalIntentProfile | null {
  return normalizeIntentProfile(spec?.campaign?.intent_profile);
}

/**
 * Guard read-before-write:
 * mode/diagnostic can be absent during early flow.
 */
export function getSafeClarification(spec: CampaignGenerationSpec): Pick<CampaignClarification, "mode" | "diagnostic"> {
  return {
    mode: spec?.campaign?.clarification?.mode ?? null,
    diagnostic: spec?.campaign?.clarification?.diagnostic ?? null,
  };
}

/**
 * Guard read-before-write:
 * status poll model may be empty before create returns.
 */
export function getSafeVeo3StatusPollModel(spec: CampaignGenerationSpec): string {
  return asString(spec?.provider_overrides?.veo3?.status_poll?.model);
}

