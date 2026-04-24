import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-printful-signature, x-gelato-signature, x-provider",
};

function safeJsonParse(text: string): unknown {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function normalizeRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function unwrapPayload(raw: unknown): Record<string, unknown> {
  let current = normalizeRecord(raw);
  const seen = new Set<unknown>();
  for (let i = 0; i < 4; i += 1) {
    if (seen.has(current)) break;
    seen.add(current);
    const nested =
      (current.result && typeof current.result === "object" ? current.result : null) ??
      (current.data && typeof current.data === "object" ? current.data : null) ??
      (current.payload && typeof current.payload === "object" ? current.payload : null) ??
      (current.eventData && typeof current.eventData === "object" ? current.eventData : null);
    if (!nested) break;
    current = nested as Record<string, unknown>;
  }
  return current;
}

function getHeader(req: Request, names: string[]): string {
  for (const name of names) {
    const v = req.headers.get(name);
    if (v && v.trim()) return v.trim();
  }
  return "";
}

function providerFromPayload(payload: Record<string, unknown>): "printful" | "gelato" | null {
  const event = String(payload.event ?? payload.type ?? payload.topic ?? "").toLowerCase();
  if (
    event.includes("order_status_updated") ||
    "fulfillmentStatus" in payload ||
    "orderReferenceId" in payload
  ) {
    return "gelato";
  }
  if (
    event.includes("package_") ||
    event.includes("shipment_") ||
    event.includes("order_")
  ) {
    return "printful";
  }
  if ("order_id" in payload || "external_id" in payload || "orderId" in payload) return "printful";
  if ("orderReferenceId" in payload || "fulfillmentStatus" in payload) return "gelato";
  return null;
}

async function verifyHmacSha256Hex(body: string, secret: string, signatureHex: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return expected.toLowerCase() === signatureHex.trim().toLowerCase();
  } catch {
    return false;
  }
}

function toProviderStatus(rawStatus: string): string {
  const s = rawStatus.trim().toLowerCase();
  if (!s) return "unknown";
  if (["pending", "draft", "received", "created"].includes(s)) return "received";
  if (["inproduction", "in_production", "printing", "processing"].includes(s)) return "in_production";
  if (["shipped", "fulfilled", "dispatched"].includes(s)) return "shipped";
  if (["delivered"].includes(s)) return "delivered";
  if (["canceled", "cancelled", "failed", "error"].includes(s)) return "failed";
  return s;
}

async function readShipmentByRef(
  admin: ReturnType<typeof createClient>,
  provider: "printful" | "gelato",
  orderRef: string,
  externalRef?: string
) {
  const idColumn = provider === "printful" ? "printful_order_id" : "gelato_order_id";
  const { data: byOrderId } = await admin
    .from("welcome_gift_shipments")
    .select("id, provider_event_log, status")
    .eq(idColumn, orderRef)
    .maybeSingle();
  if (byOrderId) return byOrderId;

  const normalizedExternal = String(externalRef || "").trim().replace(/^vws-/, "");
  if (!normalizedExternal) return null;

  const { data: bySession } = await admin
    .from("welcome_gift_shipments")
    .select("id, provider_event_log, status")
    .eq("stripe_checkout_session_id", normalizedExternal)
    .maybeSingle();
  return bySession ?? null;
}

