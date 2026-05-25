import { describe, expect, it } from "vitest";
import { ALL_METIERS, isKnownMetierLabel, METIERS_CATEGORIES } from "./metiersCategories";
import {
  getVwsEnvironmentHint,
  getVwsMetierProfile,
  PROFESSION_LABEL_ALIASES,
  VWS_METIER_LABELS,
  VWS_METIER_PROFILES,
} from "./vwsMetiersConfig";
import {
  getLieuTournageForProfession,
  PROFESSION_TO_LIEU_TOURNAGE,
} from "./professionLieuTournage";
import {
  ACCESSOIRES_PAR_METIER,
  AVATAR_METIER_SLUG_ALIASES,
  METIERS as AVATAR_METIERS,
  metierLabelToSlug,
  resolveAvatarMetierLabel,
} from "./studio/avatarMetiersCatalog";
import { getFormatById } from "./vwsVideoFormatsCatalog";

const LEGACY_PROFESSION_ALIASES = Object.keys(PROFESSION_LABEL_ALIASES);

function expectFullProfile(label: string) {
  const profile = getVwsMetierProfile(label);
  expect(profile, `profil manquant: ${label}`).not.toBeNull();
  expect(profile!.environmentHint.trim().length).toBeGreaterThan(10);
  expect(profile!.stylePlaceholder.trim().length).toBeGreaterThan(10);
  expect(profile!.inspireContext?.trim().length ?? 0).toBeGreaterThan(5);
  expect(getFormatById(profile!.recommendedVideoFormatId)).not.toBeNull();
}

describe("métiers — smoke catalogue 106", () => {
  it("ALL_METIERS : 106 libellés uniques", () => {
    expect(ALL_METIERS.length).toBe(106);
    expect(new Set(ALL_METIERS).size).toBe(106);
    expect(METIERS_CATEGORIES.reduce((n, c) => n + c.items.length, 0)).toBe(106);
  });

  it("VWS_METIER_PROFILES : 106 entrées, labels = ALL_METIERS", () => {
    expect(VWS_METIER_PROFILES.length).toBe(106);
    const profileLabels = new Set(VWS_METIER_PROFILES.map((p) => p.label));
    for (const label of ALL_METIERS) {
      expect(profileLabels.has(label), label).toBe(true);
    }
    expect(VWS_METIER_LABELS.length).toBe(106);
  });

  it("chaque métier a un profil complet (hint, placeholder, inspire, format)", () => {
    for (const label of ALL_METIERS) {
      expectFullProfile(label);
    }
  });

  it("getVwsEnvironmentHint renvoie un texte pour chaque métier", () => {
    for (const label of ALL_METIERS) {
      const hint = getVwsEnvironmentHint(label);
      expect(hint?.trim().length ?? 0, label).toBeGreaterThan(10);
    }
  });

  it("PROFESSION_TO_LIEU_TOURNAGE couvre les 106 + alias legacy", () => {
    for (const label of ALL_METIERS) {
      expect(
        PROFESSION_TO_LIEU_TOURNAGE[label],
        label
      ).toMatch(/^(chez_client|etablissement|neutre)$/);
    }
    for (const legacy of LEGACY_PROFESSION_ALIASES) {
      expect(getLieuTournageForProfession(legacy)).toMatch(
        /^(chez_client|etablissement|neutre)$/
      );
    }
  });

  it("alias legacy campagne résolvent un profil exploitable", () => {
    expectFullProfile("Coiffeur / barbier");
    expectFullProfile("Chauffagiste / climatisation");
    expectFullProfile("Paysagiste / jardinier");
    expectFullProfile("Architecte / architecte d'intérieur");
    expectFullProfile("Coach sportif / salle de sport");

    const magasin = getVwsMetierProfile("Magasin de meubles / décoration");
    expect(magasin).not.toBeNull();
    expect(magasin!.environmentHint).toContain("cuisine");
    expect(magasin!.environmentHint).toMatch(/déco|échantillon|matériau/i);
  });

  it("isKnownMetierLabel", () => {
    expect(isKnownMetierLabel("Plombier")).toBe(true);
    expect(isKnownMetierLabel("Coiffeur / barbier")).toBe(false);
    expect(isKnownMetierLabel("")).toBe(false);
  });
});

describe("métiers — smoke Avatar", () => {
  it("METIERS Avatar : 106 entrées, slugs uniques", () => {
    expect(AVATAR_METIERS.length).toBe(106);
    const slugs = AVATAR_METIERS.map((m) => m.value);
    expect(new Set(slugs).size).toBe(106);
    for (const label of ALL_METIERS) {
      expect(slugs).toContain(metierLabelToSlug(label));
    }
  });

  it("ACCESSOIRES_PAR_METIER : chaque slug + alias legacy", () => {
    for (const { value: slug } of AVATAR_METIERS) {
      expect(ACCESSOIRES_PAR_METIER[slug]?.trim().length ?? 0, slug).toBeGreaterThan(5);
    }
    for (const [legacy, canonical] of Object.entries(AVATAR_METIER_SLUG_ALIASES)) {
      expect(ACCESSOIRES_PAR_METIER[legacy]).toBe(ACCESSOIRES_PAR_METIER[canonical]);
      expect(resolveAvatarMetierLabel(legacy)).toBe(
        AVATAR_METIERS.find((m) => m.value === canonical)?.label
      );
    }
  });
});
