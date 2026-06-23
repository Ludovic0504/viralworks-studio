import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPPORTED_LANGS = new Set(["fr", "en", "es"]);
const LANG_LABELS: Record<string, string> = {
  fr: "French",
  en: "English",
  es: "Spanish",
};

type MessageScope = "public" | "private";

interface RequestBody {
  messageId?: string;
  messageScope?: MessageScope;
  conversationId?: string | null;
  targetLang?: string;
  sourceText?: string;
}

async function assertCanAccessMessage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  messageScope: MessageScope,
  messageId: string,
  conversationId: string | null
) {
  if (messageScope === "public") {
    const { data, error } = await supabase
      .from("community_public_messages")
      .select("id")
      .eq("id", messageId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.id) throw new Error("Message public introuvable.");
    return;
  }

  if (!conversationId) throw new Error("Conversation requise pour un message privé.");

  const { data: msg, error: msgErr } = await supabase
    .from("community_private_messages")
    .select("id, conversation_id")
    .eq("id", messageId)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (msgErr) throw new Error(msgErr.message);
  if (!msg?.id) throw new Error("Message privé introuvable dans cette conversation.");

  const { data: part, error: partErr } = await supabase
    .from("community_private_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (partErr) throw new Error(partErr.message);
  if (!part?.id) throw new Error("Accès à cette conversation refusé.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    const messageId = String(body.messageId || "").trim();
    const messageScope = body.messageScope;
    const targetLang = String(body.targetLang || "").trim().toLowerCase();
    const sourceText = String(body.sourceText || "").trim();
    const conversationId =
      messageScope === "private" ? String(body.conversationId || "").trim() : null;

    if (!messageId || !messageScope || !SUPPORTED_LANGS.has(targetLang)) {
      return new Response(JSON.stringify({ error: "Paramètres invalides." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (messageScope !== "public" && messageScope !== "private") {
      return new Response(JSON.stringify({ error: "Scope invalide." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!sourceText) {
      return new Response(JSON.stringify({ error: "Message vide." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (sourceText.length > 8000) {
      return new Response(JSON.stringify({ error: "Message trop long." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await assertCanAccessMessage(
      supabaseUser,
      user.id,
      messageScope,
      messageId,
      conversationId
    );

    const { data: cached } = await supabaseAdmin
      .from("community_message_translations")
      .select("translated_text")
      .eq("message_id", messageId)
      .eq("message_scope", messageScope)
      .eq("target_lang", targetLang)
      .maybeSingle();

    if (cached?.translated_text) {
      return new Response(
        JSON.stringify({ translatedText: cached.translated_text, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: "Traduction indisponible." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetLabel = LANG_LABELS[targetLang] || targetLang;
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              `Translate the user message to ${targetLabel}. ` +
              "Preserve line breaks and tone. Return only the translation, no quotes or explanation.",
          },
          { role: "user", content: sourceText },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("OpenAI translate error:", openaiResponse.status, errText);
      return new Response(JSON.stringify({ error: "Échec de la traduction." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const completion = await openaiResponse.json();
    const translatedText = String(completion?.choices?.[0]?.message?.content || "").trim();
    if (!translatedText) {
      return new Response(JSON.stringify({ error: "Traduction vide." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upsertErr } = await supabaseAdmin
      .from("community_message_translations")
      .upsert(
        {
          message_id: messageId,
          message_scope: messageScope,
          conversation_id: conversationId,
          target_lang: targetLang,
          translated_text: translatedText,
        },
        { onConflict: "message_id,message_scope,target_lang" }
      );
    if (upsertErr) {
      console.error("Cache upsert failed:", upsertErr.message);
    }

    return new Response(JSON.stringify({ translatedText, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
