/**
 * Source unique : liste des métiers + paramètres métier pour Campagne VWS et vwsPromptEngine.
 * Catalogue 106 libellés : metiersCategories.ts — profils par catégorie : vwsMetiersProfiles/.
 */

import { ALL_METIERS, isKnownMetierLabel } from "./metiersCategories";
import { VWS_METIER_PROFILES_COMBINED } from "./vwsMetiersProfiles";
import type { VwsMetierProfile } from "./vwsMetiersProfiles/types";

export type { VwsMetierProfile };

/** Anciens libellés campagne → libellé(s) canonique(s) du catalogue 106. */
export const PROFESSION_LABEL_ALIASES: Record<string, string | readonly [string, string]> = {
  "Coiffeur / barbier": "Coiffeur",
  "Chauffagiste / climatisation": "Chauffagiste",
  "Paysagiste / jardinier": "Paysagiste",
  "Architecte / architecte d'intérieur": "Architecte",
  "Coach sportif / salle de sport": "Coach sportif",
  "Magasin de meubles / décoration": ["Cuisiniste", "Décorateur d'intérieur"],
};

const MAGASIN_LEGACY_LABEL = "Magasin de meubles / décoration";

function findProfileByLabel(label: string): VwsMetierProfile | undefined {
  return VWS_METIER_PROFILES_COMBINED.find((p) => p.label === label);
}

function mergeMagasinProfiles(
  targets: readonly [string, string],
  fallback: VwsMetierProfile
): VwsMetierProfile {
  const [aLabel, bLabel] = targets;
  const a = findProfileByLabel(aLabel);
  const b = findProfileByLabel(bLabel);
  if (!a && !b) return { ...fallback, label: MAGASIN_LEGACY_LABEL };
  if (a && !b) return { ...a, label: MAGASIN_LEGACY_LABEL };
  if (b && !a) return { ...b, label: MAGASIN_LEGACY_LABEL };
  const join = (x: string | undefined, y: string | undefined) =>
    [x, y].filter(Boolean).join(" ; ");
  return {
    label: MAGASIN_LEGACY_LABEL,
    recommendedVideoFormatId: a!.recommendedVideoFormatId || b!.recommendedVideoFormatId,
    environmentHint: join(a!.environmentHint, b!.environmentHint),
    stylePlaceholder: join(a!.stylePlaceholder, b!.stylePlaceholder),
    inspireContext: join(a!.inspireContext, b!.inspireContext),
  };
}

function resolveCanonicalLabel(professionLabel: string): string {
  const alias = PROFESSION_LABEL_ALIASES[professionLabel];
  if (typeof alias === "string") return alias;
  return professionLabel;
}

export const VWS_METIER_PROFILES: VwsMetierProfile[] = VWS_METIER_PROFILES_COMBINED;

/** Libellés catalogue (106) — combobox campagne et garde mode produit. */
export const VWS_METIER_LABELS: string[] = [...ALL_METIERS];

/** Tous les libellés du catalogue (106) — pour combobox Phase 3. */
export { ALL_METIERS, isKnownMetierLabel };

export function getVwsMetierProfile(professionLabel: string): VwsMetierProfile | null {
  const t = (professionLabel || "").trim();
  if (!t) return null;

  const direct = findProfileByLabel(t);
  if (direct) return direct;

  const alias = PROFESSION_LABEL_ALIASES[t];
  if (Array.isArray(alias)) {
    const fallback = findProfileByLabel(MAGASIN_LEGACY_LABEL);
    return mergeMagasinProfiles(alias, fallback ?? {
      label: MAGASIN_LEGACY_LABEL,
      recommendedVideoFormatId: "produit_demo",
      environmentHint:
        "showroom organisé par univers, meubles en situation, accessoires déco, client qui compare matières et dimensions",
      stylePlaceholder:
        "Ex. : salon complet, chambre moderne, style scandinave, offre promotionnelle en magasin…",
      inspireContext:
        "conseil client concret, mise en situation d’un meuble, argument confort/praticité/prix",
    });
  }

  if (typeof alias === "string") {
    const resolved = findProfileByLabel(alias);
    if (resolved) return resolved;
    const legacy = findProfileByLabel(t);
    if (legacy) return legacy;
  }

  return null;
}

export function getVwsEnvironmentHint(professionLabel: string): string | null {
  return getVwsMetierProfile(professionLabel)?.environmentHint ?? null;
}
