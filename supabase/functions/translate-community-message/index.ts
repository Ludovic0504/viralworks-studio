import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { censorMessageText } from "../_shared/name-moderation/censorMessage.ts";
import { COMMUNITY_CORS_HEADERS, getAuthedClients, jsonResponse } from "../_shared/community/helpers.ts";

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
  accessToken?: string;
}

async function fetchRawMessageContent(
  adminClient: ReturnType<typeof createClient>,
  messageScope: MessageScope,
  messageId: string,
  conversationId: string | null,
): Promise<string> {
  if (messageScope === "public") {
    const { data, error } = await adminClient
      .from("community_public_messages")
      .select("content")
      .eq("id", messageId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Message public introuvable.");
    return String(data.content || "").trim();
  }

  if (!conversationId) throw new Error("Conversation requise pour un message privé.");

  const { data, error } = await adminClient
    .from("community_private_messages")
    .select("content")
    .eq("id", messageId)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Message privé introuvable dans cette conversation.");
  return String(data.content || "").trim();
}

async function assertCanAccessMessage(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  messageScope: MessageScope,
  messageId: string,
  conversationId: string | null,
) {
  if (messageScope === "public") {
    const { data, error } = await adminClient
      .from("community_public_messages")
      .select("id")
      .eq("id", messageId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.id) throw new Error("Message public introuvable.");
    return;
  }

  if (!conversationId) throw new Error("Conversation requise pour un message privé.");

  const { data: conv, error: convErr } = await adminClient
    .from("community_private_conversations")
    .select("id, user_a, user_b")
    .eq("id", conversationId)
    .maybeSingle();
  if (convErr) throw new Error(convErr.message);
  if (!conv?.id) throw new Error("Conversation introuvable.");

  const isMember =
    String(conv.user_a || "") === userId ||
    String(conv.user_b || "") === userId;

  if (!isMember) {
    const { data: part, error: partErr } = await adminClient
      .from("community_private_participants")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (partErr) throw new Error(partErr.message);
    if (!part?.id) throw new Error("Accès à cette conversation refusé.");
  }

  const { data: msg, error: msgErr } = await adminClient
    .from("community_private_messages")
    .select("id")
    .eq("id", messageId)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (msgErr) throw new Error(msgErr.message);
  if (!msg?.id) throw new Error("Message privé introuvable dans cette conversation.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: COMMUNITY_CORS_HEADERS });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { userId, adminClient } = await getAuthedClients(req, body.accessToken);

    const messageId = String(body.messageId || "").trim();
    const messageScope = body.messageScope;
    const targetLang = String(body.targetLang || "").trim().toLowerCase();
    const conversationId =
      messageScope === "private" ? String(body.conversationId || "").trim() : null;

    if (!messageId || !messageScope || !SUPPORTED_LANGS.has(targetLang)) {
      return jsonResponse({ error: "Paramètres invalides." }, 400);
    }
    if (messageScope !== "public" && messageScope !== "private") {
      return jsonResponse({ error: "Scope invalide." }, 400);
    }

    await assertCanAccessMessage(adminClient, userId, messageScope, messageId, conversationId);

    const sourceText = await fetchRawMessageContent(
      adminClient,
      messageScope,
      messageId,
      conversationId,
    );

    if (!sourceText) {
      return jsonResponse({ error: "Message vide." }, 400);
    }
    if (sourceText.length > 8000) {
      return jsonResponse({ error: "Message trop long." }, 400);
    }

    const { data: cached } = await adminClient
      .from("community_message_translations")
      .select("translated_text")
      .eq("message_id", messageId)
      .eq("message_scope", messageScope)
      .eq("target_lang", targetLang)
      .maybeSingle();

    if (cached?.translated_text) {
      const censoredCached = censorMessageText(String(cached.translated_text));
      return jsonResponse({ translatedText: censoredCached, cached: true });
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return jsonResponse({ error: "Traduction indisponible." }, 500);
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
      return jsonResponse({ error: "Échec de la traduction." }, 502);
    }

    const completion = await openaiResponse.json();
    const translatedRaw = String(completion?.choices?.[0]?.message?.content || "").trim();
    if (!translatedRaw) {
      return jsonResponse({ error: "Traduction vide." }, 502);
    }

    const translatedText = censorMessageText(translatedRaw);

    const { error: upsertErr } = await adminClient
      .from("community_message_translations")
      .upsert(
        {
          message_id: messageId,
          message_scope: messageScope,
          conversation_id: conversationId,
          target_lang: targetLang,
          translated_text: translatedText,
        },
        { onConflict: "message_id,message_scope,target_lang" },
      );
    if (upsertErr) {
      console.error("Cache upsert failed:", upsertErr.message);
    }

    return jsonResponse({ translatedText, cached: false });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    return jsonResponse({ error: message }, 500);
  }
});
