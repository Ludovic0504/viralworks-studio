import { useEffect, useRef, useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { useT } from "@/contexte/FournisseurLocale";
import { PROMO_ACQUISITION_IMAGES } from "@/bibliotheque/promo/imagesPromo";

const STEP_MS = 4200;
const STEP_COUNT = 3;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function StepDots({ step, onSelect, labels }) {
  return (
    <div className="flex items-center gap-1.5" role="tablist" aria-label={labels.group}>
      {labels.items.map((label, i) => {
        const active = i === step;
        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={label}
            onClick={() => onSelect(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              active ? "w-5 bg-[#1adfb0]" : "w-1.5 bg-white/20 hover:bg-white/35"
            }`}
          />
        );
      })}
    </div>
  );
}

/** Noyau : prompt libre → Générer */
function FreePromptStep({ t }) {
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">
        {t("promo.teaserStepFree")}
      </p>
      <div className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-3.5 py-3">
        <p className="text-[13px] leading-snug text-white/75">{t("promo.teaserFreePrompt")}</p>
      </div>
      <div className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-gradient-to-b from-[#1adfb0] via-[#00c896] to-[#009e75] px-3.5 py-2 text-[12px] font-bold text-white shadow-[0_0_16px_rgba(0,200,150,0.28)]">
        {t("promo.teaserGenerate")}
      </div>
    </div>
  );
}

/** Bonus : PromptAssist via /promptassist */
function PromptAssistStep({ t }) {
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">
        {t("promo.teaserStepAssist")}
      </p>
      <div className="flex flex-col gap-2.5">
        <div className="ml-auto max-w-[90%] rounded-xl rounded-tr-md border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[13px] leading-snug text-white/70">
          <span className="font-semibold text-[#1adfb0]">/promptassist</span>
          <span className="text-white/45"> — </span>
          {t("promo.teaserAssistUser")}
        </div>
        <div className="max-w-[94%] rounded-xl rounded-tl-md border border-[rgba(0,200,150,0.22)] bg-[rgba(0,200,150,0.08)] px-3.5 py-2.5 text-[12px] leading-snug text-white/70">
          {t("promo.teaserAssistReply")}
        </div>
        <div className="mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-lg bg-[#00c896]/15 px-3 py-1.5 text-[12px] font-bold text-[#1adfb0]">
          <Wand2 className="h-3.5 w-3.5" aria-hidden />
          {t("promo.teaserUsePrompt")}
        </div>
      </div>
    </div>
  );
}

function ResultStep({ t, src, alt }) {
  return (
    <div className="flex h-full items-stretch gap-3.5">
      <div className="relative min-w-0 flex-[1.1] overflow-hidden rounded-xl border border-[rgba(0,200,150,0.22)] shadow-[0_14px_32px_rgba(0,0,0,0.5)]">
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          draggable={false}
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-8">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/85">
            {t("promo.teaserStepResult")}
          </span>
        </div>
      </div>
      <div className="hidden min-w-0 flex-1 flex-col justify-center gap-2.5 sm:flex">
        <p className="text-[14px] leading-snug text-white/65">{t("promo.teaserPunchline")}</p>
        <p className="text-[12px] text-white/32">{t("promo.teaserExtrasLine")}</p>
      </div>
    </div>
  );
}

/**
 * Carte Image Studio — noyau = prompt libre, puis PromptAssist en option, puis résultat.
 */
export default function AccueilImageStudioTeaser() {
  const t = useT();
  const reducedMotion = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const result = PROMO_ACQUISITION_IMAGES[1] || PROMO_ACQUISITION_IMAGES[0];

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (reducedMotion) {
      setStep(2);
      return undefined;
    }
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      setStep((s) => (s + 1) % STEP_COUNT);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  const stepLabels = {
    group: t("promo.teaserStepsAria"),
    items: [t("promo.teaserStepFree"), t("promo.teaserStepAssist"), t("promo.teaserStepResult")],
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a0e14]/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/50">
          <Sparkles className="h-3.5 w-3.5 text-[#1adfb0]/80" aria-hidden />
          {t("promo.teaserCardTitle")}
        </span>
        <StepDots step={step} onSelect={setStep} labels={stepLabels} />
      </div>

      <div className="relative h-[220px] px-4 py-3.5 sm:h-[248px] sm:px-5 sm:py-4">
        <div
          className={`absolute inset-4 transition-all duration-500 ease-out sm:inset-5 ${
            step === 0 ? "z-[1] translate-y-0 opacity-100" : "pointer-events-none z-0 translate-y-1 opacity-0"
          }`}
        >
          <FreePromptStep t={t} />
        </div>
        <div
          className={`absolute inset-4 transition-all duration-500 ease-out sm:inset-5 ${
            step === 1 ? "z-[1] translate-y-0 opacity-100" : "pointer-events-none z-0 translate-y-1 opacity-0"
          }`}
        >
          <PromptAssistStep t={t} />
        </div>
        <div
          className={`absolute inset-4 transition-all duration-500 ease-out sm:inset-5 ${
            step === 2 ? "z-[1] translate-y-0 opacity-100" : "pointer-events-none z-0 translate-y-1 opacity-0"
          }`}
        >
          <ResultStep t={t} src={result.src} alt={result.alt} />
        </div>
      </div>
    </div>
  );
}
