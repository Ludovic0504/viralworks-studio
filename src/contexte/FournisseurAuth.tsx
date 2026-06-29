import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import { invalidateAuthUserIdCache } from "@/bibliotheque/supabase/authSession";
import {
  bootstrapSessionData,
  resetSessionBootstrap,
} from "@/bibliotheque/supabase/sessionBootstrap";
import {
  clearAllViralWorksStudioPersistence,
  migrateLegacySessionStorageToLocal,
  setStudioScopedUserId,
  shouldResetStudioWorkflow,
  touchStudioWorkflowLease,
} from "@/bibliotheque/viralWorksStudioStorage";
import {
  capturePostHog,
  resetPostHogUser,
  syncPostHogUserFromSession,
} from "@/bibliotheque/posthog/client";
import { clearPromoLogoutSuppression, markHadAccountOnDevice, markPromoSuppressedOnLogout } from "@/bibliotheque/promo/promoModalGate";

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  supabase: SupabaseClient;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

const LAST_ACTIVITY_KEY = "onetool_last_activity";

function updateLastActivity() {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  } catch (error) {
    console.warn("Erreur lors de l'enregistrement de la dernière activité:", error);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const remember = useMemo(() => {
    try { return localStorage.getItem("onetool_oauth_remember") === "1"; }
    catch { return false; }
  }, []);


  const supabase = useMemo(() => getBrowserSupabase({ remember }), [remember]);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(false);
  const previousUserIdRef = useRef<string | null>(null);

  const handleStudioSessionForUser = useCallback((uid: string) => {
    setStudioScopedUserId(uid);
    migrateLegacySessionStorageToLocal(uid);
    if (shouldResetStudioWorkflow(uid)) {
      void clearAllViralWorksStudioPersistence(uid).then(() => {
        touchStudioWorkflowLease(uid);
      });
    } else {
      touchStudioWorkflowLease(uid);
    }
    previousUserIdRef.current = uid;
  }, []);

  useEffect(() => {
    if (!session) return;

    const updateActivity = () => {
      updateLastActivity();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach((event) => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    updateLastActivity();

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, [session]);

  useEffect(() => {
    let isMounted = true;
    let unsub: (() => void) | undefined;

    const applySession = (s: Session | null) => {
      if (!isMounted) return;
      setSession(s);
      setLoading(false);
      if (s?.user?.id) {
        bootstrapSessionData(s.user.id);
      } else {
        resetSessionBootstrap();
      }
    };

    const setupAuthListener = () => {
      const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
        if (!isMounted) return;

        console.log("[Auth] Événement:", event, "Session:", s ? "présente" : "absente");

        applySession(s ?? null);

        if (event === "SIGNED_IN" && s?.user?.id) {
          clearPromoLogoutSuppression();
          markHadAccountOnDevice();
          try {
            localStorage.removeItem("onetool_oauth_remember");
            updateLastActivity();
            const newUserId = s.user.id;
            const previousUserId = previousUserIdRef.current;
            setStudioScopedUserId(newUserId);
            if (previousUserId && previousUserId !== newUserId) {
              void clearAllViralWorksStudioPersistence(previousUserId).then(() => {
                migrateLegacySessionStorageToLocal(newUserId);
                touchStudioWorkflowLease(newUserId);
              });
            } else {
              migrateLegacySessionStorageToLocal(newUserId);
              touchStudioWorkflowLease(newUserId);
            }
            previousUserIdRef.current = newUserId;
            void syncPostHogUserFromSession({
              id: s.user.id,
              email: s.user.email,
            });
            capturePostHog("login");
            console.log("[Auth] Utilisateur connecté, activité mise à jour");
          } catch (err) {
            console.warn("[Auth] Erreur lors du nettoyage OAuth:", err);
          }
        }

        if (event === "INITIAL_SESSION" && s?.user?.id) {
          markHadAccountOnDevice();
          void syncPostHogUserFromSession({
            id: s.user.id,
            email: s.user.email,
          });
          try {
            handleStudioSessionForUser(s.user.id);
          } catch (err) {
            console.warn("[Auth] Erreur reset workflow studio (INITIAL_SESSION):", err);
          }
        }

        if (event === "SIGNED_OUT") {
          markPromoSuppressedOnLogout();
          try {
            invalidateAuthUserIdCache();
            resetSessionBootstrap();
            resetPostHogUser();
            localStorage.removeItem(LAST_ACTIVITY_KEY);
            const signedOutUserId = previousUserIdRef.current;
            setStudioScopedUserId(null);
            previousUserIdRef.current = null;
            void clearAllViralWorksStudioPersistence(signedOutUserId ?? undefined);
            console.log("[Auth] Utilisateur déconnecté, activité nettoyée");
          } catch (err) {
            console.warn("[Auth] Erreur lors du nettoyage:", err);
          }
        }

        if (event === "TOKEN_REFRESHED") {
          updateLastActivity();
          console.log("[Auth] Token rafraîchi, activité mise à jour");
        }
      });
      unsub = () => sub.subscription.unsubscribe();
      mountedRef.current = true;
    };

    setupAuthListener();

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;

      if (error || !data.session) {
        applySession(null);
        try {
          localStorage.removeItem(LAST_ACTIVITY_KEY);
        } catch {}
        return;
      }

      updateLastActivity();
      if (data.session.user?.id) {
        setStudioScopedUserId(data.session.user.id);
        migrateLegacySessionStorageToLocal(data.session.user.id);
      }
      applySession(data.session);
    }).catch((err) => {
      console.error("Erreur lors de l'initialisation de la session:", err);
      if (isMounted) {
        applySession(null);
      }
    });

    return () => {
      isMounted = false;
      if (unsub) unsub();
    };
  }, [supabase, handleStudioSessionForUser]);

  const signOut = useCallback(async () => {
    const signedOutUserId = previousUserIdRef.current ?? session?.user?.id ?? null;
    try {
      markPromoSuppressedOnLogout();
      resetPostHogUser();
      await supabase.auth.signOut();
      setSession(null);
      try {
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        setStudioScopedUserId(null);
        previousUserIdRef.current = null;
        await clearAllViralWorksStudioPersistence(signedOutUserId ?? undefined);
      } catch {}
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      throw error;
    }
  }, [supabase, session?.user?.id]);

  const value = useMemo(
    () => ({ session, loading, supabase, signOut }),
    [session, loading, supabase, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
