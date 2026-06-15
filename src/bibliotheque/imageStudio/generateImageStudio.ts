import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import type { ImageStudioAspectRatio, ImageStudioGenerationRefs } from "./imageStudioHistory";

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

const QUOTA_MESSAGE =
  "Quota mensuel atteint (200 images). Réessayez le mois prochain.";

export type { ImageStudioAspectRatio };

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
): Promise<GenerateImageStudioResult> {
  const supabase = getBrowserSupabase();
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;

  if (!accessToken) {
    throw new Error("Connexion requise pour générer une image.");
  }

  const { data, error } = await supabase.functions.invoke("generate-image-studio", {
    body: {
      prompt: prompt.trim(),
      aspectRatio,
      model,
      ...(referenceImage ? { referenceImage } : {}),
      ...(batchId ? { batchId } : {}),
      ...(generationRefs ? { generationRefs } : {}),
    },
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error) {
    let message = error.message || "Erreur lors de la génération.";
    if (error.context instanceof Response) {
      try {
        const parsed = (await error.context.clone().json()) as ErrorBody;
        if (parsed.code === "IMAGE_STUDIO_QUOTA_EXCEEDED") {
          throw new Error(QUOTA_MESSAGE);
        }
        if (parsed.code === "IMAGE_STUDIO_SUBSCRIPTION_REQUIRED") {
          throw new Error(
            parsed.userMessage ||
              "Un abonnement ViralWorks Image est requis pour générer des images.",
          );
        }
        message = parsed.userMessage || parsed.error || message;
      } catch (inner) {
        if (inner instanceof Error && inner.message === QUOTA_MESSAGE) throw inner;
      }
    }
    throw new Error(message);
  }

  const body = data as {
    url?: string;
    count?: number;
    limit?: number;
    historyId?: string;
    code?: string;
    userMessage?: string;
    error?: string;
    model?: ImageStudioModelId;
    provider?: string;
  };

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
