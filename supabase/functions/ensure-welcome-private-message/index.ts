import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { notifyOnboardingStep1Delivery } from "../_shared/adminNotify.ts";
import {
  COMMUNITY_CORS_HEADERS,
  getAuthedClients,
  jsonResponse,
} from "../_shared/community/helpers.ts";
import {
  createAdminClient,
  sendWelcomeOnboardingStep1,
} from "../_shared/community/welcomeFlow.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: COMMUNITY_CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    let accessToken: string | undefined;
    try {
      const body = (await req.json()) as { accessToken?: string };
      accessToken = body.accessToken;
    } catch {
      accessToken = undefined;
    }

    const { userId } = await getAuthedClients(req, accessToken);
    const adminClient = createAdminClient();
    const result = await sendWelcomeOnboardingStep1(adminClient, userId);

    const shouldNotify = !result.ok || !result.skipped;

    if (shouldNotify) {
      await notifyOnboardingStep1Delivery(adminClient, {
        userId,
        result,
        source: "client_fallback",
      }).catch((notifyError) => {
        const message = notifyError instanceof Error ? notifyError.message : String(notifyError);
        console.error("[ensure-welcome-private-message] notify failed:", message);
      });
    }

    if (!result.ok) {
      console.error("[ensure-welcome-private-message] failed:", result.reason);
      return jsonResponse({ ok: false, error: result.reason }, 500);
    }

    return jsonResponse({
      ok: true,
      skipped: result.skipped === true,
      reason: result.reason,
      conversationId: result.conversationId ?? null,
      messageId: result.messageId ?? null,
      supportUserId: result.supportUserId ?? null,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    console.error("[ensure-welcome-private-message] exception:", message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
