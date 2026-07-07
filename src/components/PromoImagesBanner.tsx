import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { useBoutiqueModal } from "@/contexte/ContexteModalBoutique";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { PROMO_NANOBANANA_OFFER } from "@/bibliotheque/promo/imagesPromo";

const BANNER_HEIGHT_VAR = "--promo-images-banner-height";

function setBannerHeight(px: number) {
  document.documentElement.style.setProperty(BANNER_HEIGHT_VAR, `${px}px`);
}

export default function PromoImagesBanner() {
  const { session, loading: authLoading } = useAuth();
  const { hasAccess, loading: premiumLoading } = usePremiumAccess();
  const { openAuthModal } = useRequireAuthAction();
  const { openBoutiqueModal } = useBoutiqueModal();
  const bannerRef = useRef<HTMLDivElement>(null);

  const isResolving = authLoading || (Boolean(session) && premiumLoading);
  const visible = !isResolving && !hasAccess;

  useEffect(() => {
    if (!visible) {
      setBannerHeight(0);
      return undefined;
    }

    const syncHeight = () => {
      const h = bannerRef.current?.offsetHeight ?? 0;
      setBannerHeight(h);
    };

    syncHeight();
    window.addEventListener("resize", syncHeight);
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(syncHeight)
        : null;
    if (bannerRef.current && observer) observer.observe(bannerRef.current);

    return () => {
      window.removeEventListener("resize", syncHeight);
      observer?.disconnect();
      setBannerHeight(0);
    };
  }, [visible]);

  if (!visible) return null;

  const handleCta = () => {
    if (session) {
      openBoutiqueModal("subscription");
    } else {
      openAuthModal();
    }
  };

  return (
    <div
      ref={bannerRef}
      className="fixed left-0 right-0 z-40 border-b border-black/10 bg-[#f5d84e] text-[#1a1400] max-md:top-[calc(4rem+var(--pwa-install-banner-height,0px))] md:top-16"
      role="region"
      aria-label="Offre ViralWorks Images"
    >
      <div className="mx-auto flex w-full min-w-0 max-w-7xl items-center px-4 py-2 sm:px-6 lg:px-8 md:justify-center md:py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:flex-none">
          <Sparkles
            className="hidden h-4 w-4 shrink-0 sm:block"
            strokeWidth={2.25}
            aria-hidden
          />
          <p className="min-w-0 flex-1 text-[11px] font-semibold leading-snug sm:text-sm md:flex-none">
            {PROMO_NANOBANANA_OFFER}
          </p>
          <button
            type="button"
            onClick={handleCta}
            className="shrink-0 rounded-md bg-[#1a1400] px-2.5 py-1.5 text-[10px] font-bold text-[#f5d84e] transition-opacity hover:opacity-90 sm:px-3 sm:text-xs"
          >
            {session ? "Essayer" : "Essai gratuit"}
          </button>
        </div>
      </div>
    </div>
  );
}
