import { useEffect, useState } from "react";
import { useAuth } from "@/contexte/FournisseurAuth";
import {
  fetchPremiumAccess,
  type UserPlan,
} from "@/bibliotheque/supabase/premiumAccess";

type AccessData = {
  isSubscribed: boolean;
  isTester: boolean;
  hasAccess: boolean;
  plan: UserPlan;
};

type PremiumState = AccessData & { loading: boolean };

const FREE_ACCESS: AccessData = {
  isSubscribed: false,
  isTester: false,
  hasAccess: false,
  plan: "free",
};

const LOADING_ACCESS: PremiumState = { ...FREE_ACCESS, loading: true };

let cached: { userId: string; data: AccessData } | null = null;
let inflight: { userId: string; promise: Promise<AccessData> } | null = null;

function resolvePremiumAccess(userId: string): Promise<AccessData> {
  if (cached?.userId === userId) {
    return Promise.resolve(cached.data);
  }
  if (inflight?.userId === userId) {
    return inflight.promise;
  }

  const promise = fetchPremiumAccess()
    .then((data) => {
      cached = { userId, data };
      return data;
    })
    .catch(() => FREE_ACCESS)
    .finally(() => {
      if (inflight?.userId === userId) inflight = null;
    });

  inflight = { userId, promise };
  return promise;
}

function readCachedAccess(userId: string | undefined): PremiumState | null {
  if (!userId || cached?.userId !== userId) return null;
  return { ...cached.data, loading: false };
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
    return readCachedAccess(userId) ?? LOADING_ACCESS;
  });

  useEffect(() => {
    let active = true;

    if (!userId) {
      setState({ ...FREE_ACCESS, loading: false });
      return () => {
        active = false;
      };
    }

    const hit = readCachedAccess(userId);
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

  return state;
}
