import { useEffect } from "react";
import { X } from "lucide-react";
import ContenuBoutique from "@/composants/boutique/ContenuBoutique";

export default function ModalBoutique({ open, section = "subscription", onClose }) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.documentElement.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-black/80 px-4 py-6 sm:px-6 sm:py-10 backdrop-blur-sm"
      onClick={() => onClose?.()}
      role="presentation"
    >
      <div
        className="relative w-full max-w-5xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0C1116] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-boutique-title"
      >
        <button
          type="button"
          onClick={() => onClose?.()}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#0C1116]/95 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200"
          aria-label="Fermer la boutique"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="px-4 pb-6 pt-4 sm:px-6 sm:pb-8">
          <ContenuBoutique variant="modal" initialSection={section} />
        </div>
      </div>
    </div>
  );
}
