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
  ): Promise<{ ok: true; raw: unknown } | { ok: false; error: string; raw?: unknown }> {
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
      return { ok: false, error: `Printful HTTP ${res.status}`, raw };
    }
    return { ok: true, raw };
  }

  function pickSyncVariantIdFromRaw(raw: unknown, searchTerms: string[]): number | null {
    const terms = searchTerms.map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (!terms.length) return null;
    if (!raw || typeof raw !== "object") return null;
    const result = (raw as { result?: unknown }).result;
    if (!Array.isArray(result)) return null;

    for (const item of result) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const name = String(rec.name ?? "").toLowerCase();
      const externalId = String(rec.external_id ?? "").toLowerCase();
      const anyMatch = terms.some((t) => name.includes(t) || externalId.includes(t));
      if (!anyMatch) continue;

      const syncVariants = Array.isArray(rec.sync_variants) ? rec.sync_variants : [];
      for (const sv of syncVariants) {
        if (!sv || typeof sv !== "object") continue;
        const id = Number((sv as Record<string, unknown>).id);
        if (Number.isFinite(id) && id > 0) return id;
      }
    }
    return null;
  }

  let v = params.variantId ?? 0;
  let s = params.syncVariantId ?? 0;
  if (v <= 0 && s <= 0) {
    const terms = params.productSearchTerms ?? ["mouse pad", "tapis de souris"];
    const list = await printfulApi("https://api.printful.com/store/products");
    if (!list.ok) {
      return { ok: false, error: `Printful: impossible de lister les produits (${list.error})`, raw: list.raw };
    }
    const resolved = pickSyncVariantIdFromRaw(list.raw, terms);
    if (resolved && resolved > 0) {
      s = resolved;
      console.log("🎁 Printful : syncVariantId résolu automatiquement", { syncVariantId: s, terms });
    } else {
      return {
        ok: false,
        error:
          "Printful : aucun variant trouvé automatiquement (renseigne syncVariantId/variantId ou ajuste productSearchTerms)",
        raw: list.raw,
      };
    }
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

  const createRes = await printfulApi(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!createRes.ok) {
    const msg =
      typeof createRes.raw === "object" && createRes.raw !== null && "result" in createRes.raw
        ? JSON.stringify((createRes.raw as { result: unknown }).result)
        : createRes.error;
    return { ok: false, error: msg.slice(0, 500), raw: createRes.raw };
  }
  const raw = createRes.raw;

  const code =
    typeof raw === "object" && raw !== null && "code" in raw
      ? Number((raw as { code: unknown }).code)
      : NaN;

  if (code !== 200) {
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
