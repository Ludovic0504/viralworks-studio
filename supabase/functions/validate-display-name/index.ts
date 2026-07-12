import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateSignupInput } from "../_shared/signup-guard/validate-signup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

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

  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Corps JSON invalide" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName : "";
  const lastName = typeof body.lastName === "string" ? body.lastName : "";
  const email = typeof body.email === "string" ? body.email : "";

  const result = validateSignupInput({ email, firstName, lastName });
  if (!result.ok) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: result.message,
        field: result.field ?? "both",
        reason: result.reason,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
