import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildAuthorizeUrl,
  getStateSecret,
  isSocialProvider,
  providerConfigured,
  signOAuthState,
  type SocialProvider,
} from "../_shared/social-oauth.ts";
import {
  isLocalDevOrigin,
  normalizeAllowedProductionOrigin,
  PRODUCTION_CANONICAL_ORIGIN,
} from "../_shared/site-origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function resolveReturnOrigin(requested?: unknown): string {
  if (typeof requested === "string" && requested.trim()) {
    try {
      const origin = new URL(requested).origin;
      if (isLocalDevOrigin(origin)) return origin;
      const allowed = normalizeAllowedProductionOrigin(origin);
      if (allowed) return allowed;
    } catch {
      /* ignore */
    }
  }
  const siteUrl = Deno.env.get("SITE_URL")?.trim();
  if (siteUrl) {
    const allowed = normalizeAllowedProductionOrigin(siteUrl);
    if (allowed) return allowed;
    if (isLocalDevOrigin(siteUrl)) return new URL(siteUrl).origin;
  }
  return PRODUCTION_CANONICAL_ORIGIN;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

    const body = await req.json().catch(() => ({}));
    const provider = body?.provider as SocialProvider;
    if (!isSocialProvider(provider)) {
      return new Response(JSON.stringify({ error: "Provider invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfg = providerConfigured(provider);
    if (!cfg.ok) {
      return new Response(
        JSON.stringify({
          error: `Connexion ${provider} non configurée côté serveur. Secrets manquants : ${cfg.missing.join(", ")}`,
          missing: cfg.missing,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const stateSecret = getStateSecret();
    if (!stateSecret) {
      return new Response(JSON.stringify({ error: "SOCIAL_OAUTH_STATE_SECRET / SERVICE_ROLE_KEY manquant" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const returnOrigin = resolveReturnOrigin(body?.returnOrigin ?? body?.return_origin);
    const nonce = crypto.randomUUID();
    const state = await signOAuthState(
      {
        uid: user.id,
        provider,
        nonce,
        exp: Date.now() + 15 * 60 * 1000,
        return_origin: returnOrigin,
      },
      stateSecret,
    );

    const url = buildAuthorizeUrl(provider, state);

    return new Response(JSON.stringify({ url, provider }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[social-oauth-start]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erreur serveur" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
