/**
 * Génération avatar Studio — Kie AI (Nano Banana Pro) ou repli MiniMax (hailuo-image).
 * Actions : create (taskId ou résultat sync) | poll (statut Kie).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log(
  "[studio-generate-avatar] Env keys:",
  Object.keys(Deno.env.toObject()).sort()
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const KIE_BASE = "https://api.kie.ai";

interface CreateBody {
  action: "create";
  prompt: string;
  format?: "face" | "triptyque";
  referenceImageUrl?: string;
  ratio?: string;
}

interface PollBody {
  action: "poll";
  taskId: string;
}

type RequestBody = CreateBody | PollBody;

class KieFallbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KieFallbackError";
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getKieApiKey(): string | null {
  const key =
    Deno.env.get("KIE_AI_API_KEY")?.trim() ||
    Deno.env.get("KIE_API_KEY")?.trim() ||
    "";
  return key.length > 0 ? key : null;
}

function getMinimaxApiKey(): string | null {
  const env = Deno.env.toObject();
  const key =
    env["CléAPI_Hailuo_Image"] ||
    env["CleAPI_Hailuo_Image"] ||
    env["MINIMAX_API_KEY"] ||
    env["HAILUO_API_KEY"] ||
    env["HAILUO_IMAGE_API_KEY"] ||
    Deno.env.get("MINIMAX_API_KEY") ||
    Deno.env.get("HAILUO_API_KEY") ||
    "";
  const trimmed = String(key).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isKieCreditsOrRateLimitError(err: unknown): boolean {
  if (err instanceof KieFallbackError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    /credits?\s+insufficient|insufficient\s+credit|not\s+enough\s+to\s+run|your\s+current\s+balance|top\s*up|crédit\s+insuffisant/.test(
      lower
    ) ||
    /\b402\b|\b429\b|rate\s*limit|too\s+many\s+requests/.test(lower)
  );
}

function throwIfKieShouldFallback(
  httpStatus: number,
  apiCode: number | undefined,
  message: string
): void {
  const combined = `${httpStatus} ${apiCode ?? ""} ${message}`.toLowerCase();
  if (
    httpStatus === 402 ||
    httpStatus === 429 ||
    apiCode === 402 ||
    apiCode === 429 ||
    isKieCreditsOrRateLimitError(new Error(message))
  ) {
    throw new KieFallbackError(message || `Kie HTTP ${httpStatus}`);
  }
}

async function kieCreateAvatarTask(
  kieApiKey: string,
  prompt: string,
  options: {
    referenceImageUrl?: string;
    ratio?: string;
    format?: "face" | "triptyque";
  } = {}
): Promise<string> {
  const model =
    Deno.env.get("KIE_IMAGE_EDIT_MODEL")?.trim() || "nano-banana-pro";
  const format = options.format === "triptyque" ? "triptyque" : "face";

  const imageInput: string[] = [];
  if (options.referenceImageUrl?.trim()) {
    const url = options.referenceImageUrl.trim().replace(/^http:\/\//i, "https://");
    imageInput.push(url);
  }

  const kieRatioMap: Record<string, string> = {
    "16:9": "16:9",
    "9:16": "9:16",
    "3:1": "16:9",
    "1:1": "1:1",
    "4:3": "4:3",
  };
  const ratio = options.ratio || (format === "triptyque" ? "16:9" : "9:16");
  const aspect_ratio = kieRatioMap[ratio] || (format === "triptyque" ? "16:9" : "9:16");

  const input: Record<string, unknown> = {
    prompt: prompt.trim(),
    aspect_ratio,
    resolution: "1K",
    output_format: "png",
    image_input: imageInput,
  };

  if (format === "triptyque") {
    console.log("[triptyque] Kie createTask input:", JSON.stringify({ model, input }));
    console.log("[triptyque] Kie image_input count:", imageInput.length, {
      referencePresent: imageInput.length > 0,
      referencePreview: imageInput[0]?.slice(0, 120) ?? null,
    });
  }

  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${kieApiKey}`,
    },
    body: JSON.stringify({ model, input }),
  });

  const text = await res.text();
  let json: { code?: number; msg?: string; data?: { taskId?: string } };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throwIfKieShouldFallback(res.status, undefined, text.slice(0, 200));
    throw new Error("Kie AI (createTask) : réponse invalide");
  }

  const apiCode = json.code;
  const apiMsg = json.msg || `Kie createTask (HTTP ${res.status})`;

  if (apiCode !== 200 || !json.data?.taskId) {
    throwIfKieShouldFallback(res.status, apiCode, apiMsg);
    throw new Error(apiMsg);
  }

  return json.data.taskId;
}

async function kiePollTask(
  taskId: string,
  kieApiKey: string
): Promise<{ status: string; avatarUrl?: string; error?: string }> {
  const res = await fetch(
    `${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${kieApiKey}` } }
  );

  const text = await res.text();
  let json: {
    code?: number;
    msg?: string;
    data?: {
      state?: string;
      resultJson?: string;
      failMsg?: string;
      failCode?: string;
    };
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error("Kie AI (recordInfo) : JSON invalide");
  }

  if (json.code !== 200) {
    const msg = json.msg || `Kie recordInfo code ${json.code}`;
    throwIfKieShouldFallback(res.status, json.code, msg);
    throw new Error(msg);
  }

  const d = json.data;
  if (!d?.state) {
    return { status: "pending" };
  }

  if (d.state === "success") {
    const rj = d.resultJson;
    if (!rj) throw new Error("Kie AI : succès sans resultJson");
    let parsed: { resultUrls?: string[] };
    try {
      parsed = JSON.parse(rj) as { resultUrls?: string[] };
    } catch {
      throw new Error("Kie AI : resultJson illisible");
    }
    const url = parsed.resultUrls?.[0];
    if (!url) throw new Error("Kie AI : aucune image dans resultUrls");
    return { status: "completed", avatarUrl: url };
  }

  if (d.state === "fail") {
    const failMsg =
      [d.failMsg, d.failCode].filter(Boolean).join(" — ") ||
      "Génération échouée";
    if (isKieCreditsOrRateLimitError(new Error(failMsg))) {
      throw new KieFallbackError(failMsg);
    }
    return { status: "failed", error: failMsg };
  }

  return { status: "pending" };
}

/** Ordre de préférence — nano-banana via Kie (createTask) ; essai aussi sur api.minimax.io */
const MINIMAX_AVATAR_MODEL_CANDIDATES = [
  "nano-banana-pro",
  "nano-banana-2",
  "nano-banana",
  "image-01",
] as const;

