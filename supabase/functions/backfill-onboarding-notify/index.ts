import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { notifyOnboardingStep1Delivery } from "../_shared/adminNotify.ts";
import { COMMUNITY_CORS_HEADERS, jsonResponse } from "../_shared/community/helpers.ts";
import { ONBOARDING_ROLLOUT_AT } from "../_shared/community/onboarding.ts";
import {
  createAdminClient,
  getSupportUserId,
  type WelcomeStep1Result,
} from "../_shared/community/welcomeFlow.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function verifyHookSecret(req: Request): boolean {
  const hookSecret = (Deno.env.get("AUTH_HOOK_SECRET") ?? "").trim();
  if (!hookSecret) return true;
  const provided =
    (req.headers.get("x-hook-secret") ?? "").trim() ||
    new URL(req.url).searchParams.get("x-hook-secret")?.trim() ||
    "";
  return provided === hookSecret;
}

async function inferOnboardingStep1Result(
  adminClient: SupabaseClient,
  userId: string,
): Promise<WelcomeStep1Result> {
  const supportUserId = await getSupportUserId(adminClient);
  if (supportUserId === userId) {
    return { ok: true, skipped: true, reason: "is_support_account" };
  }

  const { data: flow, error: flowError } = await adminClient
    .from("community_welcome_flow")
    .select("conversation_id, step1_message_id, completed_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (flowError) {
    return { ok: false, reason: flowError.message };
  }

  if (flow?.step1_message_id) {
    return {
      ok: true,
      conversationId: String(flow.conversation_id || ""),
      messageId: String(flow.step1_message_id || ""),
      supportUserId: supportUserId || undefined,
    };
  }

  if (flow?.conversation_id) {
    const { data: step1 } = await adminClient
      .from("community_private_messages")
      .select("id")
      .eq("conversation_id", flow.conversation_id)
      .eq("onboarding_step", 1)
      .limit(1)
      .maybeSingle();

    if (step1?.id) {
      return {
        ok: true,
        conversationId: String(flow.conversation_id),
        messageId: String(step1.id),
        supportUserId: supportUserId || undefined,
      };
    }
  }

  if (flow?.completed_at) {
    return { ok: true, skipped: true, reason: "onboarding_skipped" };
  }

  return { ok: false, reason: "message_jamais_envoye" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: COMMUNITY_CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!verifyHookSecret(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const dryRun = new URL(req.url).searchParams.get("dry_run") === "1";

  try {
    const adminClient = createAdminClient();
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("user_id, email, full_name, created_at")
      .gte("created_at", ONBOARDING_ROLLOUT_AT)
      .order("created_at", { ascending: true });

    if (profilesError) {
      return jsonResponse({ ok: false, error: profilesError.message }, 500);
    }

    const results: Array<Record<string, unknown>> = [];

    for (const profile of profiles ?? []) {
      const userId = String(profile.user_id || "").trim();
      if (!userId) continue;

      const result = await inferOnboardingStep1Result(adminClient, userId);

      if (dryRun) {
        results.push({
          userId,
          email: profile.email,
          fullName: profile.full_name,
          signedUpAt: profile.created_at,
          result,
        });
        continue;
      }

      const notify = await notifyOnboardingStep1Delivery(adminClient, {
        userId,
        userEmail: profile.email,
        result,
        source: "backfill",
        signedUpAt: profile.created_at,
      });

      results.push({
        userId,
        email: profile.email,
        fullName: profile.full_name,
        signedUpAt: profile.created_at,
        result,
        notified: notify.notified,
        emailed: notify.emailed,
        skippedExisting: !notify.notified && !notify.emailed && !notify.error,
        error: notify.error ?? null,
      });

      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    const emailed = results.filter((row) => row.emailed === true).length;
    const skipped = results.filter((row) => row.skippedExisting === true).length;

    return jsonResponse({
      ok: true,
      dryRun,
      rolloutFrom: ONBOARDING_ROLLOUT_AT,
      totalProfiles: profiles?.length ?? 0,
      emailed,
      skippedExisting: skipped,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    console.error("[backfill-onboarding-notify] exception:", message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
