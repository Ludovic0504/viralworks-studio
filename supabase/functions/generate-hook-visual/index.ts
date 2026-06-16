import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type Provider = "gpt-image-2" | "hailuo";
const OPENAI_EDITS_URL = "https://api.openai.com/v1/images/edits";
const MAX_REF_IMAGE_BYTES = 10 * 1024 * 1024;
const PRODUCT_REF_PROMPT_LINE =
  "Reproduce exactly the same product as shown in the reference image — identical packaging, same colors, same label, same shape.";

type RequestBody = {
  prompt: string;
  provider?: Provider;
  hookId: string | null;
  stagingIds: string[];
  aspectRatio: string; // "16:9" | "9:16" | "1:1" — vient du champ "ratio" côté UI
  subjectReferences?: unknown[];
  productReference?: string;
  /** Legacy client field — fusionné dans subjectReferences si absent */
  refCharacter?: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function resolveGptImageSize(aspectRatio: string): string {
  switch (aspectRatio) {
    case "16:9":
      return "1536x1024";
    case "9:16":
      return "1024x1536";
    case "1:1":
      return "1024x1024";
    default:
      return "1024x1024";
  }
}

function getServiceRoleKey(): string | null {
  return (
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
    Deno.env.get("SERVICE_ROLE_KEY")?.trim() ||
    null
  );
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parsePhotoDataUrl(dataUrl: string): {
  bytes: Uint8Array;
  mime: string;
  fileName: string;
} | null {
  const trimmed = dataUrl.trim();
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(mime)) {
    return null;
  }

  try {
    const bytes = base64ToUint8Array(match[2]);
    if (bytes.length === 0 || bytes.length > MAX_REF_IMAGE_BYTES) return null;
    const ext =
      mime.includes("jpeg") || mime.includes("jpg")
        ? "jpg"
        : mime.includes("webp")
          ? "webp"
          : "png";
    return { bytes, mime, fileName: `product-reference.${ext}` };
  } catch {
    return null;
  }
}

async function loadReferencePhotoBytes(
  refInput: string
): Promise<{ bytes: Uint8Array; mime: string; fileName: string } | null> {
  const trimmed = String(refInput || "").trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:")) {
    return parsePhotoDataUrl(trimmed);
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = trimmed.startsWith("http://") ? trimmed.replace("http://", "https://") : trimmed;
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") || "image/png").split(";")[0].trim().toLowerCase();
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_REF_IMAGE_BYTES) return null;
    const ext =
      mime.includes("jpeg") || mime.includes("jpg")
        ? "jpg"
        : mime.includes("webp")
          ? "webp"
          : "png";
    return { bytes: buf, mime, fileName: `product-reference.${ext}` };
  }

  return null;
}

/**
 * Upload binaire PNG via l'API REST Storage (fetch, pas de client JS).
 * Retourne l'URL publique du bucket `generated-images`.
 * Calqué sur studio-generate-avatar.
 */
async function uploadPngToGeneratedImages(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  userId: string;
  pngBytes: Uint8Array;
}): Promise<string> {
  const baseUrl = params.supabaseUrl.replace(/\/$/, "");
  const timestamp = Date.now();
  const objectPath = `${params.userId}/hook-visuals/${timestamp}.png`;
  const uploadUrl = `${baseUrl}/storage/v1/object/generated-images/${objectPath}`;

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.serviceRoleKey}`,
      apikey: params.serviceRoleKey,
      "Content-Type": "image/png",
      "Cache-Control": "3600",
      "x-upsert": "false",
    },
    body: params.pngBytes,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Échec upload Storage (${uploadRes.status}): ${errText.slice(0, 400)}`);
  }

  return `${baseUrl}/storage/v1/object/public/generated-images/${objectPath}`;
}

// ---------------------------------------------------------------------------
// Hailuo logic: calqué sur supabase/functions/hailuo-image/index.ts
// ---------------------------------------------------------------------------

async function resolveReferenceImageUrl(
  refInput: string,
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient> | null
): Promise<string | null> {
  const refCharacter = String(refInput || "").trim();
  if (!refCharacter) return null;

  try {
    if (refCharacter.startsWith("http://") || refCharacter.startsWith("https://")) {
      return refCharacter.startsWith("http://") ? refCharacter.replace("http://", "https://") : refCharacter;
    }

    if (!supabaseAdmin) return null;

    let base64Data = refCharacter;
    let mimeType = "image/png";

    if (refCharacter.startsWith("data:")) {
      const mimeMatch = refCharacter.match(/data:([^;]+);base64,(.+)/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
        base64Data = mimeMatch[2];
      }
    }

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const ext = mimeType.includes("jpeg") || mimeType.includes("jpg")
      ? "jpg"
      : mimeType.includes("png")
        ? "png"
        : mimeType.includes("webp")
          ? "webp"
          : "png";

    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage.from("image-references").upload(fileName, bytes, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) return null;

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("image-references").getPublicUrl(fileName);

    return publicUrl;
  } catch {
    return null;
  }
}

