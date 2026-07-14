import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { subscriptionPlanLabel } from "@/bibliotheque/supabase/subscriptionPlans";

export const CANCELLATION_REASONS = [
  { id: "too_expensive", label: "Trop cher pour mon usage" },
  { id: "not_using_enough", label: "Je n'utilise pas assez le service" },
  { id: "features_mismatch", label: "Les fonctionnalités ne me conviennent pas" },
  { id: "switching_tool", label: "Je passe à un autre outil" },
  { id: "quality_issues", label: "Problème technique ou qualité insuffisante" },
  { id: "other", label: "Autre raison" },
];

export default function ModalConfirmAnnulationAbonnement({
  open,
  onClose,
  currentPlanKey,
  currentPlanName,
  onConfirmCancel,
  cancelling = false,
}) {
  const [selectedReasonId, setSelectedReasonId] = useState("");
  const [customReason, setCustomReason] = useState("");

  useEffect(() => {
    if (!open) {
      setSelectedReasonId("");
      setCustomReason("");
    }
  }, [open]);

  if (!open) return null;

  const planLabel =
    currentPlanName || subscriptionPlanLabel(currentPlanKey) || "votre abonnement";
  const selectedReason = CANCELLATION_REASONS.find((r) => r.id === selectedReasonId);
  const customTrimmed = customReason.trim();
  const needsCustomText = selectedReasonId === "other";
  const canConfirm =
    Boolean(selectedReason) && (!needsCustomText || customTrimmed.length >= 3);

  const handleConfirm = () => {
    if (!canConfirm || cancelling) return;
    onConfirmCancel({
      reason: selectedReason.label,
      reasonId: selectedReasonId,
      reasonDetail: customTrimmed || undefined,
    });
  };

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

        <h2 id="cancel-subscription-title" className="image-studio-quota-title">
          Pourquoi arrêter {planLabel} ?
        </h2>
        <p className="image-studio-quota-message">
          Votre retour nous aide à améliorer ViralWorks. Choisissez une raison avant de
          confirmer.
        </p>

        <div className="mb-4 space-y-2 text-left">
          {CANCELLATION_REASONS.map((reason) => {
            const selected = selectedReasonId === reason.id;
            return (
              <button
                key={reason.id}
                type="button"
                disabled={cancelling}
                onClick={() => setSelectedReasonId(reason.id)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50 ${
                  selected
                    ? "border-violet-500/50 bg-violet-500/15 text-gray-100"
                    : "border-white/10 bg-white/[0.04] text-gray-300 hover:border-white/20 hover:bg-white/[0.06]"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    selected ? "border-violet-400 bg-violet-500" : "border-white/25"
                  }`}
                  aria-hidden
                >
                  {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                </span>
                <span>{reason.label}</span>
              </button>
            );
          })}
        </div>

        <label className="mb-4 block text-left">
          <span className="mb-1.5 block text-xs text-gray-400">
            {needsCustomText
              ? "Précisez votre raison (obligatoire)"
              : "Précisez si vous le souhaitez (optionnel)"}
          </span>
          <textarea
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            disabled={cancelling}
            rows={3}
            maxLength={500}
            placeholder="Votre message…"
            className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
        </label>

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
            className="image-studio-quota-cta-secondary !border-red-500/30 !text-red-300 hover:!bg-red-500/10 disabled:opacity-40"
            onClick={handleConfirm}
            disabled={cancelling || !canConfirm}
          >
            {cancelling ? "Annulation…" : "Confirmer"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
