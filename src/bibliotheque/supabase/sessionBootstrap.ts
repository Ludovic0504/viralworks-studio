import { getUserProfile, readCachedUserProfile } from "./profil";
import { getProfilCreditsSnapshot } from "./credits";
import { getUserSubscriptionDetails } from "./stripe";
import { prefetchPremiumAccessData } from "./premiumAccess";
import { prefetchAdminDashboard } from "./adminDashboardCache";

let bootstrappedUserId: string | null = null;

/**
 * Précharge une fois les données session partagées (profil, wallet, abo, premium).
 * Appelé dès que la session est prête — évite la « ruée » de requêtes dupliquées au mount.
 */
export function bootstrapSessionData(userId: string | null | undefined): void {
  if (!userId || bootstrappedUserId === userId) return;
  bootstrappedUserId = userId;

  const cachedProfile = readCachedUserProfile(userId);
  if (String(cachedProfile?.role || "").toLowerCase() === "admin") {
    prefetchAdminDashboard();
  }

  void getUserProfile(userId)
    .then((profile) => {
      if (String(profile?.role || "").toLowerCase() === "admin") {
        prefetchAdminDashboard();
      }
    })
    .catch(() => {})
    .finally(() => {
      void Promise.all([
        getProfilCreditsSnapshot(userId),
        getUserSubscriptionDetails({ userId }),
        prefetchPremiumAccessData(userId),
      ]).catch(() => {
        bootstrappedUserId = null;
      });
    });
}

export function resetSessionBootstrap(userId?: string | null): void {
  if (!userId || bootstrappedUserId === userId) {
    bootstrappedUserId = null;
  }
}
