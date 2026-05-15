import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import {
  clearAllViralWorksStudioPersistence,
  shouldResetStudioWorkflow,
  touchStudioWorkflowLease,
} from "@/bibliotheque/viralWorksStudioStorage";

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
    let unsub: (() => void) | undefined;
    let isMounted = true;

    const init = async () => {
      setLoading(true);
      
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (error || !data.session) {
          setSession(null);
          try {
            localStorage.removeItem(LAST_ACTIVITY_KEY);
          } catch {}
          setLoading(false);
          
          if (!mountedRef.current) {
            setupAuthListener();
          }
          return;
        }

        const validSession = data.session;
        updateLastActivity();
        
        setSession(validSession);
        setLoading(false);

        if (!mountedRef.current) {
          setupAuthListener();
        }
      } catch (err) {
        console.error("Erreur lors de l'initialisation de la session:", err);
        if (isMounted) {
          setSession(null);
          setLoading(false);
        }
      }
    };

    const setupAuthListener = () => {
      const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
        if (!isMounted) return;
        
        console.log("[Auth] Événement:", event, "Session:", s ? "présente" : "absente");
        
        setSession(s ?? null);
        setLoading(false);

        if (event === "SIGNED_IN") {
          try {
            localStorage.removeItem("onetool_oauth_remember");
            updateLastActivity();
            void clearAllViralWorksStudioPersistence().then(() => {
              if (s?.user?.id) touchStudioWorkflowLease(s.user.id);
            });
            console.log("[Auth] Utilisateur connecté, activité mise à jour");
          } catch (err) {
            console.warn("[Auth] Erreur lors du nettoyage OAuth:", err);
          }
        }

        if (event === "INITIAL_SESSION" && s?.user?.id) {
          try {
            const uid = s.user.id;
            if (shouldResetStudioWorkflow(uid)) {
              void clearAllViralWorksStudioPersistence().then(() => {
                touchStudioWorkflowLease(uid);
              });
            } else {
              touchStudioWorkflowLease(uid);
            }
          } catch (err) {
            console.warn("[Auth] Erreur reset workflow studio (INITIAL_SESSION):", err);
          }
        }
        
        if (event === "SIGNED_OUT") {
          try {
            localStorage.removeItem(LAST_ACTIVITY_KEY);
            void clearAllViralWorksStudioPersistence();
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

    void init();
    return () => { 
      isMounted = false;
      if (unsub) unsub();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      try {
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        await clearAllViralWorksStudioPersistence();
      } catch {}
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      throw error;
    }
  }, [supabase]);

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
