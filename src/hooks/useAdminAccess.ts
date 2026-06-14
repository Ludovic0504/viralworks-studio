import { useEffect, useState } from "react";
import { useAuth } from "@/contexte/FournisseurAuth";
import {
  readCachedAdminStatus,
  resolveAdminStatusForUser,
} from "@/bibliotheque/supabase/credits";

type AdminState = {
  isAdmin: boolean;
  loading: boolean;
};

const LOADING_STATE: AdminState = { isAdmin: false, loading: true };
const NOT_ADMIN: AdminState = { isAdmin: false, loading: false };

function readCachedState(userId: string | undefined): AdminState | null {
  const cached = readCachedAdminStatus(userId);
  if (cached === null) return null;
  return { isAdmin: cached, loading: false };
}

export function useAdminAccess() {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id;

  const [state, setState] = useState<AdminState>(() => {
    if (!userId) return NOT_ADMIN;
    return readCachedState(userId) ?? LOADING_STATE;
  });

  useEffect(() => {
    let active = true;

    if (authLoading) return () => {
      active = false;
    };

    if (!userId) {
      setState(NOT_ADMIN);
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

    setState((prev) => (prev.loading ? prev : LOADING_STATE));
    resolveAdminStatusForUser(userId).then((isAdmin) => {
      if (active) setState({ isAdmin, loading: false });
    });

    return () => {
      active = false;
    };
  }, [userId, authLoading]);

  return state;
}
