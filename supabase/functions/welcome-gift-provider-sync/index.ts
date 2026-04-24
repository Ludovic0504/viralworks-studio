import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

function safeJsonParse(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function normalizeRow(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function unwrapProviderPayload(raw: unknown): Record<string, unknown> {
  let current = normalizeRow(raw);
  const nested =
    (current.result && typeof current.result === "object" ? current.result : null) ??
    (current.data && typeof current.data === "object" ? current.data : null) ??
    null;
  if (nested) current = nested as Record<string, unknown>;
  return current;
}

async function fetchPrintfulOrder(orderId: string) {
  const token = Deno.env.get("PRINTFUL_API_KEY")?.trim();
  if (!token) return { ok: false, error: "PRINTFUL_API_KEY manquant" };
  const storeId = Deno.env.get("PRINTFUL_STORE_ID")?.trim();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (storeId) headers["X-PF-Store-Id"] = storeId;

  const res = await fetch(`https://api.printful.com/orders/${encodeURIComponent(orderId)}`, {
    headers,
  });
  const text = await res.text();
  const raw = safeJsonParse(text);
  if (!res.ok) return { ok: false, error: `Printful HTTP ${res.status}`, raw };
  const data = unwrapProviderPayload(raw);
  const status = String(data.status ?? "");
  return { ok: true, status, raw: data };
}

async function fetchGelatoOrder(orderId: string) {
  const apiKey = Deno.env.get("GELATO_API_KEY")?.trim();
  if (!apiKey) return { ok: false, error: "GELATO_API_KEY manquant" };
  const base = Deno.env.get("GELATO_API_BASE_URL")?.trim() || "https://order.gelatoapis.com/v4/orders";
  const res = await fetch(`${base}/${encodeURIComponent(orderId)}`, {
    headers: { "X-API-KEY": apiKey },
  });
  const text = await res.text();
  const raw = safeJsonParse(text);
  if (!res.ok) return { ok: false, error: `Gelato HTTP ${res.status}`, raw };
  const data = unwrapProviderPayload(raw);
  const status = String(data.status ?? data.orderStatus ?? data.fulfillmentStatus ?? "");
  return { ok: true, status, raw: data };
}

async function syncOneShipment(
  admin: ReturnType<typeof createClient>,
  row: Record<string, unknown>
): Promise<{ ok: true; providerStatus: string } | { ok: false; error: string }> {
  const provider = String(row.fulfillment_provider || "").trim();
  let upstream:
    | { ok: true; status: string; raw: unknown }
    | { ok: false; error: string; raw?: unknown };

  if (provider === "printful" && row.printful_order_id) {
    upstream = await fetchPrintfulOrder(String(row.printful_order_id));
  } else if (provider === "gelato" && row.gelato_order_id) {
    upstream = await fetchGelatoOrder(String(row.gelato_order_id));
  } else {
    return { ok: false, error: "unsupported_provider" };
  }

  const nowIso = new Date().toISOString();
  const oldLog = Array.isArray(row.provider_event_log) ? row.provider_event_log : [];

  if (!upstream.ok) {
    await admin
      .from("welcome_gift_shipments")
      .update({
        provider_last_check_at: nowIso,
        error_message: upstream.error,
        updated_at: nowIso,
      })
      .eq("id", row.id);
    return { ok: false, error: upstream.error };
  }

  const normalized = toProviderStatus(upstream.status);
  const nextLog = [
    ...oldLog,
    {
      provider,
      provider_status: normalized,
      at: nowIso,
      source: "api_sync",
      payload: upstream.raw,
    },
  ];

  const patch: Record<string, unknown> = {
    provider_status: normalized,
    provider_last_check_at: nowIso,
    provider_tracking: upstream.raw as Record<string, unknown>,
    provider_event_log: nextLog,
    updated_at: nowIso,
  };
  if (normalized === "failed") patch.status = "failed";
  if (normalized === "shipped" || normalized === "delivered") patch.status = "submitted";

  await admin.from("welcome_gift_shipments").update(patch).eq("id", row.id);
  return { ok: true, providerStatus: normalized };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      }
    );
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    const isUserMode = !userError && !!user;

    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!serviceKey) {
      return new Response(JSON.stringify({ error: "SERVICE_ROLE_KEY manquant" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

    if (isUserMode) {
      const { data: row } = await admin
        .from("welcome_gift_shipments")
        .select("id,fulfillment_provider,printful_order_id,gelato_order_id,provider_event_log")
        .eq("user_id", user!.id)
        .in("status", ["submitted", "pending_manual"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!row) {
        return new Response(JSON.stringify({ synced: true, skipped: "no_shipment" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await syncOneShipment(admin, row as Record<string, unknown>);
      if (!result.ok) {
        return new Response(JSON.stringify({ synced: false, error: result.error }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ synced: true, provider_status: result.providerStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode cron/public: synchroniser en lot les expéditions récentes.
    const { data: rows } = await admin
      .from("welcome_gift_shipments")
      .select("id,fulfillment_provider,printful_order_id,gelato_order_id,provider_event_log,updated_at")
      .in("status", ["submitted", "pending_manual"])
      .order("updated_at", { ascending: false })
      .limit(100);

    const batch = rows || [];
    let synced = 0;
    let failed = 0;
    for (const row of batch) {
      const result = await syncOneShipment(admin, row as Record<string, unknown>);
      if (result.ok) synced += 1;
      else failed += 1;
    }

    return new Response(JSON.stringify({ synced: true, mode: "batch", total: batch.length, success: synced, failed }), {
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
