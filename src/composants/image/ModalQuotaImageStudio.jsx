import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { getImageStudioQuotaState } from "@/bibliotheque/imageStudio/quotaAlerts";

export default function ModalQuotaImageStudio({ open, kind, count, limit, onClose }) {
  if (!open) return null;

  const state = getImageStudioQuotaState(count, limit);
  const isExhausted = kind === "exhausted";
  const title = isExhausted
    ? "Crédits épuisés"
    : "Générations ralenties";
  const message = isExhausted
    ? "Vous avez utilisé tous vos crédits Image Studio pour ce mois. Le quota se réinitialise au début du mois prochain."
    : `Vous avez utilisé ${state.used} images ce mois-ci. Les générations suivantes peuvent prendre un peu plus de temps.`;

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
            <div
              className={`image-studio-quota-battery-fill${isExhausted ? " is-empty" : ""}`}
              style={{ width: `${isExhausted ? 0 : state.remainingPercent}%` }}
            />
            {!isExhausted ? (
              <span className="image-studio-quota-battery-label">
                {state.remainingPercent}%
              </span>
            ) : null}
          </div>
        </div>

        <h2 id="image-studio-quota-title" className="image-studio-quota-title">
          {title}
        </h2>
        <p className="image-studio-quota-message">{message}</p>
        <p className="image-studio-quota-hint">1 image générée = 1 crédit</p>

        <button
          type="button"
          className="image-studio-quota-cta"
          onClick={onClose}
        >
          Compris
        </button>
      </div>
    </div>,
    document.body,
  );
}
