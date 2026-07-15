import { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { SITE_LOCALES } from "@/bibliotheque/i18n/locales";
import { useLocale } from "@/contexte/FournisseurLocale";

export default function BoutonMenuLangue() {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t("lang.choose")}
        aria-expanded={open}
        title={t("lang.choose")}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Globe size={18} className="text-gray-300" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-[60] mt-1 w-max overflow-hidden rounded-md border border-white/10 bg-[#0f1629] py-0.5 shadow-xl shadow-black/40"
        >
          {SITE_LOCALES.map((entry) => (
            <button
              key={entry.code}
              type="button"
              role="menuitemradio"
              aria-checked={locale === entry.code}
              onClick={() => {
                setLocale(entry.code);
                setOpen(false);
              }}
              className={`block w-full px-2 py-1 text-left text-[13px] leading-tight whitespace-nowrap ${
                locale === entry.code
                  ? "bg-emerald-500/10 text-emerald-100"
                  : "text-gray-300 hover:bg-white/5"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
