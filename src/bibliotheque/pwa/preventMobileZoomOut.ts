const MOBILE_MQ = "(max-width: 768px)";

const VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, viewport-fit=cover";

/** Écart minimal entre deux doigts pour considérer un vrai pinch (évite les faux positifs au scroll). */
const MIN_PINCH_SPAN_PX = 28;

const MIN_ZOOM_GUARD = 1.02;

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function shouldGuardMobileZoom(): boolean {
  if (typeof window === "undefined") return false;
  return isStandalonePwa() || window.matchMedia(MOBILE_MQ).matches;
}

function touchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function refreshViewportMeta(): void {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  meta.setAttribute("content", VIEWPORT_CONTENT);
}

/**
 * Bloque le dézoom pinch sous 100 % sans interférer avec le scroll à un doigt.
 * - Pas de gesturestart/gesturechange (iOS lie parfois ça au scroll).
 * - Pas d'écoute du scroll visualViewport (déclenché au scroll normal).
 * - Pas de scrollTo : ne remet jamais la page en haut.
 */
export function initPreventMobileZoomOut(): () => void {
  if (typeof window === "undefined" || !shouldGuardMobileZoom()) {
    return () => {};
  }

  const blockAllPinch = isStandalonePwa();
  let lastPinchDistance = 0;

  const currentScale = () => window.visualViewport?.scale ?? 1;

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 2) {
      lastPinchDistance = touchDistance(event.touches);
    }
  };

  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length !== 2) return;

    const distance = touchDistance(event.touches);
    if (distance < MIN_PINCH_SPAN_PX) return;

    const scale = currentScale();

    if (blockAllPinch || scale < 1) {
      event.preventDefault();
      lastPinchDistance = distance;
      return;
    }

    const pinchingOut = distance < lastPinchDistance - 2;
    if (scale <= MIN_ZOOM_GUARD && pinchingOut) {
      event.preventDefault();
    }

    lastPinchDistance = distance;
  };

  const onViewportResize = () => {
    if (currentScale() < 1) refreshViewportMeta();
  };

  document.addEventListener("touchstart", onTouchStart, { passive: true });
  document.addEventListener("touchmove", onTouchMove, { passive: false });
  window.visualViewport?.addEventListener("resize", onViewportResize);

  return () => {
    document.removeEventListener("touchstart", onTouchStart);
    document.removeEventListener("touchmove", onTouchMove);
    window.visualViewport?.removeEventListener("resize", onViewportResize);
  };
}
