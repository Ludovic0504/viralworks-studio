import { getBrowserSupabase } from "./client-navigateur";
import { fetchPremiumAccess } from "./premiumAccess";
import {
  getImageStudioMonthlyLimit,
  IMAGE_STUDIO_MONTHLY_QUOTA_DEFAULT,
} from "./planQuotas";

export const IMAGE_STUDIO_MONTHLY_LIMIT = IMAGE_STUDIO_MONTHLY_QUOTA_DEFAULT;

export type ImageStudioQuota = {
  count: number;
  limit: number;
  resetAt: string | null;
};

export async function fetchImageStudioQuota(): Promise<ImageStudioQuota> {
  const supabase = getBrowserSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { count: 0, limit: IMAGE_STUDIO_MONTHLY_LIMIT, resetAt: null };
  }

  const { plan } = await fetchPremiumAccess();
  const limit = getImageStudioMonthlyLimit(plan) || IMAGE_STUDIO_MONTHLY_LIMIT;

  const { data, error } = await supabase
    .from("profiles")
    .select("image_studio_count, image_studio_reset_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return { count: 0, limit, resetAt: null };
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const resetAt = data.image_studio_reset_at
    ? new Date(data.image_studio_reset_at)
    : null;

  if (!resetAt || resetAt < monthStart) {
    return {
      count: 0,
      limit,
      resetAt: monthStart.toISOString(),
    };
  }

  return {
    count: data.image_studio_count ?? 0,
    limit,
    resetAt: data.image_studio_reset_at,
  };
}
