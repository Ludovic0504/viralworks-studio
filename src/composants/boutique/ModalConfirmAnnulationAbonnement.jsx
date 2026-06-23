import { createPortal } from "react-dom";
import { AlertTriangle, Crown, X } from "lucide-react";
import {
  getAlternativeSubscriptionPlans,
  subscriptionPlanLabel,
} from "@/bibliotheque/supabase/subscriptionPlans";

export default function ModalConfirmAnnulationAbonnement({
  open,
  onClose,
  currentPlanKey,
  currentPlanName,
  onConfirmCancel,
  onChooseAlternativePlan,
  cancelling = false,
}) {
  if (!open) return null;

  const planLabel =
    currentPlanName || subscriptionPlanLabel(currentPlanKey) || "votre abonnement";
  const alternatives = getAlternativeSubscriptionPlans(currentPlanKey);

  return createPortal(
    <div
      className="image-studio-quota-modal-backdrop cancel-subscription-modal-backdrop"
      role="presentation"
      onClick={cancelling ? undefined : onClose}
    >
      <div
        className="image-studio-quota-modal max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-subscription-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="image-studio-quota-modal-close"
          onClick={onClose}
          disabled={cancelling}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
          <AlertTriangle className="h-6 w-6 text-red-400" strokeWidth={1.75} />
        </div>

        <h2 id="cancel-subscription-title" className="image-studio-quota-title">
          Arrêter votre abonnement ?
        </h2>
        <p className="image-studio-quota-message">
          Vous êtes sur le point d&apos;annuler{" "}
          <strong className="font-semibold text-white">{planLabel}</strong>.
          Votre accès restera actif jusqu&apos;à la fin de la période en cours, puis
          l&apos;abonnement s&apos;arrêtera définitivement.
        </p>

        {alternatives.length > 0 ? (
          <div className="mb-4 rounded-xl border border-violet-500/25 bg-violet-500/5 p-3 text-left">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-violet-200">
              <Crown className="h-3.5 w-3.5 shrink-0" />
              Votre formule ne vous convient pas ?
            </p>
            <p className="mb-3 text-xs leading-relaxed text-gray-400">
              Vous pouvez changer de plan sans résilier : l&apos;abonnement actuel sera
              remplacé automatiquement.
            </p>
            <ul className="space-y-2">
              {alternatives.map((plan) => (
                <li key={plan.id}>
                  <button
                    type="button"
                    disabled={cancelling}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition-colors hover:border-violet-500/30 hover:bg-violet-500/10 disabled:opacity-50"
                    onClick={() => onChooseAlternativePlan(plan.id)}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-100">
                        {plan.name}
                      </span>
                      <span className="block text-xs text-gray-400">{plan.summary}</span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-violet-300">
                      {plan.priceLabel}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="image-studio-quota-actions">
          <button
            type="button"
            className="image-studio-quota-cta"
            onClick={onClose}
            disabled={cancelling}
          >
            Garder mon abonnement
          </button>
          <button
            type="button"
            className="image-studio-quota-cta-secondary !border-red-500/30 !text-red-300 hover:!bg-red-500/10"
            onClick={onConfirmCancel}
            disabled={cancelling}
          >
            {cancelling ? "Annulation…" : "Confirmer l'arrêt de l'abonnement"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
