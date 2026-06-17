import { useState } from "react";
import { X } from "lucide-react";
import {
  dismissImageStudioRenewalNotice,
  formatImageStudioQuotaResetDate,
  getDaysUntilImageStudioQuotaReset,
  getNextImageStudioQuotaResetDate,
  isImageStudioQuotaRenewalNoticePeriod,
  wasImageStudioRenewalNoticeDismissed,
} from "@/bibliotheque/imageStudio/imageStudioQuotaCycle";

export default function BandeauRenouvellementQuotaImageStudio({ limit }) {
  const [dismissed, setDismissed] = useState(() => wasImageStudioRenewalNoticeDismissed());

  if (dismissed || !isImageStudioQuotaRenewalNoticePeriod() || !limit) {
    return null;
  }

  const resetDate = getNextImageStudioQuotaResetDate();
  const resetLabel = formatImageStudioQuotaResetDate(resetDate);
  const daysLeft = getDaysUntilImageStudioQuotaReset();
  const dayWord = daysLeft > 1 ? "jours" : "jour";

  const handleDismiss = () => {
    dismissImageStudioRenewalNotice();
    setDismissed(true);
  };

  return (
    <div
      className="mx-4 mb-2 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.08] px-3 py-2.5 sm:mx-6 lg:mx-8"
      role="status"
    >
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-amber-100/90">
        Votre quota de <strong className="font-semibold text-amber-50">{limit} images</strong>{" "}
        se renouvelle le <strong className="font-semibold text-amber-50">{resetLabel}</strong>
        {daysLeft > 0 ? (
          <>
            {" "}
            (dans {daysLeft} {dayWord})
          </>
        ) : null}
        . Les images non utilisées ne sont pas reportées au mois suivant.
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-md p-1 text-amber-200/60 transition-colors hover:bg-amber-500/10 hover:text-amber-100"
        aria-label="Fermer l'avis de renouvellement"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
