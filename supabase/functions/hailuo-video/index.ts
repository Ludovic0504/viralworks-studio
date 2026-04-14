import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action = "create" | "status";

interface RequestBody {
  action: Action;
  task_id?: string;
  prompt?: string;
  model?: string;
  duration?: number;
  resolution?: string;
}

function getMiniMaxApiKey(): string | null {
  const env = Deno.env.toObject();
  const key =
    env["CléAPI_Hailuo_Image"] ||
    env["CleAPI_Hailuo_Image"] ||
    env["MINIMAX_API_KEY"] ||
    env["HAILUO_API_KEY"] ||
    env["HAILUO_VIDEO_API_KEY"] ||
    Deno.env.get("CléAPI_Hailuo_Image") ||
    Deno.env.get("MINIMAX_API_KEY") ||
    Deno.env.get("HAILUO_API_KEY");
  return key?.trim() || null;
}

function toMiniMaxStatus(raw?: string): "processing" | "success" | "failed" {
  const s = String(raw || "").toLowerCase();
  if (s === "success") return "success";
  if (s === "fail" || s === "failed") return "failed";
  return "processing";
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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = getMiniMaxApiKey();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Configuration MiniMax manquante." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    const action = body.action;
    if (action !== "create" && action !== "status") {
      return new Response(
        JSON.stringify({ error: "Action invalide. Utilisez create ou status." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create") {
      const prompt = String(body.prompt || "").trim();
      if (!prompt) {
        return new Response(
          JSON.stringify({ error: "Le prompt est requis." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const model = body.model || "MiniMax-Hailuo-02";
      const duration = body.duration === 10 ? 10 : 6;
      const resolution = body.resolution === "1080P" ? "1080P" : "768P";

      const createRes = await fetch("https://api.minimax.io/v1/video_generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: prompt.slice(0, 2000),
          prompt_optimizer: true,
          duration,
          resolution,
        }),
      });

      const createText = await createRes.text();
      let createData: any = {};
      try {
        createData = JSON.parse(createText);
      } catch {
        // keep raw only
      }

      if (!createRes.ok) {
        return new Response(
          JSON.stringify({
            error:
              createData?.base_resp?.status_msg ||
              createData?.error?.message ||
              createText ||
              `Erreur MiniMax (${createRes.status})`,
          }),
          { status: createRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          task_id: createData?.task_id,
          status: "processing",
          base_resp: createData?.base_resp || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // action === "status"
    const taskId = String(body.task_id || "").trim();
    if (!taskId) {
      return new Response(
        JSON.stringify({ error: "task_id requis pour action status." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const queryUrl = `https://api.minimax.io/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`;
    const queryRes = await fetch(queryUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const queryText = await queryRes.text();
    let queryData: any = {};
    try {
      queryData = JSON.parse(queryText);
    } catch {
      // keep raw
    }

    if (!queryRes.ok) {
      return new Response(
        JSON.stringify({
          error:
            queryData?.base_resp?.status_msg ||
            queryData?.error?.message ||
            queryText ||
            `Erreur MiniMax (${queryRes.status})`,
        }),
        { status: queryRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const status = toMiniMaxStatus(queryData?.status);
    if (status !== "success") {
      return new Response(
        JSON.stringify({
          task_id: taskId,
          status,
          raw_status: queryData?.status || null,
          error: status === "failed" ? queryData?.base_resp?.status_msg || "Génération échouée" : null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileId = queryData?.file_id;
    if (!fileId) {
      return new Response(
        JSON.stringify({ task_id: taskId, status: "failed", error: "file_id manquant." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileRes = await fetch(
      `https://api.minimax.io/v1/files/retrieve?file_id=${encodeURIComponent(String(fileId))}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );
    const fileText = await fileRes.text();
    let fileData: any = {};
    try {
      fileData = JSON.parse(fileText);
    } catch {
      // keep raw
    }

    if (!fileRes.ok) {
      return new Response(
        JSON.stringify({
          error:
            fileData?.base_resp?.status_msg ||
            fileData?.error?.message ||
            fileText ||
            `Erreur récupération fichier (${fileRes.status})`,
        }),
        { status: fileRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const videoUrl = fileData?.file?.download_url || null;
    return new Response(
      JSON.stringify({
        task_id: taskId,
        status: "success",
        file_id: String(fileId),
        video_url: videoUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erreur Edge Function hailuo-video:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur serveur",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

