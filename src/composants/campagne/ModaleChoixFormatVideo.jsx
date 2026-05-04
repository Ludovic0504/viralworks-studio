import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PanneauChoixFormatVideo } from "./PanneauChoixFormatVideo.jsx";
import { VWS_VIDEO_FORMATS, VWS_VIDEO_FORMAT_CATEGORIES } from "@/bibliotheque/vwsVideoFormatsCatalog";
import { prefetchPexelsQueries } from "@/bibliotheque/pexelsFormatImages";
import "./ModaleChoixFormatVideo.css";

const MD_QUERY = "(max-width: 767px)";

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

/**
 * @param {'portal' | 'studioOverlay'} [presentation] — `studioOverlay` : panneau in-tree (ViralWorks mobile), sans portal
 */
export default function ModaleChoixFormatVideo({
  open,
  onClose,
  professionLabel,
  onConfirm,
  presentation = "portal",
}) {
  const titleId = useId();
  const isMobile = useIsMobileSheet();
  const [categoryId, setCategoryId] = useState(VWS_VIDEO_FORMAT_CATEGORIES[0]?.id ?? "produit");
  const [mobilePickId, setMobilePickId] = useState(null);
  const panelRef = useRef(null);

  const isMobilePicker = presentation === "studioOverlay" ? true : isMobile;

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
    if (presentation === "portal") {
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      if (presentation === "portal") {
        document.body.style.overflow = prev;
      }
    };
  }, [open, onClose, presentation]);

  const pickFormat = useCallback(
    (formatId) => {
      onConfirm?.(formatId);
      onClose?.();
    },
    [onConfirm, onClose]
  );

  const handleCardActivate = useCallback(
    (formatId) => {
      if (isMobilePicker) {
        setMobilePickId(formatId);
      } else {
        pickFormat(formatId);
      }
    },
    [isMobilePicker, pickFormat]
  );

  const handleBackdrop = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose?.();
    },
    [onClose]
  );

  if (!open) return null;

  const panneau = (
    <PanneauChoixFormatVideo
      titleId={titleId}
      professionLabel={professionLabel}
      categoryId={categoryId}
      onCategoryId={setCategoryId}
      mobilePickId={mobilePickId}
      isMobilePicker={isMobilePicker}
      onCardActivate={handleCardActivate}
      onPickFormat={pickFormat}
      onClose={onClose}
      showMobileFooter={isMobilePicker}
      gridClassName={
        presentation === "studioOverlay" ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5"
      }
    />
  );

  if (presentation === "studioOverlay") {
    return (
      <div
        ref={panelRef}
        className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden bg-[#0f1420]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {panneau}
      </div>
    );
  }

  if (typeof document === "undefined") return null;

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
        {panneau}
      </div>
    </div>,
    document.body
  );
}
