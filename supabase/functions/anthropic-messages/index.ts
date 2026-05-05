/**
 * Edge Function — Anthropic Messages API (Claude).
 * Secret Supabase : ANTHROPIC_API_KEY
 * Optionnel : ANTHROPIC_MODEL (défaut claude-3-5-sonnet-20241022)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  system?: string;
  messages: Msg[];
  model?: string;
  max_tokens?: number;
}

function extractTextFromAnthropicPayload(data: Record<string, unknown>): string {
  const content = data.content;
  if (!Array.isArray(content)) return "";
  for (const block of content) {
    if (
      block &&
      typeof block === "object" &&
      (block as { type?: string }).type === "text" &&
      typeof (block as { text?: string }).text === "string"
    ) {
      return String((block as { text: string }).text);
    }
  }
  return "";
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

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey?.trim()) {
      console.error("ANTHROPIC_API_KEY manquante");
      return new Response(
        JSON.stringify({
          error: "Configuration Anthropic manquante (ANTHROPIC_API_KEY).",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = (await req.json()) as RequestBody;
    const {
      system = "",
      messages,
      model = Deno.env.get("ANTHROPIC_MODEL")?.trim() || "claude-3-5-sonnet-20241022",
      max_tokens = 1024,
    } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Le champ 'messages' est requis (non vide)." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const MAX_CHARS = 24000;
    for (const m of messages) {
      if (m.content && m.content.length > MAX_CHARS) {
        return new Response(
          JSON.stringify({ error: `Message trop long (max ${MAX_CHARS} caractères).` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }
    if (system.length > MAX_CHARS) {
      return new Response(JSON.stringify({ error: "System prompt trop long." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clampedMax = Math.min(Math.max(256, Math.floor(Number(max_tokens) || 1024)), 4096);

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: clampedMax,
        ...(system.trim() ? { system: system.trim() } : {}),
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    const rawText = await anthropicRes.text();
    let data: Record<string, unknown> = {};
    try {
      data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
    } catch {
      data = { error: rawText || `HTTP ${anthropicRes.status}` };
    }

    if (!anthropicRes.ok) {
      const errMsg =
        typeof data.error === "object" && data.error !== null && "message" in data.error
          ? String((data.error as { message?: string }).message)
          : typeof data.error === "string"
            ? data.error
            : `Erreur Anthropic HTTP ${anthropicRes.status}`;
      return new Response(JSON.stringify({ error: errMsg }), {
        status: anthropicRes.status >= 400 && anthropicRes.status < 600 ? anthropicRes.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = extractTextFromAnthropicPayload(data);

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("anthropic-messages:", error);
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
