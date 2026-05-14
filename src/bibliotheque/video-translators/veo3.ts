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
  const core = String(spec.campaign.core_idea ?? "").trim();
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
        ? `${ideaBody}\n\nVisuel d'accroche :\n${hookPrompt}`
        : `Visuel d'accroche :\n${hookPrompt}`;
    }
  }
  const dialogueLine = String(scene?.dialogue_text ?? "").trim();
  // dialogueText exclu du prompt Veo3 — ce modèle rend le texte visuellement. D'autres traducteurs (Kling, Runway...) pourront l'injecter dans leur propre prompt si le moteur le supporte.
  const dialogueText: string | null = dialogueLine ? dialogueLine : null;
  ideaBody += buildCampaignContextLines(spec);

  const blocks: string[] = [];
  blocks.push(`Idée: ${ideaBody}`);
  blocks.push(`Format: ${spec.rendering.aspect_ratio} (aligné sur le visuel d’accroche)`);
  blocks.push(`Durée: ${formatDurationLabel(spec.rendering.duration_seconds)}`);

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

  const productName = String(spec.campaign.profession ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const formatDef = spec.campaign.video_format_id
    ? getFormatById(String(spec.campaign.video_format_id).trim())
    : null;
  if (productName && formatDef?.categoryId === "produit") {
    if (causal === "automatic") {
      blocks.push(
        `Following the scene described in the idea above, the physical product ${productName} is clearly visible on screen at all times — consistently framed and recognizable from first to last frame, prominent in the composition without implying visible people or hands.`,
      );
    } else {
      blocks.push(
        `Following the scene and actions described in the idea above. Throughout the video, the person is visibly holding or interacting with ${productName}. The product ${productName} is clearly visible on screen at all times, held naturally in the person's hand or placed prominently in the foreground.`,
      );
    }
  }

  const noMusic = wantsNoMusic(spec.rendering.audio.music_style);
  if (noMusic) {
    blocks.push("audio_mode: silent");
    blocks.push(
      "Silent constraints: no dialogue, no speech, no voice over, no talking, no lip sync, no TTS, visual-only sequence.",
    );
    blocks.push("No background music, no soundtrack.");
  } else {
    const dialogueOn = spec.rendering.audio.dialogue_enabled !== false;
    blocks.push(`audio_mode: ${dialogueOn ? "dialogue" : "silent"}`);
    if (!dialogueOn) {
      blocks.push(
        "Silent constraints: no dialogue, no speech, no voice over, no talking, no lip sync, no TTS, visual-only sequence.",
      );
    }
  }

  if (spec.rendering.camera.fixed === true) {
    blocks.push(
      "Camera: locked-off static framing for the full shot; no camera movement — no pan, tilt, dolly, zoom, orbit, crane, or handheld drift.",
    );
  }

  const formatParamsFromCatalog = getVideoFormatConfigForCatalogId(spec.campaign.video_format_id);
  if (formatParamsFromCatalog) {
    blocks.push(formatVideoFormatParamsPromptAppendix(formatParamsFromCatalog));
  }

  blocks.push(
    "Build progression must unfold continuously from frame 0 to final frame with no temporal jump.",
  );

  return { prompt: blocks.filter(Boolean).join("\n"), dialogueText };
}
