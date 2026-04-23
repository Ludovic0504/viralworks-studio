import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { completeWelcomeGiftChoiceForUser } from "../_shared/welcome-gift-flow.ts";

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
    const supabaseUser = createClient(
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
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!serviceKey) {
      return new Response(
        JSON.stringify({ error: "SERVICE_ROLE_KEY manquant" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceKey
    );

    let body: { giftId?: string; giftSize?: string } = {};
    try {
      if (req.method === "POST") {
        body = await req.json();
      }
    } catch {
      body = {};
    }

    const giftId = typeof body.giftId === "string" ? body.giftId.trim() : "";
    const giftSize = typeof body.giftSize === "string" ? body.giftSize.trim() : "";

    if (giftId) {
      const result = await completeWelcomeGiftChoiceForUser(
        supabaseAdmin,
        user.id,
        giftId,
        giftSize || undefined
      );

      if (!result.ok) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: row } = await supabaseAdmin
      .from("welcome_gift_shipments")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending_choice")
      .maybeSingle();

    return new Response(JSON.stringify({ needsChoice: Boolean(row?.id) }), {
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
