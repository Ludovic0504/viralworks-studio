/**
 * Image Studio — génération multi-modèles avec quota mensuel selon l'offre.
 * GET  → disponibilité des modèles (clés API configurées)
 * POST → génération (nano_banana_pro | hailuo | gpt_image_2)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getImageStudioMonthlyLimit,
  planAllowsImageStudio,
  resolveUserPlan,
} from "../_shared/plan-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const KIE_BASE = "https://api.kie.ai";
const OPENAI_GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_EDITS_URL = "https://api.openai.com/v1/images/edits";
const HAILUO_API_URL = "https://api.minimax.io/v1/image_generation";
const KIE_IMAGE_RESOLUTION = "2K";
const MAX_REF_IMAGE_BYTES = 10 * 1024 * 1024;
const MSG_BUSY =
  "Les serveurs sont saturés, réessaye dans quelques instants.";

/** Nouvelles tentatives createTask uniquement (pas de taskId = pas de débit Kie). */
const KIE_CREATE_MAX_ATTEMPTS = 4;
const KIE_CREATE_BACKOFF_MS = [4000, 10000, 20000];
/** Extension du polling sur la même tâche Kie (pas de second createTask). */
const KIE_POLL_EXTENSION_MS = 5 * 60 * 1000;

type ImageStudioModel = "nano_banana_pro" | "hailuo" | "gpt_image_2";

type RequestBody = {
  prompt?: string;
  userPrompt?: string;
  aspectRatio?: string;
  model?: string;
  referenceImage?: string;
  referenceImages?: string[];
  batchId?: string;
  generationRefs?: {
    avatarUrl?: string | null;
    productUrl?: string | null;
    importedRefUrl?: string | null;
  };
};

const ALLOWED_RATIOS = new Set(["1:1", "9:16", "16:9"]);
const ALLOWED_MODELS = new Set<ImageStudioModel>([
  "nano_banana_pro",
  "hailuo",
  "gpt_image_2",
]);

function normalizeAspectRatio(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  return ALLOWED_RATIOS.has(value) ? value : "1:1";
}

