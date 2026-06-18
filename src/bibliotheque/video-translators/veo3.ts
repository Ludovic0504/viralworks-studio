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

function buildProductPhysicalModelBlock(
  formatId: string,
  productName: string,
  isSelfieIntent: boolean,
  staging: string | null,
): string {
  switch (formatId) {
    case "produit_pub_esthetique":
      return (
        `Product-only hero shot. ${productName} is the sole subject of the video. ` +
        `No hands, no human interaction unless the Idea section explicitly describes a human gesture. ` +
        `Film the product as an object — through light, texture, slow motion movement. ` +
        `Do not place a person holding the product unless the idea requires it.`
      );

    case "produit_demo": {
      const isHandsOn = staging === "mains_produit";
      if (isHandsOn) {
        return (
          `Throughout the video, the person is visibly holding or interacting with ${productName}. ` +
          `The product ${productName} is clearly visible on screen at all times, held naturally in the person's hand or placed prominently in the foreground. ` +
          `CRITICAL: the person has exactly two hands. No extra limbs. ` +
          `If both hands are needed for an action (e.g. applying a product to the face), ` +
          `the product container must be placed on a nearby surface before that action begins — it must not remain held.`
        );
      } else if (isSelfieIntent) {
        return (
          `SELFIE SINGLE-HAND PROTOCOL — strictly enforced, no exceptions:\n\n` +

          `CAMERA RULE:\n` +
          `One hand holds the camera throughout the entire video. ` +
          `This hand is NEVER shown on screen. ` +
          `No cut, no camera change, no perspective shift. ` +
          `Selfie POV is maintained from the first frame to the last frame.\n\n` +

          `HAND RULE:\n` +
          `Only ONE hand is visible at any time — the non-camera hand. ` +
          `At no point are two hands visible simultaneously in the frame. ` +
          `This is a hard constraint: if two hands appear, it is a failure.\n\n` +

          `SEQUENCE — the visible hand does everything:\n` +
          `- Opening (seconds 0–2): the visible hand holds ${productName}. ` +
          `The jar arrives pre-opened — no lid removal gesture. ` +
          `The hand presents the jar naturally toward the lens.\n` +
          `- Scoop (seconds 2–4): the same hand scoops a small amount of cream ` +
          `with one finger directly from the open jar.\n` +
          `- Release (seconds 3–5): the hand naturally moves the jar out of frame — ` +
          `it may be placed off-screen or lowered below the frame. ` +
          `No explicit "set down" gesture required — the jar simply exits the frame.\n` +
          `- Application (seconds 4–8): the same single hand applies cream ` +
          `to the face with fingertips. One hand only. ` +
          `The motion is gentle and deliberate.\n\n` +

          `CRITICAL:\n` +
          `- No cut between selfie and fixed camera. One continuous shot only.\n` +
          `- The camera-holding hand is never shown, never implied on screen.\n` +
          `- ${productName} exits the frame naturally — it does not teleport or ` +
          `transform. It is not required to remain visible after the scoop.\n` +
          `- The person has exactly two hands total. The camera hand is one of them ` +
          `and is permanently off-screen. The visible hand is the other one.`
        );
      } else {
        return (
        `BEHAVIORAL PROTOCOL — choose ONE of the two protocols below ` +
        `and commit to it from the first frame to the last. Do not mix them.\n\n` +

        `PROTOCOL A — HOLD THROUGHOUT:\n` +
        `Use this if ${productName} remains in one hand for the full duration.\n` +
        `- The non-dominant hand holds ${productName} at all times, ` +
        `from first frame to last frame. It never releases the jar.\n` +
        `- The dominant hand is the only hand that interacts with ` +
        `the product and applies it — using one or two fingertips only.\n` +
        `- TWO-HANDED FACE APPLICATION IS FORBIDDEN in Protocol A. ` +
        `The non-dominant hand holding the jar never moves toward the face. ` +
        `It stays at chest or waist level throughout.\n` +
        `- Lid lifecycle: if the lid is opened, it is visibly set aside ` +
        `on a nearby surface — it does not disappear from the scene. ` +
        `The jar base remains in the non-dominant hand at all times.\n\n` +

        `PROTOCOL B — SHOW THEN SET DOWN:\n` +
        `Use this if the video transitions from product interaction ` +
        `to two-handed application.\n` +
        `- Phase 1 (seconds 0–3): person interacts with ${productName} — ` +
        `shows it to camera, opens lid, or scoops cream with one finger.\n` +
        `- TRANSITION (must be visible on screen): person places ` +
        `${productName} on a nearby surface with a deliberate, visible gesture. ` +
        `The jar must be seen resting on the surface before the hands move ` +
        `to the face. The jar does not disappear — it is physically set down.\n` +
        `- Phase 2 (seconds 3–8): both hands are free. Person applies cream ` +
        `to face with fingertips.\n` +
        `- ${productName} remains visible on the surface in the background ` +
        `during Phase 2. It does not teleport, vanish, or reappear arbitrarily.\n` +
        `- Lid lifecycle: if opened during Phase 1, the lid is visibly ` +
        `set aside — it does not disappear.\n\n` +

        `CRITICAL (both protocols):\n` +
        `- The person has exactly two hands. No extra limbs. No phantom hands.\n` +
        `- Protocol A: jar never leaves the non-dominant hand.\n` +
        `- Protocol B: jar must be visibly placed on a surface before ` +
        `both hands touch the face.\n` +
        `- Never mix protocols mid-video.`
        );
      }
    }

    case "produit_test_review":
      return isSelfieIntent
        ? `The person tests ${productName} while facing the camera in selfie perspective. ` +
            `They hold the product in one hand at a time — never simultaneously with the camera hand. ` +
            `When ${productName} is not being actively tested, it rests on a surface or is held loosely at waist level, out of the primary frame. ` +
            `At no point are more than 2 hands visible. The camera hand is never shown.`
        : `The person tests ${productName} and gives their reaction. ` +
            `They hold or interact with ${productName} with one hand. ` +
            `The other hand may gesture naturally. No more than 2 hands visible at any time. ` +
            `${productName} may be placed on a surface between active test moments.`;

    case "produit_comparatif":
      // Note : le spec ne contient qu'un seul nom produit (champ profession).
      // Le second produit est inféré par le LLM depuis l'Idea.
      // Ne pas tenter de résoudre cela ici — c'est une évolution de schéma séparée.
      // Le fallback "competing product" ci-dessous est la solution temporaire intentionnelle.
      return (
        `COMPARISON VIDEO — two distinct products are compared. ` +
        `Read the Idea section carefully to identify both Product A and Product B. ` +
        `Product A is held or placed on the LEFT side of frame. Product B is on the RIGHT side. ` +
        `Each hand is assigned to one product — left hand for Product A, right hand for Product B. ` +
        `The two products are never merged, confused, or touching. ` +
        `If the idea names only one product (${productName}), treat the second as a generic competitor ` +
        `described as "a competing product" positioned opposite. ` +
        `CRITICAL: the person has exactly two hands. One product per hand. No third hand.`
      );

    case "produit_focus_detail":
      return (
        `Extreme macro close-up of ${productName}'s texture, material surface, or finish detail. ` +
        `Human hands are optional — include them only if the Idea section explicitly mentions ` +
        `touching, feeling, or gliding across the surface. ` +
        `If a hand appears: one single finger trace only, slow motion, deliberate gesture. ` +
        `${productName} rests on a neutral surface — it is not held up or presented to camera.`
      );

    case "produit_preuve_performance":
      return (
        `${productName} is subjected to a physical stress test as described in the Idea. ` +
        `The product may be placed, dropped, exposed, or submerged — it is NOT necessarily held throughout. ` +
        `Human hands appear only to: (1) initiate the test, or (2) reveal the result after. ` +
        `During the stress sequence itself, ${productName} may rest independently on a surface or in the environment. ` +
        `No more than 2 hands visible at any point.`
      );

    case "produit_reveal":
      return (
        `${productName} is CONCEALED at frame 0 — covered, wrapped, in shadow, or behind an object. ` +
        `Do NOT show ${productName} held or visible at the start of the video. ` +
        `The reveal unfolds progressively: the occluder (cloth, cover, shadow, box lid) ` +
        `is removed in a single fluid motion by one or two hands. ` +
        `${productName} is first touched or held only at the moment of reveal. ` +
        `The occluder must have a defined exit path — it does not disappear, it is moved aside or lifted off.`
      );

  // Pas de case "produit_unboxing" : cette fonction n'est jamais
  // appelée pour l'unboxing (le if supérieur le capture avant d'arriver ici).

    default:
      return isSelfieIntent
        ? `Following the scene and actions described in the idea above. Throughout the video, the person is visibly holding ${productName} naturally in one hand, presenting it toward the camera. The product ${productName} is clearly visible on screen at all times.`
        : `Following the scene and actions described in the idea above. Throughout the video, the person is visibly holding or interacting with ${productName}. The product ${productName} is clearly visible on screen at all times, held naturally in the person's hand or placed prominently in the foreground.`;
  }
}

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
  const packagingBoxAppearance = String(spec.campaign.packaging_box_appearance ?? "").trim();
  if (spec.campaign.video_format_id === "produit_unboxing" && packagingOpeningGesture) {
    blocks.push(
      `CRITICAL HAND CONSTRAINT: ${hasShrinkWrap ? "The box has intact factory shrink wrap — right hand peels it off cleanly in the first 1.5 seconds before proceeding with the sleeve grip. " : "The box is already unwrapped — no plastic film, no shrink wrap, no cellophane anywhere on the box. The sleeve grip begins at frame 0 with no preliminary unwrapping step of any kind. "}${packagingOpeningGesture} The stabilizing hand must remain completely still during the entire opening sequence. BOX MATERIAL INTEGRITY: ${packagingBoxAppearance ? `the box is exactly as described — ${packagingBoxAppearance}.` : "the box is rigid cardboard."} This exact material, color, texture and shape must remain strictly identical from frame 0 to the last frame — the box surface never stretches, wrinkles, becomes transparent, develops plastic or film texture, or deforms under finger pressure at any point. Any gripping or pulling gesture must show the box moving as a completely rigid solid object. This constraint overrides any other camera or movement instruction.`,
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

  const intentProfile = spec.campaign.intent_profile;
  const cameraFaceMode = spec.campaign.clarification.camera_face_mode;
  const isSelfieIntent =
    cameraFaceMode === "selfie"
      ? true
      : cameraFaceMode === "fixed"
        ? false
        : spec.rendering.camera.selfie_mode === true ||
          intentProfile?.humanPresence === "selfie";

  const hookUrl = String(spec.creative.hook_visual.selected_image_url ?? "").trim();
  if (hookUrl) {
    if (isSelfieIntent) {
      blocks.push(
        "Start from the exact selected hook image as the first frame. " +
          "Maintain character identity and environment continuity from that initial state. " +
          "EXCEPTION: the camera perspective in the hook image is a reference only — " +
          "the selfie POV rules above take absolute priority over hook composition. " +
          "If the hook image shows a non-selfie perspective, ignore the camera angle " +
          "and apply the selfie POV from frame 0. Character identity and environment " +
          "must match, but camera position must be selfie handheld.",
      );
    } else {
      blocks.push(
        "Start from the exact selected hook image as the first frame and keep identity, " +
          "composition and environment continuity from that initial state.",
      );
    }
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
  const videoFormatId = String(spec.campaign.video_format_id ?? "").trim();
  const stagingChip = spec.campaign.staging_chips?.[0];
  const staging =
    stagingChip && typeof stagingChip === "string" && stagingChip.trim()
      ? stagingChip.trim()
      : null;
  const formatDef = spec.campaign.video_format_id
    ? getFormatById(String(spec.campaign.video_format_id).trim())
    : null;
  if (productName && formatDef?.categoryId === "produit") {
    if (spec.campaign.video_format_id === "produit_unboxing") {
      blocks.push(
        `The ${productName} is hidden inside the closed box at frame 0 and must not be visible until the opening gesture reveals it. As the lid separates, the ${productName} becomes progressively visible. By the final frame, the ${productName} is fully revealed and clearly visible inside the open box, resting in its original factory position in the tray, screen off.`,
      );
    } else if (causal === "automatic") {
      blocks.push(
        `Following the scene described in the idea above, the physical product ${productName} is clearly visible on screen at all times — consistently framed and recognizable from first to last frame, prominent in the composition without implying visible people or hands.`,
      );
    } else {
      const physicalModel = buildProductPhysicalModelBlock(
        videoFormatId,
        productName,
        isSelfieIntent,
        staging,
      );
      if (physicalModel) blocks.push(physicalModel);
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
  } else if (spec.rendering.camera.fixed === true) {
    blocks.push(
      "Camera: locked-off static framing for the full shot; no camera " +
        "movement — no pan, tilt, dolly, zoom, orbit, crane, or handheld drift.",
    );
  } else if (cameraFaceMode === "fixed") {
    blocks.push(
      "Camera: stable framing from a fixed support — tripod or surface mount. " +
        "The support is never visible on screen. " +
        "No handheld movement, no perspective drift.",
    );
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
    blocks.push(
      formatVideoFormatParamsPromptAppendix(
        formatParamsForAppendix,
        isSelfieIntent
          ? {
              isSelfie: true,
              actualDurationSeconds: spec.rendering.duration_seconds ?? 8,
            }
          : undefined,
      ),
    );
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
