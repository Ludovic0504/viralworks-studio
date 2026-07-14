import {
  IMAGE_STUDIO_PROMPT_TEMPLATES,
  type PromptTemplateDefinition,
} from "@/bibliotheque/imageStudio/promptTemplates";
import { TEMPLATE_INTENT_METADATA } from "./intentMetadata";
import type { CatalogVariable, ImageStudioTemplateCatalogEntry } from "./types";

function buildCatalogVariable(
  template: PromptTemplateDefinition,
  variable: PromptTemplateDefinition["variables"][number],
): CatalogVariable {
  const roleFr =
    TEMPLATE_INTENT_METADATA[template.id]?.variableRolesFr?.[variable.key] ??
    `Renseigne « ${variable.label} » dans le prompt assemblé`;

  return {
    key: variable.key,
    labelFr: variable.label,
    required: Boolean(variable.required),
    placeholderHint: variable.placeholder,
    roleFr,
  };
}

function buildCatalogEntry(template: PromptTemplateDefinition): ImageStudioTemplateCatalogEntry {
  const metadata = TEMPLATE_INTENT_METADATA[template.id];
  if (!metadata) {
    throw new Error(`TEMPLATE_INTENT_METADATA manquant pour ${template.id}`);
  }
  if (!template.guideMode) {
    throw new Error(`guideMode manquant pour le template ${template.id}`);
  }

  return {
    id: template.id,
    guideMode: template.guideMode,
    labelFr: template.label,
    summaryFr: template.summary,
    intentTagsFr: metadata.intentTagsFr,
    promptFocusEn: metadata.promptFocusEn,
    mentionHint: metadata.mentionHint,
    variables: template.variables.map((variable) => buildCatalogVariable(template, variable)),
  };
}

/** Catalogue central des templates Image Studio (étape 2). */
export const IMAGE_STUDIO_TEMPLATE_CATALOG: ImageStudioTemplateCatalogEntry[] =
  IMAGE_STUDIO_PROMPT_TEMPLATES.map(buildCatalogEntry);

export function getTemplateCatalogEntryById(
  id: string,
): ImageStudioTemplateCatalogEntry | undefined {
  return IMAGE_STUDIO_TEMPLATE_CATALOG.find((entry) => entry.id === id);
}

export function getTemplateCatalogEntryByGuideMode(
  guideMode: string,
): ImageStudioTemplateCatalogEntry | undefined {
  return IMAGE_STUDIO_TEMPLATE_CATALOG.find((entry) => entry.guideMode === guideMode);
}
