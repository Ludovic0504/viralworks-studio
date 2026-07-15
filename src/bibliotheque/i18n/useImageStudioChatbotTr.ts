import { useMemo } from "react";
import { useLocale, useT } from "@/contexte/FournisseurLocale";
import { createChatbotTr } from "@/bibliotheque/i18n/chatbotTranslate";
import type { PromptTemplateDefinition, ProductShotStyle } from "@/bibliotheque/imageStudio/promptTemplates";

export function useImageStudioChatbotTr() {
  const { locale } = useLocale();
  const t = useT();

  return useMemo(() => {
    const tr = createChatbotTr(t, locale);
    return {
      locale,
      tr,
      ui: (key: string, fallback: string) => tr(`chatbot.ui.${key}`, fallback),
      shot: (style: ProductShotStyle) => ({
        ...style,
        label: tr(`chatbot.shots.${style.id}`, style.label),
      }),
      template: (template: PromptTemplateDefinition) => ({
        ...template,
        label: tr(`chatbot.templates.${template.id}.label`, template.label),
        summary: tr(`chatbot.templates.${template.id}.summary`, template.summary),
        botIntro: tr(`chatbot.templates.${template.id}.botIntro`, template.botIntro),
        botAskRequired: tr(
          `chatbot.templates.${template.id}.botAskRequired`,
          template.botAskRequired,
        ),
        botAskEnvironment: template.botAskEnvironment
          ? tr(
              `chatbot.templates.${template.id}.botAskEnvironment`,
              template.botAskEnvironment,
            )
          : undefined,
        botAskElementsMode: template.botAskElementsMode
          ? tr(
              `chatbot.templates.${template.id}.botAskElementsMode`,
              template.botAskElementsMode,
            )
          : undefined,
        botAskPackagingMode: template.botAskPackagingMode
          ? tr(
              `chatbot.templates.${template.id}.botAskPackagingMode`,
              template.botAskPackagingMode,
            )
          : undefined,
        botAskCustomElements: template.botAskCustomElements
          ? tr(
              `chatbot.templates.${template.id}.botAskCustomElements`,
              template.botAskCustomElements,
            )
          : undefined,
        botReady: tr(`chatbot.templates.${template.id}.botReady`, template.botReady),
        variables: template.variables.map((variable) => ({
          ...variable,
          label: tr(
            `chatbot.templates.${template.id}.vars.${variable.key}`,
            variable.label,
          ),
        })),
      }),
      packshotOption: <T extends { id: string; label: string }>(
        group: string,
        option: T,
      ) => ({
        ...option,
        label: tr(`chatbot.packshot.${group}.${option.id}`, option.label),
      }),
      packshotOptions: <T extends { id: string; label: string }>(
        group: string,
        options: T[],
      ) =>
        options.map((option) => ({
          ...option,
          label: tr(`chatbot.packshot.${group}.${option.id}`, option.label),
        })),
    };
  }, [locale, t]);
}
