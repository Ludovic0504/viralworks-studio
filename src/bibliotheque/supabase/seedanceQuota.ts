import { getBrowserSupabase } from "./client-navigateur";
import { fetchPremiumAccess } from "./premiumAccess";
import { getSeedanceMonthlyLimit } from "./planQuotas";

export type SeedanceQuota = {
  count: number;
  limit: number;
  resetAt: string | null;
};

export async function fetchSeedanceQuota(): Promise<SeedanceQuota> {
  const supabase = getBrowserSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { count: 0, limit: 0, resetAt: null };
  }

  const { plan } = await fetchPremiumAccess();
  const limit = getSeedanceMonthlyLimit(plan);

  if (limit <= 0) {
    return { count: 0, limit: 0, resetAt: null };
  }

  const { data: quotaRow, error: rpcError } = await supabase.rpc("get_my_seedance_quota");

  if (rpcError || !quotaRow || typeof quotaRow !== "object") {
    const { data, error } = await supabase
      .from("profiles")
      .select("seedance_count, seedance_reset_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      return { count: 0, limit, resetAt: null };
    }

    return {
      count: data.seedance_count ?? 0,
      limit,
      resetAt: data.seedance_reset_at ?? null,
    };
  }

  const row = quotaRow as { count?: number; reset_at?: string | null };

  return {
    count: typeof row.count === "number" ? row.count : 0,
    limit,
    resetAt: row.reset_at ?? null,
  };
}
