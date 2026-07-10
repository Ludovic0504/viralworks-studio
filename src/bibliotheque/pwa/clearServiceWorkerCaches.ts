/** Désinstalle les SW et vide les caches Workbox (récupération après precache obsolète). */
export async function clearServiceWorkerAndCaches(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  if (registrations.length === 0) return false;

  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  return true;
}

const RECOVERY_FLAG = "vws_sw_recovery_pending";

export function markSwRecoveryPending(): void {
  try {
    sessionStorage.setItem(RECOVERY_FLAG, "1");
  } catch {
    // no-op
  }
}

export function clearSwRecoveryPending(): void {
  try {
    sessionStorage.removeItem(RECOVERY_FLAG);
  } catch {
    // no-op
  }
}

export function isSwRecoveryPending(): boolean {
  try {
    return sessionStorage.getItem(RECOVERY_FLAG) === "1";
  } catch {
    return false;
  }
}
