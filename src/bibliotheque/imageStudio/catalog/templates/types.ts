import type { PromptTemplateGuideMode } from "@/bibliotheque/imageStudio/promptTemplates";

export type CatalogMentionHint = "produit" | "image1" | "garment" | "optional";

export type CatalogVariable = {
  key: string;
  labelFr: string;
  required: boolean;
  placeholderHint: string;
  /** Rôle de la variable dans le prompt assemblé (guide existant). */
  roleFr: string;
};

export type ImageStudioTemplateCatalogEntry = {
  id: string;
  guideMode: PromptTemplateGuideMode;
  labelFr: string;
  summaryFr: string;
  /** Mots-clés français pour reconnaître ce type d'image (étape 3 : routage). */
  intentTagsFr: string[];
  /** Vocabulaire / style anglais typique produit par ce guide. */
  promptFocusEn: string;
  mentionHint: CatalogMentionHint;
  variables: CatalogVariable[];
};
