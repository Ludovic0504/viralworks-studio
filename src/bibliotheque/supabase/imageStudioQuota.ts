import { getBrowserSupabase } from "./client-navigateur";

export const IMAGE_STUDIO_MONTHLY_LIMIT = 200;
/** À partir de ce nombre de générations consommées, throttle serveur (30 s). */
export const IMAGE_STUDIO_THROTTLE_AFTER = 100;

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

  const { data, error } = await supabase
    .from("profiles")
    .select("image_studio_count, image_studio_reset_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return { count: 0, limit: IMAGE_STUDIO_MONTHLY_LIMIT, resetAt: null };
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
      limit: IMAGE_STUDIO_MONTHLY_LIMIT,
      resetAt: monthStart.toISOString(),
    };
  }

  return {
    count: data.image_studio_count ?? 0,
    limit: IMAGE_STUDIO_MONTHLY_LIMIT,
    resetAt: data.image_studio_reset_at,
  };
}
