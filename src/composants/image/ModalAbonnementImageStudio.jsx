import { createPortal } from "react-dom";
import { ImageIcon, X } from "lucide-react";
import { useBoutiqueModal } from "@/contexte/ContexteModalBoutique";
import { IMAGE_STUDIO_TRIAL_OFFER } from "@/bibliotheque/promo/imagesPromo";

export default function ModalAbonnementImageStudio({ open, onClose }) {
  const { openBoutiqueModal } = useBoutiqueModal();

  if (!open) return null;

  const goSubscribe = () => {
    onClose();
    openBoutiqueModal("subscription");
  };

  return createPortal(
    <div
      className="image-studio-quota-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="image-studio-quota-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-studio-subscribe-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="image-studio-quota-modal-close"
          onClick={onClose}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="image-studio-subscribe-icon-wrap" aria-hidden>
          <ImageIcon className="h-8 w-8 text-[#2af598]" strokeWidth={1.75} />
        </div>

        <h2 id="image-studio-subscribe-title" className="image-studio-quota-title">
          Essaie Image Studio gratuitement
        </h2>
        <p className="image-studio-quota-message">
          {IMAGE_STUDIO_TRIAL_OFFER} — génère des visuels produits en 2K avec{" "}
          <strong className="font-semibold text-white">NanoBanana Pro</strong> et{" "}
          <strong className="font-semibold text-white">GPT 2.0</strong>.
        </p>
        <p className="image-studio-quota-hint">
          Décrivez votre scène, l&apos;IA s&apos;occupe du reste.
        </p>

        <div className="image-studio-quota-actions">
          <button
            type="button"
            className="image-studio-quota-cta-secondary"
            onClick={onClose}
          >
            Plus tard
          </button>
          <button type="button" className="image-studio-quota-cta" onClick={goSubscribe}>
            Démarrer mon essai gratuit
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
