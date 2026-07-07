import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getImageStudioMonthlyLimit, type UserPlan } from "./plan-access.ts";

export const IMAGE_STUDIO_TRIAL_QUOTA = 30;
export const IMAGE_STUDIO_TRIAL_DAYS = 7;

export type ImageStudioQuotaMode = "monthly" | "trial";

export type ResolvedImageStudioQuota = {
  count: number;
  limit: number;
  mode: ImageStudioQuotaMode;
  resetAt: string | null;
  cycleEndsAt: string | null;
  trialUsed: boolean;
  trialExpired: boolean;
};

function parseQuotaPayload(data: unknown): ResolvedImageStudioQuota | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const mode = row.mode === "trial" ? "trial" : "monthly";
  return {
    count: typeof row.count === "number" ? row.count : 0,
    limit: typeof row.limit === "number" ? row.limit : 0,
    mode,
    resetAt: typeof row.reset_at === "string" ? row.reset_at : null,
    cycleEndsAt: typeof row.cycle_ends_at === "string" ? row.cycle_ends_at : null,
    trialUsed: row.trial_used === true,
    trialExpired: row.trial_expired === true,
  };
}

export async function resolveImageStudioQuota(
  supabase: SupabaseClient,
  userId: string,
  fallbackPlan: UserPlan = "free",
): Promise<ResolvedImageStudioQuota> {
  const { data, error } = await supabase.rpc("resolve_image_studio_quota", {
    p_user_id: userId,
  });

  const parsed = parseQuotaPayload(data);
  if (!error && parsed) {
    return parsed;
  }

  const fallbackLimit = getImageStudioMonthlyLimit(fallbackPlan);
  return {
    count: 0,
    limit: fallbackLimit,
    mode: "monthly",
    resetAt: null,
    cycleEndsAt: null,
    trialUsed: false,
    trialExpired: false,
  };
}

export function imageStudioQuotaExceededMessage(quota: ResolvedImageStudioQuota): string {
  if (quota.mode === "trial" && quota.trialExpired) {
    return "Ton essai gratuit Image Studio est terminé. Passe à ViralWorks Image pour continuer.";
  }
  if (quota.mode === "trial") {
    return `Quota d'essai atteint (${IMAGE_STUDIO_TRIAL_QUOTA} images). Passe à l'abonnement pour continuer.`;
  }
  return `Quota mensuel atteint (${quota.limit} images). Le quota se réinitialise le 1er du mois prochain.`;
}