function isMinimaxInvalidModelError(
  httpStatus: number,
  message: string
): boolean {
  if (httpStatus === 400) return true;
  const lower = message.toLowerCase();
  return (
    /model\s+not\s+found|invalid\s+model|unknown\s+model|unsupported\s+model/.test(
      lower
    ) ||
    /model.*(not\s+(supported|available|exist)|does\s+not\s+exist)/.test(
      lower
    ) ||
    /param.*\bmodel\b|invalid.*\bmodel\b/.test(lower)
  );
}

/** Même structure que hailuo-image : subject_reference[{ type, image_file }] */
function applyMinimaxSubjectReference(
  requestBody: Record<string, unknown>,
  referenceImageUrl: string
): string {
  const refUrl = referenceImageUrl.trim().replace(/^http:\/\//i, "https://");
  requestBody.subject_reference = [
    {
      type: "character",
      image_file: refUrl,
    },
  ];
  return refUrl;
}

async function minimaxTryModel(
  apiKey: string,
  requestBody: Record<string, unknown>,
  model: string
): Promise<string> {
  const body = {
    ...requestBody,
    model: model === "Image-01" ? "image-01" : model,
  };

  const res = await fetch("https://api.minimax.io/v1/image_generation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(body),
  });

  const errText = await res.text();
  let parsed: {
    base_resp?: { status_code?: number; status_msg?: string };
    error?: { message?: string };
    data?: { image_urls?: string[] };
    image_urls?: string[];
  } = {};

  try {
    parsed = JSON.parse(errText) as typeof parsed;
  } catch {
    /* corps non-JSON */
  }

  const apiMsg =
    parsed.base_resp?.status_msg ||
    parsed.error?.message ||
    errText.slice(0, 300) ||
    `Erreur API MiniMax: ${res.status}`;

  if (!res.ok) {
    const err = new Error(apiMsg);
    (err as Error & { httpStatus?: number }).httpStatus = res.status;
    throw err;
  }

  const statusCode = parsed.base_resp?.status_code;
  if (statusCode !== 0 && statusCode !== undefined) {
    const err = new Error(apiMsg);
    (err as Error & { httpStatus?: number }).httpStatus = 400;
    throw err;
  }

  const urls: string[] = [];
  if (Array.isArray(parsed.data?.image_urls)) {
    urls.push(...parsed.data.image_urls);
  } else if (Array.isArray(parsed.image_urls)) {
    urls.push(...parsed.image_urls);
  }

  if (!urls[0]) {
    const err = new Error("Aucune image retournée par MiniMax");
    (err as Error & { httpStatus?: number }).httpStatus = 400;
    throw err;
  }

  const url = urls[0].startsWith("http://")
    ? urls[0].replace("http://", "https://")
    : urls[0];
  return url;
}

