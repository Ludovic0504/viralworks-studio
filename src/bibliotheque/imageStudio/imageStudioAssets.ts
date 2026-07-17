/** Base URL for Image Studio static assets (served from public/assets/image-studio/). */
export const IMAGE_STUDIO_ASSETS_BASE = "/assets/image-studio";

export const IMAGE_STUDIO_TEMPLATES_BASE = `${IMAGE_STUDIO_ASSETS_BASE}/templates`;

export const IMAGE_STUDIO_MODELS_BASE = `${IMAGE_STUDIO_ASSETS_BASE}/models`;

/**
 * Bust PWA/Workbox caches for unhashed public files under /assets/.
 * Bump when a model/template asset is replaced in place.
 */
const IMAGE_STUDIO_ASSET_REV = "2";

function withAssetRev(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${IMAGE_STUDIO_ASSET_REV}`;
}

export function imageStudioTemplateAsset(...segments: string[]): string {
  return withAssetRev(`${IMAGE_STUDIO_TEMPLATES_BASE}/${segments.join("/")}`);
}

export function imageStudioModelAsset(filename: string): string {
  return withAssetRev(`${IMAGE_STUDIO_MODELS_BASE}/${filename}`);
}
