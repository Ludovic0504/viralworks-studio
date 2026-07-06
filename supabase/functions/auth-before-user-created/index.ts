import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { blockedDisplayNameMessage } from "../_shared/name-moderation/messages.ts";
import { extractNameFields } from "../_shared/name-moderation/extract-names.ts";
import { validateDisplayNames } from "../_shared/name-moderation/validate.ts";

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

  if (!firstName.trim() && !lastName.trim()) {
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = validateDisplayNames(firstName, lastName);
  if (!result.ok) {
    return new Response(
      JSON.stringify({
        error: {
          message: blockedDisplayNameMessage(result.field),
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
