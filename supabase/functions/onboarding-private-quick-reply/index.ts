import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  COMMUNITY_CORS_HEADERS,
  getAuthedClients,
  jsonResponse,
} from "../_shared/community/helpers.ts";
import {
  createAdminClient,
  handleOnboardingQuickReply,
} from "../_shared/community/welcomeFlow.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: COMMUNITY_CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    let body: {
      accessToken?: string;
      messageId?: string;
      conversationId?: string;
      label?: string;
    } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }

    const messageId = String(body.messageId || "").trim();
    const conversationId = String(body.conversationId || "").trim();
    const label = String(body.label || "").trim();
    if (!messageId || !conversationId || !label) {
      return jsonResponse({ error: "Paramètres manquants." }, 400);
    }

    const { userId } = await getAuthedClients(req, body.accessToken);
    const adminClient = createAdminClient();
    const result = await handleOnboardingQuickReply(adminClient, {
      userId,
      messageId,
      conversationId,
      label,
    });

    if (!result.ok) {
      return jsonResponse({ ok: false, error: result.reason }, 500);
    }

    return jsonResponse({ ok: true, skipped: result.skipped === true, reason: result.reason });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
