import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { COMMUNITY_CORS_HEADERS, jsonResponse } from "../_shared/community/helpers.ts";
import {
  createAdminClient,
  handleOnboardingUserReply,
} from "../_shared/community/welcomeFlow.ts";

type FollowupHookPayload = {
  type?: string;
  message?: {
    id?: string;
    conversation_id?: string;
    user_id?: string;
    response_method?: string | null;
    created_at?: string;
  };
};

function verifyHookSecret(req: Request): boolean {
  const hookSecret = (Deno.env.get("AUTH_HOOK_SECRET") ?? "").trim();
  if (!hookSecret) return true;
  const provided =
    (req.headers.get("x-hook-secret") ?? "").trim() ||
    new URL(req.url).searchParams.get("x-hook-secret")?.trim() ||
    "";
  return provided === hookSecret;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: COMMUNITY_CORS_HEADERS });
  }

  if (!verifyHookSecret(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let payload: FollowupHookPayload = {};
  try {
    payload = (await req.json()) as FollowupHookPayload;
  } catch {
    payload = {};
  }

  const message = payload.message ?? {};
  const messageId = String(message.id || "").trim();
  const conversationId = String(message.conversation_id || "").trim();
  const userId = String(message.user_id || "").trim();

  if (!messageId || !conversationId || !userId) {
    return jsonResponse({ ok: false, error: "payload_incomplete" }, 400);
  }

  try {
    const adminClient = createAdminClient();
    const result = await handleOnboardingUserReply(adminClient, {
      messageId,
      conversationId,
      userId,
      responseMethod: message.response_method,
    });
    if (!result.ok) {
      console.error("[onboarding-private-followup] failed:", result.reason);
      return jsonResponse({ ok: false, error: result.reason }, 500);
    }
    return jsonResponse({ ok: true, skipped: result.skipped === true, reason: result.reason });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Erreur serveur.";
    console.error("[onboarding-private-followup] exception:", messageText);
    return jsonResponse({ ok: false, error: messageText }, 500);
  }
});
