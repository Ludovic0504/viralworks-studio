import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type Provider = "gpt-image-2" | "hailuo";

type RequestBody = {
  prompt: string;
  hookId: string | null;
  stagingIds: string[];
  aspectRatio: string; // "16:9" | "9:16" | "1:1" — vient du champ "ratio" côté UI
  subjectReferences?: unknown[];
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

async function sumUserCredits(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string
): Promise<number> {
  const { data, error } = await supabaseAdmin.from("user_credits").select("credits").eq("user_id", userId);
  if (error) throw new Error(error.message || "Erreur lecture crédits.");
  const rows = Array.isArray(data) ? data : [];
  return rows.reduce((sum, r) => sum + Number((r as { credits?: unknown })?.credits ?? 0), 0);
}

async function debitUserCreditsAtomic(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  userId: string;
  amount: number;
  reason: string;
  metadata: Record<string, unknown>;
}): Promise<{ remainingCredits: number }> {
  const { data: rpcRaw, error: rpcError } = await params.supabaseAdmin.rpc("debit_user_credits_atomic", {
    p_user_id: params.userId,
    p_amount: Math.floor(params.amount),
    p_reason: params.reason,
    p_metadata: params.metadata,
  });

  if (rpcError) {
    throw new Error(
      rpcError.message || "Erreur lors du débit (vérifie que la migration SQL est appliquée)."
    );
  }

  const rpcData = rpcRaw as
    | { success?: boolean; error?: string; remaining_credits?: number; debited?: number }
    | null;

  if (!rpcData || rpcData.success !== true) {
    const msg = String(rpcData?.error || "Débit refusé");
    const insufficient = msg === "Crédits insuffisants";
    const err = new Error(msg);
    (err as { status?: number }).status = insufficient ? 402 : 400;
    throw err;
  }

  return { remainingCredits: Number(rpcData.remaining_credits ?? 0) };
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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

  if (subjectRefInputs.length > 0) {
    const primaryRefInput = subjectRefInputs[0];
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

async function generateWithGptImage2(params: {
  openaiKey: string;
  prompt: string;
  aspectRatio: string;
}): Promise<{ b64: string }> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${params.openaiKey}` },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt: params.prompt,
      n: 1,
      size: resolveGptImageSize(params.aspectRatio),
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
    const subjectReferences = subjectReferencesRaw
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);

    if (!prompt) return jsonResponse({ error: "Le prompt est requis et doit être une chaîne non vide." }, 400);

    const provider: Provider = hookId ? "gpt-image-2" : "hailuo";
    const creditsUsed = provider === "gpt-image-2" ? 2 : 1;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Vérifier le solde côté serveur (avant appel modèle)
    const currentCredits = await sumUserCredits(supabaseAdmin, user.id);
    if (currentCredits < creditsUsed) {
      return jsonResponse(
        {
          error: "Crédits insuffisants",
          current_credits: currentCredits,
          required: creditsUsed,
        },
        402
      );
    }

    // 2) Appeler le modèle
    let imageUrl = "";
    if (provider === "gpt-image-2") {
      const openaiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
      if (!openaiKey) {
        return jsonResponse({ error: "OPENAI_API_KEY manquante dans les secrets Supabase." }, 500);
      }

      const { b64 } = await generateWithGptImage2({ openaiKey, prompt, aspectRatio });
      const pngBytes = base64ToUint8Array(b64);
      imageUrl = await uploadPngToGeneratedImages({ supabaseUrl, serviceRoleKey, userId: user.id, pngBytes });
    } else {
      // Reprendre exactement la logique hailuo-image (env key fallbacks + prompt_optimizer + 1500 chars)
      const env = Deno.env.toObject();
      let minimaxApiKey =
        env["CléAPI_Hailuo_Image"] ||
        env["CleAPI_Hailuo_Image"] ||
        env["MINIMAX_API_KEY"] ||
        env["HAILUO_API_KEY"] ||
        env["HAILUO_IMAGE_API_KEY"] ||
        Deno.env.get("CléAPI_Hailuo_Image") ||
        Deno.env.get("MINIMAX_API_KEY") ||
        Deno.env.get("HAILUO_API_KEY");
      minimaxApiKey = minimaxApiKey ? minimaxApiKey.trim() : "";
      if (!minimaxApiKey) {
        return jsonResponse({ error: "Configuration serveur manquante. Contactez l'administrateur." }, 500);
      }

      imageUrl = await generateWithHailuo({
        minimaxApiKey,
        prompt,
        aspectRatio,
        subjectReferences,
        userId: user.id,
        supabaseAdmin,
      });
    }

    if (!imageUrl) return jsonResponse({ error: "Aucune image générée." }, 500);

    // 3) Débiter post-succès (si race condition, on ne casse pas l'UX)
    let debitWarning = false;
    let remainingCredits: number | null = null;
    try {
      const debit = await debitUserCreditsAtomic({
        supabaseAdmin,
        userId: user.id,
        amount: creditsUsed,
        reason: "hook_visual_generation",
        metadata: {
          provider,
          hookId,
          stagingIds,
          aspectRatio,
        },
      });
      remainingCredits = debit.remainingCredits;
    } catch {
      debitWarning = true;
    }

    return jsonResponse({
      imageUrl,
      provider,
      creditsUsed,
      remainingCredits,
      debitWarning,
    });
  } catch (err) {
    const status = typeof (err as { status?: number })?.status === "number" ? (err as { status?: number }).status! : 500;
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return jsonResponse({ error: message }, status);
  }
});

