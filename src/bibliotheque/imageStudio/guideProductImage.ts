import {
  IMAGE_STUDIO_REF_IMPORT_MESSAGE,
  isSupportedImageStudioReferenceMime,
} from "./uploadImageStudioReference";

export const GUIDE_PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export type ReadGuideProductImageResult =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string };

export function readGuideProductImageFile(file: File): Promise<ReadGuideProductImageResult> {
  if (!isSupportedImageStudioReferenceMime(file.type)) {
    return Promise.resolve({ ok: false, error: IMAGE_STUDIO_REF_IMPORT_MESSAGE });
  }

  if (file.size > GUIDE_PRODUCT_IMAGE_MAX_BYTES) {
    return Promise.resolve({ ok: false, error: IMAGE_STUDIO_REF_IMPORT_MESSAGE });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "").trim();
      if (!dataUrl) {
        resolve({ ok: false, error: IMAGE_STUDIO_REF_IMPORT_MESSAGE });
        return;
      }
      resolve({ ok: true, dataUrl });
    };
    reader.onerror = () => {
      resolve({ ok: false, error: IMAGE_STUDIO_REF_IMPORT_MESSAGE });
    };
    reader.readAsDataURL(file);
  });
}
