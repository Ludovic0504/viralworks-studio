import { MESSAGE_CATALOG } from "./messages";
import { DEFAULT_SITE_LOCALE } from "./locales";
import type { MessageTree, SiteLocale, TranslateVars } from "./types";

function getMessage(messages: MessageTree, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as MessageTree)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function applyVars(text: string, vars?: TranslateVars): string {
  if (!vars) return text;
  return Object.entries(vars).reduce(
    (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
    text,
  );
}

export function createTranslator(locale: SiteLocale) {
  const messages = MESSAGE_CATALOG[locale] ?? MESSAGE_CATALOG[DEFAULT_SITE_LOCALE];
  const fallback = MESSAGE_CATALOG[DEFAULT_SITE_LOCALE];

  return function t(key: string, vars?: TranslateVars): string {
    const text = getMessage(messages, key) ?? getMessage(fallback, key) ?? key;
    return applyVars(text, vars);
  };
}
