import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";

const MAX_REF_BYTES = 10 * 1024 * 1024;

export const IMAGE_STUDIO_SUPPORTED_REF_MIMES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

export const IMAGE_STUDIO_REF_IMPORT_MESSAGE =
  "Format non supporté. Importe une image JPG, PNG ou WebP (max 10 Mo).";

export function isSupportedImageStudioReferenceMime(mime: string): boolean {
  return IMAGE_STUDIO_SUPPORTED_REF_MIMES.includes(
    mime.toLowerCase() as (typeof IMAGE_STUDIO_SUPPORTED_REF_MIMES)[number],
  );
}

function parseImageDataUrl(
  dataUrl: string,
): { bytes: Uint8Array; mime: string; ext: string } | null {
  const match = String(dataUrl || "")
    .trim()
    .match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  try {
    const mime = match[1].toLowerCase();
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(mime)) {
      return null;
    }
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (bytes.length === 0 || bytes.length > MAX_REF_BYTES) return null;
    const ext =
      mime.includes("jpeg") || mime.includes("jpg")
        ? "jpg"
        : mime.includes("webp")
          ? "webp"
          : "png";
    return { bytes, mime, ext };
  } catch {
    return null;
  }
}

function normalizePublicStorageUrl(url: string): string {
  let u = String(url || "").trim();
  if (!u) return u;
  if (u.startsWith("http://")) u = u.replace("http://", "https://");
  u = u.replace(
    "/storage/v1/object/generated-images/",
    "/storage/v1/object/public/generated-images/",
  );
  return u;
}

export async function uploadImageStudioReferenceUrl(
  userId: string,
  input: string,
): Promise<string> {
  const trimmed = String(input || "").trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith("https://")) {
    return normalizePublicStorageUrl(trimmed);
  }

  if (trimmed.startsWith("http://")) {
    return normalizePublicStorageUrl(trimmed);
  }

  if (!trimmed.startsWith("data:")) {
    throw new Error("Format d'image de référence non supporté.");
  }

  const parsed = parseImageDataUrl(trimmed);
  if (!parsed) {
    throw new Error(IMAGE_STUDIO_REF_IMPORT_MESSAGE);
  }

  const supabase = getBrowserSupabase();
  const filePath = `${userId}/image-studio-refs/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${parsed.ext}`;
  const { error } = await supabase.storage.from("generated-images").upload(filePath, parsed.bytes, {
    contentType: parsed.mime,
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || "Impossible d'envoyer l'image de référence.");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("generated-images").getPublicUrl(filePath);

  return normalizePublicStorageUrl(publicUrl);
}

export async function uploadImageStudioReferenceUrls(
  userId: string,
  inputs: string[],
): Promise<string[]> {
  const urls: string[] = [];
  for (const input of inputs) {
    const trimmed = String(input || "").trim();
    if (!trimmed) continue;
    urls.push(await uploadImageStudioReferenceUrl(userId, trimmed));
  }
  return urls;
}
