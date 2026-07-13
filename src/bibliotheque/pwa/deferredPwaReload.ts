const PENDING_KEY = "vws_deferred_reload_pending";
const NAV_EVENT = "vws:deferred-pwa-reload-navigate";

type PendingReason = "build" | "sw";

type PendingState = {
  reason: PendingReason;
};

function readPending(): PendingState | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingState;
  } catch {
    return null;
  }
}

function writePending(reason: PendingReason) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ reason }));
  } catch {
    // no-op
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // no-op
  }
}

/** Indique qu'une mise à jour doit être appliquée au prochain moment discret. */
export function markDeferredPwaReload(reason: PendingReason): void {
  if (typeof window === "undefined") return;
  writePending(reason);
}

export function hasDeferredPwaReload(): boolean {
  return readPending() !== null;
}

function reloadNow() {
  clearPending();
  window.location.reload();
}

let listenersInstalled = false;

/** Recharge quand l'onglet est masqué ou à la prochaine navigation interne. */
export function installDeferredPwaReloadListeners(): void {
  if (typeof window === "undefined" || listenersInstalled) return;
  listenersInstalled = true;

  const tryReload = () => {
    if (!hasDeferredPwaReload()) return;
    reloadNow();
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      tryReload();
    }
  });

  window.addEventListener(NAV_EVENT, tryReload);
}

/** À appeler à chaque changement de route SPA. */
export function notifySpaNavigationForDeferredReload(): void {
  if (!hasDeferredPwaReload()) return;
  window.dispatchEvent(new Event(NAV_EVENT));
}

/** True si un service worker contrôlait déjà la page au chargement (mise à jour, pas 1ère install). */
export function hadServiceWorkerControllerOnLoad(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as Window & { __vwsHadSwController?: boolean }).__vwsHadSwController);
}

export function captureServiceWorkerControllerOnLoad(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const w = window as Window & { __vwsHadSwController?: boolean };
  if (w.__vwsHadSwController !== undefined) return;
  w.__vwsHadSwController = Boolean(navigator.serviceWorker.controller);
}
