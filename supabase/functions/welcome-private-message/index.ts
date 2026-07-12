import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { notifyOnboardingStep1Delivery } from "../_shared/adminNotify.ts";
import { COMMUNITY_CORS_HEADERS, jsonResponse } from "../_shared/community/helpers.ts";
import {
  createAdminClient,
  sendWelcomeOnboardingStep1,
} from "../_shared/community/welcomeFlow.ts";

type SignupHookPayload = {
  type?: string;
  user?: {
    id?: string;
    email?: string | null;
    created_at?: string;
  };
  record?: {
    id?: string;
    email?: string | null;
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

function getUserId(payload: SignupHookPayload): string {
  const user = payload.user ?? payload.record ?? {};
  return String(user.id || "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: COMMUNITY_CORS_HEADERS });
  }

  if (!verifyHookSecret(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let payload: SignupHookPayload = {};
  try {
    payload = (await req.json()) as SignupHookPayload;
  } catch {
    payload = {};
  }

  const userId = getUserId(payload);
  const userEmail = String(payload.user?.email ?? payload.record?.email ?? "").trim() || null;
  if (!userId) {
    return jsonResponse({ ok: false, error: "user_id manquant" }, 400);
  }

  try {
    const adminClient = createAdminClient();
    const result = await sendWelcomeOnboardingStep1(adminClient, userId);

    const notifyResult = await notifyOnboardingStep1Delivery(adminClient, {
      userId,
      userEmail,
      result,
      source: "signup_hook",
    }).catch((notifyError) => {
      const message = notifyError instanceof Error ? notifyError.message : String(notifyError);
      console.error("[welcome-private-message] notify failed:", message);
      return { notified: false, emailed: false, error: message };
    });

    if (!result.ok) {
      console.error("[welcome-private-message] failed:", result.reason);
      return jsonResponse(
        { ok: false, error: result.reason, adminNotified: notifyResult.emailed },
        500,
      );
    }
    return jsonResponse({
      ok: true,
      skipped: result.skipped === true,
      reason: result.reason,
      adminNotified: notifyResult.emailed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    console.error("[welcome-private-message] exception:", message);

    try {
      const adminClient = createAdminClient();
      await notifyOnboardingStep1Delivery(adminClient, {
        userId,
        userEmail,
        result: { ok: false, reason: message },
        source: "signup_hook",
      });
    } catch (notifyError) {
      console.error("[welcome-private-message] notify exception failed:", notifyError);
    }

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
