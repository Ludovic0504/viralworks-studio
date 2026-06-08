import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const HOOK_VISUAL_DEBIT_REASON = "hook_visual_generation";
const RECONCILIATION_REASON = "hook_visual_reconciliation";

type DebitRow = {
  user_id: string;
  faux_debits: number;
  credits_lost: number;
};

async function requireAdmin(supabaseClient: ReturnType<typeof createClient>) {
  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser();

  if (userError || !user) {
    return { error: "Non autorisé", status: 401 as const, user: null };
  }

  const { data: roleData, error: roleError } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (roleError || roleData?.role !== "admin") {
    return { error: "Accès refusé. Admin requis.", status: 403 as const, user: null };
  }

  return { error: null, status: 200 as const, user };
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

    const adminCheck = await requireAdmin(supabaseClient);
    if (adminCheck.error || !adminCheck.user) {
      return new Response(JSON.stringify({ error: adminCheck.error }), {
        status: adminCheck.status,
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const body =
      req.method === "POST"
        ? await req.json().catch(() => ({}))
        : {};
    const dryRun = body?.dry_run !== false;
    const targetUserId =
      typeof body?.target_user_id === "string" && body.target_user_id.trim()
        ? body.target_user_id.trim()
        : null;

    const { data: debitRows, error: debitError } = await supabaseAdmin
      .from("credit_transactions")
      .select("user_id, amount")
      .eq("reason", HOOK_VISUAL_DEBIT_REASON)
      .lt("amount", 0);

    if (debitError) {
      throw debitError;
    }

    const byUser = new Map<string, { faux_debits: number; credits_lost: number }>();
    for (const row of debitRows || []) {
      const uid = String(row.user_id || "");
      if (!uid) continue;
      if (targetUserId && uid !== targetUserId) continue;
      const prev = byUser.get(uid) || { faux_debits: 0, credits_lost: 0 };
      prev.faux_debits += 1;
      prev.credits_lost += Math.abs(Number(row.amount) || 0);
      byUser.set(uid, prev);
    }

    const { data: reconciledRows, error: reconciledError } = await supabaseAdmin
      .from("credit_transactions")
      .select("user_id")
      .eq("reason", RECONCILIATION_REASON);

    if (reconciledError) {
      throw reconciledError;
    }

    const alreadyReconciled = new Set(
      (reconciledRows || []).map((r) => String(r.user_id))
    );

    const plan: DebitRow[] = [];
    for (const [user_id, stats] of byUser.entries()) {
      if (alreadyReconciled.has(user_id)) continue;
      plan.push({ user_id, ...stats });
    }

    plan.sort((a, b) => b.credits_lost - a.credits_lost);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          users_affected: plan.length,
          total_credits_to_restore: plan.reduce((s, r) => s + r.credits_lost, 0),
          users: plan,
          already_reconciled_user_ids: [...alreadyReconciled],
          query_hint:
            "SELECT user_id, COUNT(*) AS faux_debits, SUM(ABS(amount)) AS credits_lost FROM credit_transactions WHERE reason = 'hook_visual_generation' AND amount < 0 GROUP BY user_id;",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results: Array<{
      user_id: string;
      credits_restored: number;
      new_balance: number;
      skipped?: boolean;
      error?: string;
    }> = [];

    for (const entry of plan) {
      if (alreadyReconciled.has(entry.user_id)) {
        results.push({
          user_id: entry.user_id,
          credits_restored: 0,
          new_balance: 0,
          skipped: true,
        });
        continue;
      }

      const { data: creditsData, error: creditsError } = await supabaseAdmin
        .from("user_credits")
        .select("credits")
        .eq("user_id", entry.user_id)
        .maybeSingle();

      if (creditsError) {
        results.push({
          user_id: entry.user_id,
          credits_restored: 0,
          new_balance: 0,
          error: creditsError.message,
        });
        continue;
      }

      const currentCredits = Number(creditsData?.credits ?? 0);
      const newCredits = currentCredits + entry.credits_lost;

      if (creditsData) {
        const { error: updateError } = await supabaseAdmin
          .from("user_credits")
          .update({ credits: newCredits, updated_at: new Date().toISOString() })
          .eq("user_id", entry.user_id);
        if (updateError) {
          results.push({
            user_id: entry.user_id,
            credits_restored: 0,
            new_balance: currentCredits,
            error: updateError.message,
          });
          continue;
        }
      } else {
        const { error: insertError } = await supabaseAdmin
          .from("user_credits")
          .insert({ user_id: entry.user_id, credits: newCredits });
        if (insertError) {
          results.push({
            user_id: entry.user_id,
            credits_restored: 0,
            new_balance: 0,
            error: insertError.message,
          });
          continue;
        }
      }

      const { error: txError } = await supabaseAdmin.from("credit_transactions").insert({
        user_id: entry.user_id,
        amount: entry.credits_lost,
        type: "admin_add",
        reason: RECONCILIATION_REASON,
        metadata: {
          source: "hook_visual_generation_refund",
          faux_debits: entry.faux_debits,
          credits_restored: entry.credits_lost,
          reconciled_by: adminCheck.user.id,
        },
        created_by: adminCheck.user.id,
      });

      if (txError) {
        results.push({
          user_id: entry.user_id,
          credits_restored: entry.credits_lost,
          new_balance: newCredits,
          error: `Solde mis à jour mais transaction non journalisée: ${txError.message}`,
        });
        alreadyReconciled.add(entry.user_id);
        continue;
      }

      alreadyReconciled.add(entry.user_id);
      results.push({
        user_id: entry.user_id,
        credits_restored: entry.credits_lost,
        new_balance: newCredits,
      });
    }

    return new Response(
      JSON.stringify({
        dry_run: false,
        users_processed: results.length,
        total_credits_restored: results.reduce((s, r) => s + (r.credits_restored || 0), 0),
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erreur admin-recredit-hook-visual:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
