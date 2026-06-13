import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import {
  getWelcomeGiftById,
  type WelcomeGiftCatalogEntry,
  validateGelatoEntry,
  validatePrintfulEntry,
} from "./welcome-gifts.catalog.ts";
import { createGelatoWelcomeOrder, stripeShippingToGelato } from "./gelato-order.ts";
import { createPrintfulWelcomeOrder } from "./printful-order.ts";
import type { GelatoShippingAddress } from "./gelato-order.ts";

export type WelcomeGiftShippingSnapshot = {
  gelatoShipping: GelatoShippingAddress;
  recipientName: string;
  recipient: {
    address1: string;
    address2?: string;
    city: string;
    state_code: string;
    country_code: string;
    zip: string;
    email: string;
    phone?: string;
  };
  stripeCustomerDetails: unknown;
};

function isFulfilledStatus(status: string | null | undefined): boolean {
  return status === "submitted" || status === "pending_manual";
}

function parseSnapshot(raw: unknown): WelcomeGiftShippingSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.gelatoShipping || !o.recipientName || !o.recipient) return null;
  return raw as WelcomeGiftShippingSnapshot;
}

function normalizeGiftSize(v?: string): string | undefined {
  const s = (v ?? "").trim().toUpperCase();
  return s || undefined;
}

function resolveGelatoProductUid(
  entry: WelcomeGiftCatalogEntry,
  selectedSize?: string
): string | undefined {
  const size = normalizeGiftSize(selectedSize);
  if (!entry.gelato) return undefined;
  if (size) {
    const mapped = entry.gelato.sizeProductUids?.[size]?.trim();
    if (mapped && !mapped.startsWith("REMPLACER")) return mapped;
  }
  return entry.gelato.productUid;
}

/** Webhook : enregistre livraison + statut en attente du choix utilisateur (après paiement). */
export async function tryScheduleWelcomeGift(
  supabaseClient: SupabaseClient,
  session: Stripe.Checkout.Session,
  userId: string
): Promise<void> {
  if (session.metadata?.welcome_gift !== "1") {
    return;
  }

  const plan = session.metadata?.subscription_plan?.trim();
  if (plan !== "monthly" && plan !== "yearly" && plan !== "premium_129") {
    return;
  }

  const shipping = session.shipping_details;
  const customer = session.customer_details;
  const name = shipping?.name || customer?.name || "";
  const addr = shipping?.address || customer?.address;
  if (!name || !addr?.line1 || !addr.city || !addr.country || !addr.postal_code) {
    console.warn("🎁 Cadeau : adresse incomplète sur la session", {
      sessionId: session.id,
      userId,
    });
    return;
  }

  const email =
    session.customer_details?.email ||
    session.customer_email ||
    "";

  if (!email) {
    console.warn("🎁 Cadeau : email introuvable", { sessionId: session.id, userId });
    return;
  }

  const gelatoShipping = stripeShippingToGelato({
    shippingName: name,
    line1: addr.line1,
    line2: addr.line2,
    city: addr.city,
    state: addr.state,
    postalCode: addr.postal_code,
    country: addr.country,
    email,
    phone: session.customer_details?.phone,
  });

  const fulfillmentSnapshot: WelcomeGiftShippingSnapshot = {
    gelatoShipping,
    recipientName: name,
    recipient: {
      address1: addr.line1,
      address2: addr.line2 || undefined,
      city: addr.city,
      state_code: addr.state?.trim() || "",
      country_code: addr.country,
      zip: addr.postal_code,
      email,
      phone: session.customer_details?.phone || undefined,
    },
    stripeCustomerDetails: session.customer_details,
  };

  const { data: bySession } = await supabaseClient
    .from("welcome_gift_shipments")
    .select("id, status, gelato_order_id, printful_order_id, stripe_checkout_session_id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (bySession?.status === "pending_choice" && !bySession.gelato_order_id && !bySession.printful_order_id) {
    console.log("🎁 Cadeau : déjà en pending_choice pour cette session", session.id);
    return;
  }
  if (bySession && isFulfilledStatus(bySession.status)) {
    return;
  }
  if (bySession?.gelato_order_id || bySession?.printful_order_id) {
    return;
  }

  const { data: byUser } = await supabaseClient
    .from("welcome_gift_shipments")
    .select("id, status, stripe_checkout_session_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (byUser && isFulfilledStatus(byUser.status)) {
    console.log("🎁 Cadeau : envoi déjà finalisé pour l’utilisateur", userId);
    return;
  }

  const now = new Date().toISOString();
  const payload = {
    stripe_checkout_session_id: session.id,
    subscription_plan: plan,
    amount_total_cents: session.amount_total ?? null,
    status: "pending_choice" as const,
    gift_product_id: null as string | null,
    fulfillment_provider: null as string | null,
    gelato_order_id: null as string | null,
    gelato_response: null as Record<string, unknown> | null,
    printful_order_id: null as string | null,
    printful_response: null as Record<string, unknown> | null,
    error_message: null as string | null,
    shipping_snapshot: fulfillmentSnapshot as unknown as Record<string, unknown>,
    updated_at: now,
  };

  if (!byUser) {
    const { error: insertError } = await supabaseClient
      .from("welcome_gift_shipments")
      .insert({
        user_id: userId,
        ...payload,
      });

    if (insertError?.code === "23505") {
      await supabaseClient
        .from("welcome_gift_shipments")
        .update(payload)
        .eq("user_id", userId)
        .in("status", ["pending_choice", "pending", "failed"]);
    } else if (insertError) {
      console.error("🎁 Cadeau : erreur insertion pending_choice", insertError);
    } else {
      console.log("🎁 Cadeau : pending_choice créé", { userId, sessionId: session.id });
    }
    return;
  }

  const { error: upErr } = await supabaseClient
    .from("welcome_gift_shipments")
    .update(payload)
    .eq("id", byUser.id)
    .in("status", ["pending_choice", "pending", "failed"]);

  if (upErr) {
    console.error("🎁 Cadeau : erreur mise à jour pending_choice", upErr);
    return;
  }
  console.log("🎁 Cadeau : pending_choice mis à jour", { userId, sessionId: session.id });
}