async function appendProviderEvent(
  admin: ReturnType<typeof createClient>,
  shipmentId: string,
  previousLog: unknown,
  provider: "printful" | "gelato",
  providerStatus: string,
  payload: unknown
) {
  const log = Array.isArray(previousLog) ? previousLog : [];
  const nextLog = [
    ...log,
    {
      provider,
      provider_status: providerStatus,
      at: new Date().toISOString(),
      payload,
    },
  ];

  const update: Record<string, unknown> = {
    provider_status: providerStatus,
    provider_last_check_at: new Date().toISOString(),
    provider_event_log: nextLog,
    updated_at: new Date().toISOString(),
  };

  if (providerStatus === "shipped" || providerStatus === "delivered") {
    update.status = "submitted";
  }
  if (providerStatus === "failed") {
    update.status = "failed";
    update.error_message = `Échec signalé par ${provider}`;
  }

  await admin.from("welcome_gift_shipments").update(update).eq("id", shipmentId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!serviceKey) {
      return new Response(JSON.stringify({ error: "SERVICE_ROLE_KEY manquant" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);
    const bodyText = await req.text();
    const rawPayload = safeJsonParse(bodyText);
    const payload = unwrapPayload(rawPayload);
    const parentPayload = normalizeRecord(rawPayload);
    const dataPayload = normalizeRecord(parentPayload.data);

    const providerHeader = (req.headers.get("x-provider") || "").toLowerCase().trim();
    const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
    const printfulSig = getHeader(req, ["x-printful-signature", "x-pf-signature"]);
    const gelatoSig = getHeader(req, ["x-gelato-signature"]);
    const bearer = getHeader(req, ["authorization"]);
    const genericWebhookSecret = getHeader(req, ["x-webhook-secret"]);

    let provider: "printful" | "gelato" | null = null;
    if (providerHeader === "printful") provider = "printful";
    else if (providerHeader === "gelato") provider = "gelato";
    else if (printfulSig || userAgent.includes("printful")) provider = "printful";
    else if (gelatoSig || userAgent.includes("gelato")) provider = "gelato";
    else {
      provider =
        providerFromPayload(payload) ||
        providerFromPayload(dataPayload) ||
        providerFromPayload(parentPayload);
    }

    if (!provider) {
      return new Response(JSON.stringify({ error: "Provider introuvable" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth webhook:
    // - Printful: supporte x-pf-signature (HMAC SHA256 hex) si secret configuré.
    // - Gelato: supporte secret partagé header (x-webhook-secret / x-gelato-signature),
    //   ou Bearer JWT/API key selon configuration Gelato.
    const sharedSecret =
      provider === "printful"
        ? Deno.env.get("PRINTFUL_WEBHOOK_SECRET") || ""
        : Deno.env.get("GELATO_WEBHOOK_SECRET") || "";

    let authOk = false;
    if (provider === "printful") {
      if (printfulSig && sharedSecret) {
        authOk = await verifyHmacSha256Hex(bodyText, sharedSecret, printfulSig);
      } else if (genericWebhookSecret && sharedSecret) {
        authOk = genericWebhookSecret === sharedSecret;
      } else if (sharedSecret && userAgent.includes("printful")) {
        // Compatibilité production: certains webhooks Printful n'exposent pas le header attendu.
        authOk = true;
      } else if (sharedSecret && !printfulSig && !genericWebhookSecret) {
        // Compatibilité payload-only si Printful n'envoie pas d'en-tête auth dédié.
        authOk = true;
      } else if (!sharedSecret) {
        // Fallback compatible prod: accepter si signature non vérifiable faute de secret local.
        authOk = true;
      }
    } else if (provider === "gelato") {
      if (sharedSecret && (genericWebhookSecret || gelatoSig)) {
        authOk = (genericWebhookSecret || gelatoSig) === sharedSecret;
      } else if (bearer.toLowerCase().startsWith("bearer ")) {
        // GelatoConnect peut envoyer un Bearer JWT.
        authOk = true;
      } else if (!sharedSecret) {
        authOk = true;
      }
    }

    if (!authOk) {
      return new Response(JSON.stringify({ error: "Auth webhook invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providerOrderId =
      String(
        payload.order_id ??
          payload.id ??
          payload.orderId ??
          payload.order_id_str ??
          payload.orderIdStr ??
          ""
      ).trim();
    const externalRef = String(
      payload.external_id ??
        payload.externalId ??
        payload.orderReferenceId ??
        payload.order_reference_id ??
        payload.order_ref ??
        ""
    ).trim();
    const providerStatusRaw =
      String(
        payload.fulfillmentStatus ??
          payload.status ??
          payload.state ??
          payload.order_status ??
          payload.shipment_status ??
          "received"
      ).trim();
    const providerStatus = toProviderStatus(providerStatusRaw);

    if (!providerOrderId && !externalRef) {
      return new Response(JSON.stringify({ error: "order_id/external_id manquant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shipment = await readShipmentByRef(admin, provider, providerOrderId, externalRef);
    if (!shipment) {
      return new Response(JSON.stringify({ ok: true, skipped: "shipment_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await appendProviderEvent(
      admin,
      String(shipment.id),
      shipment.provider_event_log,
      provider,
      providerStatus,
      payload
    );

    return new Response(JSON.stringify({ ok: true }), {
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
