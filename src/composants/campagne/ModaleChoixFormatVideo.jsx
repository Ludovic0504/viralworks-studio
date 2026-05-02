import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Film, Package, Smartphone, User, Wrench, X } from "lucide-react";
import {
  VWS_VIDEO_FORMATS,
  VWS_VIDEO_FORMAT_CATEGORIES,
  getFormatById,
  getFormatsByCategory,
} from "@/bibliotheque/vwsVideoFormatsCatalog";
import { prefetchPexelsQueries } from "@/bibliotheque/pexelsFormatImages";
import { getVwsMetierProfile } from "@/bibliotheque/vwsMetiersConfig";
import FormatCardVisual from "./FormatCardVisual.jsx";
import "./ModaleChoixFormatVideo.css";

const MD_QUERY = "(max-width: 767px)";

const TAB_ICONS = {
  produit: Package,
  storytelling: Film,
  humain: User,
  process: Wrench,
  social: Smartphone,
};

function useIsMobileSheet() {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MD_QUERY).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(MD_QUERY);
    const fn = () => setNarrow(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return narrow;
}

export default function ModaleChoixFormatVideo({ open, onClose, professionLabel, onConfirm }) {
  const titleId = useId();
  const isMobile = useIsMobileSheet();
  const [categoryId, setCategoryId] = useState(VWS_VIDEO_FORMAT_CATEGORIES[0]?.id ?? "produit");
  const [mobilePickId, setMobilePickId] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (open) setMobilePickId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    prefetchPexelsQueries(VWS_VIDEO_FORMATS.map((f) => f.pexelsQuery));
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const metierReco = useMemo(() => {
    const p = (professionLabel || "").trim();
    if (!p) return null;
    const profile = getVwsMetierProfile(p);
    const id = profile?.recommendedVideoFormatId;
    if (!id) return null;
    return getFormatById(id);
  }, [professionLabel]);

  const suggestionLine = useMemo(() => {
    const p = (professionLabel || "").trim();
    if (!p) {
      return "Choisis d'abord ton métier dans le formulaire pour une suggestion personnalisée.";
    }
    if (!metierReco) return null;
    return (
      <>
        Pas sûr de ton choix ? Pour un <span className="text-white/90 font-medium">{p}</span>, commence
        par <span className="text-[#2ecc9a] font-medium">{metierReco.name}</span> →
      </>
    );
  }, [professionLabel, metierReco]);

  const handleBackdrop = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose?.();
    },
    [onClose]
  );

  const pickFormat = useCallback(
    (formatId) => {
      onConfirm?.(formatId);
      onClose?.();
    },
    [onConfirm, onClose]
  );

  const handleCardActivate = useCallback(
    (formatId) => {
      if (isMobile) {
        setMobilePickId(formatId);
      } else {
        pickFormat(formatId);
      }
    },
    [isMobile, pickFormat]
  );

  if (!open || typeof document === "undefined") return null;

  const formats = getFormatsByCategory(categoryId);

  const sheetOrPanelClass = isMobile
    ? "vws-format-sheet-mobile fixed inset-x-0 bottom-0 top-0 z-[101] flex flex-col rounded-t-2xl border border-[#1e1e1e] bg-[#0d0d0d] shadow-2xl"
    : "vws-format-panel-desktop relative z-[101] flex max-h-[85vh] w-[90vw] max-w-[900px] flex-col overflow-hidden rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] shadow-2xl";

  return createPortal(
    <div
      className="vws-format-overlay fixed inset-0 z-[100] flex items-end justify-center bg-black/60 md:items-center md:p-4"
      role="presentation"
      onMouseDown={handleBackdrop}
    >
      <div
        ref={panelRef}
        className={sheetOrPanelClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1e1e1e] px-4 py-3 md:px-5 md:py-4 safe-padded">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-100">
              Choisir un format vidéo
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">Un seul choix — tu pourras affiner après.</p>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1e1e1e] bg-[#141414] text-slate-400 transition hover:text-white min-h-[48px] min-w-[48px]"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 border-b border-[#1e1e1e] px-2 md:px-4">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-thin [-webkit-overflow-scrolling:touch]">
            {VWS_VIDEO_FORMAT_CATEGORIES.map((c) => {
              const active = c.id === categoryId;
              const TabIcon = TAB_ICONS[c.id] ?? Package;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2.5 text-xs font-medium transition min-h-[48px] ${
                    active
                      ? "border-[#2ecc9a] text-[#2ecc9a]"
                      : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <TabIcon
                    className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[#2ecc9a]" : "text-slate-500"}`}
                    aria-hidden
                  />
                  {c.tabLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5 md:py-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
            {formats.map((f) => {
              const selectedMobile = isMobile && mobilePickId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleCardActivate(f.id)}
                  className={`group flex min-h-[48px] flex-col rounded-xl border bg-[#141414] p-2.5 text-left transition md:p-3 ${
                    selectedMobile
                      ? "border-[#2ecc9a] ring-1 ring-[#2ecc9a]/40"
                      : "border-[#1e1e1e] hover:border-white/20"
                  }`}
                >
                  <FormatCardVisual
                    formatId={f.id}
                    categoryId={f.categoryId}
                    pexelsQuery={f.pexelsQuery}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-medium leading-snug text-slate-100">{f.name}</span>
                    {f.popular ? (
                      <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/40">
                        Populaire
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500">{f.description}</p>
                </button>
              );
            })}
          </div>

          <p className="mt-6 text-center text-[10px] text-slate-600">
            Photos :{" "}
            <a
              href="https://www.pexels.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 underline decoration-slate-600 underline-offset-2 hover:text-slate-400"
            >
              Pexels
            </a>
          </p>

          {suggestionLine ? (
            <p className="mt-4 border-t border-[#1e1e1e] pt-4 text-center text-[11px] leading-relaxed text-slate-500">
              {suggestionLine}
            </p>
          ) : null}
        </div>

        {isMobile ? (
          <div className="shrink-0 border-t border-[#1e1e1e] bg-[#0d0d0d] p-4 safe-padded">
            <button
              type="button"
              disabled={!mobilePickId}
              onClick={() => mobilePickId && pickFormat(mobilePickId)}
              className="btn-vws-primary w-full min-h-[48px] rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Choisir ce format
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
