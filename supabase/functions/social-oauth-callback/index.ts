import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  errorReturnPath,
  exchangeCodeForConnection,
  getStateSecret,
  safeReturnPath,
  verifyOAuthState,
} from "../_shared/social-oauth.ts";

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key =
    Deno.env.get("SERVICE_ROLE_KEY")?.trim() ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
    "";
  return createClient(url, key);
}

function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  });
}

serve(async (req) => {
  try {
    const incoming = new URL(req.url);
    const code = incoming.searchParams.get("code");
    const state = incoming.searchParams.get("state");
    const oauthError = incoming.searchParams.get("error");
    const oauthErrorDesc = incoming.searchParams.get("error_description");

    const stateSecret = getStateSecret();
    if (!stateSecret) {
      return new Response("Configuration OAuth manquante", { status: 503 });
    }

    // Essayer de résoudre return_origin même en cas d'erreur utilisateur
    let returnOrigin = Deno.env.get("SITE_URL")?.trim() || "https://viralworks-studio.com";
    if (state) {
      const parsed = await verifyOAuthState(state, stateSecret);
      if (parsed?.return_origin) returnOrigin = parsed.return_origin;
    }

    if (oauthError) {
      return redirect(
        errorReturnPath(returnOrigin, oauthErrorDesc || oauthError || "Autorisation refusée"),
      );
    }

    if (!code || !state) {
      return redirect(errorReturnPath(returnOrigin, "Paramètres OAuth manquants"));
    }

    const payload = await verifyOAuthState(state, stateSecret);
    if (!payload) {
      return redirect(errorReturnPath(returnOrigin, "Session de connexion expirée ou invalide"));
    }

    returnOrigin = payload.return_origin;

    const connection = await exchangeCodeForConnection(payload.provider, code);

    const supabase = adminClient();
    const now = new Date().toISOString();
    const { error } = await supabase.from("social_connections").upsert(
      {
        user_id: payload.uid,
        provider: payload.provider,
        provider_user_id: connection.provider_user_id,
        username: connection.username ?? null,
        display_name: connection.display_name ?? null,
        avatar_url: connection.avatar_url ?? null,
        access_token: connection.access_token ?? null,
        refresh_token: connection.refresh_token ?? null,
        token_expires_at: connection.token_expires_at ?? null,
        scopes: connection.scopes ?? null,
        status: "connected",
        metadata: connection.metadata ?? {},
        connected_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,provider" },
    );

    if (error) {
      console.error("[social-oauth-callback] upsert", error);
      return redirect(errorReturnPath(returnOrigin, error.message || "Enregistrement impossible"));
    }

    const okUrl = new URL(safeReturnPath(returnOrigin));
    okUrl.searchParams.set("provider", payload.provider);
    return redirect(okUrl.toString());
  } catch (err) {
    console.error("[social-oauth-callback]", err);
    const site = Deno.env.get("SITE_URL")?.trim() || "https://viralworks-studio.com";
    const message = err instanceof Error ? err.message : "Erreur de connexion";
    return redirect(errorReturnPath(site, message));
  }
});
