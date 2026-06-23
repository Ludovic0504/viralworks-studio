import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIST_LIMIT = 100;
const VALID_SECTIONS = new Set([
  "overview", "payments", "transactions", "subscriptions", "history", "notifications",
]);

type ProfileRow = {
  user_id: string;
  email?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  created_at?: string | null;
  role?: string | null;
  is_tester?: boolean | null;
};

type UserWithAuth = ProfileRow & {
  credits: number;
  credits_text_generation: number;
  credits_image_generation: number;
  credits_image_modification: number;
  credits_video_generation: number;
  email_verified: boolean;
  last_sign_in_at: string | null;
  created_at_auth: string | null;
};

function buildProfileMap(profiles: ProfileRow[]) {
  const map = new Map<string, ProfileRow>();
  for (const p of profiles) map.set(p.user_id, p);
  return map;
}

function enrichWithClient<T extends { user_id?: string }>(rows: T[], profileMap: Map<string, ProfileRow>) {
  return rows.map((row) => {
    const client = row.user_id ? profileMap.get(row.user_id) : undefined;
    return {
      ...row,
      client_email: client?.email || "Client inconnu",
      client_name: client?.full_name || client?.first_name || null,
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sections = ["overview", "payments", "transactions", "subscriptions", "history", "notifications"];
    try {
      const body = await req.json();
      if (Array.isArray(body?.sections) && body.sections.length > 0) {
        sections = body.sections.filter((s: string) => VALID_SECTIONS.has(s));
        if (!sections.length) sections = ["overview"];
      }
    } catch {
      // body optional
    }

    const wants = new Set(sections);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const response: Record<string, unknown> = {};

    if (wants.has("overview")) {
      const [
        { data: profiles },
        { data: credits },
        { data: creditBuckets },
        { data: authUsers },
        { count: totalPayments },
        { count: totalTransactions },
        { count: totalHistory },
        { count: totalSubscriptions },
        { count: activeSubscriptions },
        { count: unreadAdminNotifications },
      ] = await Promise.all([
        supabaseAdminClient.from("profiles").select("user_id, email, full_name, first_name, last_name, created_at, role, is_tester").order("created_at", { ascending: false }),
        supabaseAdminClient.from("user_credits").select("user_id, credits"),
        supabaseAdminClient.from("user_credit_buckets").select("user_id, text_generation, image_generation, image_modification, video_generation"),
        supabaseAdminClient.auth.admin.listUsers(),
        supabaseAdminClient.from("stripe_payments").select("*", { count: "exact", head: true }),
        supabaseAdminClient.from("credit_transactions").select("*", { count: "exact", head: true }),
        supabaseAdminClient.from("history").select("*", { count: "exact", head: true }),
        supabaseAdminClient.from("stripe_subscriptions").select("*", { count: "exact", head: true }),
        supabaseAdminClient.from("stripe_subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabaseAdminClient.from("admin_notifications").select("*", { count: "exact", head: true }).is("read_at", null),
      ]);

      const usersWithAuth: UserWithAuth[] = (profiles || []).map((p) => {
        const authUser = authUsers?.users?.find((u) => u.id === p.user_id);
        const userCredits = credits?.find((c) => c.user_id === p.user_id);
        const userBuckets = creditBuckets?.find((b) => b.user_id === p.user_id);
        return {
          ...p,
          credits: userCredits?.credits || 0,
          credits_text_generation: userBuckets?.text_generation || 0,
          credits_image_generation: userBuckets?.image_generation || 0,
          credits_image_modification: userBuckets?.image_modification || 0,
          credits_video_generation: userBuckets?.video_generation || 0,
          email_verified: Boolean(authUser?.email_confirmed_at),
          last_sign_in_at: authUser?.last_sign_in_at || null,
          created_at_auth: authUser?.created_at || null,
        };
      });

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentSignups = usersWithAuth.filter((u) => {
        const signupDate = new Date(u.created_at_auth || u.created_at || 0);
        return signupDate >= weekAgo;
      }).length;
      const verifiedEmails = usersWithAuth.filter((u) => u.email_verified).length;

      response.stats = {
        totalUsers: usersWithAuth.length,
        activeSubscriptions: activeSubscriptions || 0,
        recentSignups,
        verifiedEmails,
        totalPayments: totalPayments || 0,
        totalTransactions: totalTransactions || 0,
        totalHistory: totalHistory || 0,
        totalSubscriptions: totalSubscriptions || 0,
        unreadAdminNotifications: unreadAdminNotifications || 0,
      };
      response.users = usersWithAuth;
    }

    let profileMap: Map<string, ProfileRow> | null = null;
    async function getProfileMap() {
      if (profileMap) return profileMap;
      const { data: profiles } = await supabaseAdminClient
        .from("profiles")
        .select("user_id, email, full_name, first_name, last_name");
      profileMap = buildProfileMap(profiles || []);
      return profileMap;
    }

    if (wants.has("payments")) {
      const [{ data: payments }, map] = await Promise.all([
        supabaseAdminClient.from("stripe_payments").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT),
        getProfileMap(),
      ]);
      response.payments = enrichWithClient(payments || [], map);
    }

    if (wants.has("transactions")) {
      const [{ data: transactions }, map] = await Promise.all([
        supabaseAdminClient.from("credit_transactions").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT),
        getProfileMap(),
      ]);
      response.transactions = enrichWithClient(transactions || [], map);
    }

    if (wants.has("subscriptions")) {
      const [{ data: subscriptions }, map] = await Promise.all([
        supabaseAdminClient.from("stripe_subscriptions").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT),
        getProfileMap(),
      ]);
      response.subscriptions = enrichWithClient(subscriptions || [], map);
    }

    if (wants.has("history")) {
      const [{ data: history }, map] = await Promise.all([
        supabaseAdminClient.from("history").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT),
        getProfileMap(),
      ]);
      response.history = enrichWithClient(history || [], map);
    }

    if (wants.has("notifications")) {
      const { data: adminNotifications } = await supabaseAdminClient
        .from("admin_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);
      response.adminNotifications = adminNotifications || [];
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erreur admin dashboard:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
