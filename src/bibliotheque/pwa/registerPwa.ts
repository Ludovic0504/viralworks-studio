import { registerSW } from "virtual:pwa-register";
import {
  captureServiceWorkerControllerOnLoad,
  hadServiceWorkerControllerOnLoad,
  installDeferredPwaReloadListeners,
  markDeferredPwaReload,
} from "@/bibliotheque/pwa/deferredPwaReload";

/**
 * Mise à jour PWA : le nouveau service worker s'installe en arrière-plan.
 * Le rechargement n'a lieu que lorsque l'onglet est masqué ou à la prochaine navigation.
 */
export function initPwaRegistration(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  captureServiceWorkerControllerOnLoad();
  installDeferredPwaReloadListeners();

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadServiceWorkerControllerOnLoad()) return;
    markDeferredPwaReload("sw");
  });

  registerSW({
    immediate: true,
    onRegistered(registration) {
      void registration?.update();
    },
  });
}

/** Complément au boot inline — retour Stripe. */
export async function requestPwaUpdateCheck(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    await registration?.update();
  } catch {
    // no-op
  }
}
