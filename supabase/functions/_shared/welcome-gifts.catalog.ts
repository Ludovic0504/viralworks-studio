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
    /** Optionnel: mots-clés de recherche automatique si les IDs ne sont pas renseignés. */
    productSearchTerms?: string[];
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
      productUid: "11a38159-31c9-4c37-9b62-65d5c613a758",
      printFileUrl:
        "https://wuvtfhletxieocetzppo.supabase.co/storage/v1/object/public/welcome-gifts/photo%20produit%20tee-shirt.jpeg",
      printFileType: "default",
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
      productUid: "cb98cead-d758-4ce1-a567-988abf33ec90",
      printFileUrl:
        "https://wuvtfhletxieocetzppo.supabase.co/storage/v1/object/public/welcome-gifts/photo%20produit%20sweatshirt.jpeg",
      printFileType: "default",
    },
  },
  {
    id: "mug",
    label: "Mug",
    provider: "gelato",
    sortOrder: 3,
    enabled: true,
    gelato: {
      productUid: "2ba4652d-5213-43f0-a407-d80e6e918def",
      printFileUrl:
        "https://wuvtfhletxieocetzppo.supabase.co/storage/v1/object/public/welcome-gifts/photo%20produi%20mug.jpeg",
      printFileType: "default",
    },
  },
  {
    id: "mousepad",
    label: "Tapis de souris",
    provider: "printful",
    sortOrder: 4,
    enabled: true,
    printful: {
      // Option 1 (recommandée): renseigne syncVariantId.
      syncVariantId: 0,
      // Option 2: renseigne variantId.
      variantId: 0,
      // Fallback auto: si IDs non remplis, on cherche le produit par nom dans Printful.
      productSearchTerms: ["mouse pad", "tapis de souris"],
      // Optionnel: fichier design hébergé (utile surtout avec variantId).
      files: [
        {
          url: "https://wuvtfhletxieocetzppo.supabase.co/storage/v1/object/public/welcome-gifts/mousepad-print.png",
          type: "default",
        },
      ],
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
  const hasSearchTerms = Boolean(
    entry.printful?.productSearchTerms?.some((t) => t.trim().length > 0)
  );
  if (v <= 0 && s <= 0 && !hasSearchTerms) {
    return "Renseigne printful.variantId, printful.syncVariantId ou printful.productSearchTerms";
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
