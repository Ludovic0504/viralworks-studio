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
}

export function buildVideoEditPrompt(config: VideoEditConfig): string {
  const filledAvatarCount = config.avatarUrls.filter(Boolean).length;

  const promptPayload = {
    prompt_parameters: {
      references: {
        video: {
          source: "reference_video_1",
          role: "scene environment and camera movement",
          instructions:
            "keep original camera path, geometry, lighting and scene structure intact throughout the entire video",
        },
        avatars: config.avatarUrls
          .map((url, index) =>
            url
              ? {
                  source: `reference_image_${index + 1}`,
                  role: "character",
                  instructions:
                    "preserve face, body proportions and outfit exactly as shown",
                }
              : null
          )
          .filter(Boolean),
        reference_image: config.refImageUrl
          ? {
              source: `reference_image_${filledAvatarCount + 1}`,
              mode: config.refImageMode,
              role:
                config.refImageMode === "état_final"
                  ? "target state for progressive scene transformation"
                  : "visual style and atmosphere inspiration only, do not reproduce exactly",
            }
          : null,
      },
      scene: {
        presenter: config.avatarUrls.some(Boolean)
          ? {
              behavior:
                "stands naturally in the space, faces camera, gestures toward the scene",
              tone: "confident and professional",
              language: "french",
              consistency:
                "character must remain visually identical throughout entire video",
            }
          : null,
        transformation:
          config.refImageUrl && config.refImageMode === "état_final"
            ? {
                type: "progressive",
                instructions:
                  "scene transforms smoothly from original state to final state, transformation happens gradually without cuts",
              }
            : null,
      },
      modifications: config.modifications
        .filter((m) => m.what.trim() !== "")
        .map((mod) => ({
          action: mod.what,
          location: mod.where || "anywhere relevant in the scene",
          asset_reference: mod.assetUrl
            ? "provided as additional reference image"
            : null,
          timing:
            "identify the relevant moment and location automatically from the video context",
        })),
      output: {
        aspect_ratio: "9:16",
        duration_seconds: config.durationSec,
        resolution: "720p",
        generate_audio: true,
        style: "cinematic, photorealistic, natural lighting",
        quality: "professional social media content",
      },
      general_instructions: {
        scene_preservation:
          "do not modify architectural elements, walls, floors or fixed structures unless explicitly requested in modifications",
        character_consistency:
          "maintain identical character appearance in every frame",
        realism:
          "all additions and modifications must match the scene lighting, perspective and style",
        rendering:
          "real photography style only, no CGI, no illustration, no cartoon",
      },
    },
  };

  return JSON.stringify(promptPayload);
}
