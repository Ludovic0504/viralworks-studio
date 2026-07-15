import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useT } from "@/contexte/FournisseurLocale";
import { getImageStudioQuotaState } from "@/bibliotheque/imageStudio/quotaAlerts";
import { IMAGE_STUDIO_TRIAL_QUOTA } from "@/bibliotheque/supabase/planQuotas";

export default function ModalQuotaImageStudio({ open, kind, count, limit, mode = "monthly", onClose }) {
  const t = useT();
  if (!open) return null;

  const state = getImageStudioQuotaState(count, limit);
  const isExhausted = kind === "exhausted";
  const isTrial = mode === "trial";
  const remaining = state.remaining;
  const imageLabel =
    remaining > 1 ? t("imageStudio.imagePlural") : t("imageStudio.imageSingular");
  const title = isExhausted
    ? t("imageStudio.quotaExhaustedTitle")
    : t("imageStudio.quotaWarningTitle");
  const message = isExhausted
    ? isTrial
      ? t("imageStudio.quotaExhaustedTrial", { trialQuota: IMAGE_STUDIO_TRIAL_QUOTA })
      : t("imageStudio.quotaExhaustedMonthly")
    : isTrial
      ? t("imageStudio.quotaWarningTrial", {
          remaining,
          imageLabel,
          percent: state.remainingPercent,
        })
      : t("imageStudio.quotaWarningMonthly", {
          remaining,
          imageLabel,
          percent: state.remainingPercent,
        });

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
          aria-label={t("common.close")}
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
            {t("imageStudio.quotaGotIt")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
