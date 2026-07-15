import { createPortal } from "react-dom";
import { ImageIcon, X } from "lucide-react";
import { useT } from "@/contexte/FournisseurLocale";
import { useBoutiqueModal } from "@/contexte/ContexteModalBoutique";
import { IMAGE_STUDIO_TRIAL_OFFER } from "@/bibliotheque/promo/imagesPromo";

export default function ModalAbonnementImageStudio({ open, onClose }) {
  const t = useT();
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
          aria-label={t("common.close")}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="image-studio-subscribe-icon-wrap" aria-hidden>
          <ImageIcon className="h-8 w-8 text-[#2af598]" strokeWidth={1.75} />
        </div>

        <h2 id="image-studio-subscribe-title" className="image-studio-quota-title">
          {t("imageStudio.subscribeTitle")}
        </h2>
        <p className="image-studio-quota-message">
          {t("imageStudio.subscribeMessage", { offer: IMAGE_STUDIO_TRIAL_OFFER })}
        </p>
        <p className="image-studio-quota-hint">
          {t("imageStudio.subscribeHint")}
        </p>

        <div className="image-studio-quota-actions">
          <button
            type="button"
            className="image-studio-quota-cta-secondary"
            onClick={onClose}
          >
            {t("imageStudio.subscribeLater")}
          </button>
          <button type="button" className="image-studio-quota-cta" onClick={goSubscribe}>
            {t("imageStudio.subscribeCta")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
