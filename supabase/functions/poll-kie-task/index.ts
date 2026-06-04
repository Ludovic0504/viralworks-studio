/**
 * Poll unique Kie (recordInfo) — appelé par le client toutes les 6s.
 * Route : `/functions/v1/poll-kie-task`
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const KIE_BASE = "https://api.kie.ai";

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

    let body: { taskId?: string };
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "BAD_REQUEST", "Corps JSON invalide");
    }

    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
    if (!taskId) {
      return jsonError(400, "BAD_REQUEST", "taskId est requis.");
    }

    const hasSubscription = await userHasActiveSubscription(supabase, user.id);
    if (!hasSubscription) {
      return jsonError(403, "SUBSCRIPTION_REQUIRED", "Abonnement requis");
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
      return jsonError(502, "KIE_INVALID", "Réponse Kie invalide.");
    }

    if (json.code !== 200) {
      return jsonError(
        502,
        "KIE_RECORD_INFO",
        json.msg || `Kie recordInfo code ${json.code ?? res.status}`,
      );
    }

    const d = json.data;
    if (!d) {
      return new Response(JSON.stringify({ status: "pending" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (d.state === "success" || d.state === "succeed") {
      const rj = d.resultJson;
      if (!rj) {
        return jsonError(502, "KIE_NO_RESULT", "Succès Kie sans resultJson.");
      }
      let parsed: { resultUrls?: string[] };
      try {
        parsed = JSON.parse(rj) as { resultUrls?: string[] };
      } catch {
        return jsonError(502, "KIE_RESULT_PARSE", "resultJson illisible.");
      }
      const urls = parsed.resultUrls;
      const videoUrl = Array.isArray(urls) ? urls[0] : undefined;
      if (!videoUrl) {
        return jsonError(502, "KIE_NO_URL", "Aucune URL dans resultUrls.");
      }
      return new Response(
        JSON.stringify({ status: "done", videoUrl }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (d.state === "fail" || d.state === "failed") {
      const errorMsg =
        [d.failMsg, d.failCode].filter(Boolean).join(" — ") ||
        "Tâche Kie AI en échec";
      return new Response(
        JSON.stringify({ status: "failed", error: errorMsg }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ status: "pending" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("poll-kie-task:", error);
    return jsonError(500, "INTERNAL_ERROR", "Erreur lors du poll Kie.");
  }
});
