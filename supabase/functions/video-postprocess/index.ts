import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type PostprocessPayload = {
  video_url?: string;
  voice_text?: string;
  music_style?: string;
  enable_tts?: boolean;
  enable_music?: boolean;
  model?: string;
};

function cleanText(value: unknown, max = 2000): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Les Edge Functions Supabase ne peuvent pas joindre localhost /127.0.0.1 sur ta machine. */
function isUnreachableHostFromEdge(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local");
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Token d'authentification manquant" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Non autorisé. Veuillez vous connecter." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as PostprocessPayload;
    const inputVideoUrl = String(body?.video_url || "").trim();
    if (!inputVideoUrl) {
      return new Response(JSON.stringify({ error: "video_url requis." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pipelineUrl = String(Deno.env.get("VIDEO_AUDIO_PIPELINE_URL") || "").trim();
    const pipelineToken = String(Deno.env.get("VIDEO_AUDIO_PIPELINE_TOKEN") || "").trim();
    const enableTts = body?.enable_tts !== false;
    const enableMusic = body?.enable_music !== false;
    const voiceText = cleanText(body?.voice_text);
    const musicStyle = cleanText(body?.music_style || "cinematic", 64);
    const model = cleanText(body?.model || "video", 32);

    // Mode "prêt à brancher": si aucun pipeline externe n'est configuré,
    // on retourne la vidéo originale sans bloquer la génération.
    if (!pipelineUrl) {
      return new Response(
        JSON.stringify({
          status: "ready_without_external_pipeline",
          audio_applied: false,
          video_url: inputVideoUrl,
          message: "Pipeline audio externe non configuré (VIDEO_AUDIO_PIPELINE_URL).",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (isUnreachableHostFromEdge(pipelineUrl)) {
      return new Response(
        JSON.stringify({
          status: "pipeline_unreachable",
          audio_applied: false,
          video_url: inputVideoUrl,
          message:
            "VIDEO_AUDIO_PIPELINE_URL pointe vers localhost : inaccessible depuis Supabase Edge. " +
            "Expose le pipeline (HTTPS public) ou laisse le secret vide pour garder la vidéo telle quelle.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let externalRes: Response;
    try {
      externalRes = await fetch(pipelineUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(pipelineToken ? { Authorization: `Bearer ${pipelineToken}` } : {}),
        },
        body: JSON.stringify({
          user_id: user.id,
          model,
          source_video_url: inputVideoUrl,
          enable_tts: enableTts,
          enable_music: enableMusic,
          voice_text: voiceText,
          music_style: musicStyle,
        }),
      });
    } catch (err) {
      console.error("video-postprocess: échec réseau vers le pipeline", err);
      return new Response(
        JSON.stringify({
          status: "pipeline_unreachable",
          audio_applied: false,
          video_url: inputVideoUrl,
          message:
            "Impossible de joindre le pipeline audio (réseau / DNS / timeout). Vidéo d’origine renvoyée.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const raw = await externalRes.text();
    let data: Record<string, unknown> = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

    if (!externalRes.ok) {
      console.error(
        "video-postprocess: pipeline HTTP",
        externalRes.status,
        raw?.slice?.(0, 500) ?? raw,
      );
      return new Response(
        JSON.stringify({
          status: "pipeline_error",
          audio_applied: false,
          video_url: inputVideoUrl,
          message: String(
            data?.error || data?.message || "Le pipeline audio a renvoyé une erreur.",
          ),
          pipeline_status: externalRes.status,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const outputUrl = cleanText(
      (data?.video_url as string) ||
        (data?.output_video_url as string) ||
        (data?.result_url as string) ||
        inputVideoUrl,
      4000
    );

    return new Response(
      JSON.stringify({
        status: "success",
        audio_applied: outputUrl !== inputVideoUrl,
        video_url: outputUrl || inputVideoUrl,
        provider_response: data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erreur Edge Function video-postprocess:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur serveur" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