async function minimaxGenerateImage(
  apiKey: string,
  prompt: string,
  ratio = "9:16",
  options: {
    referenceImageUrl?: string;
    format?: "face" | "triptyque";
  } = {}
): Promise<string> {
  const isTriptyque = options.format === "triptyque";
  const finalPrompt = prompt.trim();

  const ratioMap: Record<string, string> = {
    "16:9": "16:9",
    "1:1": "1:1",
    "9:16": "9:16",
    "4:3": "4:3",
    "3:1": "16:9",
  };
  const aspectRatio = isTriptyque
    ? "16:9"
    : ratioMap[ratio] || "9:16";

  const baseRequestBody: Record<string, unknown> = {
    prompt: finalPrompt,
    aspect_ratio: aspectRatio,
    response_format: "url",
    n: 1,
    prompt_optimizer: true,
  };

  if (isTriptyque) {
    const ref = options.referenceImageUrl?.trim();
    if (!ref) {
      throw new Error(
        "Triptyque : referenceImageUrl manquante pour subject_reference MiniMax"
      );
    }
    const refUrl = applyMinimaxSubjectReference(baseRequestBody, ref);
    console.log("[triptyque] referenceImageUrl reçue:", refUrl);
  }

  let lastError = "Aucun modèle MiniMax disponible";

  for (let i = 0; i < MINIMAX_AVATAR_MODEL_CANDIDATES.length; i++) {
    const model = MINIMAX_AVATAR_MODEL_CANDIDATES[i];
    const isLast = i === MINIMAX_AVATAR_MODEL_CANDIDATES.length - 1;

    if (isTriptyque) {
      console.log(
        "[triptyque] body envoyé:",
        JSON.stringify({ ...baseRequestBody, model })
      );
    }

    try {
      const url = await minimaxTryModel(apiKey, baseRequestBody, model);
      console.log("[avatar] modèle utilisé:", model);
      return url;
    } catch (err) {
      const httpStatus =
        (err as Error & { httpStatus?: number }).httpStatus ?? 0;
      const msg = err instanceof Error ? err.message : String(err);

      if (!isLast && isMinimaxInvalidModelError(httpStatus, msg)) {
        console.log(
          `[avatar] modèle ${model} indisponible (${httpStatus}) — essai suivant:`,
          msg.slice(0, 200)
        );
        lastError = msg;
        continue;
      }

      throw err instanceof Error ? err : new Error(msg);
    }
  }

  throw new Error(lastError);
}

