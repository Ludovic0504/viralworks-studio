import { useEffect, useRef, useState } from "react";
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
        className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-3 text-[13px] font-semibold uppercase tracking-wide text-emerald-200 transition-colors hover:border-emerald-400/50 hover:bg-emerald-500/25 hover:text-emerald-100"
      >
        <span>{locale}</span>
        <span aria-hidden className={`text-[10px] leading-none text-emerald-300/80 transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
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
