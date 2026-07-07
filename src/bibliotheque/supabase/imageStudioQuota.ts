import { getBrowserSupabase } from "./client-navigateur";
import {
  IMAGE_STUDIO_TRIAL_QUOTA,
  type ImageStudioQuotaMode,
} from "./planQuotas";

export type ImageStudioQuota = {
  count: number;
  limit: number;
  resetAt: string | null;
  mode: ImageStudioQuotaMode;
  cycleEndsAt: string | null;
  trialUsed: boolean;
  trialExpired: boolean;
};

function parseQuotaRow(data: unknown): ImageStudioQuota | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  return {
    count: typeof row.count === "number" ? row.count : 0,
    limit: typeof row.limit === "number" ? row.limit : 0,
    resetAt: typeof row.reset_at === "string" ? row.reset_at : null,
    mode: row.mode === "trial" ? "trial" : "monthly",
    cycleEndsAt: typeof row.cycle_ends_at === "string" ? row.cycle_ends_at : null,
    trialUsed: row.trial_used === true,
    trialExpired: row.trial_expired === true,
  };
}

export async function fetchImageStudioQuota(): Promise<ImageStudioQuota> {
  const supabase = getBrowserSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  const empty: ImageStudioQuota = {
    count: 0,
    limit: IMAGE_STUDIO_TRIAL_QUOTA,
    resetAt: null,
    mode: "monthly",
    cycleEndsAt: null,
    trialUsed: false,
    trialExpired: false,
  };

  if (userErr || !user) {
    return empty;
  }

  const { data: quotaRow, error: rpcError } = await supabase.rpc(
    "get_my_image_studio_quota",
  );

  const parsed = parseQuotaRow(quotaRow);
  if (!rpcError && parsed) {
    return parsed;
  }

  return empty;
}
