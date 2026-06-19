import { useEffect, useRef } from "react";
import { hasPwaBlockingOverlay } from "@/bibliotheque/pwa/pwaOverlayBlockers";
import { isPwaMobileShell } from "@/bibliotheque/pwa/isStandalonePwa";

const EDGE_WIDTH_PX = 28;
const MIN_SWIPE_PX = 64;
const MAX_VERTICAL_DRIFT_PX = 72;

type Options = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  enabled?: boolean;
};

export function usePwaMobileDrawerSwipe({
  open,
  onOpen,
  onClose,
  enabled = true,
}: Options): void {
  const openRef = useRef(open);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);

  openRef.current = open;
  onOpenRef.current = onOpen;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled || !isPwaMobileShell()) return;

    let tracking = false;
    let fromEdge = false;
    let startX = 0;
    let startY = 0;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      if (hasPwaBlockingOverlay()) return;

      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;

      if (openRef.current) {
        tracking = true;
        fromEdge = false;
        return;
      }

      if (startX > EDGE_WIDTH_PX) return;
      tracking = true;
      fromEdge = true;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;

      const touch = event.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);
      if (dy > MAX_VERTICAL_DRIFT_PX) return;

      if (!openRef.current && fromEdge && dx >= MIN_SWIPE_PX) {
        onOpenRef.current();
        return;
      }

      if (openRef.current && dx <= -MIN_SWIPE_PX) {
        onCloseRef.current();
      }
    };

    const onTouchCancel = () => {
      tracking = false;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [enabled]);
}
