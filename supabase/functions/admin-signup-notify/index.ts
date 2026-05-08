import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SignupHookPayload = {
  type?: string;
  event?: string;
  user?: {
    id?: string;
    email?: string | null;
    created_at?: string;
  };
  record?: {
    id?: string;
    email?: string | null;
    created_at?: string;
  };
};

function getUserFromPayload(payload: SignupHookPayload): { id?: string; email?: string | null; created_at?: string } {
  return payload.user ?? payload.record ?? {};
}

async function sendAdminEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  const from = (Deno.env.get("ADMIN_NOTIFY_FROM") ?? "ViralWorks Studio <contact@viralworks-studio.com>").trim();
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY manquante" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status}: ${t || res.statusText}` };
  }
  return { ok: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const hookSecret = (Deno.env.get("AUTH_HOOK_SECRET") ?? "").trim();
  const provided =
    (req.headers.get("x-hook-secret") ?? "").trim() ||
    new URL(req.url).searchParams.get("x-hook-secret")?.trim() ||
    "";
  if (hookSecret && provided !== hookSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: SignupHookPayload | null = null;
  try {
    payload = (await req.json()) as SignupHookPayload;
  } catch {
    payload = null;
  }

  const user = payload ? getUserFromPayload(payload) : {};
  const email = (user.email ?? "").toString();
  const userId = (user.id ?? "").toString();
  const createdAt = user.created_at ?? new Date().toISOString();

  const adminEmail = (Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "jean.limonta06@gmail.com").trim();

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const title = "Nouvelle inscription";
  const body = `Un nouvel utilisateur vient de s'inscrire.\n\nEmail: ${email || "(inconnu)"}\nUser ID: ${userId || "(inconnu)"}\nDate: ${createdAt}\n`;

  const insertResult = await supabaseAdmin.from("admin_notifications").insert({
    kind: "signup",
    title,
    body,
    actor_user_id: userId || null,
    actor_email: email || null,
  });

  if (insertResult.error) {
    console.error("Insert admin_notifications failed:", insertResult.error);
  }

  const emailResult = await sendAdminEmail({
    to: adminEmail,
    subject: `[ViralWorks Studio] ${title}`,
    text: body,
  });

  if (!emailResult.ok) {
    console.error("Send admin email failed:", emailResult.error);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      inserted: !insertResult.error,
      emailed: emailResult.ok,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

