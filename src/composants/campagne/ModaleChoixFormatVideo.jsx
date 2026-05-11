import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PanneauChoixFormatVideo } from "./PanneauChoixFormatVideo.jsx";
import { VWS_VIDEO_FORMATS, VWS_VIDEO_FORMAT_CATEGORIES } from "@/bibliotheque/vwsVideoFormatsCatalog";
import { prefetchPexelsQueries } from "@/bibliotheque/pexelsFormatImages";
import "./ModaleChoixFormatVideo.css";

/** Feuille mobile + footer « Choisir ce format » : aligné sur la zone « mobile » large (tablettes étroites incluses) */
const MD_QUERY = "(max-width: 1023px)";

const NARROW_OVERLAY_QUERY = "(max-width: 640px)";

function useMatchMedia(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = () => setMatches(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [query]);
  return matches;
}

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
  const isNarrowOverlay = useMatchMedia(NARROW_OVERLAY_QUERY);
  const [categoryId, setCategoryId] = useState(VWS_VIDEO_FORMAT_CATEGORIES[0]?.id ?? "produit");
  const [mobilePickId, setMobilePickId] = useState(null);
  const panelRef = useRef(null);

  const isMobilePicker = presentation === "studioOverlay" ? true : isMobile;
  const bottomSheetNarrow = Boolean(isNarrowOverlay && isMobilePicker);

  useEffect(() => {
    if (open) setMobilePickId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    prefetchPexelsQueries(
      VWS_VIDEO_FORMATS.map((f) => ({ query: f.pexelsQuery, photoIndex: f.pexelsPhotoIndex }))
    );
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    const lockBody =
      presentation === "portal" || (presentation === "studioOverlay" && isNarrowOverlay);
    if (lockBody) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      if (lockBody) {
        document.body.style.overflow = prev;
      }
    };
  }, [open, onClose, presentation, isNarrowOverlay]);

  const pickFormat = useCallback(
    (formatId) => {
      onConfirm?.(formatId);
      onClose?.();
    },
    [onConfirm, onClose]
  );

  /** ≤640px : un tap sur une carte confirme et ferme (pas de bouton pied). 641px–1023px : sélection + bouton. */
  const handleCardActivate = useCallback(
    (formatId) => {
      if (isMobilePicker && !isNarrowOverlay) {
        setMobilePickId(formatId);
      } else {
        pickFormat(formatId);
      }
    },
    [isMobilePicker, isNarrowOverlay, pickFormat]
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
      narrowMobileOverlay={isNarrowOverlay}
      bottomSheetNarrow={bottomSheetNarrow}
    />
  );

  /** ≤640px : backdrop + bottom sheet (78dvh), porté sur document.body en studio pour z-index viewport */
  const narrowBottomSheetChrome = (
    <>
      <div
        className="vws-format-bottom-backdrop fixed inset-0 z-[40]"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onMouseDown={handleBackdrop}
        role="presentation"
      />
      <div
        ref={panelRef}
        className="vws-format-bottom-sheet-panel fixed bottom-0 left-0 right-0 z-[41] flex h-[78dvh] flex-col overflow-hidden rounded-t-[20px] border-t border-[#1e2845] bg-[#0f1420]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {panneau}
      </div>
    </>
  );

  if (presentation === "studioOverlay") {
    if (isNarrowOverlay) {
      if (typeof document === "undefined") return null;
      return createPortal(narrowBottomSheetChrome, document.body);
    }
    return (
      <div
        ref={panelRef}
        className="absolute inset-0 z-20 flex h-full min-h-0 flex-col overflow-hidden bg-[#0f1420]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {panneau}
      </div>
    );
  }

  if (typeof document === "undefined") return null;

  const sheetOrPanelClass =
    isMobile && !isNarrowOverlay
      ? "vws-format-sheet-mobile fixed inset-x-0 bottom-0 top-0 z-[101] flex min-h-[100dvh] flex-col overflow-hidden rounded-t-2xl border border-[#1e1e1e] bg-[#0d0d0d] shadow-2xl"
      : !isMobile
        ? "vws-format-panel-desktop relative z-[101] flex max-h-[85vh] w-[90vw] max-w-[900px] flex-col overflow-hidden rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] shadow-2xl"
        : "";

  if (isMobile && isNarrowOverlay) {
    return createPortal(narrowBottomSheetChrome, document.body);
  }

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
