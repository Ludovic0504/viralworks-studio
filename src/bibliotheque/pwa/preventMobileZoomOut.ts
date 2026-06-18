const MOBILE_MQ = "(max-width: 768px)";

const VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, viewport-fit=cover";

function shouldGuardMobileZoom(): boolean {
  if (typeof window === "undefined") return false;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  return standalone || window.matchMedia(MOBILE_MQ).matches;
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

/** iOS Safari / PWA ignore souvent minimum-scale — bloque le pinch-out sous 100 %. */
export function initPreventMobileZoomOut(): () => void {
  if (typeof window === "undefined" || !shouldGuardMobileZoom()) {
    return () => {};
  }

  let lastPinchDistance = 0;
  let viewportResetTimer: ReturnType<typeof setTimeout> | null = null;

  const onGestureChange = (event: Event) => {
    const gesture = event as Event & { scale?: number };
    const viewportScale = window.visualViewport?.scale ?? 1;
    if (
      viewportScale <= 1.02 &&
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

    const distance = touchDistance(event.touches);
    const scale = window.visualViewport?.scale ?? 1;

    if (distance < lastPinchDistance && scale <= 1.02) {
      event.preventDefault();
    }

    lastPinchDistance = distance;
  };

  const scheduleViewportReset = () => {
    if (viewportResetTimer) clearTimeout(viewportResetTimer);
    viewportResetTimer = setTimeout(() => {
      viewportResetTimer = null;
      if ((window.visualViewport?.scale ?? 1) < 1) {
        refreshViewportMeta();
      }
    }, 80);
  };

  const onVisualViewportChange = () => {
    if ((window.visualViewport?.scale ?? 1) < 1) {
      refreshViewportMeta();
      scheduleViewportReset();
    }
  };

  document.addEventListener("gesturechange", onGestureChange, { passive: false });
  document.addEventListener("touchstart", onTouchStart, { passive: true });
  document.addEventListener("touchmove", onTouchMove, { passive: false });
  window.visualViewport?.addEventListener("resize", onVisualViewportChange);
  window.visualViewport?.addEventListener("scroll", onVisualViewportChange);

  return () => {
    document.removeEventListener("gesturechange", onGestureChange);
    document.removeEventListener("touchstart", onTouchStart);
    document.removeEventListener("touchmove", onTouchMove);
    window.visualViewport?.removeEventListener("resize", onVisualViewportChange);
    window.visualViewport?.removeEventListener("scroll", onVisualViewportChange);
    if (viewportResetTimer) clearTimeout(viewportResetTimer);
  };
}
