/**
 * Tracking clic bio → redirect accueil.
 * Appel : GET .../functions/v1/go-redirect?source=facebook|instagram|tiktok&client=1
 * Secrets Supabase : SUPABASE_URL, SERVICE_ROLE_KEY (déjà sur le projet).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_SOURCES = new Set(["facebook", "instagram", "tiktok"]);
const HOME_URL = "https://viralworks-studio.com/";

/** Origines autorisées pour fetch navigateur (Authorization + apikey). */
const ALLOWED_ORIGINS = new Set([
  "https://viralworks-studio.com",
  "https://www.viralworks-studio.com",
  // Dev local (Vite)
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const DEFAULT_ALLOW_ORIGIN = "https://viralworks-studio.com";

function corsHeadersForRequest(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : DEFAULT_ALLOW_ORIGIN;

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, accept",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function redirectHome(req: Request): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: HOME_URL,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...corsHeadersForRequest(req),
    },
  });
}

/** Réponse JSON pour fetch depuis la SPA (pas de redirect HTTP). */
function clientLoggedResponse(req: Request): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      ...corsHeadersForRequest(req),
      "Content-Type": "application/json",
    },
  });
}

function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    null
  );
}

serve(async (req) => {
  const cors = corsHeadersForRequest(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "GET") {
    return redirectHome(req);
  }

  const url = new URL(req.url);
  const source = (url.searchParams.get("source") ?? "").trim().toLowerCase();
  const clientMode = url.searchParams.get("client") === "1";

  if (source && ALLOWED_SOURCES.has(source)) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
      if (!supabaseUrl || !serviceKey) {
        console.error("[go-redirect] SUPABASE_URL ou SERVICE_ROLE_KEY manquant");
      } else {
        const admin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false },
        });
        const { error } = await admin.from("link_clicks").insert({
          source,
          user_agent: req.headers.get("user-agent"),
          ip: getClientIp(req),
        });
        if (error) console.error("[go-redirect] insert link_clicks:", error.message);
      }
    } catch (e) {
      console.error("[go-redirect] insert link_clicks:", e);
    }
  }

  if (clientMode) {
    return clientLoggedResponse(req);
  }

  return redirectHome(req);
});
