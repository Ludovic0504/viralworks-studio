import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { blockedDisplayNameMessage } from "../_shared/name-moderation/messages.ts";
import { validateDisplayNames } from "../_shared/name-moderation/validate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  job?: string;
  birth_date?: string;
  avatar_url?: string;
  secteur?: string | null;
  user_intent?: string | null;
};

function hasNameChanges(body: RequestBody): boolean {
  return (
    body.first_name !== undefined ||
    body.last_name !== undefined ||
    body.full_name !== undefined
  );
}

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
      { global: { headers: { Authorization: authHeader } } },
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

    const body = (await req.json()) as RequestBody;

    if (hasNameChanges(body)) {
      const firstName = typeof body.first_name === "string" ? body.first_name : "";
      const lastName = typeof body.last_name === "string" ? body.last_name : "";

      if (firstName.trim() || lastName.trim()) {
        const validation = validateDisplayNames(firstName, lastName);
        if (!validation.ok) {
          return new Response(
            JSON.stringify({
              error: blockedDisplayNameMessage(validation.field),
              field: validation.field,
            }),
            {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
          );
        }
      }
    }

    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Configuration serveur incomplète" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const row: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.first_name !== undefined) row.first_name = body.first_name;
    if (body.last_name !== undefined) row.last_name = body.last_name;
    if (body.full_name !== undefined) {
      row.full_name = body.full_name;
    } else if (body.first_name !== undefined || body.last_name !== undefined) {
      const first = typeof body.first_name === "string" ? body.first_name.trim() : "";
      const last = typeof body.last_name === "string" ? body.last_name.trim() : "";
      row.full_name = `${first} ${last}`.trim();
    }
    if (body.job !== undefined) row.job = body.job;
    if (body.birth_date !== undefined) row.birth_date = body.birth_date;
    if (body.avatar_url !== undefined) row.avatar_url = body.avatar_url;
    if (body.secteur !== undefined) row.secteur = body.secteur;
    if (body.user_intent !== undefined) row.user_intent = body.user_intent;

    if (hasNameChanges(body)) {
      const { error: flagError } = await supabaseAdmin.rpc("set_profile_name_write_flag");
      if (flagError) {
        console.error("set_profile_name_write_flag failed:", flagError);
        return new Response(JSON.stringify({ error: "Impossible de mettre à jour le profil" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(row)
      .eq("user_id", user.id);

    if (error) {
      console.error("update-user-profile failed:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("update-user-profile unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erreur serveur" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
