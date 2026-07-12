import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { extractNameFields } from "../_shared/name-moderation/extract-names.ts";
import { validateSignupInput } from "../_shared/signup-guard/validate-signup.ts";

function getHookSecret(): string | undefined {
  const raw =
    (Deno.env.get("BEFORE_USER_CREATED_HOOK_SECRET") ?? "").trim() ||
    (Deno.env.get("AUTH_HOOK_SECRET") ?? "").trim();
  if (!raw) return undefined;
  return raw.replace(/^v1,whsec_/, "");
}

type AuthHookPayload = {
  metadata?: {
    name?: string;
  };
  user?: {
    email?: string | null;
    user_metadata?: Record<string, unknown>;
    raw_user_meta_data?: Record<string, unknown>;
  };
};

function parseHookPayload(event: unknown): AuthHookPayload | null {
  if (!event || typeof event !== "object") return null;
  return event as AuthHookPayload;
}

async function readHookPayload(req: Request): Promise<AuthHookPayload | null> {
  const payloadText = await req.text();
  const secret = getHookSecret();

  if (secret) {
    const wh = new Webhook(secret);
    const headers = Object.fromEntries(req.headers);
    try {
      return parseHookPayload(wh.verify(payloadText, headers));
    } catch {
      return null;
    }
  }

  try {
    return parseHookPayload(JSON.parse(payloadText));
  } catch {
    return null;
  }
}

function isLikelyOAuthSignup(userMeta: Record<string, unknown>): boolean {
  const provider = String(userMeta.provider || userMeta.iss || "").toLowerCase();
  if (provider.includes("google")) return true;
  if (userMeta.avatar_url || userMeta.picture) return true;
  if (userMeta.given_name || userMeta.family_name) return true;
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok");
  }

  const payload = await readHookPayload(req);
  if (!payload) {
    return new Response(
      JSON.stringify({
        error: { message: "Invalid hook signature", http_code: 401 },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const hookName = payload.metadata?.name ?? "";
  if (hookName && hookName !== "before-user-created") {
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userMeta =
    payload.user?.user_metadata ??
    payload.user?.raw_user_meta_data ??
    {};
  const { firstName, lastName } = extractNameFields(userMeta);
  const email = String(payload.user?.email || "").trim();

  const result = validateSignupInput({
    email,
    firstName,
    lastName,
    allowMissingNames: isLikelyOAuthSignup(userMeta),
  });

  if (!result.ok) {
    return new Response(
      JSON.stringify({
        error: {
          message: result.message,
          http_code: 400,
          field: result.field,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
