import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { useBoutiqueModal } from "@/contexte/ContexteModalBoutique";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { PROMO_ACQUISITION_IMAGES } from "@/bibliotheque/promo/imagesPromo";
import {
  hasSeenPromoVariant,
  isPromoModalSuppressed,
  markPromoVariantSeen,
  PROMO_LOGOUT_SUPPRESS_EVENT,
  PROMO_OPEN_REQUEST_EVENT,
  type PromoModalVariant,
} from "@/bibliotheque/promo/promoModalGate";

type Variant = PromoModalVariant;

const DELAY_MS = 1000;

function hasSeenVariant(variant: Variant): boolean {
  return hasSeenPromoVariant(variant);
}

function markVariantSeen(variant: Variant): void {
  markPromoVariantSeen(variant);
}

const CONTENT = {
  acquisition: {
    title: "Génère des visuels produits avec l'IA",
    subtitle:
      "Accède à Nanobanana Pro inclus dans ViralWorks Images — à partir de 9€/mois",
    cta: "Créer mon compte gratuitement",
    dismiss: "Explorer Image Studio d'abord",
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
  const location = useLocation();
  const promoSuppressed = isPromoModalSuppressed(location.pathname);
  const { session, loading: authLoading } = useAuth();
  const { hasAccess, loading: premiumLoading } = usePremiumAccess();
  const { openAuthModal, isAuthModalOpen } = useRequireAuthAction();
  const { openBoutiqueModal, isBoutiqueModalOpen } = useBoutiqueModal();

  const variant: Variant = session ? "conversion" : "acquisition";

  const [visible, setVisible] = useState(false);
  const [manualOpen, setManualOpen] = useState<Variant | null>(null);
  const pendingManualRef = useRef<Variant | null>(null);
  const [, setLogoutSuppressTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isResolving = authLoading || (Boolean(session) && premiumLoading);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Réagir immédiatement à la déconnexion (avant le prochain cycle du timer). */
  useEffect(() => {
    const onLogoutSuppress = () => {
      setLogoutSuppressTick((n) => n + 1);
      setVisible(false);
      setManualOpen(null);
      pendingManualRef.current = null;
      clearTimer();
    };
    window.addEventListener(PROMO_LOGOUT_SUPPRESS_EVENT, onLogoutSuppress);
    return () =>
      window.removeEventListener(PROMO_LOGOUT_SUPPRESS_EVENT, onLogoutSuppress);
  }, [clearTimer]);

  /** Ouverture explicite (bouton Générer Image Studio) — ignore les blocages « déjà vu ». */
  useEffect(() => {
    const onOpenRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ variant?: Variant }>).detail;
      const requested =
        detail?.variant ?? (session ? "conversion" : "acquisition");
      clearTimer();
      setVisible(false);
      if (isResolving) {
        pendingManualRef.current = requested;
        return;
      }
      setManualOpen(requested);
    };
    window.addEventListener(PROMO_OPEN_REQUEST_EVENT, onOpenRequest);
    return () =>
      window.removeEventListener(PROMO_OPEN_REQUEST_EVENT, onOpenRequest);
  }, [clearTimer, isResolving, session]);

  useEffect(() => {
    if (!pendingManualRef.current || isResolving) return;
    setManualOpen(pendingManualRef.current);
    pendingManualRef.current = null;
  }, [isResolving]);

  const closeModal = useCallback(
    (variantToMark: Variant, opts?: { manual?: boolean }) => {
      const isManual = opts?.manual ?? manualOpen !== null;
      if (isManual) {
        setManualOpen(null);
        return;
      }
      markVariantSeen(variantToMark);
      setVisible(false);
      clearTimer();
    },
    [clearTimer, manualOpen],
  );

  const goToImageStudio = useCallback(
    (variantToMark: Variant, isManual: boolean) => {
      closeModal(variantToMark, { manual: isManual });
      if (location.pathname !== "/image-studio") {
        navigate("/image-studio");
      }
    },
    [closeModal, navigate, location.pathname],
  );

  const showAutoModal =
    !manualOpen &&
    !promoSuppressed &&
    !isResolving &&
    !hasAccess &&
    !hasSeenVariant(variant) &&
    visible;

  const showManualModal = manualOpen !== null && !isResolving;
  const isModalOpen = showAutoModal || showManualModal;

  useEffect(() => {
    if (!isModalOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal(manualOpen ?? variant, { manual: manualOpen !== null });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isModalOpen, closeModal, manualOpen, variant]);

  /** Après connexion : réinitialiser pour relancer le timer conversion (1 s). */
  useEffect(() => {
    setVisible(false);
    setManualOpen(null);
    pendingManualRef.current = null;
    clearTimer();
  }, [session?.user?.id, clearTimer]);

  /** Masquer immédiatement sur les routes auth (ex. lien email de confirmation). */
  useEffect(() => {
    if (!promoSuppressed) return;
    setVisible(false);
    clearTimer();
  }, [promoSuppressed, clearTimer]);

  useEffect(() => {
    if (manualOpen || promoSuppressed || isResolving || hasAccess || hasSeenVariant(variant)) {
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
    manualOpen,
    promoSuppressed,
    isResolving,
    hasAccess,
    variant,
    isAuthModalOpen,
    isBoutiqueModalOpen,
    visible,
    clearTimer,
    session?.user?.id,
  ]);

  if ((!showAutoModal && !showManualModal) || isResolving || (hasAccess && !manualOpen)) {
    return null;
  }
  if (typeof document === "undefined") return null;

  const displayVariant = manualOpen ?? variant;
  const isAcquisition = displayVariant === "acquisition";
  const { title, subtitle, cta, dismiss: dismissLabel } = CONTENT[displayVariant];

  const handleCta = () => {
    if (displayVariant === "acquisition") {
      if (!manualOpen) markVariantSeen("acquisition");
      setManualOpen(null);
      setVisible(false);
      clearTimer();
      openAuthModal();
      return;
    }
    closeModal("conversion", { manual: manualOpen !== null });
    openBoutiqueModal("subscription");
  };

  const handleClose = () => closeModal(displayVariant, { manual: manualOpen !== null });

  return createPortal(
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center bg-black/70 px-4 py-6"
      onClick={handleClose}
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

        {!isAcquisition ? (
          <span className="mb-4 inline-block rounded bg-[#2af598] px-2 py-0.5 text-xs font-semibold text-black">
            Nouveau
          </span>
        ) : null}

        <h2
          id="promo-images-title"
          className="mb-3 text-xl font-bold text-white"
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
            onClick={() => goToImageStudio(displayVariant, manualOpen !== null)}
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
