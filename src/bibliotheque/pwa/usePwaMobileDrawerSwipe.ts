import { useEffect, useRef } from "react";
import { hasPwaBlockingOverlay } from "@/bibliotheque/pwa/pwaOverlayBlockers";
import { isPwaMobileShell } from "@/bibliotheque/pwa/isStandalonePwa";

const EDGE_WIDTH_PX = 32;
const MIN_SWIPE_PX = 56;
const MAX_VERTICAL_DRIFT_PX = 80;
const HORIZONTAL_DOMINANCE_PX = 8;

type Options = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Désactivé sur l'accueil — le swipe bord gauche ouvre le menu ailleurs. */
  openFromEdgeEnabled?: boolean;
  enabled?: boolean;
};

export function usePwaMobileDrawerSwipe({
  open,
  onOpen,
  onClose,
  openFromEdgeEnabled = true,
  enabled = true,
}: Options): void {
  const openRef = useRef(open);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const openFromEdgeRef = useRef(openFromEdgeEnabled);

  openRef.current = open;
  onOpenRef.current = onOpen;
  onCloseRef.current = onClose;
  openFromEdgeRef.current = openFromEdgeEnabled;

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

      if (!openFromEdgeRef.current || startX > EDGE_WIDTH_PX) return;
      tracking = true;
      fromEdge = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!tracking || !fromEdge || openRef.current) return;
      if (event.touches.length !== 1) return;

      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);

      if (dy > MAX_VERTICAL_DRIFT_PX) {
        tracking = false;
        fromEdge = false;
        return;
      }

      // Priorité au drawer : bloque le geste « retour » natif du navigateur.
      if (dx > HORIZONTAL_DOMINANCE_PX && dx > dy) {
        event.preventDefault();
      }
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
      fromEdge = false;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [enabled]);
}
