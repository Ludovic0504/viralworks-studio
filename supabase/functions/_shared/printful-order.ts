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

function extractProviderMessage(raw: unknown, fallback: string): string {
  if (!raw || typeof raw !== "object") return fallback;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.error === "string" && rec.error.trim()) return rec.error.trim();
  if (typeof rec.message === "string" && rec.message.trim()) return rec.message.trim();
  if (typeof rec.result === "string" && rec.result.trim()) return rec.result.trim();
  if (rec.result && typeof rec.result === "object") {
    const r = rec.result as Record<string, unknown>;
    if (typeof r.error === "string" && r.error.trim()) return r.error.trim();
    if (typeof r.message === "string" && r.message.trim()) return r.message.trim();
    if (typeof r.reason === "string" && r.reason.trim()) return r.reason.trim();
  }
  return fallback;
}

export async function createPrintfulWelcomeOrder(params: {
  recipient: PrintfulRecipient;
  variantId?: number;
  syncVariantId?: number;
  productSearchTerms?: string[];
  files?: { url: string; type?: string }[];
  externalId: string;
}): Promise<{ ok: true; orderId: string; raw: unknown } | { ok: false; error: string; raw?: unknown }> {
  const token = Deno.env.get("PRINTFUL_API_KEY")?.trim();
  if (!token) {
    return { ok: false, error: "PRINTFUL_API_KEY manquant (secrets Supabase Edge Functions)" };
  }

  const storeId = Deno.env.get("PRINTFUL_STORE_ID")?.trim();
  const autoConfirm = (Deno.env.get("PRINTFUL_AUTO_CONFIRM") ?? "1").trim() !== "0";

  async function printfulApi(
    url: string,
    init?: RequestInit
  ): Promise<
    | { ok: true; raw: unknown; status: number }
    | { ok: false; error: string; raw?: unknown; status: number }
  > {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    if (storeId) headers["X-PF-Store-Id"] = storeId;

    const res = await fetch(url, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
    const text = await res.text();
    let raw: unknown;
    try {
      raw = text ? JSON.parse(text) : null;
    } catch {
      raw = text;
    }

    if (!res.ok) {
      const msg = extractProviderMessage(raw, `Printful HTTP ${res.status}`);
      return { ok: false, error: msg.slice(0, 500), raw, status: res.status };
    }
    return { ok: true, raw, status: res.status };
  }

  let v = params.variantId ?? 0;
  let s = params.syncVariantId ?? 0;
  if (v <= 0 && s <= 0) {
    const terms = params.productSearchTerms ?? [];
    return {
      ok: false,
      error:
        `Printful : syncVariantId/variantId requis pour ce cadeau (fallback auto désactivé). Terms actuels: ${terms.join(", ") || "aucun"}`,
    };
  }

  const item: Record<string, unknown> = { quantity: 1 };
  // N'envoyer qu'un seul identifiant variant:
  // sync_variant_id prioritaire, variant_id en fallback.
  if (s > 0) {
    item.sync_variant_id = s;
  } else if (v > 0) {
    item.variant_id = v;
  }
  if (params.files?.length) {
    item.files = params.files.map((f) => {
      const o: Record<string, unknown> = { url: f.url };
      if (f.type) o.type = f.type;
      return o;
    });
  }

  // Printful est strict sur external_id selon les comptes/endpoints.
  // On force un identifiant court, lowercase, alphanum + _- uniquement.
  const extBase = params.externalId
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
  const ext = (extBase || "vwsorder") + "-" + Date.now().toString(36).slice(-6);

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

  const createRes = await printfulApi(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!createRes.ok) {
    return { ok: false, error: createRes.error, raw: createRes.raw };
  }
  const raw = createRes.raw;

  const code =
    typeof raw === "object" && raw !== null && "code" in raw
      ? Number((raw as { code: unknown }).code)
      : NaN;

  if (code !== 200) {
    const msg = extractProviderMessage(raw, `Printful HTTP ${createRes.status}`);
    return { ok: false, error: msg.slice(0, 500), raw };
  }

  const result = typeof raw === "object" && raw !== null ? (raw as { result?: { id?: unknown } }).result : undefined;
  const id = result?.id;
  if (id === undefined || id === null) {
    return { ok: false, error: "Réponse Printful sans result.id", raw };
  }

  return { ok: true, orderId: String(id), raw };
}