function normalizeModel(raw: unknown): ImageStudioModel {
  const value = typeof raw === "string" ? raw.trim() : "";
  return ALLOWED_MODELS.has(value as ImageStudioModel)
    ? (value as ImageStudioModel)
    : "nano_banana_pro";
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(
  status: number,
  code: string,
  userMessage: string,
): Response {
  return jsonResponse({ error: userMessage, userMessage, code }, status);
}

function getServiceRoleKey(): string | null {
  return (
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
    Deno.env.get("SERVICE_ROLE_KEY")?.trim() ||
    null
  );
}

function getKieApiKey(): string | null {
  return (
    Deno.env.get("KIE_AI_API_KEY")?.trim() ||
    Deno.env.get("KIE_API_KEY")?.trim() ||
    null
  );
}

function getOpenAiKey(): string | null {
  return Deno.env.get("OPENAI_API_KEY")?.trim() || null;
}

function getHailuoApiKey(): string | null {
  const env = Deno.env.toObject();
  const key =
    env["CléAPI_Hailuo_Image"]?.trim() ||
    env["CleAPI_Hailuo_Image"]?.trim() ||
    env["MINIMAX_API_KEY"]?.trim() ||
    env["HAILUO_API_KEY"]?.trim() ||
    env["HAILUO_IMAGE_API_KEY"]?.trim() ||
    Deno.env.get("CléAPI_Hailuo_Image")?.trim() ||
    Deno.env.get("MINIMAX_API_KEY")?.trim() ||
    Deno.env.get("HAILUO_API_KEY")?.trim() ||
    null;
  return key || null;
}

function getModelsAvailability() {
  return {
    nano_banana_pro: Boolean(getKieApiKey()),
    hailuo: Boolean(getHailuoApiKey()),
    gpt_image_2: Boolean(getOpenAiKey()),
  };
}

function openAiSizeForRatio(ratio: string): string {
  if (ratio === "16:9") return "1536x1024";
  if (ratio === "9:16") return "1024x1536";
  return "1024x1024";
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function isKieCreditsError(message: string): boolean {
  const lower = message.toLowerCase();
  return /402|credits?\s+insufficient|insufficient\s+credit|crédit\s+insuffisant/i.test(
    lower,
  );
}

/** Erreurs avant obtention d’un taskId — safe pour retry sans second débit Kie. */
function isRetryableKieCreateError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (isKieCreditsError(lower)) return false;
  if (
    /invalid|bad request|parameter|unauthorized|forbidden|401|403|prompt rejected|content policy/i.test(
      lower,
    )
  ) {
    return false;
  }
  return (
    /429|503|502|504|408|timeout|rate limit|too many|upstream|maintenance|unavailable|gateway|temporarily|saturation|busy|overloaded/i.test(
      lower,
    ) ||
    /réponse invalide|createTask échoué|recordInfo/i.test(lower)
  );
}

function isKiePollTimeout(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return /délai dépassé|timeout|timed out/i.test(raw);
}

function isKieTaskTerminalFailure(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return /génération échouée|aucune image dans resulturls|succès sans resultjson/i.test(
    raw,
  );
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const SUPPORTED_REF_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const REF_FORMAT_MESSAGE =
  "Format d'image non supporté. Importe une image JPG, PNG ou WebP (max 10 Mo).";

const REF_TOO_LARGE_MESSAGE =
  "L'image de référence est trop lourde ou vide. Utilise une photo JPG/PNG de moins de 10 Mo.";

const REF_UNREADABLE_MESSAGE =
  "Impossible de lire l'image de référence (@Image1). Réimporte-la en JPG ou PNG.";

class ImageStudioUserError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ImageStudioUserError";
  }
}

function isImageStudioUserError(err: unknown): err is ImageStudioUserError {
  return err instanceof ImageStudioUserError;
}

function extFromMime(mime: string): string {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  return "png";
}

function inferMimeFromUrl(url: string): string | null {
  if (/\.jpe?g(\?|$)/i.test(url)) return "image/jpeg";
  if (/\.webp(\?|$)/i.test(url)) return "image/webp";
  if (/\.png(\?|$)/i.test(url)) return "image/png";
  return null;
}

function normalizeRefMime(raw: string, sourceUrl?: string): string {
  const mime = raw.split(";")[0].trim().toLowerCase();
  if (SUPPORTED_REF_MIMES.has(mime)) return mime;
  if (sourceUrl) {
    const inferred = inferMimeFromUrl(sourceUrl);
    if (inferred) return inferred;
  }
  throw new ImageStudioUserError("INVALID_REF_FORMAT", REF_FORMAT_MESSAGE);
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
  if (!SUPPORTED_REF_MIMES.has(mime)) {
    return null;
  }
  try {
    const bytes = base64ToUint8Array(match[2]);
    if (bytes.length === 0 || bytes.length > MAX_REF_IMAGE_BYTES) return null;
    return {
      bytes,
      mime,
      fileName: `reference.${extFromMime(mime)}`,
    };
  } catch {
    return null;
  }
}

async function resolveReferencePhotoInput(
  input: string,
): Promise<{ bytes: Uint8Array; mime: string; fileName: string }> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ImageStudioUserError("INVALID_REF_IMAGE", REF_UNREADABLE_MESSAGE);
  }

  if (trimmed.startsWith("data:")) {
    const parsed = parsePhotoDataUrl(trimmed);
    if (!parsed) {
      throw new ImageStudioUserError("INVALID_REF_FORMAT", REF_FORMAT_MESSAGE);
    }
    return parsed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const fetchUrl = trimmed.startsWith("http://")
      ? trimmed.replace("http://", "https://")
      : trimmed;
    const res = await fetch(fetchUrl);
    if (!res.ok) {
      throw new ImageStudioUserError("INVALID_REF_IMAGE", REF_UNREADABLE_MESSAGE);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_REF_IMAGE_BYTES) {
      throw new ImageStudioUserError("REF_IMAGE_TOO_LARGE", REF_TOO_LARGE_MESSAGE);
    }
    const mime = normalizeRefMime(
      res.headers.get("content-type") || "image/png",
      fetchUrl,
    );
    return {
      bytes,
      mime,
      fileName: `reference.${extFromMime(mime)}`,
    };
  }

  throw new ImageStudioUserError("INVALID_REF_IMAGE", REF_UNREADABLE_MESSAGE);
}

