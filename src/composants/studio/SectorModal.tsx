import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { capturePostHog } from "@/bibliotheque/posthog/client";
import { SECTORS, getIntentFromSecteur, getSectorLabelForDisplay } from "@/bibliotheque/sectorDefaults";

type SectorModalProps = {
  open: boolean;
  onComplete: (secteur: string) => Promise<void> | void;
};

export default function SectorModal({ open, onComplete }: SectorModalProps) {
  const titleId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autre, setAutre] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ label: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  const autreTrim = autre.trim();
  const effectiveValue = autreTrim.length > 0 ? autreTrim : selectedId;
  const canContinue = Boolean(effectiveValue) && !submitting;

  const handleContinue = useCallback(async () => {
    if (!canContinue || !effectiveValue) return;
    setSubmitting(true);
    try {
      const label = autreTrim ? autreTrim : selectedId ? getSectorLabelForDisplay(selectedId) : effectiveValue;
      const intent = getIntentFromSecteur(effectiveValue);
      capturePostHog("intent_selected", {
        intent,
        secteur: effectiveValue,
        source: "onboarding_modal",
      });
      setSuccess({ label });
      await new Promise((r) => setTimeout(r, 720));
      await onComplete(effectiveValue);
    } catch (e) {
      console.error(e);
      setSuccess(null);
      alert(e instanceof Error ? e.message : "Impossible d'enregistrer le secteur.");
    } finally {
      setSubmitting(false);
      setSuccess(null);
    }
  }, [autreTrim, canContinue, effectiveValue, onComplete, selectedId]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4 animate-[vwsSectorFade_.3s_ease_both]"
      style={{
        background: "rgba(4, 6, 10, 0.88)",
        backdropFilter: "blur(18px) saturate(1.2)",
        WebkitBackdropFilter: "blur(18px) saturate(1.2)",
      }}
      role="presentation"
    >
      <style>{`
        @keyframes vwsSectorFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes vwsSectorSlideUp {
          from { opacity: 0; transform: translateY(28px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes vwsSectorCardIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes vwsSectorPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>

      <div
        className="relative w-full max-w-[720px] max-h-[calc(100vh-48px)] overflow-y-auto rounded-[24px] border border-white/[0.07] shadow-[0_40px_120px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)] animate-[vwsSectorSlideUp_.35s_cubic-bezier(.22,.68,0,1.2)_both] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ background: "#0e1318" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute left-0 right-0 top-0 h-px rounded-t-[24px] opacity-60"
          style={{
            background: "linear-gradient(90deg, transparent, #1DDBA0, #4B9FFF, transparent)",
          }}
        />

        <div className="relative z-[1] px-5 py-7 sm:px-9 sm:py-9">
          <div className="mb-7 text-center">
            <div className="mb-5 inline-flex items-center gap-[7px] rounded-[30px] border border-[rgba(29,219,160,0.2)] bg-[rgba(29,219,160,0.08)] py-[5px] pl-2.5 pr-3.5">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#1DDBA0] shadow-[0_0_8px_#1DDBA0] animate-[vwsSectorPulse_2s_ease_infinite]"
                aria-hidden
              />
              <span
                className="font-[Syne,sans-serif] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1DDBA0]"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                ViralWorks Studio
              </span>
            </div>
            <h1
              id={titleId}
              className="font-sans mb-2.5 text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#f0f4f8] sm:text-[26px]"
            >
              Tu travailles dans
              <br />
              quel <span className="text-[#1DDBA0]">secteur</span> ?
            </h1>
            <p
              className="text-sm font-normal leading-relaxed text-[rgba(240,244,248,0.5)]"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              On adapte l&apos;outil à ton activité dès maintenant.
              <br />
              Tu pourras changer ça dans ton profil à tout moment.
            </p>
          </div>

          <div className="mb-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {SECTORS.map((s, i) => {
              const selected = selectedId === s.id && !autreTrim;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(s.id);
                    setAutre("");
                  }}
                  className={[
                    "relative overflow-hidden rounded-2xl border px-3 py-4 text-center transition-all duration-[180ms]",
                    "animate-[vwsSectorCardIn_.4s_cubic-bezier(.22,.68,0,1.1)_both]",
                    selected
                      ? "border-[#1DDBA0] bg-[rgba(29,219,160,0.12)] shadow-[0_0_0_1px_rgba(29,219,160,0.15)]"
                      : "border-white/[0.07] bg-[#131920] hover:-translate-y-0.5 hover:border-[rgba(32,220,180,0.4)] hover:bg-[#171f29]",
                  ].join(" ")}
                  style={{
                    animationDelay: `${0.04 * (i + 1)}s`,
                  }}
                >
                  <span
                    className={`mb-2.5 block text-[28px] leading-none transition-transform duration-200 ${
                      selected ? "scale-[1.08]" : "group-hover:scale-110"
                    }`}
                    aria-hidden
                  >
                    {s.icon}
                  </span>
                  <span
                    className={`relative z-[1] text-xs font-bold leading-snug tracking-[0.01em] ${
                      selected ? "text-[#1DDBA0]" : "text-[#f0f4f8]"
                    }`}
                    style={{ fontFamily: "'Syne', sans-serif" }}
                  >
                    {s.label}
                  </span>
                  <span
                    className={`absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#1DDBA0] transition-all ${
                      selected ? "scale-100 opacity-100" : "scale-50 opacity-0"
                    }`}
                    aria-hidden
                  >
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="text-[#050e0a]">
                      <path d="M1 4.5L3.5 7L8 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className="mb-6 flex animate-[vwsSectorCardIn_.4s_cubic-bezier(.22,.68,0,1.1)_both] items-center gap-2.5"
            style={{ animationDelay: "0.36s" }}
          >
            <input
              type="text"
              value={autre}
              onChange={(e) => {
                setAutre(e.target.value);
                if (e.target.value.trim()) setSelectedId(null);
              }}
              placeholder="Autre secteur (précise en quelques mots)…"
              className="min-w-0 flex-1 rounded-xl border border-white/[0.07] bg-[#131920] px-4 py-3 text-[13px] text-[#f0f4f8] outline-none transition-colors placeholder:text-[rgba(240,244,248,0.28)] focus:border-[rgba(29,219,160,0.35)]"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>

          <div
            className="mt-6 flex animate-[vwsSectorCardIn_.4s_cubic-bezier(.22,.68,0,1.1)_both] flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: "0.42s" }}
          >
            <p
              className="text-xs text-[rgba(240,244,248,0.28)]"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              <strong className="font-medium text-[rgba(240,244,248,0.5)]">Astuce :</strong> tu peux affiner plus
              tard dans l&apos;étape Campagne.
            </p>
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => void handleContinue()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-none bg-[#1DDBA0] px-6 py-3.5 text-[13px] font-bold text-[#050e0a] shadow-[0_4px_20px_rgba(29,219,160,0.25)] transition-all disabled:cursor-not-allowed disabled:opacity-[0.35] disabled:shadow-none enabled:hover:-translate-y-px enabled:hover:opacity-90 enabled:hover:shadow-[0_8px_28px_rgba(29,219,160,0.35)]"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Continuer
              <ChevronRight className="h-4 w-4 transition-transform group-enabled:hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        <div
          className={`absolute inset-0 z-[5] flex flex-col items-center justify-center gap-4 rounded-[24px] bg-[#0e1318] transition-opacity duration-300 ${
            success ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-live="polite"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#1DDBA0] bg-[rgba(29,219,160,0.12)] text-[28px]">
            🚀
          </div>
          <p className="text-center text-xl font-extrabold text-[#f0f4f8]" style={{ fontFamily: "'Syne', sans-serif" }}>
            C&apos;est noté !
          </p>
          <p className="max-w-sm px-6 text-center text-sm text-[rgba(240,244,248,0.5)]">{success?.label}</p>
          <span className="rounded-[30px] border border-[rgba(29,219,160,0.3)] bg-[rgba(29,219,160,0.12)] px-4 py-1.5 text-sm font-medium text-[#1DDBA0]">
            {success?.label}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
