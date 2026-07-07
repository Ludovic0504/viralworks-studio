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

function getDaysUntilTrialEnd(cycleEndsAt) {
  if (!cycleEndsAt) return 0;
  const endMs = new Date(cycleEndsAt).getTime();
  if (!Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.ceil((endMs - Date.now()) / (1000 * 60 * 60 * 24)));
}

export default function BandeauRenouvellementQuotaImageStudio({
  limit,
  mode = "monthly",
  cycleEndsAt = null,
}) {
  const [dismissed, setDismissed] = useState(() => wasImageStudioRenewalNoticeDismissed());

  if (!limit) return null;

  if (mode === "trial") {
    const daysLeft = getDaysUntilTrialEnd(cycleEndsAt);
    if (daysLeft <= 0) return null;
    const dayWord = daysLeft > 1 ? "jours" : "jour";
    const endLabel = cycleEndsAt
      ? formatImageStudioQuotaResetDate(new Date(cycleEndsAt))
      : "bientôt";

    return (
      <div
        className="mx-4 mb-2 flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.08] px-3 py-2.5 sm:mx-6 lg:mx-8"
        role="status"
      >
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-emerald-100/90">
          Essai gratuit : <strong className="font-semibold text-emerald-50">{limit} images</strong>{" "}
          jusqu&apos;au <strong className="font-semibold text-emerald-50">{endLabel}</strong>
          {daysLeft > 0 ? (
            <>
              {" "}
              (dans {daysLeft} {dayWord})
            </>
          ) : null}
          .
        </p>
      </div>
    );
  }

  if (dismissed || !isImageStudioQuotaRenewalNoticePeriod()) {
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
