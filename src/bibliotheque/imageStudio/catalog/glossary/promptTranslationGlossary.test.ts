import { describe, expect, it } from "vitest";
import {
  buildOpenAiMessagesForPromptAssist,
  buildPromptAssistSystemPrompt,
  buildLocalPromptFromUserText,
  findGlossaryMatchesInText,
  mergeGlossaryMatches,
} from "./index";

describe("promptTranslationGlossary", () => {
  it("matches French terms without accents", () => {
    const matches = findGlossaryMatchesInText("je veux un croquis en vue plongeante");
    const ids = matches.map((entry) => entry.id);
    expect(ids).toContain("style-sketch");
    expect(ids).toContain("shot-bird-eye");
  });

  it("matches packshot and UGC intents", () => {
    const matches = findGlossaryMatchesInText("packshot e-commerce avec lumière douce");
    const ids = matches.map((entry) => entry.id);
    expect(ids).toContain("intent-packshot");
    expect(ids).toContain("light-soft");
  });

  it("deduplicates merged matches", () => {
    const a = findGlossaryMatchesInText("selfie ugc");
    const b = findGlossaryMatchesInText("selfie miroir");
    const merged = mergeGlossaryMatches(a, b);
    const selfieEntries = merged.filter((entry) => entry.id === "style-selfie");
    expect(selfieEntries).toHaveLength(1);
  });

  it("builds system prompt with glossary sections", () => {
    const prompt = buildPromptAssistSystemPrompt();
    expect(prompt).toContain("GLOSSAIRE FR → EN");
    expect(prompt).toContain("hand-drawn pencil sketch");
    expect(prompt).toContain("bird's eye view");
  });

  it("builds local prompt from glossary matches", () => {
    const prompt = buildLocalPromptFromUserText(
      "Je veux un croquis en vue plongeante avec lumière douce",
    );
    expect(prompt).toContain("hand-drawn pencil sketch");
    expect(prompt).toContain("bird's eye view");
    expect(prompt).toContain("soft diffused light");
  });

  it("appends @Produit when reference image is attached", () => {
    const prompt = buildLocalPromptFromUserText("packshot produit", {
      hasReferenceImage: true,
    });
    expect(prompt).toContain("@Produit");
  });

  it("matches mannequin and worn product intent", () => {
    const matches = findGlossaryMatchesInText(
      "veste portée par un mannequin editorial",
    );
    const ids = matches.map((entry) => entry.id);
    expect(ids).toContain("intent-mannequin-worn");
  });

  it("builds OpenAI messages from UI thread (skips welcome, adds system)", () => {
    const system = buildPromptAssistSystemPrompt();
    const messages = buildOpenAiMessagesForPromptAssist(
      [
        { role: "assistant", content: "Bonjour !" },
        {
          role: "user",
          content: "veste portée par un mannequin",
          imageUrl: "data:image/png;base64,abc",
        },
      ],
      system,
    );
    expect(messages[0]).toEqual({ role: "system", content: system });
    expect(messages).toHaveLength(2);
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toContain("@Produit");
    expect(messages[1].content).toContain("mannequin");
  });
});

describe("parsePromptAssistMessage", () => {
  it("splits assistant reply into intro, prompt and outro", async () => {
    const { parsePromptAssistAssistantMessage, splitPromptForDisplay } = await import(
      "./parsePromptAssistMessage"
    );
    const text =
      "Merci pour la précision. Voici le prompt final : <prompt>medium shot (MS) + three-point studio setup + fashion model wearing the product</prompt> @Produit sera utilisé comme référence.";
    const parsed = parsePromptAssistAssistantMessage(text);
    expect(parsed.intro).toContain("Merci pour la précision");
    expect(parsed.prompt).toContain("medium shot");
    expect(parsed.outro).toContain("@Produit");
    expect(splitPromptForDisplay(parsed.prompt!)).toHaveLength(3);
  });

  it("uses friendly intro label for prompt replies", async () => {
    const { formatPromptAssistIntro, PROMPT_ASSIST_PROMPT_INTRO } = await import(
      "./parsePromptAssistMessage"
    );
    expect(formatPromptAssistIntro("Voici le prompt final :", true)).toBe(
      PROMPT_ASSIST_PROMPT_INTRO,
    );
    expect(formatPromptAssistIntro("Quel style souhaitez-vous ?", false)).toBe(
      "Quel style souhaitez-vous ?",
    );
  });
});
