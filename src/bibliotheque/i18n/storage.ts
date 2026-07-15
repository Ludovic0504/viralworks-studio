import { DEFAULT_SITE_LOCALE, isSiteLocale, SITE_LOCALE_STORAGE_KEY } from "./locales";
import type { SiteLocale } from "./types";

export function readStoredSiteLocale(): SiteLocale {
  try {
    const raw = localStorage.getItem(SITE_LOCALE_STORAGE_KEY);
    if (raw && isSiteLocale(raw)) return raw;
  } catch {
    // ignore
  }
  return DEFAULT_SITE_LOCALE;
}

export function writeStoredSiteLocale(locale: SiteLocale): void {
  try {
    localStorage.setItem(SITE_LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}
