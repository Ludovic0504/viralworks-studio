const MOBILE_MQ = "(max-width: 768px)";

const VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, viewport-fit=cover";

/** Marge autour de 100 % — iOS reporte parfois 1.01 / 0.99 sur visualViewport. */
const MIN_ZOOM_GUARD = 1.035;

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

function forceViewportReset(): void {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;

  if ((window.visualViewport?.scale ?? 1) < 1) {
    meta.setAttribute(
      "content",
      "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover",
    );
  }

  requestAnimationFrame(() => {
    meta.setAttribute("content", VIEWPORT_CONTENT);
    if ((window.visualViewport?.scale ?? 1) < 1) {
      window.scrollTo(0, 0);
    }
    requestAnimationFrame(refreshViewportMeta);
  });
}

/**
 * Limite le dézoom pinch sous 100 % sans bloquer le scroll vertical (1 doigt).
 * Ne jamais appeler preventDefault sur gesturestart : iOS désactive alors le scroll.
 */
export function initPreventMobileZoomOut(): () => void {
  if (typeof window === "undefined" || !shouldGuardMobileZoom()) {
    return () => {};
  }

  const blockAllPinch = isStandalonePwa();
  let lastPinchDistance = 0;
  let activePinch = false;
  let viewportResetTimer: ReturnType<typeof setTimeout> | null = null;

  const currentScale = () => window.visualViewport?.scale ?? 1;

  const scheduleViewportReset = () => {
    if (viewportResetTimer) clearTimeout(viewportResetTimer);
    viewportResetTimer = setTimeout(() => {
      viewportResetTimer = null;
      if (currentScale() < 1) forceViewportReset();
    }, 16);
  };

  const onVisualViewportChange = () => {
    if (currentScale() < 1) {
      forceViewportReset();
      scheduleViewportReset();
    }
  };

  const onGestureChange = (event: Event) => {
    const gesture = event as Event & { scale?: number };
    const scale = currentScale();
    if (scale < 1) {
      event.preventDefault();
      forceViewportReset();
      return;
    }
    if (
      scale <= MIN_ZOOM_GUARD &&
      typeof gesture.scale === "number" &&
      gesture.scale < 1
    ) {
      event.preventDefault();
    }
  };

  const onGestureEnd = () => {
    if (currentScale() < 1) forceViewportReset();
  };

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length >= 2) {
      activePinch = true;
      lastPinchDistance = touchDistance(event.touches);
    }
  };

  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length < 2) return;

    activePinch = true;
    const scale = currentScale();
    const distance = touchDistance(event.touches);

    if (scale < 1 || blockAllPinch) {
      event.preventDefault();
      lastPinchDistance = distance;
      return;
    }

    const pinchingOut = distance < lastPinchDistance - 1;
    if (scale <= MIN_ZOOM_GUARD && pinchingOut) {
      event.preventDefault();
    }

    lastPinchDistance = distance;
  };

  const onTouchEndHandler = (event: TouchEvent) => {
    if (event.touches.length >= 2) return;

    const hadPinch = activePinch || event.changedTouches.length >= 2;
    if (!hadPinch) return;

    activePinch = false;
    window.setTimeout(() => {
      if (currentScale() < 1) forceViewportReset();
    }, 32);
  };

  const capturePassiveFalse = { capture: true, passive: false as const };
  const capturePassiveTrue = { capture: true, passive: true as const };

  window.addEventListener("gesturechange", onGestureChange, capturePassiveFalse);
  window.addEventListener("gestureend", onGestureEnd, capturePassiveTrue);
  window.addEventListener("touchstart", onTouchStart, capturePassiveTrue);
  window.addEventListener("touchmove", onTouchMove, capturePassiveFalse);
  window.addEventListener("touchend", onTouchEndHandler, capturePassiveTrue);
  window.addEventListener("touchcancel", onTouchEndHandler, capturePassiveTrue);
  window.visualViewport?.addEventListener("resize", onVisualViewportChange);
  window.visualViewport?.addEventListener("scroll", onVisualViewportChange);

  return () => {
    window.removeEventListener("gesturechange", onGestureChange, capturePassiveFalse);
    window.removeEventListener("gestureend", onGestureEnd, capturePassiveTrue);
    window.removeEventListener("touchstart", onTouchStart, capturePassiveTrue);
    window.removeEventListener("touchmove", onTouchMove, capturePassiveFalse);
    window.removeEventListener("touchend", onTouchEndHandler, capturePassiveTrue);
    window.removeEventListener("touchcancel", onTouchEndHandler, capturePassiveTrue);
    window.visualViewport?.removeEventListener("resize", onVisualViewportChange);
    window.visualViewport?.removeEventListener("scroll", onVisualViewportChange);
    if (viewportResetTimer) clearTimeout(viewportResetTimer);
  };
}
