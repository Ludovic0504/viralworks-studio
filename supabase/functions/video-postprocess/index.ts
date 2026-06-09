import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function cleanText(value: unknown, max = 3500): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function resolveMusicUrl(musicStyle: string): string {
  const style = musicStyle.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const specific = Deno.env.get(`MUSIC_BED_URL_${style}`) || "";
  if (specific) return specific;
  return Deno.env.get("MUSIC_BED_URL_DEFAULT") || "";
}

async function generateDialogueText(
  profession: string,
  sceneIdea: string,
  openaiKey: string
): Promise<string> {
  const prompt = `Tu es un expert en marketing vidéo pour artisans.
Génère UNE seule phrase courte en français naturel (10-12 mots maximum) 
qu'un ${profession} dirait face caméra dans cette situation :
"${sceneIdea.slice(0, 200)}"

Règles strictes :
- Français de France, neutre, professionnel
- Déclaratif uniquement (pas de question, pas d'exclamation)
- Maximum 12 mots
- Pas de guillemets dans ta réponse
- Réponds uniquement avec la phrase, rien d'autre`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 60,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI dialogue gen failed: ${res.status}`);
  const data = await res.json();
  return String(data.choices?.[0]?.message?.content || "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token d'authentification manquant" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Non autorisé. Veuillez vous connecter." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const sourceVideoUrl = String(body?.video_url || "").trim();
    if (!sourceVideoUrl) {
      return new Response(
        JSON.stringify({ error: "video_url requis." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const enableTts = body?.enable_tts !== false;
    const enableMusic = body?.enable_music !== false;
    const voiceText = cleanText(body?.voice_text);
    const musicStyle = cleanText(body?.music_style || "cinematic", 64);

    let voiceUrl: string | null = null;
    let musicUrl: string | null = null;

    // Résoudre le texte TTS : voice_text explicite OU génération auto
    let resolvedVoiceText = voiceText;
    if (enableTts && !resolvedVoiceText) {
      const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";
      const profession = String(body?.voice_context?.profession || "").trim();
      const sceneIdea = String(body?.voice_context?.scene_idea || "").trim();
      if (openaiKey && profession && sceneIdea) {
        try {
          resolvedVoiceText = await generateDialogueText(
            profession,
            sceneIdea,
            openaiKey
          );
          console.log("[TTS] dialogue généré:", resolvedVoiceText);
        } catch (err) {
          console.error("[TTS] génération dialogue échouée:", err);
        }
      }
    }

    // TTS ElevenLabs
    if (enableTts && resolvedVoiceText) {
      const elevenlabsKey = Deno.env.get("ELEVENLABS_API_KEY") || "";
      const elevenlabsVoiceId =
        Deno.env.get("ELEVENLABS_VOICE_ID") || "OOiDJrD1goukqfTpiySr";
      const elevenlabsModel =
        Deno.env.get("ELEVENLABS_MODEL") || "eleven_multilingual_v2";

      if (elevenlabsKey) {
        const ttsRes = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${elevenlabsVoiceId}`,
          {
            method: "POST",
            headers: {
              "xi-api-key": elevenlabsKey,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text: resolvedVoiceText,
              model_id: elevenlabsModel,
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.3,
                use_speaker_boost: true,
              },
            }),
          }
        );

        if (ttsRes.ok) {
          const audioBuffer = await ttsRes.arrayBuffer();
          const audioBytes = new Uint8Array(audioBuffer);

          // Upload dans Supabase Storage avec service role
          const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
          });

          const audioPath = `${user.id}/${Date.now()}-voice.mp3`;

          const { error: uploadErr } = await adminClient.storage
            .from("audio-temp")
            .upload(audioPath, audioBytes, {
              contentType: "audio/mpeg",
              upsert: false,
              cacheControl: "3600",
            });

          if (!uploadErr) {
            const { data: pubData } = adminClient.storage
              .from("audio-temp")
              .getPublicUrl(audioPath);
            voiceUrl = pubData.publicUrl;
          } else {
            console.error("audio upload error:", uploadErr.message);
          }
        } else {
          const errText = await ttsRes.text();
          console.error("ElevenLabs TTS error:", ttsRes.status, errText);
        }
      }
    }

    // Music URL
    if (enableMusic) {
      musicUrl = resolveMusicUrl(musicStyle) || null;
    }

    return new Response(
      JSON.stringify({
        status: "ready",
        source_video_url: sourceVideoUrl,
        voice_url: voiceUrl,
        music_url: musicUrl,
        merge_client_side: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erreur Edge Function video-postprocess:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur serveur",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
