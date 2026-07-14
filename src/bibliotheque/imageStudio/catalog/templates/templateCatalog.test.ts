import { describe, expect, it } from "vitest";
import { IMAGE_STUDIO_PROMPT_TEMPLATES } from "@/bibliotheque/imageStudio/promptTemplates";
import {
  IMAGE_STUDIO_TEMPLATE_CATALOG,
  findTemplateCatalogMatchesInText,
  getTemplateCatalogEntryById,
} from "./index";
import { buildPromptAssistCatalogBlock } from "./formatCatalogBlock";
import { buildPromptAssistSystemPrompt } from "../glossary/systemPrompt";

describe("imageStudioTemplateCatalog", () => {
  it("builds one catalog entry per prompt template", () => {
    expect(IMAGE_STUDIO_TEMPLATE_CATALOG).toHaveLength(IMAGE_STUDIO_PROMPT_TEMPLATES.length);
    expect(IMAGE_STUDIO_TEMPLATE_CATALOG).toHaveLength(9);
  });

  it("keeps template ids and variables in sync with promptTemplates.ts", () => {
    for (const template of IMAGE_STUDIO_PROMPT_TEMPLATES) {
      const entry = getTemplateCatalogEntryById(template.id);
      expect(entry).toBeDefined();
      expect(entry?.guideMode).toBe(template.guideMode);
      expect(entry?.variables.map((variable) => variable.key)).toEqual(
        template.variables.map((variable) => variable.key),
      );
    }
  });

  it("matches editorial and mannequin intents to outfit or editorial templates", () => {
    const worn = findTemplateCatalogMatchesInText("veste portée par un mannequin editorial");
    const ids = worn.map((entry) => entry.id);
    expect(ids).toContain("editorial-worn-held");
    expect(ids).toContain("outfit-studio");
  });

  it("matches packshot and e-commerce intents", () => {
    const matches = findTemplateCatalogMatchesInText("packshot e-commerce fond blanc");
    expect(matches[0]?.id).toBe("packshot-dynamique");
  });

  it("injects catalog block into Prompt Assistant system prompt", () => {
    const prompt = buildPromptAssistSystemPrompt();
    expect(prompt).toContain("CATALOGUE TEMPLATES GUIDES");
    expect(prompt).toContain("packshot-dynamique");
    expect(prompt).toContain("editorial-worn-held");
  });

  it("formats catalog entries with variables and intent tags", () => {
    const block = buildPromptAssistCatalogBlock();
    expect(block).toContain("productDescription");
    expect(block).toContain("Intentions FR");
    expect(block).toContain("Focus prompt EN");
  });
});
