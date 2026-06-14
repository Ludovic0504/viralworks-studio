/**
 * Édition vidéo Edit Video — Kie AI Seedance 1 Lite.
 * Route : `/functions/v1/edit-video-seedance`
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  planAllowsSeedance,
  resolveUserPlan,
  SEEDANCE_MONTHLY_LIMIT,
} from "../_shared/plan-access.ts";

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
  console.error("[kie-error-raw]", raw);
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

interface RequestBody {
  prompt: string;
  videoUrl: string;
  avatarUrls: (string | null)[];
  refImageUrl: string | null;
  dialogueEnabled: boolean;
  resolution?: string;
  duration?: number;
  aspectRatio?: string;
}

async function kieCreateTask(
  kieApiKey: string,
  model: string,
  input: Record<string, unknown>,
): Promise<string> {
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

function normalizeAvatarUrls(raw: unknown): (string | null)[] {
  if (!Array.isArray(raw)) return [null, null, null];
  return raw.slice(0, 3).map((u) => (typeof u === "string" && u.trim() ? u.trim() : null));
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

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
    const avatarUrls = normalizeAvatarUrls(body.avatarUrls);
    const refImageUrl =
      typeof body.refImageUrl === "string" && body.refImageUrl.trim()
        ? body.refImageUrl.trim()
        : null;

    if (!prompt) {
      return jsonError(400, "BAD_REQUEST", "Le prompt est requis.");
    }

    if (!videoUrl || !videoUrl.startsWith("https://")) {
      return jsonError(
        400,
        "BAD_VIDEO_URL",
        "videoUrl est requis et doit commencer par https://",
      );
    }

    const hasAvatars = avatarUrls.some(Boolean);
    const hasRefImage = refImageUrl != null;
    const hasModifications = prompt.includes("modifications");

    if (!hasAvatars && !hasRefImage && !hasModifications) {
      return jsonError(400, "NO_INPUT", "Aucune modification demandée");
    }

    const hasAccessPlan = await resolveUserPlan(supabase, user.id);
    if (!planAllowsSeedance(hasAccessPlan)) {
      return jsonError(
        403,
        "SUBSCRIPTION_REQUIRED",
        "Abonnement Pro ou Studio requis",
      );
    }

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
      Deno.env.get("SERVICE_ROLE_KEY")?.trim();
    if (!serviceRoleKey) {
      return jsonError(503, "NO_SERVICE_ROLE", MSG_EDIT_BUSY);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: currentSeedanceCount, error: seedanceQuotaError } =
      await supabaseAdmin.rpc("refresh_seedance_quota", {
        p_user_id: user.id,
      });
    if (seedanceQuotaError) {
      return jsonError(503, "QUOTA_READ_FAILED", MSG_EDIT_BUSY);
    }
    const seedanceCount =
      typeof currentSeedanceCount === "number" ? currentSeedanceCount : 0;
    if (seedanceCount >= SEEDANCE_MONTHLY_LIMIT) {
      return jsonError(
        429,
        "SEEDANCE_QUOTA_EXCEEDED",
        `Quota mensuel Seedance atteint (${SEEDANCE_MONTHLY_LIMIT} éditions). Réessayez le mois prochain.`,
      );
    }

    const kieApiKey =
      Deno.env.get("KIE_AI_API_KEY")?.trim() ||
      Deno.env.get("KIE_API_KEY")?.trim();

    if (!kieApiKey) {
      return jsonError(
        503,
        "NO_KIE_KEY",
        "KIE_AI_API_KEY manquante dans les secrets Supabase.",
      );
    }

    const dialogueEnabled = body.dialogueEnabled === true;
    const kieModel = "bytedance/seedance-2-fast";

    const filledAvatarUrls = avatarUrls.filter(Boolean) as string[];

    const kieInput: Record<string, unknown> = {
      prompt: prompt,
      reference_video_urls: [videoUrl],
      generate_audio: dialogueEnabled,
      resolution:
        typeof body.resolution === "string" && body.resolution
          ? body.resolution
          : "720p",
      aspect_ratio: body.aspectRatio ?? "9:16",
      duration:
        typeof body.duration === "number" && body.duration > 0
          ? Math.round(body.duration)
          : 15,
    };

    if (filledAvatarUrls.length > 0 || refImageUrl) {
      const refImages: string[] = [];
      filledAvatarUrls.forEach((url) => refImages.push(url));
      if (refImageUrl) refImages.push(refImageUrl);
      kieInput.reference_image_urls = refImages;
    }

    console.log(
      "[edit-video-seedance] kieInput:",
      JSON.stringify({ model: kieModel, input: kieInput }),
    );

    try {
      console.log("[prompt-debug]", prompt.slice(0, 300));
      const taskId = await kieCreateTask(kieApiKey, kieModel, kieInput);

      const { error: incrementError } = await supabaseAdmin.rpc(
        "increment_seedance_count",
        { p_user_id: user.id },
      );
      if (incrementError?.message?.includes("SEEDANCE_QUOTA_EXCEEDED")) {
        return jsonError(
          429,
          "SEEDANCE_QUOTA_EXCEEDED",
          `Quota mensuel Seedance atteint (${SEEDANCE_MONTHLY_LIMIT} éditions). Réessayez le mois prochain.`,
        );
      }

      return new Response(
        JSON.stringify({
          taskId,
          status: "pending",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (kieErr) {
      console.error("edit-video-seedance (Kie pipeline):", kieErr);
      return kiePipelineFailureResponse(kieErr);
    }
  } catch (error) {
    console.error("edit-video-seedance:", error);
    return jsonError(500, "INTERNAL_ERROR", MSG_EDIT_BUSY);
  }
});
