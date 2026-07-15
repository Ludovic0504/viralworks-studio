import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { isSiteLocale, siteLocaleToHtmlLang } from "@/bibliotheque/i18n/locales";
import { readStoredSiteLocale, writeStoredSiteLocale } from "@/bibliotheque/i18n/storage";
import { createTranslator } from "@/bibliotheque/i18n/translate";
import type { SiteLocale, TranslateVars } from "@/bibliotheque/i18n/types";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import { getUserProfile, invalidateUserProfileCache } from "@/bibliotheque/supabase/profil";

type LocaleContextValue = {
  locale: SiteLocale;
  setLocale: (locale: SiteLocale) => void;
  t: (key: string, vars?: TranslateVars) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

async function persistPreferredLocale(userId: string, locale: SiteLocale): Promise<void> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ preferred_locale: locale })
    .eq("user_id", userId);
  if (error) throw error;
  invalidateUserProfileCache(userId);
}

export function FournisseurLocale({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [locale, setLocaleState] = useState<SiteLocale>(() => readStoredSiteLocale());
  const profileLocaleLoadedRef = useRef<string | null>(null);

  const setLocale = useCallback(
    (nextLocale: SiteLocale) => {
      setLocaleState(nextLocale);
      writeStoredSiteLocale(nextLocale);
      const userId = session?.user?.id;
      if (userId) {
        void persistPreferredLocale(userId, nextLocale).catch(() => {
          // ignore — localStorage reste la source de secours
        });
      }
    },
    [session?.user?.id],
  );

  useEffect(() => {
    document.documentElement.lang = siteLocaleToHtmlLang(locale);
  }, [locale]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      profileLocaleLoadedRef.current = null;
      return;
    }
    if (profileLocaleLoadedRef.current === userId) return;

    let cancelled = false;
    void getUserProfile(userId)
      .then((profile) => {
        if (cancelled) return;
        profileLocaleLoadedRef.current = userId;
        const raw = String(profile?.preferred_locale || "").toLowerCase();
        if (!isSiteLocale(raw)) return;
        setLocaleState(raw);
        writeStoredSiteLocale(raw);
      })
      .catch(() => {
        if (!cancelled) profileLocaleLoadedRef.current = userId;
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale doit être utilisé dans FournisseurLocale");
  }
  return ctx;
}

export function useT() {
  return useLocale().t;
}
