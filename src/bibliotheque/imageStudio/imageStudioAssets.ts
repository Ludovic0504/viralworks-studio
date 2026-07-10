/** Base URL for Image Studio static assets (served from public/assets/image-studio/). */
export const IMAGE_STUDIO_ASSETS_BASE = "/assets/image-studio";

export const IMAGE_STUDIO_TEMPLATES_BASE = `${IMAGE_STUDIO_ASSETS_BASE}/templates`;

export const IMAGE_STUDIO_MODELS_BASE = `${IMAGE_STUDIO_ASSETS_BASE}/models`;

export function imageStudioTemplateAsset(...segments: string[]): string {
  return `${IMAGE_STUDIO_TEMPLATES_BASE}/${segments.join("/")}`;
}

export function imageStudioModelAsset(filename: string): string {
  return `${IMAGE_STUDIO_MODELS_BASE}/${filename}`;
}
