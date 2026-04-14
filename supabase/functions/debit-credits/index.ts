import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Créer le client Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Récupérer l'utilisateur
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

    const { amount, reason, metadata } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Montant invalide" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Vérifier les crédits actuels
    const { data: creditsData, error: creditsError } = await supabaseClient
      .from("user_credits")
      .select("credits")
      .eq("user_id", user.id)
      .single();

    if (creditsError) {
      // Si l'utilisateur n'a pas encore de crédits, initialiser à 0
      const { error: insertError } = await supabaseClient
        .from("user_credits")
        .insert({ user_id: user.id, credits: 0 });

      if (insertError) {
        throw insertError;
      }
    }

    const currentCredits = creditsData?.credits || 0;

    if (currentCredits < amount) {
      return new Response(
        JSON.stringify({
          error: "Crédits insuffisants",
          current_credits: currentCredits,
          required: amount,
        }),
        {
          status: 402, // Payment Required
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Débiter les crédits
    const newCredits = currentCredits - amount;

    const { error: updateError } = await supabaseClient
      .from("user_credits")
      .update({ credits: newCredits })
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    // Créer la transaction
    const { error: transactionError } = await supabaseClient
      .from("credit_transactions")
      .insert({
        user_id: user.id,
        amount: -amount, // Négatif pour un débit
        type: "debit",
        reason: reason || "generation",
        metadata: metadata || {},
      });

    if (transactionError) {
      console.error("Erreur création transaction:", transactionError);
      // Ne pas échouer si la transaction ne peut pas être créée
    }

    return new Response(
      JSON.stringify({
        success: true,
        remaining_credits: newCredits,
        debited: amount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erreur débit crédits:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
