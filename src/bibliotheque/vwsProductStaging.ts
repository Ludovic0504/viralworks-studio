/** Legacy encoding: chips + free text were stored inside `style_details` (Campagne VWS produit). */
export const LEGACY_PRODUCT_STAGING_PREFIX = "__VWS_PRODUCT_STAGING__:";

export interface LegacyProductStyleSplit {
  /** Staging chip ids (catalog keys), same as former JSON `staging` array. */
  chipIds: string[];
  /** Free-text modifiers only, without the legacy prefix / JSON line. */
  freeText: string;
}

/**
 * If `raw` uses the legacy prefix, splits JSON staging line and following free text.
 * Otherwise returns the whole string as `freeText` and no chips.
 */
export function parseLegacyProductStyleDetails(raw: string): LegacyProductStyleSplit {
  const s = String(raw ?? "");
  if (!s.startsWith(LEGACY_PRODUCT_STAGING_PREFIX)) {
    return { chipIds: [], freeText: s };
  }
  const rest = s.slice(LEGACY_PRODUCT_STAGING_PREFIX.length);
  const nl = rest.indexOf("\n");
  if (nl === -1) {
    try {
      const j = JSON.parse(rest) as { staging?: unknown };
      return {
        chipIds: Array.isArray(j.staging) ? j.staging.filter((x): x is string => typeof x === "string") : [],
        freeText: "",
      };
    } catch {
      return { chipIds: [], freeText: s };
    }
  }
  const jsonLine = rest.slice(0, nl);
  const freeText = rest.slice(nl + 1);
  try {
    const j = JSON.parse(jsonLine) as { staging?: unknown };
    return {
      chipIds: Array.isArray(j.staging) ? j.staging.filter((x): x is string => typeof x === "string") : [],
      freeText,
    };
  } catch {
    return { chipIds: [], freeText: s };
  }
}

/** Removes legacy wrapper from `style_details` when present; otherwise returns `raw`. */
export function stripLegacyProductStyleDetailsPrefix(raw: string): string {
  return parseLegacyProductStyleDetails(String(raw ?? "")).freeText;
}
