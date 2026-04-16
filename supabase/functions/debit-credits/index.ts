import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization requis" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      console.error("SERVICE_ROLE_KEY manquant");
      return new Response(
        JSON.stringify({ error: "Configuration serveur incomplète" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { amount, reason, metadata } = await req.json();

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return new Response(JSON.stringify({ error: "Montant invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const meta =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? metadata
        : {};

    const { data: rpcRaw, error: rpcError } = await supabaseAdmin.rpc(
      "debit_user_credits_atomic",
      {
        p_user_id: user.id,
        p_amount: Math.floor(amount),
        p_reason: typeof reason === "string" ? reason : "generation",
        p_metadata: meta as Record<string, unknown>,
      },
    );

    if (rpcError) {
      console.error("Erreur RPC debit_user_credits_atomic:", rpcError);
      return new Response(
        JSON.stringify({
          error:
            rpcError.message ||
            "Erreur lors du débit (vérifie que la migration SQL est appliquée).",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const rpcData = rpcRaw as {
      success?: boolean;
      error?: string;
      current_credits?: number;
      required?: number;
      remaining_credits?: number;
      debited?: number;
    } | null;

    if (!rpcData || rpcData.success !== true) {
      const msg = String(rpcData?.error || "Débit refusé");
      const insufficient = msg === "Crédits insuffisants";
      return new Response(
        JSON.stringify({
          error: msg,
          current_credits: rpcData?.current_credits,
          required: rpcData?.required ?? amount,
        }),
        {
          status: insufficient ? 402 : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        remaining_credits: rpcData.remaining_credits,
        debited: rpcData.debited ?? amount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Erreur débit crédits:", error);
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