async function generateWithHailuo(params: {
  minimaxApiKey: string;
  prompt: string;
  aspectRatio: string;
  productReference?: string | null;
  subjectReferences: string[];
  userId: string;
  supabaseAdmin: ReturnType<typeof createClient> | null;
}): Promise<string> {
  const MAX_PROMPT_LENGTH = 1500;
  const trimmedPrompt = params.prompt.trim();
  const finalPrompt =
    trimmedPrompt.length > MAX_PROMPT_LENGTH ? trimmedPrompt.substring(0, MAX_PROMPT_LENGTH) : trimmedPrompt;

  // Hailuo accepte "16:9" | "9:16" | "1:1" nativement
  const ratioMap: Record<string, string> = {
    "16:9": "16:9",
    "1:1": "1:1",
    "9:16": "9:16",
  };
  const aspectRatio = ratioMap[params.aspectRatio] || "16:9";

  const requestBody: any = {
    model: "image-01",
    prompt: finalPrompt,
    aspect_ratio: aspectRatio,
    response_format: "url",
    n: 1,
    prompt_optimizer: true,
  };

  const subjectRefInputs = Array.isArray(params.subjectReferences)
    ? params.subjectReferences.filter((s) => typeof s === "string" && s.trim().length > 0)
    : [];

  const productRefInput =
    typeof params.productReference === "string" ? params.productReference.trim() : "";
  const primaryRefInput = productRefInput || subjectRefInputs[0] || "";

  if (primaryRefInput) {
    const referenceImageUrl = await resolveReferenceImageUrl(primaryRefInput, params.userId, params.supabaseAdmin);
    if (referenceImageUrl) {
      requestBody.subject_reference = [
        {
          type: "character",
          image_file: referenceImageUrl,
        },
      ];
    }
  }

  const minimaxResponse = await fetch("https://api.minimax.io/v1/image_generation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.minimaxApiKey.trim()}`,
    },
    body: JSON.stringify(requestBody),
  });

  const text = await minimaxResponse.text();

  if (!minimaxResponse.ok) {
    let errorMessage = `Erreur API MiniMax: ${minimaxResponse.status}`;
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.base_resp?.status_msg || errorData.error?.message || errorMessage;
    } catch {
      errorMessage = text || errorMessage;
    }
    throw new Error(errorMessage);
  }

  let minimaxData: any;
  try {
    minimaxData = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Réponse invalide de l'API MiniMax");
  }

  if (minimaxData?.base_resp?.status_code != null && minimaxData.base_resp.status_code !== 0) {
    throw new Error(String(minimaxData.base_resp.status_msg || "Erreur API MiniMax"));
  }

  const imageUrls: string[] = [];
  if (Array.isArray(minimaxData?.data?.image_urls)) imageUrls.push(...minimaxData.data.image_urls);
  else if (Array.isArray(minimaxData?.image_urls)) imageUrls.push(...minimaxData.image_urls);
  else if (Array.isArray(minimaxData?.data)) {
    minimaxData.data.forEach((item: any) => {
      if (item?.url) imageUrls.push(item.url);
      if (item?.image_url) imageUrls.push(item.image_url);
    });
  }

  const first = String(imageUrls[0] || "").trim();
  if (!first) throw new Error("Aucune image retournée par l'API MiniMax");
  return first;
}

async function callOpenAiEdits(
  prompt: string,
  photo: { bytes: Uint8Array; mime: string; fileName: string },
  openaiKey: string,
  size: string
): Promise<{ b64: string }> {
  const form = new FormData();
  form.append("model", "gpt-image-2");
  form.append("prompt", prompt);
  form.append("n", "1");
  form.append("size", size);
  form.append(
    "image[]",
    new Blob([photo.bytes], { type: photo.mime }),
    photo.fileName
  );

  const res = await fetch(OPENAI_EDITS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: form,
  });

  const text = await res.text();
  let data: { data?: Array<{ b64_json?: string }>; error?: { message?: string } } | null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      data?.error?.message || (typeof text === "string" ? text.slice(0, 400) : "") || `Erreur OpenAI (${res.status})`;
    const err = new Error(msg);
    (err as { status?: number }).status = res.status;
    throw err;
  }

  const b64 = data?.data?.[0]?.b64_json;
  if (!b64 || typeof b64 !== "string") {
    throw new Error("Réponse OpenAI invalide (b64_json manquant).");
  }
  return { b64 };
}

