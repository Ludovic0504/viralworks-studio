import { registerSW } from "virtual:pwa-register";
import { showPwaUpdateToast } from "@/bibliotheque/pwa/pwaUpdateToast";

/** Fenêtre après chargement document où un reload auto est acceptable (navigation fraîche). */
const FRESH_NAV_WINDOW_MS = 10_000;

const pageLoadAt = typeof performance !== "undefined" ? performance.now() : 0;

type UpdateSwFn = (reloadPage?: boolean) => Promise<void>;

let updateSw: UpdateSwFn | null = null;
let pendingRefresh = false;
let forceReloadOnNextRefresh = false;

export function isFreshDocumentNavigation(): boolean {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get("payment") === "success") return true;

  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (nav?.type === "navigate" || nav?.type === "reload") return true;

  return performance.now() - pageLoadAt < FRESH_NAV_WINDOW_MS;
}

function shouldAutoReloadOnRefresh(): boolean {
  return forceReloadOnNextRefresh || isFreshDocumentNavigation();
}

function applyPwaRefresh(reloadPage: boolean): void {
  if (!updateSw) return;
  if (reloadPage) showPwaUpdateToast();
  void updateSw(reloadPage);
}

/** Enregistre le SW (mode prompt) avec reload auto uniquement sur navigation fraîche. */
export function initPwaRegistration(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  updateSw = registerSW({
    immediate: true,
    onNeedRefresh() {
      pendingRefresh = true;
      if (shouldAutoReloadOnRefresh()) {
        applyPwaRefresh(true);
      }
    },
    onRegistered(registration) {
      void registration?.update();
    },
  });
}

/**
 * Vérifie une mise à jour SW (ex. retour Stripe).
 * Si `forceReload` et un worker en attente existe, active la nouvelle version tout de suite.
 */
export async function requestPwaUpdateCheck(options?: {
  forceReload?: boolean;
  reason?: string;
}): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (options?.forceReload) {
    forceReloadOnNextRefresh = true;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) return;

    await registration.update();

    if (registration.waiting && (options?.forceReload || shouldAutoReloadOnRefresh())) {
      applyPwaRefresh(true);
      return;
    }

    if (pendingRefresh && shouldAutoReloadOnRefresh()) {
      applyPwaRefresh(true);
    }
  } catch {
    // no-op
  }
}
