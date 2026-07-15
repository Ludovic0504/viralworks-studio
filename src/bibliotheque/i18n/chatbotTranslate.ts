import type { SiteLocale } from "./types";

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

/** FR = texte source (fallback). Autres langues = catalogue i18n. */
export function createChatbotTr(t: TranslateFn, locale: SiteLocale) {
  return function tr(key: string, fallback: string): string {
    if (locale === "fr") return fallback;
    const value = t(key);
    return value === key ? fallback : value;
  };
}

export function translateLabeledOption<T extends { id: string; label: string }>(
  option: T,
  tr: (key: string, fallback: string) => string,
  keyPrefix: string,
): T {
  return {
    ...option,
    label: tr(`${keyPrefix}.${option.id}`, option.label),
  };
}

export function translateLabeledOptions<T extends { id: string; label: string }>(
  options: T[],
  tr: (key: string, fallback: string) => string,
  keyPrefix: string,
): T[] {
  return options.map((option) => translateLabeledOption(option, tr, keyPrefix));
}

export function translateHintOption<T extends { id: string; label: string; hint?: string }>(
  option: T,
  tr: (key: string, fallback: string) => string,
  keyPrefix: string,
): T {
  return {
    ...option,
    label: tr(`${keyPrefix}.${option.id}.label`, option.label),
    hint: option.hint ? tr(`${keyPrefix}.${option.id}.hint`, option.hint) : option.hint,
  };
}
