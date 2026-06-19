import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { isStandalonePwa } from "@/bibliotheque/pwa/isStandalonePwa";

const PwaNavigationContext = createContext(null);

export function PwaNavigationProvider({ children, onBackGesture }) {
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  const nestedBackRef = useRef(null);
  const onBackGestureRef = useRef(onBackGesture);

  pathnameRef.current = location.pathname;
  onBackGestureRef.current = onBackGesture;

  const setNestedBackHandler = useCallback((handler) => {
    nestedBackRef.current = handler;
  }, []);

  useEffect(() => {
    if (!isStandalonePwa()) return;
    document.documentElement.classList.add("pwa-standalone");
    return () => document.documentElement.classList.remove("pwa-standalone");
  }, []);

  useEffect(() => {
    if (!isStandalonePwa()) return;
    if (nestedBackRef.current) return;

    window.history.replaceState(
      { ...(window.history.state ?? {}), vwsAnchor: location.pathname },
      "",
      window.location.href,
    );
  }, [location.pathname]);

  useEffect(() => {
    if (!isStandalonePwa()) return;

    const onPopState = () => {
      const nestedBack = nestedBackRef.current;
      if (nestedBack) {
        nestedBack();
        return;
      }

      // Swipe retour / bouton back → ouvrir le menu (sauf accueil) au lieu de quitter.
      onBackGestureRef.current?.();

      window.history.pushState(
        { vwsAnchor: pathnameRef.current },
        "",
        window.location.href,
      );
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <PwaNavigationContext.Provider value={{ setNestedBackHandler }}>
      {children}
    </PwaNavigationContext.Provider>
  );
}

export function usePwaNestedBack(active, onBack) {
  const ctx = useContext(PwaNavigationContext);
  const onBackRef = useRef(onBack);
  const pushedRef = useRef(false);

  onBackRef.current = onBack;

  useEffect(() => {
    if (!ctx || !isStandalonePwa() || !active) {
      pushedRef.current = false;
      ctx?.setNestedBackHandler(null);
      return;
    }

    const handler = () => {
      onBackRef.current?.();
    };

    ctx.setNestedBackHandler(handler);

    if (!window.history.state?.vwsNested) {
      window.history.pushState(
        { ...(window.history.state ?? {}), vwsNested: true },
        "",
        window.location.href,
      );
    }
    pushedRef.current = true;

    return () => {
      ctx.setNestedBackHandler(null);
      pushedRef.current = false;
    };
  }, [active, ctx]);
}

/** Fermeture explicite (bouton UI) d'une vue imbriquée en PWA. */
export function pwaNestedBackViaHistory() {
  if (!isStandalonePwa()) return false;
  window.history.back();
  return true;
}
