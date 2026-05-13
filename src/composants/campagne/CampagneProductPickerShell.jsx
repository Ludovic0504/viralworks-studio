import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
import "./ModaleChoixFormatVideo.css";

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
 * Enveloppe portal / studioOverlay identique à `ModaleChoixFormatVideo` (≤640 bottom sheet).
 */
export default function CampagneProductPickerShell({
  open,
  onClose,
  presentation = "portal",
  titleId,
  title,
  subtitle,
  children,
}) {
  const isMobile = useIsMobileSheet();
  const isNarrowOverlay = useMatchMedia(NARROW_OVERLAY_QUERY);
  const panelRef = useRef(null);

  const isMobilePicker = presentation === "studioOverlay" ? true : isMobile;
  const bottomSheetNarrow = Boolean(isNarrowOverlay && isMobilePicker);

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

  const handleBackdrop = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose?.();
    },
    [onClose]
  );

  if (!open) return null;

  const header = (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#1e2845] px-3 py-3 md:px-5 md:py-4">
      <div className="min-w-0">
        <h2 id={titleId} className="text-[15px] font-bold tracking-tight text-white md:text-base">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] leading-snug text-[#8a8f9a] md:text-xs">{subtitle}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onClose?.()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#1e2845] bg-[#161d2e] px-2.5 py-1.5 text-[12px] text-[#8a8f9a] hover:text-white md:px-3"
      >
        <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Retour
      </button>
    </div>
  );

  const scrollClass = bottomSheetNarrow
    ? "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-[11px] py-3"
    : isMobilePicker
      ? "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:px-5 md:py-5"
      : "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:px-5 md:py-5";

  const panneauInner = (
    <>
      {bottomSheetNarrow ? (
        <div className="mx-auto mb-1.5 mt-2.5 h-1 w-9 shrink-0 rounded-[2px] bg-[#2a3560]" aria-hidden />
      ) : null}
      {header}
      <div className={scrollClass}>{children}</div>
    </>
  );

  const panneau = (
    <div
      className={
        bottomSheetNarrow || isMobilePicker
          ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
          : "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      }
    >
      {panneauInner}
    </div>
  );

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
        ? "vws-format-panel-desktop relative z-[101] flex max-h-[85vh] w-[90vw] max-w-[520px] flex-col overflow-hidden rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] shadow-2xl"
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
        className={`${sheetOrPanelClass} flex flex-col overflow-hidden bg-[#0d0d0d]`}
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
