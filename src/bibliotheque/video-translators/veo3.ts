/**
 * Traducteur pur CampaignGenerationSpec → prompt texte Veo3 (aucun I/O, pas de mutation du spec).
 */
import {
  formatVideoFormatParamsPromptAppendix,
  getVideoFormatConfigForCatalogId,
} from "@/config/videoFormats";
import type { CampaignGenerationSpec } from "../campaignGenerationSpec";
import { getSafeScenes } from "../campaignGenerationSpec";
import { getFormatById } from "../vwsVideoFormatsCatalog";
import { stripMetierSceneFormLabels } from "../vwsPromptEngine";

function clampSceneIndex(i: number): 0 | 1 | 2 {
  const n = Math.floor(Number(i));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(2, n)) as 0 | 1 | 2;
}

function wantsNoMusic(style: string): boolean {
  const s = String(style ?? "").trim().toLowerCase();
  return !s || s === "none";
}

/**
 * Buckets 4 / 6 / 8 comme côté Edge (mapDurationSeconds) : seuils sur la durée demandée.
 */
function mapVeoDurationSeconds(raw: number): 4 | 6 | 8 {
  const d = Math.floor(Number(raw));
  if (!Number.isFinite(d) || d <= 0) return 8;
  if (d <= 4) return 4;
  if (d <= 6) return 6;
  return 8;
}

function formatDurationLabel(seconds: number): string {
  const d = mapVeoDurationSeconds(seconds);
  return `${d}s`;
}

function buildCampaignContextLines(spec: CampaignGenerationSpec): string {
  const parts: string[] = [];
  const core = stripMetierSceneFormLabels(String(spec.campaign.core_idea ?? "").trim());
  const style = String(spec.campaign.style_details ?? "").trim();
  if (core) parts.push(`Campaign core idea: ${core}`);
  if (style) parts.push(`Style direction: ${style}`);
  const ip = spec.campaign.intent_profile;
  if (ip) {
    parts.push(
      `Intent: family=${ip.intentFamily}, hook=${ip.hookGoal}, humanPresence=${ip.humanPresence}, confidence=${ip.confidence}`,
    );
  }
  return parts.length ? `\n\n${parts.join("\n")}` : "";
}

export type Veo3PromptBuild = {
  prompt: string;
  dialogueText: string | null;
};

