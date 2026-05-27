/**
 * Génération avatar Studio — OpenAI gpt-image-2.
 * Upload serveur vers generated-images (pas de base64 renvoyé au client).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const STORAGE_BUCKET = "generated-images";

interface CreateBody {
  action: "create";
  prompt: string;
}

type RequestBody = CreateBody;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getServiceRoleKey(): string | null {
  return (
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
    Deno.env.get("SERVICE_ROLE_KEY")?.trim() ||
    null
  );
}

/** Aligné sur getUserSubscription (client) + cancel-subscription / sync-subscription-credits */
async function userHasActiveSubscription(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("stripe_subscriptions")
    .select("status, cancel_at_period_end, current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return false;

  if (data.cancel_at_period_end) {
    const periodEndMs = new Date(data.current_period_end).getTime();
    if (Number.isFinite(periodEndMs) && Date.now() >= periodEndMs) {
      return false;
    }
  }

  return true;
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Upload binaire PNG via l'API REST Storage (fetch, pas de client JS).
 * Retourne l'URL publique du bucket.
 */
async function uploadAvatarPngToStorage(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  pngBytes: Uint8Array
): Promise<string> {
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const timestamp = Date.now();
  const objectPath = `${userId}/avatars/${timestamp}.png`;
  const uploadUrl = `${baseUrl}/storage/v1/object/${STORAGE_BUCKET}/${objectPath}`;

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "image/png",
      "Cache-Control": "3600",
      "x-upsert": "false",
    },
    body: pngBytes,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(
      `Échec upload Storage (${uploadRes.status}): ${errText.slice(0, 400)}`
    );
  }

  return `${baseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${objectPath}`;
}

async function handleCreate(
  body: CreateBody,
  userId: string
): Promise<Response> {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return jsonResponse({ error: "Le prompt est requis" }, 400);

  const openaiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!openaiKey) {
    return jsonResponse(
      { error: "OPENAI_API_KEY manquante dans les secrets Supabase." },
      500
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = getServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      {
        error:
          "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans les secrets.",
      },
      500
    );
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "low",
    }),
  });

  const text = await res.text();
  let data: { data?: Array<{ b64_json?: string }>; error?: { message?: string } } | null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      (typeof text === "string" ? text.slice(0, 400) : "") ||
      `Erreur OpenAI (${res.status})`;
    return jsonResponse({ error: msg }, res.status);
  }

  const b64Json = data?.data?.[0]?.b64_json;
  if (!b64Json || typeof b64Json !== "string") {
    return jsonResponse(
      { error: "Réponse OpenAI invalide (b64_json manquant)." },
      500
    );
  }

  let pngBytes: Uint8Array;
  try {
    pngBytes = base64ToUint8Array(b64Json);
  } catch {
    return jsonResponse(
      { error: "Impossible de décoder l'image OpenAI (base64 invalide)." },
      500
    );
  }

  let publicUrl: string;
  try {
    publicUrl = await uploadAvatarPngToStorage(
      supabaseUrl,
      serviceRoleKey,
      userId,
      pngBytes
    );
  } catch (err) {
    console.error("studio-generate-avatar: upload Storage:", err);
    return jsonResponse(
      {
        error:
          err instanceof Error ? err.message : "Échec upload Storage avatar.",
      },
      500
    );
  }

  return jsonResponse({
    status: "completed",
    avatarUrl: publicUrl,
    jobId: `openai-${Date.now()}`,
    provider: "openai",
    format: "character_sheet",
    creditsUsed: 4,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Token d'authentification manquant" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Non autorisé. Veuillez vous connecter." }, 401);
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Corps JSON invalide" }, 400);
    }

    if (body.action !== "create") {
      return jsonResponse({ error: "action invalide (create)" }, 400);
    }

    const hasSubscription = await userHasActiveSubscription(supabase, user.id);
    if (!hasSubscription) {
      return jsonResponse({ error: "Abonnement requis" }, 403);
    }

    return await handleCreate(body, user.id);
  } catch (error) {
    console.error("studio-generate-avatar:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Erreur serveur",
      },
      500
    );
  }
});
