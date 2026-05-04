import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/contexte/FournisseurAuth";
import {
  countUnreadPrivateMessages,
  hasNewPublicMessageSince,
} from "@/bibliotheque/supabase/communaute";

export const VWS_PUBLIC_LAST_SEEN_KEY = "vws_public_last_seen";

const CommunauteVWSNotifContext = createContext(null);

export function FournisseurCommunauteVWSNotif({ children }) {
  const { session } = useAuth();
  const uid = session?.user?.id;
  const [unreadPrivateCount, setUnreadPrivateCount] = useState(0);
  const [hasNewPublicSinceLastVisit, setHasNewPublicSinceLastVisit] = useState(false);

  const refreshUnreadPrivate = useCallback(async () => {
    if (!uid) {
      setUnreadPrivateCount(0);
      return;
    }
    try {
      const n = await countUnreadPrivateMessages();
      setUnreadPrivateCount(n);
    } catch {
      setUnreadPrivateCount(0);
    }
  }, [uid]);

  const refreshPublicIndicator = useCallback(async () => {
    if (!uid) {
      setHasNewPublicSinceLastVisit(false);
      return;
    }
    try {
      const raw =
        typeof localStorage !== "undefined" ? localStorage.getItem(VWS_PUBLIC_LAST_SEEN_KEY) : null;
      const hasNew = await hasNewPublicMessageSince(raw);
      setHasNewPublicSinceLastVisit(hasNew);
    } catch {
      setHasNewPublicSinceLastVisit(false);
    }
  }, [uid]);

  const markPublicTabVisited = useCallback(() => {
    try {
      localStorage.setItem(VWS_PUBLIC_LAST_SEEN_KEY, new Date().toISOString());
      setHasNewPublicSinceLastVisit(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshUnreadPrivate();
    void refreshPublicIndicator();
  }, [refreshUnreadPrivate, refreshPublicIndicator]);

  useEffect(() => {
    if (!uid) return undefined;
    const id = setInterval(() => {
      void refreshUnreadPrivate();
      void refreshPublicIndicator();
    }, 15000);
    return () => clearInterval(id);
  }, [uid, refreshUnreadPrivate, refreshPublicIndicator]);

  const value = useMemo(
    () => ({
      unreadPrivateCount,
      hasNewPublicSinceLastVisit,
      refreshUnreadPrivate,
      refreshPublicIndicator,
      markPublicTabVisited,
    }),
    [
      unreadPrivateCount,
      hasNewPublicSinceLastVisit,
      refreshUnreadPrivate,
      refreshPublicIndicator,
      markPublicTabVisited,
    ]
  );

  return (
    <CommunauteVWSNotifContext.Provider value={value}>{children}</CommunauteVWSNotifContext.Provider>
  );
}

export function useCommunauteVWSNotif() {
  const ctx = useContext(CommunauteVWSNotifContext);
  if (!ctx) {
    return {
      unreadPrivateCount: 0,
      hasNewPublicSinceLastVisit: false,
      refreshUnreadPrivate: async () => {},
      refreshPublicIndicator: async () => {},
      markPublicTabVisited: () => {},
    };
  }
  return ctx;
}
