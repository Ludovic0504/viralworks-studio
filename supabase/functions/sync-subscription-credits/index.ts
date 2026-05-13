import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { nextVideoDisplayCap } from "../_shared/video-display-cap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function monthDiffInclusive(startIso: string, end: Date): number {
  const s = new Date(startIso);
  if (Number.isNaN(s.getTime())) return 1;
  let months =
    (end.getUTCFullYear() - s.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - s.getUTCMonth());
  if (months < 0) months = 0;
  return months + 1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: "SERVICE_ROLE_KEY manquant" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey
    );

    const { data: cycle } = await admin
      .from("subscription_credit_cycles")
      .select("id, stripe_subscription_id, plan_key, monthly_credit_amount, granted_months")
      .eq("user_id", user.id)
      .eq("plan_key", "yearly")
      .maybeSingle();

    if (!cycle) {
      return new Response(JSON.stringify({ synced: true, granted: 0, reason: "no_yearly_cycle" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sub } = await admin
      .from("stripe_subscriptions")
      .select("status, current_period_start, current_period_end")
      .eq("stripe_subscription_id", cycle.stripe_subscription_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub || sub.status !== "active") {
      return new Response(JSON.stringify({ synced: true, granted: 0, reason: "subscription_not_active" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const targetMonths = Math.min(12, monthDiffInclusive(sub.current_period_start, now));
    const alreadyGranted = Number(cycle.granted_months || 0);
    const toGrantMonths = targetMonths - alreadyGranted;

    if (toGrantMonths <= 0) {
      return new Response(JSON.stringify({ synced: true, granted: 0, reason: "up_to_date" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creditsToGrant = toGrantMonths * Number(cycle.monthly_credit_amount || 30);

    const { data: creditsData } = await admin
      .from("user_credits")
      .select("credits, video_display_cap")
      .eq("user_id", user.id)
      .single();

    const balanceBefore = Number(creditsData?.credits || 0);
    const newCredits = balanceBefore + creditsToGrant;
    const nextCap = nextVideoDisplayCap({
      balanceBefore,
      oldCap: creditsData?.video_display_cap,
      purchaseQty: creditsToGrant,
      balanceAfter: newCredits,
    });

    if (creditsData) {
      await admin
        .from("user_credits")
        .update({ credits: newCredits, video_display_cap: nextCap })
        .eq("user_id", user.id);
    } else {
      await admin
        .from("user_credits")
        .insert({ user_id: user.id, credits: newCredits, video_display_cap: nextCap });
    }

    await admin
      .from("credit_transactions")
      .insert({
        user_id: user.id,
        amount: creditsToGrant,
        type: "credit",
        reason: "subscription_yearly_monthly_allocation",
        metadata: {
          subscription_id: cycle.stripe_subscription_id,
          months_granted_now: toGrantMonths,
          granted_months_before: alreadyGranted,
          granted_months_after: targetMonths,
        },
      });

    await admin
      .from("subscription_credit_cycles")
      .update({
        granted_months: targetMonths,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cycle.id);

    return new Response(JSON.stringify({ synced: true, granted: creditsToGrant }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

