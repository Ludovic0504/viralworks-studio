import type { ImageStudioModelId } from "./generateImageStudio";
import { imageStudioModelAsset } from "./imageStudioAssets";

export type ImageStudioModelOption = {
  id: ImageStudioModelId;
  label: string;
  description: string;
};

export const IMAGE_STUDIO_MODEL_LOGOS: Record<ImageStudioModelId, string> = {
  nano_banana_pro: imageStudioModelAsset("nano-banana-open.png"),
  hailuo: imageStudioModelAsset("hailuo.png"),
  gpt_image_2: imageStudioModelAsset("gpt-image-2.png"),
};

export const IMAGE_STUDIO_MODEL_OPTIONS: ImageStudioModelOption[] = [
  {
    id: "nano_banana_pro",
    label: "NanaBanana Pro",
    description: "Dernier modèle, performances maximales, capacités inégalées.",
  },
  {
    id: "hailuo",
    label: "Hailuo Image",
    description: "Modèle haute qualité, excellent pour les portraits.",
  },
  {
    id: "gpt_image_2",
    label: "GPT Image 2.0",
    description: "Photo-réalisme renforcé, plus de détails et de fidélité des couleurs.",
  },
];

export function getImageStudioModelLabel(modelId: string): string {
  return IMAGE_STUDIO_MODEL_OPTIONS.find((opt) => opt.id === modelId)?.label ?? "Image";
}

export function getImageStudioModelOption(
  modelId: string,
): ImageStudioModelOption | undefined {
  return IMAGE_STUDIO_MODEL_OPTIONS.find((opt) => opt.id === modelId);
}

export function getImageStudioModelLogo(modelId: string): string | undefined {
  return IMAGE_STUDIO_MODEL_LOGOS[modelId as ImageStudioModelId];
}
