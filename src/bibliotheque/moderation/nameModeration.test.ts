import { describe, expect, it } from "vitest";
import { normalizeDisplayName } from "../../../supabase/functions/_shared/name-moderation/normalize.ts";
import { validateDisplayNames } from "../../../supabase/functions/_shared/name-moderation/validate.ts";
import { extractNameFields } from "../../../supabase/functions/_shared/name-moderation/extract-names.ts";

describe("normalizeDisplayName", () => {
  it("met en minuscules et retire accents, espaces et tirets", () => {
    expect(normalizeDisplayName("  Jean-Pierre  ")).toBe("jeanpierre");
    expect(normalizeDisplayName("Éléonore")).toBe("eleonore");
  });

  it("remplace le leetspeak courant", () => {
    expect(normalizeDisplayName("H1tl3r")).toBe("hitler");
    expect(normalizeDisplayName("B3n L4d3n")).toBe("benladen");
  });
});

describe("validateDisplayNames", () => {
  const toxic = new Set(["hitler", "staline", "benladen", "breivik"]);
  const badwords = new Set(["connard", "pute"]);

  it("autorise les noms innocents", () => {
    expect(validateDisplayNames("Marie", "Dupont", badwords, toxic)).toEqual({ ok: true });
  });

  it("bloque une personnalité toxique exacte ou déformée", () => {
    expect(validateDisplayNames("H1tl3r", "", badwords, toxic)).toEqual({
      ok: false,
      field: "firstName",
    });
    expect(validateDisplayNames("Adolf", "Hitler", badwords, toxic)).toEqual({
      ok: false,
      field: "lastName",
    });
    expect(validateDisplayNames("Breivik", "", badwords, toxic)).toEqual({
      ok: false,
      field: "firstName",
    });
    expect(validateDisplayNames("Hitler", "Dupont", badwords, toxic)).toEqual({
      ok: false,
      field: "firstName",
    });
  });

  it("ne bloque pas un prénom trop commun utilisé seul", () => {
    const maoOnly = validateDisplayNames("Mao", "", badwords, toxic);
    expect(maoOnly).toEqual({ ok: true });
  });

  it("bloque une insulte listée", () => {
    expect(validateDisplayNames("Connard", "", badwords, toxic)).toEqual({
      ok: false,
      field: "firstName",
    });
    expect(validateDisplayNames("Marie", "Connard", badwords, toxic)).toEqual({
      ok: false,
      field: "lastName",
    });
  });
});

describe("extractNameFields", () => {
  it("lit prénom/nom directs", () => {
    expect(extractNameFields({ first_name: "Jean", last_name: "Martin" })).toEqual({
      firstName: "Jean",
      lastName: "Martin",
    });
  });

  it("lit les champs Google OAuth", () => {
    expect(extractNameFields({ given_name: "Jean", family_name: "Martin" })).toEqual({
      firstName: "Jean",
      lastName: "Martin",
    });
  });

  it("découpe full_name ou name", () => {
    expect(extractNameFields({ full_name: "Jean Martin" })).toEqual({
      firstName: "Jean",
      lastName: "Martin",
    });
  });
});
