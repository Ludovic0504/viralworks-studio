import { registerSW } from "virtual:pwa-register";

/**
 * Mise à jour PWA automatique : le boot inline (index.html) migre les vieux caches ;
 * autoUpdate + skipWaiting rechargent les onglets à chaque nouveau déploiement.
 */
export function initPwaRegistration(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

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
