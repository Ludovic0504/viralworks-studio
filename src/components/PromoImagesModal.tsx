import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { useBoutiqueModal } from "@/contexte/ContexteModalBoutique";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { PROMO_ACQUISITION_IMAGES } from "@/bibliotheque/promo/imagesPromo";

type Variant = "acquisition" | "conversion";

const STORAGE_KEYS: Record<Variant, string> = {
  acquisition: "vw_images_promo_seen_acquisition",
  conversion: "vw_images_promo_seen_conversion",
};

const DELAY_MS = 1000;

function hasSeenVariant(variant: Variant): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEYS[variant]) === "1";
  } catch {
    return false;
  }
}

function markVariantSeen(variant: Variant): void {
  try {
    sessionStorage.setItem(STORAGE_KEYS[variant], "1");
  } catch {
    // no-op
  }
}

const CONTENT = {
  acquisition: {
    title: "Génère des visuels produits avec l'IA",
    subtitle:
      "Accède à Nanobanana Pro inclus dans ViralWorks Images — à partir de 9€/mois",
    cta: "Créer mon compte gratuitement",
    dismiss: "Continuer sur le site",
  },
  conversion: {
    title: "ViralWorks Images est disponible",
    subtitle:
      "Génère des visuels produits illimités avec Nanobanana Pro — 9€/mois",
    cta: "Découvrir l'offre",
    dismiss: "Explorer Image Studio d'abord",
  },
} as const;

export default function PromoImagesModal() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { hasAccess, loading: premiumLoading } = usePremiumAccess();
  const { openAuthModal, isAuthModalOpen } = useRequireAuthAction();
  const { openBoutiqueModal, isBoutiqueModalOpen } = useBoutiqueModal();

  const variant: Variant = session ? "conversion" : "acquisition";

  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isResolving = authLoading || (Boolean(session) && premiumLoading);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(
    (variantToMark: Variant) => {
      markVariantSeen(variantToMark);
      setVisible(false);
      clearTimer();
      if (variantToMark === "conversion") {
        navigate("/image-studio");
      }
    },
    [clearTimer, navigate],
  );

  /** Après connexion : réinitialiser pour relancer le timer conversion (1 s). */
  useEffect(() => {
    setVisible(false);
    clearTimer();
  }, [session?.user?.id, clearTimer]);

  useEffect(() => {
    if (isResolving || hasAccess || hasSeenVariant(variant)) {
      return;
    }

    if (isAuthModalOpen || isBoutiqueModalOpen) {
      return;
    }

    if (visible) return;

    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, DELAY_MS);

    return clearTimer;
  }, [
    isResolving,
    hasAccess,
    variant,
    isAuthModalOpen,
    isBoutiqueModalOpen,
    visible,
    clearTimer,
    session?.user?.id,
  ]);

  useEffect(() => {
    if (!visible) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss(variant);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, dismiss, variant]);

  if (isResolving || hasAccess || !visible) return null;
  if (typeof document === "undefined") return null;

  const { title, subtitle, cta, dismiss: dismissLabel } = CONTENT[variant];
  const isAcquisition = variant === "acquisition";

  const handleCta = () => {
    if (variant === "acquisition") {
      markVariantSeen("acquisition");
      setVisible(false);
      clearTimer();
      openAuthModal();
      return;
    }
    dismiss("conversion");
    openBoutiqueModal("subscription");
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center bg-black/70 px-4 py-6"
      onClick={() => dismiss(variant)}
      role="presentation"
    >
      <div
        className={`relative w-full rounded-2xl border border-white/[0.08] bg-[#0d0d0d] p-6 sm:p-8 ${
          isAcquisition ? "max-w-[520px]" : "max-w-[480px]"
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-images-title"
      >
        {isAcquisition ? (
          <button
            type="button"
            onClick={() => dismiss(variant)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fermer et continuer sur le site"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}

        {isAcquisition ? (
          <div className="mb-5 grid grid-cols-3 gap-2">
            {PROMO_ACQUISITION_IMAGES.map((image) => (
              <div
                key={image.src}
                className="aspect-[3/4] overflow-hidden rounded-lg border border-white/[0.08] bg-black/40"
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  className="h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                />
              </div>
            ))}
          </div>
        ) : null}

        <span className="mb-4 inline-block rounded bg-[#2af598] px-2 py-0.5 text-xs font-semibold text-black">
          Nouveau
        </span>

        <h2
          id="promo-images-title"
          className="mb-3 pr-8 text-xl font-bold text-white"
        >
          {title}
        </h2>

        <p className="mb-6 text-sm leading-relaxed text-white/60">{subtitle}</p>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleCta}
            className="w-full rounded-lg bg-[#2af598] py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            {cta}
          </button>
          <button
            type="button"
            onClick={() => dismiss(variant)}
            className="text-sm text-white/40 transition-colors hover:text-white/60"
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
