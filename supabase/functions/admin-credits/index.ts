import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { nextVideoDisplayCap } from "../_shared/video-display-cap.ts";

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

    const meta =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? metadata
        : {};

    const category = String(meta.credit_category || "workflow_video");
    const isWorkflowVideo = category === "workflow_video";
    let newCredits = 0;
    let newBucketValue: number | null = null;

    if (isWorkflowVideo) {
      // Crédits workflow vidéo (solde principal historique)
      const { data: creditsData, error: creditsError } = await supabaseAdminClient
        .from("user_credits")
        .select("credits, video_display_cap")
        .eq("user_id", target_user_id)
        .single();

      const currentCredits = creditsData?.credits || 0;
      newCredits = currentCredits + amount;
      if (newCredits < 0) {
        return new Response(
          JSON.stringify({ error: "Crédits workflow insuffisants" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const payload =
        amount > 0
          ? {
              credits: newCredits,
              video_display_cap: nextVideoDisplayCap({
                balanceBefore: currentCredits,
                oldCap: creditsData?.video_display_cap,
                purchaseQty: amount,
                balanceAfter: newCredits,
              }),
            }
          : { credits: newCredits };

      if (creditsError && creditsError.code === "PGRST116") {
        const { error: insertError } = await supabaseAdminClient
          .from("user_credits")
          .insert({ user_id: target_user_id, ...payload });

        if (insertError) {
          throw insertError;
        }
      } else if (creditsError) {
        throw creditsError;
      } else {
        const { error: updateError } = await supabaseAdminClient
          .from("user_credits")
          .update(payload)
          .eq("user_id", target_user_id);

        if (updateError) {
          throw updateError;
        }
      }
    } else {
      // Crédits dédiés (texte/image/video) dans user_credit_buckets
      const columnByCategory: Record<string, string> = {
        text_generation: "text_generation",
        image_generation: "image_generation",
        image_modification: "image_modification",
        video_generation: "video_generation",
      };
      const targetColumn = columnByCategory[category];
      if (!targetColumn) {
        return new Response(
          JSON.stringify({ error: `Catégorie de crédit inconnue: ${category}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: bucketData, error: bucketError } = await supabaseAdminClient
        .from("user_credit_buckets")
        .select("text_generation,image_generation,image_modification,video_generation")
        .eq("user_id", target_user_id)
        .single();

      const currentBucketValue = Number(bucketData?.[targetColumn] || 0);
      newBucketValue = currentBucketValue + amount;
      if (newBucketValue < 0) {
        return new Response(
          JSON.stringify({ error: "Crédits insuffisants dans cette catégorie" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (bucketError && bucketError.code === "PGRST116") {
        const row = {
          user_id: target_user_id,
          text_generation: 0,
          image_generation: 0,
          image_modification: 0,
          video_generation: 0,
          [targetColumn]: newBucketValue,
        };
        const { error: insertError } = await supabaseAdminClient
          .from("user_credit_buckets")
          .insert(row);
        if (insertError) throw insertError;
      } else if (bucketError) {
        throw bucketError;
      } else {
        const { error: updateError } = await supabaseAdminClient
          .from("user_credit_buckets")
          .update({ [targetColumn]: newBucketValue, updated_at: new Date().toISOString() })
          .eq("user_id", target_user_id);
        if (updateError) throw updateError;
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
        metadata: meta,
        created_by: user.id,
      });

    if (transactionError) {
      console.error("Erreur création transaction:", transactionError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        category,
        new_credits: isWorkflowVideo ? newCredits : undefined,
        new_category_credits: !isWorkflowVideo ? newBucketValue : undefined,
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
