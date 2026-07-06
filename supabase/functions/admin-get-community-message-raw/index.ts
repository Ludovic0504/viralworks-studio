import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  assertIsAdmin,
  COMMUNITY_CORS_HEADERS,
  getAuthedClients,
  jsonResponse,
} from "../_shared/community/helpers.ts";

type RequestBody = {
  messageId?: string;
  messageScope?: "public" | "private";
  conversationId?: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: COMMUNITY_CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { userId, userClient, adminClient } = await getAuthedClients(req);
    await assertIsAdmin(userClient, userId);

    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return jsonResponse({ error: "Corps JSON invalide." }, 400);
    }

    const messageId = String(body.messageId || "").trim();
    const messageScope = body.messageScope;
    const conversationId = body.messageScope === "private"
      ? String(body.conversationId || "").trim()
      : null;

    if (!messageId || (messageScope !== "public" && messageScope !== "private")) {
      return jsonResponse({ error: "Paramètres invalides." }, 400);
    }

    if (messageScope === "private" && !conversationId) {
      return jsonResponse({ error: "conversationId requis." }, 400);
    }

    const table = messageScope === "public"
      ? "community_public_messages"
      : "community_private_messages";

    let query = adminClient.from(table).select("*").eq("id", messageId);
    if (messageScope === "private") {
      query = query.eq("conversation_id", conversationId!);
    }

    const { data, error } = await query.maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    if (!data) return jsonResponse({ error: "Message introuvable." }, 404);

    return jsonResponse({
      message: {
        id: String(data.id),
        messageScope,
        conversationId: data.conversation_id ? String(data.conversation_id) : null,
        userId: data.user_id ? String(data.user_id) : null,
        content: String(data.content || ""),
        createdAt: String(data.created_at || ""),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    return jsonResponse({ error: message }, 500);
  }
});
