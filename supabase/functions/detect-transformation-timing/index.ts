/**
 * Détection du moment de transformation (GPT-4o Vision).
 * Route : `/functions/v1/detect-transformation-timing`
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
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

async function userHasActiveSubscription(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("stripe_subscriptions")
    .select("status, cancel_at_period_end, current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return false;

  if (data.cancel_at_period_end) {
    const periodEndMs = new Date(data.current_period_end).getTime();
    if (Number.isFinite(periodEndMs) && Date.now() >= periodEndMs) {
      return false;
    }
  }

  return true;
}

function parseFrameIndexFromGptContent(content: string): number | null {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { frameIndex?: unknown };
    const idx = parsed.frameIndex;
    if (typeof idx === "number" && Number.isFinite(idx)) {
      return Math.round(idx);
    }
    if (typeof idx === "string" && idx.trim() !== "") {
      const n = Number(idx);
      if (Number.isFinite(n)) return Math.round(n);
    }
  } catch {
    return null;
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

    let body: {
      frames?: string[];
      refImage?: string;
      totalFrames?: number;
      durationSec?: number;
    };
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "BAD_REQUEST", "Corps JSON invalide");
    }

    const frames = Array.isArray(body.frames)
      ? body.frames.filter((f) => typeof f === "string" && f.length > 0)
      : [];
    const refImage = typeof body.refImage === "string" ? body.refImage.trim() : "";
    const totalFrames =
      typeof body.totalFrames === "number" && body.totalFrames > 0
        ? Math.round(body.totalFrames)
        : 0;
    const durationSec =
      typeof body.durationSec === "number" && body.durationSec > 0
        ? body.durationSec
        : 0;

    if (frames.length === 0 || !refImage || totalFrames <= 0 || durationSec <= 0) {
      return jsonResponse({
        anchorSecond: null,
        error: "frames, refImage, totalFrames et durationSec sont requis.",
      });
    }

    if (frames.length > 24) {
      return jsonResponse({
        anchorSecond: null,
        error: "Trop de frames (max 24).",
      });
    }

    const hasSubscription = await userHasActiveSubscription(supabase, user.id);
    if (!hasSubscription) {
      return jsonError(403, "SUBSCRIPTION_REQUIRED", "Abonnement requis");
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
    if (!openaiApiKey) {
      return jsonResponse({
        anchorSecond: null,
        error: "OPENAI_API_KEY manquante dans les secrets Supabase.",
      });
    }

    const frameCount = frames.length;
    const userContent: Array<{
      type: string;
      text?: string;
      image_url?: { url: string };
    }> = [
      {
        type: "text",
        text:
          `Here are the video frames numbered 1 to ${frameCount}, followed by the reference image. Which frame number is visually closest to the reference?`,
      },
    ];

    for (let i = 0; i < frameCount; i++) {
      userContent.push({ type: "text", text: `Frame ${i + 1}:` });
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${frames[i]}` },
      });
    }

    userContent.push({ type: "text", text: "Reference image:" });
    userContent.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${refImage}` },
    });

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 100,
          messages: [
            {
              role: "system",
              content:
                'You are a video frame matching assistant. Your only job is to identify which frame number is visually most similar to a reference image. Reply ONLY with valid JSON: { "frameIndex": <number> } No explanation, no markdown, no extra text.',
            },
            {
              role: "user",
              content: userContent,
            },
          ],
        }),
      },
    );

    const openaiText = await openaiRes.text();
    if (!openaiRes.ok) {
      console.error("detect-transformation-timing OpenAI:", openaiRes.status, openaiText);
      return jsonResponse({
        anchorSecond: null,
        error: `Erreur OpenAI (${openaiRes.status}).`,
      });
    }

    let openaiJson: {
      choices?: Array<{ message?: { content?: string } }>;
    };
    try {
      openaiJson = JSON.parse(openaiText) as typeof openaiJson;
    } catch {
      return jsonResponse({
        anchorSecond: null,
        error: "Réponse OpenAI invalide.",
      });
    }

    const gptContent = openaiJson.choices?.[0]?.message?.content ?? "";
    const frameIndex = parseFrameIndexFromGptContent(gptContent);

    if (frameIndex == null || frameIndex < 1 || frameIndex > frameCount) {
      return jsonResponse({
        anchorSecond: null,
        error: "JSON GPT invalide ou frameIndex hors limites.",
      });
    }

    const anchorSecond = Math.round(
      ((frameIndex - 1) / totalFrames) * durationSec * 10,
    ) / 10;

    return jsonResponse({ anchorSecond });
  } catch (error) {
    console.error("detect-transformation-timing:", error);
    return jsonResponse({
      anchorSecond: null,
      error: "Erreur interne lors de la détection du timing.",
    });
  }
});
