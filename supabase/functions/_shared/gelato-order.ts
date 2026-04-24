/**
 * Gelato Order API v4 — utilisé pour expédier le cadeau de bienvenue VWS.
 * Secrets Supabase (Edge Functions) : GELATO_API_KEY, GELATO_PRODUCT_UID, etc.
 */

export type GelatoShippingAddress = {
  firstName: string;
  lastName: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postCode: string;
  state?: string;
  country: string;
  email: string;
  phone?: string;
};

export type CreateWelcomeGiftOrderParams = {
  orderReferenceId: string;
  customerReferenceId: string;
  shipping: GelatoShippingAddress;
};

const GELATO_ORDERS_URL =
  Deno.env.get("GELATO_API_BASE_URL")?.trim() ||
  "https://order.gelatoapis.com/v4/orders";

function extractProviderMessage(raw: unknown, fallback: string): string {
  if (!raw || typeof raw !== "object") return fallback;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.error === "string" && rec.error.trim()) return rec.error.trim();
  if (typeof rec.message === "string" && rec.message.trim()) return rec.message.trim();
  if (typeof rec.title === "string" && rec.title.trim()) return rec.title.trim();
  if (rec.errors && Array.isArray(rec.errors) && rec.errors.length > 0) {
    const first = rec.errors[0];
    if (typeof first === "string" && first.trim()) return first.trim();
    if (first && typeof first === "object") {
      const item = first as Record<string, unknown>;
      if (typeof item.message === "string" && item.message.trim()) return item.message.trim();
      if (typeof item.error === "string" && item.error.trim()) return item.error.trim();
    }
  }
  return fallback;
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const t = fullName.trim();
  if (!t) return { firstName: "Client", lastName: "VWS" };
  const i = t.indexOf(" ");
  if (i === -1) return { firstName: t, lastName: "-" };
  return { firstName: t.slice(0, i).trim(), lastName: t.slice(i + 1).trim() || "-" };
}

export function stripeShippingToGelato(params: {
  shippingName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  email: string;
  phone?: string | null;
}): GelatoShippingAddress {
  const { firstName, lastName } = splitFullName(params.shippingName);
  return {
    firstName,
    lastName,
    addressLine1: params.line1,
    addressLine2: params.line2 || undefined,
    city: params.city,
    postCode: params.postalCode,
    state: params.state || undefined,
    country: params.country,
    email: params.email,
    phone: params.phone || undefined,
  };
}

export type GelatoCatalogOverrides = {
  productUid?: string;
  printFileUrl?: string;
  printFileType?: string;
};

export async function createGelatoWelcomeOrder(
  body: CreateWelcomeGiftOrderParams,
  catalog?: GelatoCatalogOverrides
): Promise<{ ok: true; orderId: string; raw: unknown } | { ok: false; error: string; raw?: unknown }> {
  const apiKey = Deno.env.get("GELATO_API_KEY")?.trim();
  const productUid =
    catalog?.productUid?.trim() || Deno.env.get("GELATO_PRODUCT_UID")?.trim();
  const printUrl =
    catalog?.printFileUrl?.trim() || Deno.env.get("GELATO_PRINT_FILE_URL")?.trim();
  const printType =
    catalog?.printFileType?.trim() ||
    Deno.env.get("GELATO_PRINT_FILE_TYPE")?.trim() ||
    "default";
  const shipmentMethodUid = Deno.env.get("GELATO_SHIPMENT_METHOD_UID")?.trim();

  if (!apiKey) {
    return { ok: false, error: "GELATO_API_KEY manquant (secrets Supabase)" };
  }
  if (!productUid) {
    return { ok: false, error: "GELATO_PRODUCT_UID manquant (catalogue ou secrets Supabase)" };
  }

  const item: Record<string, unknown> = {
    itemReferenceId: `welcome-${body.orderReferenceId}`.slice(0, 120),
    productUid,
    quantity: 1,
  };

  if (printUrl) {
    item.files = [{ type: printType, url: printUrl }];
  }

  const payload: Record<string, unknown> = {
    orderType: "order",
    orderReferenceId: body.orderReferenceId,
    customerReferenceId: body.customerReferenceId,
    currency: "EUR",
    items: [item],
    shippingAddress: {
      firstName: body.shipping.firstName,
      lastName: body.shipping.lastName,
      companyName: body.shipping.companyName ?? "",
      addressLine1: body.shipping.addressLine1,
      addressLine2: body.shipping.addressLine2 ?? "",
      city: body.shipping.city,
      postCode: body.shipping.postCode,
      state: body.shipping.state ?? "",
      country: body.shipping.country,
      email: body.shipping.email,
      phone: body.shipping.phone ?? "",
    },
  };

  if (shipmentMethodUid) {
    payload.shipmentMethodUid = shipmentMethodUid;
  }

  const res = await fetch(GELATO_ORDERS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify(payload),
  });

  let raw: unknown;
  const text = await res.text();
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = text;
  }

  if (!res.ok) {
    const msg = extractProviderMessage(raw, `Gelato HTTP ${res.status}`);
    return { ok: false, error: msg, raw };
  }

  const orderId =
    typeof raw === "object" && raw !== null
      ? String(
          (raw as Record<string, unknown>).orderId ??
            (raw as Record<string, unknown>).id ??
            (raw as Record<string, unknown>).orderUid ??
            ""
        )
      : "";

  if (!orderId) {
    return {
      ok: false,
      error: "Réponse Gelato sans identifiant de commande reconnu",
      raw,
    };
  }

  return { ok: true, orderId, raw };
}
