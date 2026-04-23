/**
 * Catalogue des cadeaux de bienvenue (abonnement Boutique 129 € / an).
 * Modifier ce fichier pour ajouter, retirer ou réordonner les propositions.
 */

export type WelcomeGiftProvider = "gelato" | "printful" | "manual";

export type WelcomeGiftCatalogEntry = {
  id: string;
  label: string;
  description?: string;
  provider: WelcomeGiftProvider;
  sortOrder: number;
  enabled: boolean;
  /** Si défini, l'utilisateur doit choisir une taille parmi ces options. */
  availableSizes?: string[];
  gelato?: {
    productUid: string;
    printFileUrl?: string;
    printFileType?: string;
    /** Optionnel: associer un productUid par taille (ex: S/M/L/XL). */
    sizeProductUids?: Record<string, string>;
  };
  printful?: {
    variantId?: number;
    syncVariantId?: number;
    files?: { url: string; type?: string }[];
  };
  manual?: {
    internalNote?: string;
  };
};

export const WELCOME_GIFT_CATALOG: WelcomeGiftCatalogEntry[] = [
  {
    id: "tshirt",
    label: "Tee-shirt",
    provider: "gelato",
    sortOrder: 1,
    enabled: true,
    availableSizes: ["S", "M", "L", "XL", "XXL"],
    gelato: {
      productUid: "REMPLACER_PAR_PRODUCT_UID_GELATO_TEE_SHIRT",
      printFileUrl: "https://example.com/vws/tee-print.png",
      printFileType: "default",
      sizeProductUids: {
        S: "REMPLACER_UID_GELATO_TEE_S",
        M: "REMPLACER_UID_GELATO_TEE_M",
        L: "REMPLACER_UID_GELATO_TEE_L",
        XL: "REMPLACER_UID_GELATO_TEE_XL",
        XXL: "REMPLACER_UID_GELATO_TEE_XXL",
      },
    },
  },
  {
    id: "hoodie",
    label: "Sweat à capuche",
    provider: "gelato",
    sortOrder: 2,
    enabled: true,
    availableSizes: ["S", "M", "L", "XL", "XXL"],
    gelato: {
      productUid: "REMPLACER_PAR_PRODUCT_UID_GELATO_HOODIE",
      printFileUrl: "https://example.com/vws/hoodie-print.png",
      printFileType: "default",
      sizeProductUids: {
        S: "REMPLACER_UID_GELATO_HOODIE_S",
        M: "REMPLACER_UID_GELATO_HOODIE_M",
        L: "REMPLACER_UID_GELATO_HOODIE_L",
        XL: "REMPLACER_UID_GELATO_HOODIE_XL",
        XXL: "REMPLACER_UID_GELATO_HOODIE_XXL",
      },
    },
  },
  {
    id: "mug",
    label: "Mug",
    provider: "gelato",
    sortOrder: 3,
    enabled: true,
    gelato: {
      productUid: "REMPLACER_PAR_PRODUCT_UID_GELATO_MUG",
      printFileUrl: "https://example.com/vws/mug-print.png",
      printFileType: "default",
    },
  },
  {
    id: "mousepad",
    label: "Tapis de souris",
    provider: "printful",
    sortOrder: 4,
    enabled: false,
    printful: {
      variantId: 0,
      files: [{ url: "https://example.com/vws/mousepad-print.png", type: "default" }],
    },
  },
  {
    id: "pen",
    label: "Stylo",
    provider: "manual",
    sortOrder: 5,
    enabled: false,
    manual: {
      internalNote: "Stylo — à traiter avec ton prestataire de fulfillment",
    },
  },
];

export function getEnabledWelcomeGifts(): WelcomeGiftCatalogEntry[] {
  return [...WELCOME_GIFT_CATALOG]
    .filter((e) => e.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getWelcomeGiftById(id: string): WelcomeGiftCatalogEntry | undefined {
  return WELCOME_GIFT_CATALOG.find((e) => e.id === id);
}

export function validatePrintfulEntry(entry: WelcomeGiftCatalogEntry): string | null {
  if (entry.provider !== "printful") return null;
  const v = entry.printful?.variantId ?? 0;
  const s = entry.printful?.syncVariantId ?? 0;
  if (v <= 0 && s <= 0) {
    return "Renseigne printful.variantId ou printful.syncVariantId dans welcome-gifts.catalog.ts";
  }
  return null;
}

export function validateGelatoEntry(entry: WelcomeGiftCatalogEntry): string | null {
  if (entry.provider !== "gelato") return null;
  const uid = entry.gelato?.productUid?.trim() ?? "";
  if (!uid || uid.startsWith("REMPLACER")) {
    return `${entry.id} : renseigne gelato.productUid (UID Gelato réel)`;
  }
  return null;
}
