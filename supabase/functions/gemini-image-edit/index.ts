/**
 * Édition d’image (Visuel d’accroche) — même route qu’avant : `/functions/v1/gemini-image-edit`
 *
 * 1) Si `KIE_AI_API_KEY` est défini : Kie AI — Nano Banana Pro (ou `google/nano-banana-edit` via KIE_IMAGE_EDIT_MODEL).
 * 2) Sinon, si une clé Gemini est définie : appel direct Google (comportement historique).
 *
 * Kie exige des URLs d’image accessibles publiquement : les data URL sont uploadées vers le bucket `image-references` (SERVICE_ROLE_KEY).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const KIE_BASE = "https://api.kie.ai";

/** Saturation / lenteur / indisponibilité (Kie, limites Edge, réseau). */
const MSG_EDIT_BUSY =
  "Les serveurs sont saturés, réessaye dans quelques instants.";

function jsonError(
  status: number,
  code: string,
  userMessage: string,
): Response {
  return new Response(
    JSON.stringify({
      error: userMessage,
      userMessage,
      code,
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

/** Erreurs après soumission Kie (createTask + poll) — jamais de fuite technique vers l’UI. */
function kiePipelineFailureResponse(err: unknown): Response {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  /* Kie renvoie souvent "Credits insufficient : Your current balance..." (ordre ≠ "insufficient credit"). */
  if (
    /402|credits?\s+insufficient|insufficient\s+credit|not\s+enough\s+credit|not\s+enough\s+to\s+run|your\s+current\s+balance|top\s*up|recharge|crédit\s+insuffisant/i.test(
      lower,
    )
  ) {
    return jsonError(
      402,
      "KIE_CREDITS",
      "Crédits Kie AI insuffisants sur ton compte Kie (kie.ai). Recharge ton solde ou réessaie plus tard.",
    );
  }

  if (
    /délai dépassé|timeout|timed out|504|gateway timeout|deadline exceeded/i.test(
      lower,
    )
  ) {
    return jsonError(504, "KIE_TIMEOUT", MSG_EDIT_BUSY);
  }

  if (/429|rate limit|too many requests/i.test(lower)) {
    return jsonError(429, "KIE_RATE_LIMIT", MSG_EDIT_BUSY);
  }

  if (
    /408|upstream|service issues|455|maintenance|503|501|generation failed|temporarily unavailable/i.test(
      lower,
    )
  ) {
    return jsonError(503, "KIE_UPSTREAM", MSG_EDIT_BUSY);
  }

  if (/401|403/.test(lower) && /kie|unauthorized|api key|bearer/i.test(lower)) {
    return jsonError(502, "KIE_AUTH_CONFIG", MSG_EDIT_BUSY);
  }

  return jsonError(503, "KIE_EDIT_FAILED", MSG_EDIT_BUSY);
}

function geminiPipelineFailureResponse(err: unknown): Response {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    /url.*non autoris|data url invalide|téléchargement.*impossible|image.*pas une image/i.test(
      raw,
    )
  ) {
    return jsonError(400, "BAD_IMAGE_INPUT", raw);
  }

  if (
    /timeout|504|unavailable|429|rate|503|502|resource exhausted|overloaded/i.test(
      lower,
    )
  ) {
    return jsonError(503, "GEMINI_UNAVAILABLE", MSG_EDIT_BUSY);
  }

  return jsonError(500, "GEMINI_EDIT_FAILED", MSG_EDIT_BUSY);
}

interface RequestBody {
  imageUrl: string;
  instruction: string;
}

/** Domaines depuis lesquels l’Edge Function peut télécharger l’image source (MiniMax/Hailuo, stockage app, CDNs courants). */
function isAllowedImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    const ok =
      h.includes("supabase.co") ||
      h.includes("aliyuncs.com") ||
      h.includes("aliyun.com") ||
      h.includes("minimax.io") ||
      h.includes("minimax.chat") ||
      h.includes("volces.com") ||
      h.includes("byteimg.com") ||
      h.includes("bytecdn.cn") ||
      h.includes("pstatp.com") ||
      h.includes("amazonaws.com") ||
      h.includes("cloudfront.net") ||
      h.includes("googleusercontent.com") ||
      h.includes("storage.googleapis.com") ||
      h.includes("hailuo") ||
      h.includes("mini-max");
    return ok;
  } catch {
    return false;
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function uploadDataUrlToStorage(
  dataUrl: string,
  userId: string,
  supabaseAdmin: SupabaseClient,
): Promise<string> {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error("Image data URL invalide");
  const mimeType = m[1].trim() || "image/png";
  const base64Data = m[2].replace(/\s/g, "");
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const ext =
    mimeType.includes("jpeg") || mimeType.includes("jpg")
      ? "jpg"
      : mimeType.includes("webp")
      ? "webp"
      : "png";
  const fileName =
    `${userId}/kie-edit-${Date.now()}-` +
    `${Math.random().toString(36).substring(2, 9)}.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("image-references")
    .upload(fileName, bytes, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload stockage pour Kie AI : ${uploadError.message}`);
  }

  const { data: pub } = supabaseAdmin.storage
    .from("image-references")
    .getPublicUrl(fileName);
  return pub.publicUrl;
}

/** URL publique lisible par les serveurs Kie (pas de fichier brut dans la requête Kie). */
async function ensurePublicImageUrlForKie(
  imageUrl: string,
  userId: string,
  supabaseAdmin: SupabaseClient | null,
): Promise<string> {
  const trimmed = imageUrl.trim();
  if (trimmed.startsWith("data:")) {
    if (!supabaseAdmin) {
      throw new Error(
        "SERVICE_ROLE_KEY Supabase requise : Kie AI a besoin d’une URL publique (upload de l’image).",
      );
    }
    return await uploadDataUrlToStorage(trimmed, userId, supabaseAdmin);
  }
  if (!isAllowedImageUrl(trimmed)) {
    throw new Error(
      "URL d’image non autorisée (attendu : stockage app, Hailuo/MiniMax).",
    );
  }
  return trimmed.startsWith("http://")
    ? trimmed.replace("http://", "https://")
    : trimmed;
}

function buildEditPrompt(instruction: string): string {
  const antiDistortionBlock =
    "Contraintes absolues : aucune distorsion anatomique sur les humains, les membres et le corps doivent respecter des proportions et positions physiquement possibles. Si une personne est sous ou près d'un véhicule/objet, sa posture doit être réaliste et cohérente avec l'espace disponible (allongée sur le dos, accroupie, penchée selon le contexte). Aucun objet ne doit avoir une taille ou une position physiquement impossible par rapport aux autres éléments de la scène. Pas de membres supplémentaires, pas de doigts mal formés, pas de visage déformé.";
  return (
    "You are given ONE input image (via URL). EDIT that image according to the instruction. " +
    "Preserve the original scene, subjects, and composition unless the instruction explicitly asks to change them. " +
    "Do not replace it with a completely unrelated new scene. " +
    "Apply only the requested modification.\n\n" +
    "User instruction (may be in French):\n" +
    instruction +
    "\n\n" +
    antiDistortionBlock
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function kieCreateTask(
  kieApiKey: string,
  model: string,
  publicImageUrl: string,
  editPrompt: string,
): Promise<string> {
  let input: Record<string, unknown>;
  if (model === "google/nano-banana-edit") {
    input = {
      prompt: editPrompt,
      image_urls: [publicImageUrl],
      output_format: "png",
      image_size: "auto",
    };
  } else {
    input = {
      prompt: editPrompt,
      image_input: [publicImageUrl],
      aspect_ratio: "auto",
      resolution: "1K",
      output_format: "png",
    };
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
    throw new Error(`Kie AI (createTask) : réponse invalide — ${text.slice(0, 200)}`);
  }

  if (json.code !== 200 || !json.data?.taskId) {
    throw new Error(
      json.msg ||
        `Kie AI createTask échoué (code ${json.code ?? res.status})`,
    );
  }
  return json.data.taskId;
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
      throw new Error(`Kie AI (recordInfo) : JSON invalide — ${text.slice(0, 200)}`);
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
      let parsed: { resultUrls?: string[] };
      try {
        parsed = JSON.parse(rj) as { resultUrls?: string[] };
      } catch {
        throw new Error("Kie AI : resultJson illisible");
      }
      const urls = parsed.resultUrls;
      if (!Array.isArray(urls) || !urls[0]) {
        throw new Error("Kie AI : aucune image dans resultUrls");
      }
      return urls[0];
    }

    if (d.state === "fail") {
      throw new Error(
        [d.failMsg, d.failCode].filter(Boolean).join(" — ") ||
          "Tâche Kie AI en échec",
      );
    }

    await sleep(delay);
    delay = Math.min(delay + 400, 8000);
  }
  throw new Error(
    "Délai dépassé en attendant Kie AI (Nano Banana). Réessaie plus tard.",
  );
}

async function resolveInputImageForGemini(
  imageUrl: string,
): Promise<{ mimeType: string; base64: string }> {
  const trimmed = imageUrl.trim();
  if (trimmed.startsWith("data:")) {
    const m = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
    if (!m) throw new Error("Image data URL invalide");
    return {
      mimeType: m[1].trim() || "image/png",
      base64: m[2].replace(/\s/g, ""),
    };
  }
  if (!isAllowedImageUrl(trimmed)) {
    throw new Error(
      "URL d'image non autorisée pour l'édition (domaines attendus : stockage app, Hailuo/MiniMax).",
    );
  }
  const httpsUrl = trimmed.startsWith("http://")
    ? trimmed.replace("http://", "https://")
    : trimmed;
  const res = await fetch(httpsUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; ViralWorksStudio/1.0; +https://supabase.com)",
      Referer: "https://hailuo-image-algeng-data-us.oss-us-east-1.aliyuncs.com/",
    },
  });
  if (!res.ok) {
    throw new Error(`Téléchargement de l'image impossible (${res.status})`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const mimeType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  if (!mimeType.startsWith("image/")) {
    throw new Error("Le fichier téléchargé n'est pas une image");
  }
  return { mimeType, base64: uint8ToBase64(buf) };
}

function extractImageFromGeminiJson(data: Record<string, unknown>): {
  mime: string;
  b64: string;
} | null {
  const candidates = data.candidates as
    | Array<Record<string, unknown>>
    | undefined;
  const first = candidates?.[0] as Record<string, unknown> | undefined;
  const content = first?.content as Record<string, unknown> | undefined;
  const parts = content?.parts as Array<Record<string, unknown>> | undefined;
  if (!parts?.length) return null;
  for (const part of parts) {
    const inline =
      (part.inlineData as Record<string, string> | undefined) ||
      (part.inline_data as Record<string, string> | undefined);
    if (inline?.data) {
      const mime =
        (inline.mimeType as string) ||
        (inline.mime_type as string) ||
        "image/png";
      return { mime, b64: inline.data as string };
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token d'authentification manquant" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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
      return new Response(
        JSON.stringify({ error: "Non autorisé. Veuillez vous connecter." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Corps JSON invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
    const instruction =
      typeof body.instruction === "string" ? body.instruction.trim() : "";

    if (!imageUrl || !instruction) {
      return new Response(
        JSON.stringify({
          error: "imageUrl et instruction sont requis (instruction non vide).",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const editPrompt = buildEditPrompt(instruction);

    const kieApiKey =
      Deno.env.get("KIE_AI_API_KEY")?.trim() ||
      Deno.env.get("KIE_API_KEY")?.trim();

    if (kieApiKey) {
      const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
      const supabaseAdmin = serviceRoleKey
        ? createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
        : null;

      const kieModel =
        Deno.env.get("KIE_IMAGE_EDIT_MODEL")?.trim() || "nano-banana-pro";

      let publicUrl: string;
      try {
        publicUrl = await ensurePublicImageUrlForKie(
          imageUrl,
          user.id,
          supabaseAdmin,
        );
      } catch (prepErr) {
        const msg =
          prepErr instanceof Error ? prepErr.message : "Préparation de l’image impossible";
        return jsonError(400, "BAD_IMAGE_INPUT", msg);
      }

      try {
        const taskId = await kieCreateTask(
          kieApiKey,
          kieModel,
          publicUrl,
          editPrompt,
        );

        const maxPollMs = Number(Deno.env.get("KIE_POLL_MAX_MS") || "") ||
          14 * 60 * 1000;
        const resultUrl = await kiePollUntilImageUrl(
          taskId,
          kieApiKey,
          maxPollMs,
        );

        return new Response(
          JSON.stringify({
            url: resultUrl,
            provider: "kie",
            model: kieModel,
            taskId,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (kieErr) {
        console.error("gemini-image-edit (Kie pipeline):", kieErr);
        return kiePipelineFailureResponse(kieErr);
      }
    }

    const geminiKey =
      Deno.env.get("GEMINI_API_KEY")?.trim() ||
      Deno.env.get("GOOGLE_API_KEY")?.trim() ||
      Deno.env.get("GOOGLE_AI_API_KEY")?.trim();

    if (!geminiKey) {
      const msg =
        "Aucun fournisseur d’édition configuré. Dans Supabase : Project Settings → Edge Functions → Secrets, ajoute `KIE_AI_API_KEY` (recommandé, Nano Banana Pro via Kie), ou `GEMINI_API_KEY` / `GOOGLE_API_KEY` pour Gemini direct. Redéploie ensuite la fonction `gemini-image-edit`.";
      return jsonError(503, "NO_EDIT_PROVIDER", msg);
    }

    const geminiModel =
      Deno.env.get("GEMINI_IMAGE_EDIT_MODEL")?.trim() ||
      "gemini-2.5-flash-image";

    try {
      const { mimeType, base64 } = await resolveInputImageForGemini(imageUrl);

      const geminiUrl =
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;

      const geminiBody = {
        contents: [
          {
            role: "user",
            parts: [
              { text: editPrompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      };

      const geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify(geminiBody),
      });

      const geminiText = await geminiRes.text();
      let geminiJson: Record<string, unknown>;
      try {
        geminiJson = JSON.parse(geminiText) as Record<string, unknown>;
      } catch {
        return jsonError(
          502,
          "GEMINI_BAD_RESPONSE",
          MSG_EDIT_BUSY,
        );
      }

      if (!geminiRes.ok) {
        const msg =
          (geminiJson.error as { message?: string } | undefined)?.message ||
          geminiText.slice(0, 400);
        console.error("Gemini API error:", geminiRes.status, msg);
        return jsonError(
          geminiRes.status >= 400 && geminiRes.status < 600
            ? geminiRes.status
            : 502,
          "GEMINI_HTTP_ERROR",
          MSG_EDIT_BUSY,
        );
      }

      const extracted = extractImageFromGeminiJson(geminiJson);
      if (!extracted) {
        console.error("Gemini: no image in response", geminiJson);
        return jsonError(
          422,
          "GEMINI_NO_IMAGE",
          MSG_EDIT_BUSY,
        );
      }

      const dataUrl = `data:${extracted.mime};base64,${extracted.b64}`;

      return new Response(
        JSON.stringify({
          url: dataUrl,
          provider: "gemini",
          model: geminiModel,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (geminiErr) {
      console.error("gemini-image-edit (Gemini pipeline):", geminiErr);
      return geminiPipelineFailureResponse(geminiErr);
    }
  } catch (error) {
    console.error("gemini-image-edit:", error);
    return jsonError(500, "INTERNAL_ERROR", MSG_EDIT_BUSY);
  }
});
