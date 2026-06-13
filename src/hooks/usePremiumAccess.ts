import { useEffect, useState } from "react";
import { useAuth } from "@/contexte/FournisseurAuth";
import {
  fetchPremiumAccess,
  type UserPlan,
} from "@/bibliotheque/supabase/premiumAccess";

const NO_ACCESS = {
  isSubscribed: false,
  isTester: false,
  hasAccess: false,
  plan: "free" as UserPlan,
  loading: true,
};

export function usePremiumAccess() {
  const { session } = useAuth();
  const [state, setState] = useState(NO_ACCESS);

  useEffect(() => {
    let active = true;

    if (!session?.user?.id) {
      setState({
        isSubscribed: false,
        isTester: false,
        hasAccess: false,
        plan: "free",
        loading: false,
      });
      return () => {
        active = false;
      };
    }

    setState((prev) => ({ ...prev, loading: true }));
    fetchPremiumAccess()
      .then((r) => {
        if (active) setState({ ...r, loading: false });
      })
      .catch(() => {
        if (active) {
          setState({
            isSubscribed: false,
            isTester: false,
            hasAccess: false,
            plan: "free",
            loading: false,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  return state;
}