export function buildVeo3Prompt(spec: CampaignGenerationSpec, sceneIndex: number): Veo3PromptBuild {
  const idx = clampSceneIndex(sceneIndex);
  const scenes = getSafeScenes(spec);
  const scene = scenes[idx];

  let ideaBody = String(scene?.script_text ?? "").trim();
  if (idx === 0) {
    const hookPrompt = String(spec.creative.hook_visual.prompt_text ?? "").trim();
    if (hookPrompt) {
      ideaBody = ideaBody
        ? `${ideaBody}\n\nHook visual:\n${hookPrompt}`
        : `Hook visual:\n${hookPrompt}`;
    }
  }
  const dialogueLine = String(scene?.dialogue_text ?? "").trim();
  const dialogueText: string | null = dialogueLine ? dialogueLine : null;
  ideaBody += buildCampaignContextLines(spec);

  const dialogueOn = spec.rendering.audio.dialogue_enabled !== false;
  const notSilentMusic = !wantsNoMusic(spec.rendering.audio.music_style);

  const blocks: string[] = [];
  if (!dialogueOn) {
    blocks.push(
      "Audio mode: SILENT. No dialogue, no speech, no lip movement, no voice over, no character addressing camera verbally. Visual-only sequence.",
    );
  }
  const styleDetails = String(spec.campaign.style_details ?? "").toLowerCase();
  const hasShrinkWrap = /emball[eé]|sous plastique|scell[eé]|film plastique|emballage/.test(styleDetails);
  const packagingOpeningGesture = String(spec.campaign.packaging_opening_gesture ?? "").trim();
  if (spec.campaign.video_format_id === "produit_unboxing" && packagingOpeningGesture) {
    blocks.push(
      `CRITICAL HAND CONSTRAINT: ${hasShrinkWrap ? "The box has intact factory shrink wrap — right hand peels it off cleanly in the first 1.5 seconds before proceeding with the sleeve grip. " : "The box is already unwrapped — no plastic film, no shrink wrap, no cellophane anywhere on the box. The sleeve grip begins at frame 0 with no preliminary unwrapping step of any kind. "}${packagingOpeningGesture} The stabilizing hand must remain completely still during the entire opening sequence. This constraint overrides any other camera or movement instruction.`,
    );
  }
  const packagingOpeningSound = String(spec.campaign.packaging_opening_sound ?? "").trim();
  if (spec.campaign.video_format_id === "produit_unboxing" && packagingOpeningSound) {
    blocks.push(
      `CRITICAL AUDIO CONSTRAINT: ${packagingOpeningSound} This is a continuous sound, not isolated clicks or discrete events. Audio must match the visual motion frame by frame with no silence gaps during the opening gesture.`,
    );
  }
  blocks.push(`Idea: ${ideaBody}`);
  if (dialogueLine && dialogueOn && notSilentMusic) {
    blocks.push(`Character says naturally: ${dialogueLine}`);
  }
  blocks.push(`Format: ${spec.rendering.aspect_ratio} (aligned with hook visual)`);
  blocks.push(`Duration: ${formatDurationLabel(spec.rendering.duration_seconds)}`);

  const hookUrl = String(spec.creative.hook_visual.selected_image_url ?? "").trim();
  if (hookUrl) {
    blocks.push(
      "Start from the exact selected hook image as the first frame and keep identity, composition and environment continuity from that initial state.",
    );
  }

  const causal = spec.campaign.clarification.causal_agent;
  if (causal === "automatic") {
    blocks.push("No visible people, hands, tools, or machines at any time.");
  } else if (causal === "visible") {
    blocks.push("Show visible people or machines actively causing the transformation.");
  }

  const intentProfile = spec.campaign.intent_profile;
  const isSelfieIntent =
    spec.rendering.camera.selfie_mode === true ||
    intentProfile?.humanPresence === "selfie";

  const productName = String(spec.campaign.profession ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const formatDef = spec.campaign.video_format_id
    ? getFormatById(String(spec.campaign.video_format_id).trim())
    : null;
  if (productName && formatDef?.categoryId === "produit") {
    if (spec.campaign.video_format_id === "produit_unboxing") {
      blocks.push(
        `The ${productName} is hidden inside the closed box at frame 0 and must not be visible until the opening gesture reveals it. As the lid separates, the ${productName} becomes progressively visible. By the final frame, the ${productName} is fully revealed and clearly visible inside the open box, face up, centered in the tray.`,
      );
    } else if (causal === "automatic") {
      blocks.push(
        `Following the scene described in the idea above, the physical product ${productName} is clearly visible on screen at all times — consistently framed and recognizable from first to last frame, prominent in the composition without implying visible people or hands.`,
      );
    } else {
      blocks.push(
        isSelfieIntent
          ? `Following the scene and actions described in the idea above. Throughout the video, the person is visibly holding ${productName} naturally in one hand, presenting it toward the camera. The product ${productName} is clearly visible on screen at all times, held naturally in the person's hand or placed prominently in the foreground.`
          : `Following the scene and actions described in the idea above. Throughout the video, the person is visibly holding or interacting with ${productName}. The product ${productName} is clearly visible on screen at all times, held naturally in the person's hand or placed prominently in the foreground.`,
      );
    }
  }

  const noMusic = wantsNoMusic(spec.rendering.audio.music_style);
  if (noMusic) {
    blocks.push("audio_mode: silent");
    if (dialogueOn) {
      blocks.push(
        "Silent constraints: no dialogue, no speech, no voice over, no talking, no lip sync, no TTS, visual-only sequence.",
      );
    }
    blocks.push("No background music, no soundtrack.");
  } else {
    blocks.push(`audio_mode: ${dialogueOn ? "dialogue" : "silent"}`);
    if (dialogueOn) {
      blocks.push(
        "Dialogue in French without regional accent: spoken French from France only, neutral Parisian accent, no Canadian, Belgian or Swiss French.",
      );
    }
  }

  if (spec.rendering.camera.fixed === true) {
    if (isSelfieIntent) {
      blocks.push(
        "Camera: maintain consistent handheld selfie POV from first to last frame — " +
          "close wide-angle framing, subject filling 70-80% of frame height, " +
          "slight upward tilt toward subject face, characteristic selfie lens distortion " +
          "maintained throughout. " +
          "Subtle continuous micro-movements from hand holding the device — " +
          "small natural drift and sway, never fully locked, never pulling back or zooming out. " +
          "The framing distance and angle established in frame 0 must remain identical " +
          "until the last frame — no camera retreat, no reframing, no stabilization.",
      );
      blocks.push(
        "Facial performance: completely natural and understated throughout the entire shot — " +
          "calm resting expression, subtle mouth movements when speaking, " +
          "no wide eyes, no open mouth surprise, no raised eyebrows, no theatrical reaction. " +
          "The person looks like a real tradesperson filming themselves on a job site, " +
          "not an actor performing for camera. " +
          "Micro-expressions only — the same natural energy from frame 0 to last frame.",
      );
      blocks.push(
        "Camera is held at arm's length from chest to waist level, angled slightly upward toward the person's face — selfie perspective maintained from first to last frame.",
      );
      blocks.push(
        "The camera-holding arm and wrist position is locked throughout — no repositioning, no perspective shift mid-video. No device body visible in frame.",
      );
      blocks.push(
        "Close-up on hands or product is achieved by the person extending their arm toward the lens — never by a camera angle change.",
      );
    } else {
      blocks.push(
        "Camera: locked-off static framing for the full shot; no camera " +
          "movement — no pan, tilt, dolly, zoom, orbit, crane, or handheld drift.",
      );
    }
  }

  const formatParamsFromCatalog = getVideoFormatConfigForCatalogId(spec.campaign.video_format_id);
  const formatParamsForAppendix =
    formatParamsFromCatalog && isSelfieIntent
      ? {
          ...formatParamsFromCatalog,
          camera: formatParamsFromCatalog.camera.filter((angle) => angle !== "gros_plan_mains"),
        }
      : formatParamsFromCatalog;
  if (formatParamsForAppendix) {
    blocks.push(formatVideoFormatParamsPromptAppendix(formatParamsForAppendix));
  }

  blocks.push(
    "Build progression must unfold continuously from frame 0 to final frame with no temporal jump. " +
      "Full scene consistency across all frames: " +
      "Objects — every tool, product or equipment must maintain identical shape, color, texture and number of parts from first to last frame, no morphing, no part duplication, no detail change. " +
      "Characters — the person must maintain identical face, hair, skin tone, clothing, body proportions and accessories throughout, no identity drift between frames. " +
      "Facial expression — natural and grounded, realistic micro-expressions only, no exaggerated surprise, no comedic over-reaction, no performative acting. " +
      "Environment — background elements, walls, furniture, lighting sources and spatial layout must remain stable and consistent, no object teleportation, no room reconfiguration. " +
      "Physics — materials behave consistently, no impossible deformations, no sudden texture changes on surfaces.",
  );

  const fullPrompt = blocks.filter(Boolean).join("\n");
  console.log("[Veo3 fullPrompt]", fullPrompt);
  return { prompt: fullPrompt, dialogueText };
}
