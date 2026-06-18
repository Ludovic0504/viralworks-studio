const MOBILE_MQ = "(max-width: 768px)";

const VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, viewport-fit=cover";

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
 * Bloque le dézoom pinch sous 100 % sans casser le scroll au doigt (1 touch).
 * iOS ignore minimum-scale : en PWA on bloque tout pinch ; en mobile web on
 * bloque seulement le pinch-out quand le zoom est déjà à 100 %.
 */
export function initPreventMobileZoomOut(): () => void {
  if (typeof window === "undefined" || !shouldGuardMobileZoom()) {
    return () => {};
  }

  const blockAllPinch = isStandalonePwa();
  let lastPinchDistance = 0;
  let viewportResetTimer: ReturnType<typeof setTimeout> | null = null;

  const currentScale = () => window.visualViewport?.scale ?? 1;

  const onGestureStart = (event: Event) => {
    if (blockAllPinch) event.preventDefault();
  };

  const onGestureChange = (event: Event) => {
    if (blockAllPinch) {
      event.preventDefault();
      return;
    }
    const gesture = event as Event & { scale?: number };
    if (
      currentScale() <= 1.02 &&
      typeof gesture.scale === "number" &&
      gesture.scale < 1
    ) {
      event.preventDefault();
    }
  };

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 2) {
      lastPinchDistance = touchDistance(event.touches);
    }
  };

  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length < 2) return;

    if (blockAllPinch) {
      event.preventDefault();
      return;
    }

    const distance = touchDistance(event.touches);
    if (distance < lastPinchDistance && currentScale() <= 1.02) {
      event.preventDefault();
    }
    lastPinchDistance = distance;
  };

  const scheduleViewportReset = () => {
    if (viewportResetTimer) clearTimeout(viewportResetTimer);
    viewportResetTimer = setTimeout(() => {
      viewportResetTimer = null;
      if (currentScale() < 1) refreshViewportMeta();
    }, 80);
  };

  const onVisualViewportChange = () => {
    if (currentScale() < 1) {
      refreshViewportMeta();
      scheduleViewportReset();
    }
  };

  document.addEventListener("gesturestart", onGestureStart, { passive: false });
  document.addEventListener("gesturechange", onGestureChange, { passive: false });
  document.addEventListener("touchstart", onTouchStart, { passive: true });
  document.addEventListener("touchmove", onTouchMove, { passive: false });
  window.visualViewport?.addEventListener("resize", onVisualViewportChange);

  return () => {
    document.removeEventListener("gesturestart", onGestureStart);
    document.removeEventListener("gesturechange", onGestureChange);
    document.removeEventListener("touchstart", onTouchStart);
    document.removeEventListener("touchmove", onTouchMove);
    window.visualViewport?.removeEventListener("resize", onVisualViewportChange);
    if (viewportResetTimer) clearTimeout(viewportResetTimer);
  };
}