async function generateWithGptImage2(params: {
  openaiKey: string;
  prompt: string;
  aspectRatio: string;
  productReference?: string | null;
}): Promise<{ b64: string }> {
  const size = resolveGptImageSize(params.aspectRatio);

  if (params.productReference) {
    const photo = await loadReferencePhotoBytes(params.productReference);
    if (!photo) {
      throw new Error("Image de référence produit invalide ou trop volumineuse (max 10 Mo).");
    }
    const editsPrompt = params.prompt.includes(PRODUCT_REF_PROMPT_LINE)
      ? params.prompt
      : `${PRODUCT_REF_PROMPT_LINE}\n\n${params.prompt}`;
    return callOpenAiEdits(editsPrompt, photo, params.openaiKey, size);
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${params.openaiKey}` },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt: params.prompt,
      n: 1,
      size,
      quality: "low",
    }),
  });

  const text = await res.text();
  let data: { data?: Array<{ b64_json?: string }>; error?: { message?: string } } | null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      data?.error?.message || (typeof text === "string" ? text.slice(0, 400) : "") || `Erreur OpenAI (${res.status})`;
    const err = new Error(msg);
    (err as { status?: number }).status = res.status;
    throw err;
  }

  const b64 = data?.data?.[0]?.b64_json;
  if (!b64 || typeof b64 !== "string") {
    throw new Error("Réponse OpenAI invalide (b64_json manquant).");
  }
  return { b64 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non autorisée" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Token d'authentification manquant" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim() || "";
    const serviceRoleKey = getServiceRoleKey();
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Configuration serveur incomplète" }, 500);
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Non autorisé. Veuillez vous connecter." }, 401);
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Corps de requête invalide (JSON attendu)" }, 400);
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const hookId = typeof body.hookId === "string" && body.hookId.trim() ? body.hookId.trim() : null;
    const stagingIds = Array.isArray(body.stagingIds) ? body.stagingIds.filter((x) => typeof x === "string") : [];
    const aspectRatio = typeof body.aspectRatio === "string" ? body.aspectRatio.trim() : "16:9";
    const subjectReferencesRaw = Array.isArray(body.subjectReferences) ? body.subjectReferences : [];
    let subjectReferences = subjectReferencesRaw
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);

    if (subjectReferences.length === 0) {
      const legacyRef =
        typeof body.refCharacter === "string" ? body.refCharacter.trim() : "";
      if (legacyRef) subjectReferences = [legacyRef];
    }

    const productReferenceRaw =
      typeof body.productReference === "string" ? body.productReference.trim() : "";
    const productReference = productReferenceRaw || null;

    if (!prompt) return jsonResponse({ error: "Le prompt est requis et doit être une chaîne non vide." }, 400);

    const provider: Provider =
      body.provider === "gpt-image-2" || body.provider === "hailuo"
        ? body.provider
        : productReference && hookId
          ? "gpt-image-2"
          : productReference || subjectReferences.length > 0
            ? "hailuo"
            : hookId
              ? "gpt-image-2"
              : "hailuo";

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Le visuel d'accroche ne débite pas le solde workflow — seul le téléchargement vidéo le fait.
    let imageUrl = "";
    if (provider === "gpt-image-2") {
      const openaiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
      if (!openaiKey) {
        return jsonResponse({ error: "OPENAI_API_KEY manquante dans les secrets Supabase." }, 500);
      }

      const { b64 } = await generateWithGptImage2({
        openaiKey,
        prompt,
        aspectRatio,
        productReference: productReference && hookId ? productReference : null,
      });
      const pngBytes = base64ToUint8Array(b64);
      imageUrl = await uploadPngToGeneratedImages({ supabaseUrl, serviceRoleKey, userId: user.id, pngBytes });
    } else {
      const minimaxApiKey = Deno.env.get("MINIMAX_API_KEY")?.trim() ?? "";
      if (!minimaxApiKey) {
        return jsonResponse({ error: "Configuration serveur manquante. Contactez l'administrateur." }, 500);
      }

      imageUrl = await generateWithHailuo({
        minimaxApiKey,
        prompt,
        aspectRatio,
        productReference,
        subjectReferences,
        userId: user.id,
        supabaseAdmin,
      });
    }

    if (!imageUrl) return jsonResponse({ error: "Aucune image générée." }, 500);

    return jsonResponse({
      imageUrl,
      provider,
    });
  } catch (err) {
    const status = typeof (err as { status?: number })?.status === "number" ? (err as { status?: number }).status! : 500;
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return jsonResponse({ error: message }, status);
  }
});

