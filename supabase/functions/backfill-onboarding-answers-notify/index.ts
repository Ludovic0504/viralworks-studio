import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { notifyOnboardingAnswersComplete } from "../_shared/adminNotify.ts";
import { COMMUNITY_CORS_HEADERS, jsonResponse } from "../_shared/community/helpers.ts";
import { ONBOARDING_ROLLOUT_AT } from "../_shared/community/onboarding.ts";
import { createAdminClient } from "../_shared/community/welcomeFlow.ts";

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

      const { data: flow } = await adminClient
        .from("community_welcome_flow")
        .select("step1_answer, step2_answer, step3_message_id, completed_at")
        .eq("user_id", userId)
        .maybeSingle();

      const hasCompleteAnswers = Boolean(
        String(flow?.step1_answer || "").trim() &&
          String(flow?.step2_answer || "").trim() &&
          flow?.step3_message_id,
      );

      if (!hasCompleteAnswers) {
        results.push({
          userId,
          email: profile.email,
          fullName: profile.full_name,
          skipped: "answers_incomplete",
        });
        continue;
      }

      if (dryRun) {
        results.push({
          userId,
          email: profile.email,
          fullName: profile.full_name,
          step1Answer: flow?.step1_answer,
          step2Answer: flow?.step2_answer,
          completedAt: flow?.completed_at,
        });
        continue;
      }

      const notify = await notifyOnboardingAnswersComplete(adminClient, {
        userId,
        userEmail: profile.email,
        signedUpAt: profile.created_at,
        source: "backfill",
      });

      results.push({
        userId,
        email: profile.email,
        fullName: profile.full_name,
        step1Answer: flow?.step1_answer,
        step2Answer: flow?.step2_answer,
        completedAt: flow?.completed_at,
        notified: notify.notified,
        emailed: notify.emailed,
        skipped: notify.skipped ?? null,
        error: notify.error ?? null,
      });

      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    const emailed = results.filter((row) => row.emailed === true).length;
    const skippedExisting = results.filter((row) => row.skipped === "already_notified").length;
    const incomplete = results.filter((row) => row.skipped === "answers_incomplete").length;

    return jsonResponse({
      ok: true,
      dryRun,
      rolloutFrom: ONBOARDING_ROLLOUT_AT,
      totalProfiles: profiles?.length ?? 0,
      emailed,
      skippedExisting,
      answersIncomplete: incomplete,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    console.error("[backfill-onboarding-answers-notify] exception:", message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
