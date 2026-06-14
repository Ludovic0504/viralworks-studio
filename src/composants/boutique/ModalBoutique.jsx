import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import ContenuBoutique from "@/composants/boutique/ContenuBoutique";
import "./ModalBoutique.css";

export default function ModalBoutique({
  open,
  section = "subscription",
  paymentReturn = null,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const { documentElement: html, body } = document;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyWidth = body.style.width;
    const prevBodyTop = body.style.top;
    const prevBodyTouchAction = body.style.touchAction;
    const scrollY = window.scrollY;

    html.classList.add("boutique-modal-open");
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.width = "100%";
    body.style.top = `-${scrollY}px`;
    body.style.touchAction = "none";

    const preventTouchMove = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const scrollable = target?.closest?.(".boutique-modal-body");
      if (!scrollable) {
        event.preventDefault();
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("touchmove", preventTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      html.classList.remove("boutique-modal-open");
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.width = prevBodyWidth;
      body.style.top = prevBodyTop;
      body.style.touchAction = prevBodyTouchAction;
      document.removeEventListener("touchmove", preventTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      window.scrollTo(0, scrollY);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="boutique-modal-overlay flex bg-black/80 backdrop-blur-sm max-md:flex-col md:items-center md:justify-center md:p-6"
      onClick={() => onClose?.()}
      role="presentation"
    >
      <div
        className="boutique-modal-panel relative flex w-full min-w-0 max-w-5xl flex-col overflow-hidden border border-white/10 bg-[#0C1116] shadow-2xl max-md:rounded-none max-md:border-0 md:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-boutique-title"
      >
        <button
          type="button"
          onClick={() => onClose?.()}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#0C1116]/95 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200 md:right-4 md:top-4"
          aria-label="Fermer la boutique"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="boutique-modal-body flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 pb-3 pt-12 md:overflow-hidden md:px-6 md:pb-8 md:pt-14">
          <ContenuBoutique
            variant="modal"
            initialSection={section}
            initialPaymentReturn={paymentReturn}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
