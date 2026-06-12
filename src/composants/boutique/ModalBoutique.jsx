import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import ContenuBoutique from "@/composants/boutique/ContenuBoutique";
import "./ModalBoutique.css";

export default function ModalBoutique({ open, section = "subscription", onClose }) {
  useEffect(() => {
    if (!open) return undefined;

    const { documentElement: html, body } = document;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyWidth = body.style.width;
    const prevBodyTop = body.style.top;
    const scrollY = window.scrollY;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.width = "100%";
    body.style.top = `-${scrollY}px`;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.width = prevBodyWidth;
      body.style.top = prevBodyTop;
      window.scrollTo(0, scrollY);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="boutique-modal-overlay fixed inset-0 z-[120] flex max-md:flex-col md:items-center md:justify-center md:p-6 bg-black/80 backdrop-blur-sm"
      onClick={() => onClose?.()}
      role="presentation"
    >
      <div
        className="boutique-modal-panel relative flex w-full min-w-0 max-w-5xl flex-col overflow-hidden border border-white/10 bg-[#0C1116] shadow-2xl max-md:h-full max-md:max-h-none max-md:rounded-none max-md:border-0 md:max-h-[min(90dvh,920px)] md:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-boutique-title"
      >
        <button
          type="button"
          onClick={() => onClose?.()}
          className="absolute right-3 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#0C1116]/95 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200 max-md:top-[max(0.5rem,env(safe-area-inset-top))] md:right-4 md:top-4"
          aria-label="Fermer la boutique"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="boutique-modal-body min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[calc(2.75rem+env(safe-area-inset-top,0px))] md:px-6 md:pb-8 md:pt-14">
          <ContenuBoutique variant="modal" initialSection={section} />
        </div>
      </div>
    </div>,
    document.body
  );
}
