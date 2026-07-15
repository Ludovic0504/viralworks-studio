import type { SiteLocale } from "./types";

export const SITE_LOCALE_STORAGE_KEY = "vws-site-locale";

export const DEFAULT_SITE_LOCALE: SiteLocale = "fr";

export const SITE_LOCALES: { code: SiteLocale; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "it", label: "Italiano" },
];

export function isSiteLocale(value: string): value is SiteLocale {
  return SITE_LOCALES.some((locale) => locale.code === value);
}

export function siteLocaleToHtmlLang(locale: SiteLocale): string {
  return locale;
}
