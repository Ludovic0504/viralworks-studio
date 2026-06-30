import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import type { ImageStudioAspectRatio, ImageStudioGenerationRefs } from "./imageStudioHistory";
import { IMAGE_STUDIO_PROMPT_MAX_LENGTH } from "./promptMentions";
import { uploadImageStudioReferenceUrls } from "./uploadImageStudioReference";

export type ImageStudioModelId = "nano_banana_pro" | "hailuo" | "gpt_image_2";

export type ImageStudioModelsAvailability = Record<ImageStudioModelId, boolean>;

export type GenerateImageStudioResult = {
  url: string;
  count: number;
  limit: number;
  historyId?: string;
  model?: ImageStudioModelId;
  provider?: string;
};

type ErrorBody = {
  error?: string;
  userMessage?: string;
  code?: string;
};

export const IMAGE_STUDIO_BUSY_MESSAGE =
  "Les serveurs sont saturés, réessaye dans quelques instants.";

export const IMAGE_STUDIO_PATIENT_HINT =
  "Les serveurs sont occupés, patientez…";

export const IMAGE_STUDIO_RETRY_HINT =
  "Nouvel essai automatique en cours…";

const QUOTA_MESSAGE =
  "Quota mensuel atteint. Réessayez le mois prochain.";

const KIE_CREDITS_MESSAGE =
  "Crédits Kie AI insuffisants. Recharge ton compte Kie puis réessaie.";

export const IMAGE_STUDIO_REF_FORMAT_MESSAGE =
  "Format d'image non supporté. Importe une image JPG, PNG ou WebP (max 10 Mo).";

const REF_ERROR_CODES = new Set([
  "INVALID_REF_FORMAT",
  "INVALID_REF_IMAGE",
  "REF_IMAGE_TOO_LARGE",
]);

export type { ImageStudioAspectRatio };

export { IMAGE_STUDIO_PROMPT_MAX_LENGTH };

function pickUserFacingMessage(
  response: Response,
  data: ErrorBody | null,
  rawText: string,
): string {
  const code = data?.code ?? "";

  if (code === "IMAGE_STUDIO_QUOTA_EXCEEDED") return QUOTA_MESSAGE;
  if (code === "IMAGE_STUDIO_SUBSCRIPTION_REQUIRED") {
    return data?.userMessage || "Un abonnement ViralWorks Image est requis pour générer des images.";
  }
  if (code === "KIE_CREDITS") return KIE_CREDITS_MESSAGE;
  if (code.startsWith("KIE_")) return IMAGE_STUDIO_BUSY_MESSAGE;
  if (code === "PROMPT_TOO_LONG") {
    return data?.userMessage || "Le prompt est trop long.";
  }
  if (REF_ERROR_CODES.has(code)) {
    return data?.userMessage || data?.error || IMAGE_STUDIO_REF_FORMAT_MESSAGE;
  }
  if (code === "GENERATION_FAILED" && data?.userMessage) {
    return data.userMessage;
  }

  if (data?.userMessage) {
    if (response.status >= 500) return IMAGE_STUDIO_BUSY_MESSAGE;
    return data.userMessage;
  }
  if (data?.error) {
    if (response.status >= 500) return IMAGE_STUDIO_BUSY_MESSAGE;
    if (response.status < 500) return data.error;
  }

  if (response.status === 429) return QUOTA_MESSAGE;
  if (response.status === 402) return KIE_CREDITS_MESSAGE;
  if (response.status === 413) {
    return "Les images jointes sont trop lourdes. Réduis la taille de @Image1 ou utilise une photo plus légère.";
  }
  if (response.status === 504 || response.status === 503 || response.status >= 502) {
    return IMAGE_STUDIO_BUSY_MESSAGE;
  }

  const trimmed = rawText.trim();
  if (trimmed && trimmed.length <= 280 && !trimmed.startsWith("{")) {
    return trimmed;
  }

  return IMAGE_STUDIO_BUSY_MESSAGE;
}