async function uploadReferenceToStorage(
  supabaseAdmin: SupabaseClient,
  userId: string,
  refInput: string,
): Promise<string | null> {
  const trimmed = refInput.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.startsWith("http://")
      ? trimmed.replace("http://", "https://")
      : trimmed;
  }
  const parsed = parsePhotoDataUrl(trimmed);
  if (!parsed) return null;
  const ext = parsed.fileName.split(".").pop() || "png";
  const fileName = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from("image-references")
    .upload(fileName, parsed.bytes, {
      contentType: parsed.mime,
      cacheControl: "3600",
      upsert: false,
    });
  if (error) {
    console.error("upload reference:", error);
    return null;
  }
  const { data } = supabaseAdmin.storage.from("image-references").getPublicUrl(fileName);
  return data.publicUrl || null;
}

const GENERATED_IMAGES_BUCKET = "generated-images";

async function uploadBytesToGeneratedImages(
  supabaseUrl: string,
  serviceRoleKey: string,
  objectPath: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const uploadUrl =
    `${baseUrl}/storage/v1/object/${GENERATED_IMAGES_BUCKET}/${objectPath}`;

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": contentType,
      "Cache-Control": "3600",
      "x-upsert": "false",
    },
    body: bytes,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(
      `Échec upload Storage (${uploadRes.status}): ${errText.slice(0, 400)}`,
    );
  }

  return `${baseUrl}/storage/v1/object/public/${GENERATED_IMAGES_BUCKET}/${objectPath}`;
}