async function respondMinimaxCompleted(
  minimaxKey: string,
  prompt: string,
  ratio: string,
  format: "face" | "triptyque",
  creditsUsed: number,
  reason: string,
  referenceImageUrl?: string
): Promise<Response> {
  console.log(`[studio-generate-avatar] ${reason}`);
  if (format === "triptyque") {
    console.log("[triptyque] fallback MiniMax — referenceImageUrl:", {
      present: Boolean(referenceImageUrl?.trim()),
      preview: referenceImageUrl?.trim().slice(0, 120) ?? null,
      ratio,
    });
  }
  const avatarUrl = await minimaxGenerateImage(minimaxKey, prompt, ratio, {
    referenceImageUrl,
    format,
  });
  return jsonResponse({
    status: "completed",
    avatarUrl,
    jobId: `minimax-${Date.now()}`,
    provider: "minimax",
    format,
    creditsUsed,
  });
}

async function handleCreate(
  body: CreateBody
): Promise<Response> {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return jsonResponse({ error: "Le prompt est requis" }, 400);
  }

  const format = body.format === "triptyque" ? "triptyque" : "face";
  const ratio =
    body.ratio || (format === "triptyque" ? "16:9" : "9:16");
  const creditsUsed = format === "triptyque" ? 4 : 2;

  if (format === "triptyque" && !body.referenceImageUrl?.trim()) {
    return jsonResponse(
      { error: "Image de référence requise pour le triptyque (previewFaceUrl)." },
      400
    );
  }

  if (format === "triptyque") {
    console.log("[triptyque] requête create reçue:", {
      format,
      ratio,
      referenceImageUrlPresent: Boolean(body.referenceImageUrl?.trim()),
      referenceImageUrlPreview: body.referenceImageUrl?.trim().slice(0, 120) ?? null,
      promptLength: prompt.length,
    });
  }

  const minimaxKey = getMinimaxApiKey();
  const kieApiKey = getKieApiKey();

  console.log("[studio-generate-avatar] Provider choice:", {
    hasKieKey: Boolean(kieApiKey),
    hasMinimaxKey: Boolean(minimaxKey),
  });

  if (!kieApiKey) {
    if (!minimaxKey) {
      return jsonResponse(
        {
          error:
            "Configuration serveur manquante (KIE_AI_API_KEY ou clé MiniMax/Hailuo).",
        },
        500
      );
    }
    return respondMinimaxCompleted(
      minimaxKey,
      prompt,
      ratio,
      format,
      creditsUsed,
      "Pas de clé Kie — génération MiniMax directe",
      body.referenceImageUrl
    );
  }

  try {
    const taskId = await kieCreateAvatarTask(kieApiKey, prompt, {
      referenceImageUrl: body.referenceImageUrl,
      ratio,
      format,
    });
    return jsonResponse({
      status: "pending",
      taskId,
      provider: "kie",
      format,
      creditsUsed,
    });
  } catch (kieErr) {
    if (isKieCreditsOrRateLimitError(kieErr) && minimaxKey) {
      return respondMinimaxCompleted(
        minimaxKey,
        prompt,
        ratio,
        format,
        creditsUsed,
        "Kie indisponible (crédits / rate limit) — fallback MiniMax",
        body.referenceImageUrl
      );
    }
    throw kieErr;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Token d'authentification manquant" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Non autorisé. Veuillez vous connecter." }, 401);
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Corps JSON invalide" }, 400);
    }

    if (body.action === "poll") {
      const kieApiKey = getKieApiKey();
      const minimaxKey = getMinimaxApiKey();
      if (!body.taskId) {
        return jsonResponse({ error: "taskId requis" }, 400);
      }
      if (!kieApiKey) {
        return jsonResponse({ error: "Polling non disponible sans Kie AI" }, 400);
      }
      try {
        const result = await kiePollTask(body.taskId, kieApiKey);
        return jsonResponse(result);
      } catch (pollErr) {
        if (isKieCreditsOrRateLimitError(pollErr) && minimaxKey) {
          return jsonResponse(
            {
              error:
                "Tâche Kie interrompue (crédits). Relancez « Générer mon avatar » pour utiliser MiniMax.",
              status: "failed",
            },
            200
          );
        }
        throw pollErr;
      }
    }

    if (body.action !== "create") {
      return jsonResponse({ error: "action invalide (create | poll)" }, 400);
    }

    return await handleCreate(body);
  } catch (error) {
    console.error("studio-generate-avatar:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Erreur serveur",
      },
      500
    );
  }
});