export async function fetchImageStudioModels(): Promise<ImageStudioModelsAvailability> {
  const supabase = getBrowserSupabase();
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const fallback: ImageStudioModelsAvailability = {
    nano_banana_pro: false,
    hailuo: false,
    gpt_image_2: false,
  };

  if (!accessToken || !supabaseUrl || !anonKey) return fallback;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-image-studio`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { models?: Partial<ImageStudioModelsAvailability> };
    return {
      nano_banana_pro: Boolean(data.models?.nano_banana_pro),
      hailuo: Boolean(data.models?.hailuo),
      gpt_image_2: Boolean(data.models?.gpt_image_2),
    };
  } catch {
    return fallback;
  }
}

export async function generateImageStudio(
  prompt: string,
  aspectRatio: ImageStudioAspectRatio = "1:1",
  model: ImageStudioModelId = "nano_banana_pro",
  referenceImage?: string | null,
  batchId?: string,
  generationRefs?: ImageStudioGenerationRefs | null,
  referenceImages?: string[] | null,
  userPrompt?: string | null,
): Promise<GenerateImageStudioResult> {
  const supabase = getBrowserSupabase();
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;
  const userId = session.data.session?.user?.id;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!accessToken || !userId) {
    throw new Error("Connexion requise pour générer une image.");
  }
  if (!supabaseUrl || !anonKey) {
    throw new Error("Configuration Supabase manquante.");
  }

  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length > IMAGE_STUDIO_PROMPT_MAX_LENGTH) {
    throw new Error(
      `Le prompt ne doit pas dépasser ${IMAGE_STUDIO_PROMPT_MAX_LENGTH.toLocaleString("fr-FR")} caractères.`,
    );
  }

  const rawReferenceImages = Array.isArray(referenceImages)
    ? referenceImages.map((url) => String(url || "").trim()).filter(Boolean)
    : referenceImage
      ? [String(referenceImage).trim()].filter(Boolean)
      : [];

  const normalizedReferenceImages =
    rawReferenceImages.length > 0
      ? await uploadImageStudioReferenceUrls(userId, rawReferenceImages)
      : [];

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/generate-image-studio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        prompt: trimmedPrompt,
        ...(userPrompt?.trim() ? { userPrompt: userPrompt.trim() } : {}),
        aspectRatio,
        model,
        ...(normalizedReferenceImages.length > 0
          ? { referenceImages: normalizedReferenceImages }
          : {}),
        ...(batchId ? { batchId } : {}),
        ...(generationRefs ? { generationRefs } : {}),
      }),
    });
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(IMAGE_STUDIO_BUSY_MESSAGE);
    }
    throw err;
  }

  const rawText = await response.text();
  let body: ErrorBody & {
    url?: string;
    count?: number;
    limit?: number;
    historyId?: string;
    model?: ImageStudioModelId;
    provider?: string;
  };

  try {
    body = JSON.parse(rawText) as typeof body;
  } catch {
    if (!response.ok) {
      throw new Error(pickUserFacingMessage(response, null, rawText));
    }
    throw new Error("Réponse serveur invalide.");
  }

  if (!response.ok) {
    throw new Error(pickUserFacingMessage(response, body, rawText));
  }

  if (body?.code === "IMAGE_STUDIO_QUOTA_EXCEEDED") {
    throw new Error(QUOTA_MESSAGE);
  }

  if (body?.code === "IMAGE_STUDIO_SUBSCRIPTION_REQUIRED") {
    throw new Error(
      body.userMessage ||
        "Un abonnement ViralWorks Image est requis pour générer des images.",
    );
  }

  if (!body?.url) {
    throw new Error(body?.userMessage || body?.error || "URL d'image manquante.");
  }

  return {
    url: body.url,
    count: typeof body.count === "number" ? body.count : 0,
    limit: typeof body.limit === "number" ? body.limit : 200,
    historyId: typeof body.historyId === "string" ? body.historyId : undefined,
    model: body.model,
    provider: body.provider,
  };
}