async function persistGeneratedImageUrl(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  sourceUrl: string,
): Promise<string> {
  const trimmed = sourceUrl.trim();
  let bytes: Uint8Array;
  let contentType = "image/png";
  let ext = "png";

  if (trimmed.startsWith("data:")) {
    const parsed = parsePhotoDataUrl(trimmed);
    if (!parsed) throw new Error("Image générée invalide (data URL).");
    bytes = parsed.bytes;
    contentType = parsed.mime;
    ext = parsed.fileName.split(".").pop() || "png";
  } else if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const fetchUrl = trimmed.startsWith("http://")
      ? trimmed.replace("http://", "https://")
      : trimmed;
    const res = await fetch(fetchUrl);
    if (!res.ok) {
      throw new Error(`Impossible de télécharger l'image générée (${res.status}).`);
    }
    bytes = new Uint8Array(await res.arrayBuffer());
    contentType = res.headers.get("content-type") || "image/png";
    if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
    else if (contentType.includes("webp")) ext = "webp";
  } else {
    throw new Error("Format d'URL image non supporté.");
  }

  const objectPath =
    `${userId}/image-studio/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  return uploadBytesToGeneratedImages(
    supabaseUrl,
    serviceRoleKey,
    objectPath,
    bytes,
    contentType,
  );
}

async function saveImageStudioHistoryEntry(
  supabaseAdmin: SupabaseClient,
  userId: string,
  prompt: string,
  imageUrl: string,
  aspectRatio: string,
  model: string,
  batchId?: string | null,
  generationRefs?: RequestBody["generationRefs"] | null,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("history")
    .insert({
      user_id: userId,
      kind: "image",
      input: prompt,
      output: imageUrl,
      model,
      metadata: {
        source: "image_studio",
        aspectRatio,
        imageStudioModel: model,
        ...(batchId ? { batchId } : {}),
        ...(generationRefs ? { generationRefs } : {}),
        urls: [imageUrl],
      },
    })
    .select("id")
    .single();

  if (error) {
    console.error("save image studio history:", error);
    return null;
  }

  return typeof data?.id === "string" ? data.id : null;
}

async function kieCreateTask(
  kieApiKey: string,
  model: string,
  prompt: string,
  aspectRatio: string,
  referenceUrls?: string[] | null,
): Promise<string> {
  const urls = Array.isArray(referenceUrls)
    ? referenceUrls.map((url) => String(url || "").trim()).filter(Boolean)
    : [];
  const input: Record<string, unknown> = urls.length > 0
    ? {
        prompt,
        image_input: urls,
        aspect_ratio: aspectRatio,
        resolution: KIE_IMAGE_RESOLUTION,
        output_format: "png",
      }
    : {
        prompt,
        aspect_ratio: aspectRatio,
        resolution: KIE_IMAGE_RESOLUTION,
        output_format: "png",
      };

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
    throw new Error(`Kie AI (createTask) : réponse invalide — ${text.slice(0, 200)}`);
  }
  if (json.code !== 200 || !json.data?.taskId) {
    throw new Error(
      json.msg || `Kie AI createTask échoué (code ${json.code ?? res.status})`,
    );
  }
  return json.data.taskId;
}

async function kieCreateTaskWithRetries(
  kieApiKey: string,
  model: string,
  prompt: string,
  aspectRatio: string,
  referenceUrls?: string[] | null,
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= KIE_CREATE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await kieCreateTask(
        kieApiKey,
        model,
        prompt,
        aspectRatio,
        referenceUrls,
      );
    } catch (err) {
      lastErr = err;
      if (!isRetryableKieCreateError(err) || attempt >= KIE_CREATE_MAX_ATTEMPTS) {
        throw err;
      }
      const backoff = KIE_CREATE_BACKOFF_MS[attempt - 1] ?? 20000;
      console.warn(
        `generate-image-studio: createTask tentative ${attempt}/${KIE_CREATE_MAX_ATTEMPTS}, nouvel essai dans ${backoff}ms`,
      );
      await sleep(backoff);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function kiePollUntilImageUrl(
  taskId: string,
  kieApiKey: string,
  maxWaitMs: number,
): Promise<string> {
  const start = Date.now();
  let delay = 2500;
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${kieApiKey}` } },
    );
    const text = await res.text();
    let json: {
      code?: number;
      msg?: string;
      data?: { state?: string; resultJson?: string; failMsg?: string };
    };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      throw new Error(`Kie AI (recordInfo) : JSON invalide`);
    }
    if (json.code !== 200) {
      throw new Error(json.msg || `Kie recordInfo code ${json.code}`);
    }
    const d = json.data;
    if (!d) {
      await sleep(delay);
      delay = Math.min(delay + 400, 8000);
      continue;
    }
    if (d.state === "success") {
      const rj = d.resultJson;
      if (!rj) throw new Error("Kie AI : succès sans resultJson");
      const parsed = JSON.parse(rj) as { resultUrls?: string[] };
      const url = parsed.resultUrls?.[0];
      if (!url) throw new Error("Kie AI : aucune image dans resultUrls");
      return url;
    }
    if (d.state === "fail") {
      throw new Error(d.failMsg || "Kie AI : génération échouée");
    }
    await sleep(delay);
    delay = Math.min(delay + 400, 8000);
  }
  throw new Error("Kie AI : délai dépassé");
}

