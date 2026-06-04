export interface VideoEditModification {
  what: string;
  where: string;
  assetUrl: string | null;
}

export type VideoEditRefImageMode = "état_final" | "inspiration" | null;

export interface VideoEditConfig {
  avatarUrls: (string | null)[];
  refImageUrl: string | null;
  refImageMode: VideoEditRefImageMode;
  modifications: VideoEditModification[];
  durationSec: number;
  dialogueEnabled: boolean;
  aspectRatio: string;
  anchorSecond?: number;
  transformationStart?: number;
}

export function buildVideoEditPrompt(config: VideoEditConfig): string {
  const aspectRatio = config.aspectRatio === "16:9" ? "16:9" : "9:16";
  const sections: string[] = [];
  const hasAvatars = config.avatarUrls.some(Boolean);
  const filledAvatarCount = config.avatarUrls.filter(Boolean).length;
  const refImageIndex = filledAvatarCount > 0 ? filledAvatarCount + 1 : 1;

  const assetLines: string[] = [
    `@Video1 — Source footage. 
Reproduce exactly its spatial geometry, architecture, wall positions, 
pillar locations, and all visible structural elements.
Every element visible in @Video1 must appear at the exact same 
position in the output — left side, right side, depth, proportions.
Do NOT invent, mirror, or hallucinate any architectural element 
that is not visible in @Video1.
Use its original camera angles as strict reference.
The left side and right side of the space must match @Video1 exactly — 
do NOT swap, mirror, or flip the spatial layout.`,
  ];
  if (hasAvatars) {
    assetLines.push(
      `@Image1 — Presenter character. Visible on camera at all times.
Maintain their exact face, outfit, and proportions throughout 
the entire video. They NEVER disappear, teleport, or reappear.`,
    );
  }
  if (config.refImageUrl && config.refImageMode === "état_final") {
    assetLines.push(
      `@Image${refImageIndex} — Final state reference frame. Defines the finished 
visual state of the space: materials, lighting, surfaces, finishes.`,
    );
  }
  if (config.refImageUrl && config.refImageMode === "inspiration") {
    assetLines.push(
      `@Image${refImageIndex} — Style and mood reference only. Extract color palette, 
lighting atmosphere, material textures. Do not reproduce literally.`,
    );
  }
  sections.push(`ASSETS\n\n${assetLines.join("\n\n")}`);

  if (hasAvatars) {
    sections.push(
      `SCENE DESCRIPTION

The presenter walks through the space, speaks naturally and 
confidently to camera — documentary style. They move through 
the space, gesture at walls and areas, and present the environment 
around them.`,
    );
  }

  if (config.refImageUrl && config.refImageMode === "état_final") {
    const hasTiming =
      config.anchorSecond != null && config.transformationStart != null;
    const timingBlock = hasTiming
      ? `

TIMING:
From 0s to ${config.transformationStart}s: reproduce @Video1 exactly
as filmed — raw original state, no changes whatsoever,
no transformation, no cleanup, no lighting change.
From ${config.transformationStart}s: begin the progressive transformation.
At ${config.anchorSecond}s: the space must match @Image${refImageIndex} exactly.
The transformation is complete by ${config.anchorSecond}s.`
      : "";

    sections.push(
      `TRANSFORMATION EFFECT

As the camera follows the presenter through the space, the 
environment progressively transforms into the final state from 
@Image${refImageIndex} — in real time, while they are still talking.
This is NOT a before/after cut. It is a continuous, flowing reveal:
- Raw elements gradually become the finished surfaces from @Image${refImageIndex}
- The space completes itself section by section as the camera moves
- The transformation follows the camera movement: what the camera 
  points at transforms first, background areas transform last.
- The effect is smooth and deliberate — like a premium reveal.${timingBlock}`,
    );
  }

  if (config.refImageUrl && config.refImageMode === "inspiration") {
    sections.push(
      `TRANSFORMATION EFFECT

The visual style, color palette, and lighting atmosphere from 
@Image${refImageIndex} are progressively applied to the environment as the 
camera moves through the space. The transformation is smooth 
and continuous — not a cut.`,
    );
  }

  const activeModifications = config.modifications.filter(
    (m) => m.what.trim() !== "",
  );
  if (activeModifications.length > 0) {
    const modificationList = activeModifications
      .map((mod) => {
        const what = mod.what.trim();
        const where = mod.where.trim();
        return where ? `${what} — ${where}` : what;
      })
      .join("\n");
    sections.push(
      `MODIFICATIONS

Apply the following modifications to the scene.
Each modification integrates naturally — as if always part of the space:
${modificationList}`,
    );
  }

  if (hasAvatars) {
    sections.push(
      `CAMERA & MOVEMENT

Handheld documentary-style camera that follows the presenter closely.
They are always in frame — centered or slightly off-center.
Camera moves with them as they walk and gesture.
No jump cuts. No transitions. One continuous shot.
Use the spatial geometry and camera angles from @Video1 as reference.`,
    );
  } else {
    sections.push(
      `CAMERA & MOVEMENT

Use the original camera movement, angles, and spatial geometry 
from @Video1 exactly as the base layer throughout the entire video.
No jump cuts. No transitions. One continuous shot.`,
    );
  }

  if (hasAvatars && config.dialogueEnabled) {
    sections.push(
      `DIALOGUE

Generate natural spoken dialogue in FRENCH language only.
Use a neutral French accent. Synchronize speech with the visual 
transformation. Adapt content to what is visible on screen.`,
    );
  }

  sections.push(
    `FORMAT

Vertical ${aspectRatio}. Duration exactly ${config.durationSec} seconds.`,
  );

  return sections.join("\n\n---\n\n");
}
