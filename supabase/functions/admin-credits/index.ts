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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const supabaseAdminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Vérifier si l'utilisateur est admin (depuis profiles)
    const { data: roleData, error: roleError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Accès refusé. Admin requis." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { target_user_id, amount, reason, metadata } = await req.json();

    if (!target_user_id || !amount) {
      return new Response(
        JSON.stringify({ error: "target_user_id et amount requis" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Récupérer ou créer les crédits de l'utilisateur cible
    const { data: creditsData, error: creditsError } = await supabaseAdminClient
      .from("user_credits")
      .select("credits")
      .eq("user_id", target_user_id)
      .single();

    const currentCredits = creditsData?.credits || 0;
    const newCredits = currentCredits + amount;

    if (creditsError && creditsError.code === "PGRST116") {
      // L'utilisateur n'a pas encore de crédits, créer l'entrée
      const { error: insertError } = await supabaseAdminClient
        .from("user_credits")
        .insert({ user_id: target_user_id, credits: newCredits });

      if (insertError) {
        throw insertError;
      }
    } else if (creditsError) {
      throw creditsError;
    } else {
      // Mettre à jour les crédits
      const { error: updateError } = await supabaseAdminClient
        .from("user_credits")
        .update({ credits: newCredits })
        .eq("user_id", target_user_id);

      if (updateError) {
        throw updateError;
      }
    }

    // Créer la transaction
    const { error: transactionError } = await supabaseAdminClient
      .from("credit_transactions")
      .insert({
        user_id: target_user_id,
        amount: amount,
        type: amount > 0 ? "admin_add" : "admin_remove",
        reason: reason || "admin_manual",
        metadata: metadata || {},
        created_by: user.id,
      });

    if (transactionError) {
      console.error("Erreur création transaction:", transactionError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        new_credits: newCredits,
        added: amount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erreur admin crédits:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
