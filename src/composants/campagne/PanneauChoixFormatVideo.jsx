import { useId, useMemo } from "react";
import { Film, Package, Smartphone, User, Wrench, X } from "lucide-react";
import {
  VWS_VIDEO_FORMAT_CATEGORIES,
  getFormatById,
  getFormatsByCategory,
} from "@/bibliotheque/vwsVideoFormatsCatalog";
import { getVwsMetierProfile } from "@/bibliotheque/vwsMetiersConfig";
import FormatCardVisual from "./FormatCardVisual.jsx";
import "./ModaleChoixFormatVideo.css";

const TAB_ICONS = {
  produit: Package,
  storytelling: Film,
  humain: User,
  process: Wrench,
  social: Smartphone,
};

/**
 * Corps partagé du choix de format (modale, feuille mobile, ou overlay studio in-tree).
 */
export function PanneauChoixFormatVideo({
  professionLabel,
  categoryId,
  onCategoryId,
  mobilePickId,
  isMobilePicker,
  onCardActivate,
  onPickFormat,
  onClose,
  titleId: titleIdProp,
  showHeader = true,
  scrollClassName,
  showMobileFooter = true,
  /** max-width 640px — styles inline colonne + footer sticky */
  narrowMobileOverlay = false,
  gridClassName = "grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5",
}) {
  const autoTitleId = useId();
  const titleId = titleIdProp ?? autoTitleId;
  const formats = getFormatsByCategory(categoryId);
  const resolvedScrollClassName =
    scrollClassName ??
    (isMobilePicker
      ? "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-[11px] py-[9px]"
      : "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:px-5 md:py-5");

  const stickyNarrow = Boolean(narrowMobileOverlay && isMobilePicker);

  const narrowScrollStyle = stickyNarrow
    ? {
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding: "9px 11px",
      }
    : undefined;

  const narrowFooterStyle = stickyNarrow
    ? {
        flexShrink: 0,
        padding: "10px 11px 20px",
        borderTop: "1px solid #1e2845",
        background: "#0f1420",
      }
    : undefined;

  const narrowRootStyle = stickyNarrow
    ? {
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        height: "100%",
        overflow: "hidden",
      }
    : undefined;

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

  return (
    <div
      className={
        stickyNarrow ? undefined : isMobilePicker
          ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
          : "contents"
      }
      style={narrowRootStyle}
    >
      {showHeader ? (
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1e1e1e] px-4 py-3 md:px-5 md:py-4 safe-padded"
          style={stickyNarrow ? { flexShrink: 0 } : undefined}
        >
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
      ) : null}

      <div
        className="shrink-0 border-b border-[#1e1e1e] px-2 md:px-4"
        style={stickyNarrow ? { flexShrink: 0 } : undefined}
      >
        <div className="vws-format-catbar flex gap-1 overflow-x-auto py-2 scrollbar-thin [-webkit-overflow-scrolling:touch]">
          {VWS_VIDEO_FORMAT_CATEGORIES.map((c) => {
            const active = c.id === categoryId;
            const TabIcon = TAB_ICONS[c.id] ?? Package;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onCategoryId?.(c.id)}
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

      <div
        className={stickyNarrow ? "min-h-0 flex-1 overflow-x-hidden" : resolvedScrollClassName}
        style={narrowScrollStyle}
      >
        <div className={gridClassName}>
          {formats.map((f) => {
            const selectedMobile =
              isMobilePicker && !narrowMobileOverlay && mobilePickId === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onCardActivate?.(f.id)}
                className={`group flex min-h-[48px] flex-col rounded-xl border bg-[#141414] p-2.5 text-left transition md:p-3 ${
                  selectedMobile
                    ? "border-[#2ecc9a] ring-1 ring-[#2ecc9a]/40"
                    : "border-[#1e1e1e] hover:border-white/20"
                }`}
              >
                <FormatCardVisual formatId={f.id} categoryId={f.categoryId} pexelsQuery={f.pexelsQuery} />
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

      {isMobilePicker && showMobileFooter ? (
        <div
          className="shrink-0 border-t border-[#171e30] bg-[#0f1420] px-[11px] pb-4 pt-[10px] safe-padded max-[640px]:hidden"
          style={narrowFooterStyle}
        >
          <button
            type="button"
            disabled={!mobilePickId}
            onClick={() => mobilePickId && onPickFormat?.(mobilePickId)}
            className="btn-vws-primary max-[640px]:hidden w-full min-h-[48px] rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Choisir ce format
          </button>
        </div>
      ) : null}
    </div>
  );
}
