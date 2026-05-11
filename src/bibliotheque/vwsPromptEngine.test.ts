import { describe, expect, it } from "vitest";
import {
  buildHookImageApiPrompt,
  extractOpeningHookNarrativeSeed,
  truncateOpeningHookFallback,
} from "./vwsPromptEngine";

const finishedResultIntent = {
  intentFamily: "transformation" as const,
  hookGoal: "show_finished_result" as const,
  humanPresence: "none" as const,
  confidence: 0.9,
  source: "heuristic" as const,
};

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
});