async function fulfillWelcomeGiftRow(
  supabaseClient: SupabaseClient,
  row: {
    id: string;
    user_id: string;
    stripe_checkout_session_id: string;
    shipping_snapshot: unknown;
  },
  def: NonNullable<ReturnType<typeof getWelcomeGiftById>>,
  giftSize?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const snap = parseSnapshot(row.shipping_snapshot);
  if (!snap) {
    return { ok: false, error: "shipping_snapshot invalide" };
  }

  const sessionRef = row.stripe_checkout_session_id;
  const userId = row.user_id;
  const normalizedSize = normalizeGiftSize(giftSize);

  if (def.provider === "manual") {
    await supabaseClient
      .from("welcome_gift_shipments")
      .update({
        status: "pending_manual",
        gift_product_id: def.id,
        gift_size: normalizedSize ?? null,
        fulfillment_provider: def.provider,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return { ok: true };
  }

  if (def.provider === "gelato") {
    const cfgErr = validateGelatoEntry(def);
    if (cfgErr) {
      await supabaseClient
        .from("welcome_gift_shipments")
        .update({
          status: "failed",
          gift_size: normalizedSize ?? null,
          error_message: cfgErr,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      return { ok: false, error: cfgErr };
    }

    if (def.availableSizes?.length) {
      if (!normalizedSize || !def.availableSizes.includes(normalizedSize)) {
        return { ok: false, error: "Taille invalide. Choisis une taille disponible." };
      }
    }

    const productUid = resolveGelatoProductUid(def, normalizedSize);
    if (!productUid) {
      return { ok: false, error: "Produit Gelato introuvable pour cette taille." };
    }

    const orderRef = `vws-${sessionRef}`.slice(0, 100);
    const gelato = await createGelatoWelcomeOrder(
      {
        orderReferenceId: orderRef,
        customerReferenceId: userId,
        shipping: snap.gelatoShipping,
      },
      def.gelato
        ? {
            productUid,
            printFileUrl: def.gelato.printFileUrl,
            printFileType: def.gelato.printFileType,
          }
        : undefined
    );

    const ts = new Date().toISOString();
    if (gelato.ok) {
      await supabaseClient
        .from("welcome_gift_shipments")
        .update({
          status: "submitted",
          gift_product_id: def.id,
          gift_size: normalizedSize ?? null,
          fulfillment_provider: def.provider,
          provider_status: "received",
          provider_last_check_at: ts,
          provider_tracking: gelato.raw as Record<string, unknown>,
          provider_event_log: [
            {
              provider: "gelato",
              provider_status: "received",
              source: "order_create",
              at: ts,
            },
          ] as unknown,
          gelato_order_id: gelato.orderId,
          gelato_response: gelato.raw as Record<string, unknown>,
          error_message: null,
          updated_at: ts,
        })
        .eq("id", row.id);
    } else {
      await supabaseClient
        .from("welcome_gift_shipments")
        .update({
          status: "failed",
          gift_size: normalizedSize ?? null,
          error_message: gelato.error,
          gelato_response: (gelato.raw ?? null) as Record<string, unknown> | null,
          updated_at: ts,
        })
        .eq("id", row.id);
      return { ok: false, error: gelato.error };
    }
    return { ok: true };
  }

  if (def.provider === "printful") {
    const cfgErr = validatePrintfulEntry(def);
    if (cfgErr) {
      await supabaseClient
        .from("welcome_gift_shipments")
        .update({
          status: "failed",
          gift_size: normalizedSize ?? null,
          error_message: cfgErr,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      return { ok: false, error: cfgErr };
    }

    const pf = await createPrintfulWelcomeOrder({
      recipient: {
        name: snap.recipientName,
        address1: snap.recipient.address1,
        address2: snap.recipient.address2,
        city: snap.recipient.city,
        state_code: snap.recipient.state_code,
        country_code: snap.recipient.country_code,
        zip: snap.recipient.zip,
        email: snap.recipient.email,
        phone: snap.recipient.phone,
      },
      variantId: def.printful?.variantId && def.printful.variantId > 0 ? def.printful.variantId : undefined,
      syncVariantId:
        def.printful?.syncVariantId && def.printful.syncVariantId > 0
          ? def.printful.syncVariantId
          : undefined,
      productSearchTerms: def.printful?.productSearchTerms,
      files: def.printful?.files,
      externalId: `vws-${sessionRef}`,
    });

    const ts = new Date().toISOString();
    if (pf.ok) {
      await supabaseClient
        .from("welcome_gift_shipments")
        .update({
          status: "submitted",
          gift_product_id: def.id,
          gift_size: normalizedSize ?? null,
          fulfillment_provider: def.provider,
          provider_status: "received",
          provider_last_check_at: ts,
          provider_tracking: pf.raw as Record<string, unknown>,
          provider_event_log: [
            {
              provider: "printful",
              provider_status: "received",
              source: "order_create",
              at: ts,
            },
          ] as unknown,
          printful_order_id: pf.orderId,
          printful_response: pf.raw as Record<string, unknown>,
          error_message: null,
          updated_at: ts,
        })
        .eq("id", row.id);
    } else {
      await supabaseClient
        .from("welcome_gift_shipments")
        .update({
          status: "failed",
          gift_size: normalizedSize ?? null,
          error_message: pf.error,
          printful_response: (pf.raw ?? null) as Record<string, unknown> | null,
          updated_at: ts,
        })
        .eq("id", row.id);
      return { ok: false, error: pf.error };
    }
    return { ok: true };
  }

  return { ok: false, error: "Fournisseur inconnu" };
}

export async function completeWelcomeGiftChoiceForUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  giftId: string,
  giftSize?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const def = getWelcomeGiftById(giftId.trim());
  if (!def || !def.enabled) {
    return { ok: false, error: "Article non disponible" };
  }
  const normalizedSize = normalizeGiftSize(giftSize);
  if (def.availableSizes?.length) {
    if (!normalizedSize || !def.availableSizes.includes(normalizedSize)) {
      return { ok: false, error: "Choisis une taille valide pour ce vêtement." };
    }
  }

  const gelatoErr = validateGelatoEntry(def);
  if (gelatoErr) return { ok: false, error: gelatoErr };
  const printfulErr = validatePrintfulEntry(def);
  if (printfulErr) return { ok: false, error: printfulErr };

  const { data: row, error: rowErr } = await supabaseAdmin
    .from("welcome_gift_shipments")
    .select("id, user_id, stripe_checkout_session_id, shipping_snapshot, status")
    .eq("user_id", userId)
    .eq("status", "pending_choice")
    .maybeSingle();

  if (rowErr || !row) {
    // Idempotence: si le choix a déjà été validé récemment, ne pas renvoyer d'erreur côté UI.
    const { data: latest } = await supabaseAdmin
      .from("welcome_gift_shipments")
      .select("status")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest?.status === "submitted" || latest?.status === "pending_manual") {
      return { ok: true };
    }

    return { ok: false, error: "Aucun cadeau en attente de choix" };
  }

  await supabaseAdmin
    .from("welcome_gift_shipments")
    .update({
      gift_size: normalizedSize ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  return fulfillWelcomeGiftRow(supabaseAdmin, row, def, normalizedSize);
}