/** Polling prolongé sur le même taskId — pas de second createTask / pas de double débit Kie. */
async function kiePollWithOptionalExtension(
  taskId: string,
  kieApiKey: string,
  maxPollMs: number,
): Promise<string> {
  try {
    return await kiePollUntilImageUrl(taskId, kieApiKey, maxPollMs);
  } catch (err) {
    if (isKiePollTimeout(err) && !isKieTaskTerminalFailure(err)) {
      console.warn(
        `generate-image-studio: délai polling dépassé pour ${taskId}, extension sur la même tâche (${KIE_POLL_EXTENSION_MS}ms)`,
      );
      return await kiePollUntilImageUrl(taskId, kieApiKey, KIE_POLL_EXTENSION_MS);
    }
    throw err;
  }
}

function kiePipelineFailureResponse(err: unknown): Response {
  const raw = err instanceof Error ? err.message : String(err);
  if (isKieCreditsError(raw)) {
    return jsonError(402, "KIE_CREDITS", "Crédits Kie AI insuffisants. Réessaie plus tard.");
  }
  return jsonError(503, "KIE_UPSTREAM", MSG_BUSY);
}

async function generateNanoBananaPro(
  prompt: string,
  aspectRatio: string,
  referenceUrls: string[] | null,
): Promise<string> {
  const kieApiKey = getKieApiKey();
  if (!kieApiKey) {
    throw new Error("NanaBanana Pro non configuré sur le serveur.");
  }
  const kieModel =
    Deno.env.get("KIE_IMAGE_STUDIO_MODEL")?.trim() ||
    Deno.env.get("KIE_IMAGE_EDIT_MODEL")?.trim() ||
    "nano-banana-pro";
  const taskId = await kieCreateTaskWithRetries(
    kieApiKey,
    kieModel,
    prompt,
    aspectRatio,
    referenceUrls,
  );
  const maxPollMs = Number(Deno.env.get("KIE_POLL_MAX_MS") || "") || 14 * 60 * 1000;
  return kiePollWithOptionalExtension(taskId, kieApiKey, maxPollMs);
}

