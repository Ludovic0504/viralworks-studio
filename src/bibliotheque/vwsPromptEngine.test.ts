import { describe, expect, it } from "vitest";
import {
  buildHookImageApiPrompt,
  extractOpeningHookNarrativeSeed,
  normalizeProductCampaignIdeaForHook,
  truncateOpeningHookFallback,
} from "./vwsPromptEngine";

const finishedResultIntent = {
  intentFamily: "transformation" as const,
  hookGoal: "show_finished_result" as const,
  humanPresence: "none" as const,
  confidence: 0.9,
  source: "heuristic" as const,
};

const productDecor = "Décor de la scène : Studio. Fond neutre professionnel.";
const productHook =
  "Hook d'accroche (3 premières secondes) : Révélation — Lumière qui s'allume sur le produit.";
const productPromo = "Crème anti-âge posée sur marbre, lumière dorée, vapeur légère.";
const productMise = "Mise en scène souhaitée : Produit en vedette";

function buildTripledProductBrief() {
  const pollutedBody = [
    productDecor,
    productHook,
    "DESCRIPTION DE LA SCÈNE :",
    productDecor,
    productHook,
    "DESCRIPTION DE LA SCÈNE :",
    productPromo,
    productMise,
    productMise,
  ].join("\n\n");
  return `${productDecor}\n\n${productHook}\n\nDESCRIPTION DE LA SCÈNE : ${pollutedBody}`;
}

describe("normalizeProductCampaignIdeaForHook", () => {
  it("brief produit triplé → une occurrence par bloc structurant", () => {
    const triple = buildTripledProductBrief();
    const out = normalizeProductCampaignIdeaForHook(triple);
    expect((out.match(/Décor de la scène\s*:/gi) ?? []).length).toBe(1);
    expect((out.match(/Hook d'accroche/gi) ?? []).length).toBe(1);
    expect((out.match(/DESCRIPTION\s+DE\s+LA\s+SCÈNE\s*:/gi) ?? []).length).toBe(1);
    expect((out.match(/Mise en scène souhaitée\s*:/gi) ?? []).length).toBe(1);
    expect(out).toContain(productPromo);
  });

  it("brief métier LIEU DE LA SCÈNE → inchangé", () => {
    const metier =
      "LIEU DE LA SCÈNE : Atelier chez le client.\n\nDESCRIPTION DE LA SCÈNE : Réparation express.";
    expect(normalizeProductCampaignIdeaForHook(metier)).toBe(metier);
  });
});

describe("extractOpeningHookNarrativeSeed", () => {
  it("coupe avant un pivot em dash (avant / après)", () => {
    const raw =
      "LIEU DE LA SCÈNE : atelier.\n\nDESCRIPTION DE LA SCÈNE : Nikon cassé sur l'établi — puis le réparateur montre l'appareil comme neuf.";
    const seed = extractOpeningHookNarrativeSeed(raw);
    expect(seed).toContain("Nikon cassé");
    expect(seed).not.toContain("comme neuf");
    expect(seed).not.toContain("réparateur montre");
  });

  it("chaîne vide → chaîne vide", () => {
    expect(extractOpeningHookNarrativeSeed("   ")).toBe("");
  });
});

describe("truncateOpeningHookFallback", () => {
  it("tronque avec ellipse si dépasse maxLen", () => {
    const long = "a ".repeat(200);
    const out = truncateOpeningHookFallback(long, 80);
    expect(out.length).toBeLessThanOrEqual(85);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("buildHookImageApiPrompt — openingHookStill vs show_finished_result", () => {
  const transformationIdea =
    "Timelapse construction d'une piscine dans le jardin : terrain vide puis la piscine se remplit progressivement, avant après spectaculaire.";

  it("Image 1 (openingHookStill true) : show_finished_result ne supprime pas le bloc état initial", () => {
    const p = buildHookImageApiPrompt(transformationIdea, {
      revealMode: false,
      initialStateMode: "from_nothing",
      jobTypeLabel: "paysagiste",
      globalIntent: finishedResultIntent,
      openingHookStill: true,
    });
    expect(p).toContain("Contrainte visuelle (image d'accroche de départ)");
    expect(p).toContain("Consigne « image unique d'accroche »");
    expect(p).toContain("Contexte narratif (extrait accroche, premier instant uniquement)");
  });

  it("Continuation (openingHookStill false) : show_finished_result supprime le forçage état initial", () => {
    const p = buildHookImageApiPrompt(transformationIdea, {
      revealMode: false,
      initialStateMode: null,
      jobTypeLabel: "paysagiste",
      globalIntent: finishedResultIntent,
      openingHookStill: false,
    });
    expect(p).not.toContain("Contrainte visuelle (image d'accroche de départ)");
    expect(p).not.toContain("Consigne « image unique d'accroche »");
  });

  it("Image 1 sans from_nothing : avant/après déclenche quand même l’état initial si openingHookStill true", () => {
    const p = buildHookImageApiPrompt(transformationIdea, {
      revealMode: false,
      initialStateMode: null,
      jobTypeLabel: "paysagiste",
      globalIntent: finishedResultIntent,
      openingHookStill: true,
    });
    expect(p).toContain("Contrainte visuelle (image d'accroche de départ)");
    expect(p).toContain("Consigne « image unique d'accroche »");
  });

  it("brief produit triplé : le prompt final ne répète pas Décor / Hook", () => {
    const p = buildHookImageApiPrompt(buildTripledProductBrief(), {
      revealMode: false,
      initialStateMode: null,
      jobTypeLabel: "cosmétique",
      openingHookStill: true,
    });
    expect((p.match(/Décor de la scène\s*:/gi) ?? []).length).toBe(1);
    expect((p.match(/Hook d'accroche/gi) ?? []).length).toBe(1);
    expect((p.match(/Mise en scène souhaitée\s*:/gi) ?? []).length).toBe(1);
  });
});
