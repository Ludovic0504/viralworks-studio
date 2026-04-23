import { useState, useMemo, useEffect } from "react";
import {
  Shirt,
  Coffee,
  PenLine,
  RectangleHorizontal,
  Gift,
  Loader2,
  X,
} from "lucide-react";
import { getEnabledWelcomeGifts } from "@welcome-gifts";
import { submitWelcomeGiftChoice } from "@/bibliotheque/supabase/stripe";

const GIFT_ICON = {
  tshirt: Shirt,
  hoodie: null,
  mug: Coffee,
  mousepad: RectangleHorizontal,
  pen: PenLine,
};

const GIFT_FALLBACK_EMOJI = {
  hoodie: "🧥",
};

export default function ModalCadeauBienvenue({ open, onConfirmed, onClose }) {
  const choices = useMemo(() => getEnabledWelcomeGifts(), []);
  const [selected, setSelected] = useState(() => choices[0]?.id ?? "");
  const [selectedSize, setSelectedSize] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const selectedGift = choices.find((c) => c.id === selected) || null;
  const selectedGiftSizes = selectedGift?.availableSizes || [];

  useEffect(() => {
    if (!open) return;
    const first = choices[0]?.id ?? "";
    if (first && !choices.some((c) => c.id === selected)) {
      setSelected(first);
    }
  }, [open, choices, selected]);

  useEffect(() => {
    if (!selectedGiftSizes.length) {
      setSelectedSize("");
      return;
    }
    if (!selectedGiftSizes.includes(selectedSize)) {
      setSelectedSize(selectedGiftSizes[0]);
    }
  }, [selected, selectedSize, selectedGiftSizes]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (!selected) return;
    if (selectedGiftSizes.length > 0 && !selectedSize) {
      setErr("Choisis une taille pour ce vêtement.");
      return;
    }
    setSubmitting(true);
    setErr("");
    const { error } = await submitWelcomeGiftChoice(
      selected,
      selectedGiftSizes.length > 0 ? selectedSize : undefined
    );
    setSubmitting(false);
    if (error) {
      setErr(error);
      return;
    }
    onConfirmed?.();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cadeau-bienvenue-titre"
    >
      <div className="w-full max-w-lg rounded-2xl border border-violet-500/30 bg-[#14141f] shadow-2xl shadow-violet-900/20 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-3 mb-2">
            <button
              type="button"
              onClick={() => onClose?.()}
              className="ml-auto -mr-2 -mt-2 w-8 h-8 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/10 transition-colors flex items-center justify-center"
              aria-label="Fermer"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center">
              <Gift className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <h2 id="cadeau-bienvenue-titre" className="text-xl font-bold text-gray-100">
                Un cadeau t’attend
              </h2>
              <p className="text-sm text-gray-400">
                Paiement validé — choisis ton article de bienvenue.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 max-h-[min(60vh,420px)] overflow-y-auto">
          {choices.length === 0 ? (
            <p className="text-sm text-gray-400 text-center">
              Aucun article disponible pour le moment.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {choices.map((opt) => {
                const Icon = GIFT_ICON[opt.id];
                const emoji = GIFT_FALLBACK_EMOJI[opt.id];
                const isSel = selected === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelected(opt.id)}
                    className={`flex flex-col items-center text-center rounded-xl border p-4 transition-all ${
                      isSel
                        ? "border-violet-500 bg-violet-500/15 ring-1 ring-violet-500/50"
                        : "border-white/10 bg-white/[0.04] hover:border-white/20"
                    }`}
                  >
                    <div
                      className={`w-14 h-14 rounded-xl mb-3 flex items-center justify-center ${
                        isSel ? "bg-violet-500/25 text-violet-200" : "bg-white/5 text-gray-300"
                      }`}
                    >
                      {Icon ? (
                        <Icon className="w-7 h-7" strokeWidth={1.75} />
                      ) : emoji ? (
                        <span className="text-3xl leading-none" aria-hidden>
                          {emoji}
                        </span>
                      ) : (
                        <Gift className="w-7 h-7 opacity-60" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-100 leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedGiftSizes.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm text-gray-300 mb-2">Choisis ta taille</p>
              <div className="flex flex-wrap gap-2">
                {selectedGiftSizes.map((size) => {
                  const active = selectedSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                        active
                          ? "border-violet-500 bg-violet-500/20 text-violet-200"
                          : "border-white/15 bg-white/5 text-gray-200 hover:border-white/30"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {err ? (
            <p className="mt-4 text-sm text-red-400 text-center" role="alert">
              {err}
            </p>
          ) : null}
        </div>

        <div className="px-6 py-4 border-t border-white/10 bg-black/20">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !selected || choices.length === 0}
            className="w-full py-3 rounded-xl font-semibold bg-violet-500 hover:bg-violet-600 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Envoi en cours…
              </>
            ) : (
              "Valider mon choix"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