async function generateHailuoImage(
  prompt: string,
  aspectRatio: string,
  referenceUrl: string | null,
): Promise<string> {
  const hailuoKey = getHailuoApiKey();
  if (!hailuoKey) throw new Error("Hailuo Image non configuré sur le serveur.");

  const requestBody: Record<string, unknown> = {
    model: "image-01",
    prompt: prompt.slice(0, 1500),
    aspect_ratio: aspectRatio,
    response_format: "url",
    n: 1,
    prompt_optimizer: true,
  };

  if (referenceUrl) {
    requestBody.subject_reference = [
      { type: "character", image_file: referenceUrl },
    ];
  }

  const res = await fetch(HAILUO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${hailuoKey.trim()}`,
    },
    body: JSON.stringify(requestBody),
  });

  const text = await res.text();
  let data: {
    base_resp?: { status_code?: number; status_msg?: string };
    data?: { image_urls?: string[] };
    image_urls?: string[];
  };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Réponse Hailuo invalide.");
  }

  if (!res.ok || (data.base_resp?.status_code && data.base_resp.status_code !== 0)) {
    throw new Error(data.base_resp?.status_msg || `Erreur Hailuo (${res.status})`);
  }

  const urls =
    data.data?.image_urls ||
    data.image_urls ||
    [];
  if (!urls[0]) throw new Error("Aucune image retournée par Hailuo.");
  return urls[0];
}

function parseOpenAiB64(text: string, res: Response): string {
  let json: { data?: Array<{ b64_json?: string }>; error?: { message?: string } };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Réponse OpenAI invalide.");
  }
  if (!res.ok) {
    throw new Error(json.error?.message || `Erreur OpenAI (${res.status})`);
  }
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI : image manquante dans la réponse.");
  return b64;
}

function resolveGptImageQuality(): "low" | "medium" | "high" | "auto" {
  const raw = Deno.env.get("IMAGE_STUDIO_GPT_QUALITY")?.trim().toLowerCase();
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "auto") {
    return raw;
  }
  return "medium";
}

async function generateGptImage2(
  prompt: string,
  aspectRatio: string,
  referenceInput: string | null,
): Promise<string> {
  const openaiKey = getOpenAiKey();
  if (!openaiKey) throw new Error("GPT Image 2.0 non configuré sur le serveur.");

  const size = openAiSizeForRatio(aspectRatio);

  const quality = resolveGptImageQuality();

  if (referenceInput) {
    const photo = await resolveReferencePhotoInput(referenceInput);
    const form = new FormData();
    form.append("model", "gpt-image-2");
    form.append("prompt", prompt);
    form.append("n", "1");
    form.append("size", size);
    if (quality !== "auto") {
      form.append("quality", quality);
    }
    form.append(
      "image[]",
      new Blob([photo.bytes], { type: photo.mime }),
      photo.fileName,
    );
    const res = await fetch(OPENAI_EDITS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });
    const text = await res.text();
    const b64 = parseOpenAiB64(text, res);
    return `data:image/png;base64,${b64}`;
  }

  const res = await fetch(OPENAI_GENERATIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt,
      n: 1,
      size,
      ...(quality === "auto" ? {} : { quality }),
    }),
  });
  const text = await res.text();
  const b64 = parseOpenAiB64(text, res);
  return `data:image/png;base64,${b64}`;
}

async function assertQuotaAndGenerate(
  supabaseAdmin: SupabaseClient,
  userId: string,
  imageStudioLimit: number,
  model: ImageStudioModel,
  prompt: string,
  aspectRatio: string,
  referenceImages: string[],
): Promise<{ url: string; provider: string }> {
  const availability = getModelsAvailability();
  if (!availability[model]) {
    throw new Error("Ce modèle n'est pas disponible.");
  }

  const { data: currentCount, error: quotaReadError } = await supabaseAdmin.rpc(
    "refresh_image_studio_quota",
    { p_user_id: userId },
  );
  if (quotaReadError) throw new Error(MSG_BUSY);
  const count = typeof currentCount === "number" ? currentCount : 0;
  if (count >= imageStudioLimit) {
    throw new Error(`QUOTA:${imageStudioLimit}`);
  }

  const referenceUrls: string[] = [];
  for (const refInput of referenceImages) {
    const uploaded = await uploadReferenceToStorage(supabaseAdmin, userId, refInput);
    if (uploaded) referenceUrls.push(uploaded);
  }

  const primaryReferenceUrl = referenceUrls[0] ?? null;

  let url: string;
  let provider: string;

  if (model === "nano_banana_pro") {
    url = await generateNanoBananaPro(prompt, aspectRatio, referenceUrls);
    provider = "kie";
  } else if (model === "hailuo") {
    url = await generateHailuoImage(prompt, aspectRatio, primaryReferenceUrl);
    provider = "hailuo";
  } else {
    url = await generateGptImage2(prompt, aspectRatio, primaryReferenceUrl);
    provider = "openai";
  }

  const { error: incrementError } = await supabaseAdmin.rpc(
    "increment_image_studio_count",
    { p_user_id: userId, p_limit: imageStudioLimit },
  );
  if (incrementError?.message?.includes("IMAGE_STUDIO_QUOTA_EXCEEDED")) {
    throw new Error(`QUOTA:${imageStudioLimit}`);
  }

  return { url, provider };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return jsonResponse({ models: getModelsAvailability() });
  }

  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Méthode non autorisée.");
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = getServiceRoleKey();

    if (!serviceRoleKey) {
      return jsonError(500, "NO_SERVICE_ROLE", "Configuration serveur incomplète.");
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return jsonError(401, "UNAUTHORIZED", "Non autorisé. Veuillez vous connecter.");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const userPlan = await resolveUserPlan(supabaseAdmin, user.id);
    if (!planAllowsImageStudio(userPlan)) {
      return jsonError(
        403,
        "IMAGE_STUDIO_SUBSCRIPTION_REQUIRED",
        "Un abonnement ViralWorks Image est requis pour générer des images.",
      );
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "BAD_JSON", "Corps JSON invalide.");
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const userPrompt =
      typeof body.userPrompt === "string" && body.userPrompt.trim()
        ? body.userPrompt.trim()
        : prompt;
    if (!prompt) return jsonError(400, "BAD_PROMPT", "Le prompt est requis.");
    if (prompt.length > 10000) {
      return jsonError(400, "PROMPT_TOO_LONG", "Le prompt ne doit pas dépasser 10 000 caractères.");
    }

    const aspectRatio = normalizeAspectRatio(body.aspectRatio);
    const model = normalizeModel(body.model);
    const referenceImage =
      typeof body.referenceImage === "string" && body.referenceImage.trim()
        ? body.referenceImage.trim()
        : null;
    const referenceImages = Array.isArray(body.referenceImages)
      ? body.referenceImages
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : referenceImage
        ? [referenceImage]
        : [];
    const batchId =
      typeof body.batchId === "string" && body.batchId.trim()
        ? body.batchId.trim()
        : null;
    const generationRefs =
      body.generationRefs && typeof body.generationRefs === "object"
        ? {
            avatarUrl:
              typeof body.generationRefs.avatarUrl === "string"
                ? body.generationRefs.avatarUrl.trim() || null
                : null,
            productUrl:
              typeof body.generationRefs.productUrl === "string"
                ? body.generationRefs.productUrl.trim() || null
                : null,
            importedRefUrl:
              typeof body.generationRefs.importedRefUrl === "string"
                ? body.generationRefs.importedRefUrl.trim() || null
                : null,
          }
        : null;

    const imageStudioLimit = getImageStudioMonthlyLimit(userPlan);
    if (imageStudioLimit <= 0) {
      return jsonError(
        403,
        "IMAGE_STUDIO_SUBSCRIPTION_REQUIRED",
        "Un abonnement ViralWorks Image est requis pour générer des images.",
      );
    }

    try {
      const { url, provider } = await assertQuotaAndGenerate(
        supabaseAdmin,
        user.id,
        imageStudioLimit,
        model,
        prompt,
        aspectRatio,
        referenceImages,
      );

      let persistedUrl = url;
      try {
        persistedUrl = await persistGeneratedImageUrl(
          supabaseUrl,
          serviceRoleKey,
          user.id,
          url,
        );
      } catch (persistErr) {
        console.error("persist generated image:", persistErr);
      }

      const historyId = await saveImageStudioHistoryEntry(
        supabaseAdmin,
        user.id,
        userPrompt,
        persistedUrl,
        aspectRatio,
        model,
        batchId,
        generationRefs,
      );

      const { data: newCount } = await supabaseAdmin.rpc(
        "refresh_image_studio_quota",
        { p_user_id: user.id },
      );

      return jsonResponse({
        url: persistedUrl,
        historyId,
        provider,
        model,
        count: typeof newCount === "number" ? newCount : undefined,
        limit: imageStudioLimit,
      });
    } catch (genErr) {
      if (isImageStudioUserError(genErr)) {
        return jsonError(400, genErr.code, genErr.message);
      }
      const msg = genErr instanceof Error ? genErr.message : String(genErr);
      if (msg.startsWith("QUOTA:")) {
        const limit = msg.split(":")[1] || String(imageStudioLimit);
        return jsonError(
          429,
          "IMAGE_STUDIO_QUOTA_EXCEEDED",
          `Quota mensuel atteint (${limit} images). Réessayez le mois prochain.`,
        );
      }
      if (model === "nano_banana_pro") {
        return kiePipelineFailureResponse(genErr);
      }
      console.error(`generate-image-studio (${model}):`, genErr);
      return jsonError(503, "GENERATION_FAILED", msg || MSG_BUSY);
    }
  } catch (err) {
    console.error("generate-image-studio:", err);
    return jsonError(500, "INTERNAL_ERROR", MSG_BUSY);
  }
});
