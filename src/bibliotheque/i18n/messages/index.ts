import { mergeMessages } from "../mergeMessages";
import type { MessageTree, SiteLocale } from "../types";
import { authBundle, communityBundle, profileBundle, shopBundle, studioBundle } from "../bundles/pages";
import { chatbotBundle } from "../bundles/chatbots";
import { playbookBundle } from "../bundles/playbook";
import { shellBundle } from "../bundles/shell";
import { commonBundle, imageStudioBundle, promoBundle } from "../bundles/ui";
import { deMessages } from "./de";
import { enMessages } from "./en";
import { esMessages } from "./es";
import { frMessages } from "./fr";
import { itMessages } from "./it";
import { ptMessages } from "./pt";

function buildLocaleCatalog(base: MessageTree, locale: SiteLocale): MessageTree {
  return mergeMessages(
    base,
    commonBundle[locale],
    promoBundle[locale],
    imageStudioBundle[locale],
    authBundle[locale],
    shopBundle[locale],
    communityBundle[locale],
    studioBundle[locale],
    profileBundle[locale],
    playbookBundle[locale],
    shellBundle[locale],
    chatbotBundle[locale] ?? {},
  );
}

export const MESSAGE_CATALOG: Record<SiteLocale, MessageTree> = {
  fr: buildLocaleCatalog(frMessages, "fr"),
  en: buildLocaleCatalog(enMessages, "en"),
  es: buildLocaleCatalog(esMessages, "es"),
  de: buildLocaleCatalog(deMessages, "de"),
  pt: buildLocaleCatalog(ptMessages, "pt"),
  it: buildLocaleCatalog(itMessages, "it"),
};
