import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { getImageStudioQuotaState } from "@/bibliotheque/imageStudio/quotaAlerts";
import { IMAGE_STUDIO_TRIAL_QUOTA } from "@/bibliotheque/supabase/planQuotas";

export default function ModalQuotaImageStudio({ open, kind, count, limit, mode = "monthly", onClose }) {
  if (!open) return null;

  const state = getImageStudioQuotaState(count, limit);
  const isExhausted = kind === "exhausted";
  const isTrial = mode === "trial";
  const remaining = state.remaining;
  const imageLabel = remaining > 1 ? "images" : "image";
  const title = isExhausted
    ? "Quota d'images épuisé"
    : "Attention à votre consommation";
  const message = isExhausted
    ? isTrial
      ? `Vous avez utilisé vos ${IMAGE_STUDIO_TRIAL_QUOTA} images d'essai. Passez à ViralWorks Image pour continuer à générer.`
      : "Vous avez utilisé toutes vos images Image Studio pour ce mois. Le quota se réinitialise le 1er du mois prochain, sans report des images non utilisées."
    : isTrial
      ? `Il ne vous reste plus que ${remaining} ${imageLabel} pendant votre essai (${state.remainingPercent} %).`
      : `Il ne vous reste plus que ${remaining} ${imageLabel} ce mois-ci (${state.remainingPercent} %). Pensez à répartir vos générations jusqu'au prochain renouvellement.`;

  const batteryFillClass = isExhausted
    ? " is-empty"
    : state.remainingPercent <= 20
      ? " is-low"
      : state.remainingPercent <= 60
        ? " is-warning"
        : "";

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
        aria-labelledby="image-studio-quota-title"
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

        <div className="image-studio-quota-battery-wrap" aria-hidden>
          <div className="image-studio-quota-battery">
            <div className={`image-studio-quota-battery-fill${batteryFillClass}`} />
          </div>
        </div>

        <h2 id="image-studio-quota-title" className="image-studio-quota-title">
          {title}
        </h2>
        <p className="image-studio-quota-message">{message}</p>

        <div className="image-studio-quota-actions">
          <button type="button" className="image-studio-quota-cta" onClick={onClose}>
            Compris
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
