import { useEffect, useState } from "react";
import { useAuth } from "@/contexte/FournisseurAuth";
import {
  readCachedPremiumAccess,
  resolvePremiumAccess,
  PREMIUM_ACCESS_UPDATED_EVENT,
  type PremiumAccessData,
  type UserPlan,
} from "@/bibliotheque/supabase/premiumAccess";

export type { UserPlan };

type PremiumState = PremiumAccessData & { loading: boolean };

const FREE_ACCESS: PremiumAccessData = {
  isSubscribed: false,
  isTester: false,
  hasAccess: false,
  plan: "free",
};

const LOADING_ACCESS: PremiumState = { ...FREE_ACCESS, loading: true };

function readCachedState(userId: string | undefined): PremiumState | null {
  const cached = readCachedPremiumAccess(userId);
  if (!cached) return null;
  return { ...cached, loading: false };
}

/** Précharge l'abonnement (ex. au survol du lien Image Studio). */
export function prefetchPremiumAccess(userId: string | undefined) {
  if (!userId) return;
  void resolvePremiumAccess(userId);
}

export function usePremiumAccess() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [state, setState] = useState<PremiumState>(() => {
    if (!userId) return { ...FREE_ACCESS, loading: false };
    return readCachedState(userId) ?? LOADING_ACCESS;
  });

  useEffect(() => {
    let active = true;

    if (!userId) {
      setState({ ...FREE_ACCESS, loading: false });
      return () => {
        active = false;
      };
    }

    const hit = readCachedState(userId);
    if (hit) {
      setState(hit);
      return () => {
        active = false;
      };
    }

    setState((prev) => (prev.loading ? prev : { ...prev, loading: true }));
    resolvePremiumAccess(userId).then((data) => {
      if (active) setState({ ...data, loading: false });
    });

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const onPremiumAccessUpdated = () => {
      setState((prev) => (prev.loading ? prev : { ...prev, loading: true }));
      void resolvePremiumAccess(userId).then((data) => {
        setState({ ...data, loading: false });
      });
    };

    window.addEventListener(PREMIUM_ACCESS_UPDATED_EVENT, onPremiumAccessUpdated);
    return () => {
      window.removeEventListener(PREMIUM_ACCESS_UPDATED_EVENT, onPremiumAccessUpdated);
    };
  }, [userId]);

  return state;
}
