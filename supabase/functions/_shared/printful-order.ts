/**
 * Printful Orders API — https://api.printful.com/orders
 * Secret : PRINTFUL_API_KEY (Bearer). Optionnel : PRINTFUL_STORE_ID, PRINTFUL_AUTO_CONFIRM.
 */

export type PrintfulRecipient = {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code: string;
  country_code: string;
  zip: string;
  email: string;
  phone?: string;
};

export async function createPrintfulWelcomeOrder(params: {
  recipient: PrintfulRecipient;
  variantId?: number;
  syncVariantId?: number;
  files?: { url: string; type?: string }[];
  externalId: string;
}): Promise<{ ok: true; orderId: string; raw: unknown } | { ok: false; error: string; raw?: unknown }> {
  const token = Deno.env.get("PRINTFUL_API_KEY")?.trim();
  if (!token) {
    return { ok: false, error: "PRINTFUL_API_KEY manquant (secrets Supabase Edge Functions)" };
  }

  const storeId = Deno.env.get("PRINTFUL_STORE_ID")?.trim();
  const autoConfirm = (Deno.env.get("PRINTFUL_AUTO_CONFIRM") ?? "1").trim() !== "0";

  const v = params.variantId ?? 0;
  const s = params.syncVariantId ?? 0;
  if (v <= 0 && s <= 0) {
    return { ok: false, error: "Printful : variantId ou syncVariantId requis" };
  }

  const item: Record<string, unknown> = { quantity: 1 };
  if (v > 0) item.variant_id = v;
  if (s > 0) item.sync_variant_id = s;
  if (params.files?.length) {
    item.files = params.files.map((f) => {
      const o: Record<string, unknown> = { url: f.url };
      if (f.type) o.type = f.type;
      return o;
    });
  }

  const ext = params.externalId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "vws-order";

  const body: Record<string, unknown> = {
    external_id: ext,
    recipient: {
      name: params.recipient.name,
      address1: params.recipient.address1,
      city: params.recipient.city,
      state_code: params.recipient.state_code || "-",
      country_code: params.recipient.country_code,
      zip: params.recipient.zip,
      email: params.recipient.email,
      ...(params.recipient.address2 ? { address2: params.recipient.address2 } : {}),
      ...(params.recipient.phone ? { phone: params.recipient.phone } : {}),
    },
    items: [item],
  };

  const q = autoConfirm ? "?confirm=1" : "";
  const url = `https://api.printful.com/orders${q}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (storeId) {
    headers["X-PF-Store-Id"] = storeId;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  let raw: unknown;
  const text = await res.text();
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = text;
  }

  const code =
    typeof raw === "object" && raw !== null && "code" in raw
      ? Number((raw as { code: unknown }).code)
      : NaN;

  if (!res.ok || code !== 200) {
    const msg =
      typeof raw === "object" && raw !== null && "result" in raw
        ? JSON.stringify((raw as { result: unknown }).result)
        : `Printful HTTP ${res.status}`;
    return { ok: false, error: msg.slice(0, 500), raw };
  }

  const result = typeof raw === "object" && raw !== null ? (raw as { result?: { id?: unknown } }).result : undefined;
  const id = result?.id;
  if (id === undefined || id === null) {
    return { ok: false, error: "Réponse Printful sans result.id", raw };
  }

  return { ok: true, orderId: String(id), raw };
}
