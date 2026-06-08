import { getUserProfile } from "./profil";
import { getUserSubscription } from "./stripe";

export async function fetchPremiumAccess(): Promise<{
  isSubscribed: boolean;
  isTester: boolean;
  hasAccess: boolean;
}> {
  const [sub, profile] = await Promise.all([getUserSubscription(), getUserProfile()]);
  const isSubscribed = Boolean(sub);
  const isTester = profile?.is_tester === true;
  return { isSubscribed, isTester, hasAccess: isSubscribed || isTester };
}
