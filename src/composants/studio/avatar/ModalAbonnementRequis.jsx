import { useEffect } from "react";
import { X } from "lucide-react";
import Button from "@/composants/interface/Bouton";
import { useBoutiqueModal } from "@/contexte/ContexteModalBoutique";

export default function ModalAbonnementRequis({ open, onClose }) {
  const { openBoutiqueModal } = useBoutiqueModal();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const dismiss = () => onClose?.();

  const goToShop = () => {
    dismiss();
    openBoutiqueModal("subscription");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 px-5 py-4 backdrop-blur-sm sm:p-4"
      onClick={dismiss}
      role="presentation"
    >
      <div
        className="studio-panel relative w-full max-w-md p-5 sm:p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-abonnement-requis-title"
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>

        <h2
          id="modal-abonnement-requis-title"
          className="pr-8 text-lg font-semibold text-gray-100"
        >
          Fonctionnalité réservée aux membres
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          La génération d&apos;avatars IA est disponible uniquement avec un abonnement.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={dismiss} className="w-full sm:w-auto">
            Fermer
          </Button>
          <Button variant="primary" onClick={goToShop} className="w-full sm:w-auto">
            Voir les abonnements
          </Button>
        </div>
      </div>
    </div>
  );
}
