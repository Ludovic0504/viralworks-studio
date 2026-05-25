import { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AuthModal from "@/composants/auth/AuthModal";
import { useAuth } from "@/contexte/FournisseurAuth";

const AuthActionContext = createContext(null);

export function AuthActionProvider({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const pendingActionRef = useRef(null);

  const openAuthModal = useCallback(() => {
    setModalOpen(true);
  }, []);

  /** Ouvre le modal quand l'URL contient ?login=1 (ex. redirect depuis RouteProtegee). */
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const wantsLogin = sp.get("login") === "1";
    if (!wantsLogin) return;

    sp.delete("login");
    const nextSearch = sp.toString();
    navigate(
      { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" },
      { replace: true }
    );

    if (session?.user?.id) return;
    if (loading) return;

    openAuthModal();
  }, [
    location.pathname,
    location.search,
    navigate,
    openAuthModal,
    session?.user?.id,
    loading,
  ]);

  /** Fermer le modal si l'utilisateur change de page (ex. /studio?login=1 → /viralworks). */
  useEffect(() => {
    setModalOpen(false);
    pendingActionRef.current = null;
  }, [location.pathname]);

  const runWithAuth = useCallback(
    async (action) => {
      if (session) {
        return action ? await action() : true;
      }

      return await new Promise((resolve, reject) => {
        pendingActionRef.current = {
          action: typeof action === "function" ? action : null,
          resolve,
          reject,
        };
        setModalOpen(true);
      });
    },
    [session]
  );

  const handleAuthSuccess = useCallback(async () => {
    setModalOpen(false);
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    if (!pending) return;

    if (!pending.action) {
      pending.resolve(true);
      return;
    }

    try {
      const result = await pending.action();
      pending.resolve(result);
    } catch (error) {
      pending.reject(error);
    }
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    pending?.resolve(false);
  }, []);

  const value = useMemo(
    () => ({
      runWithAuth,
      openAuthModal,
      isAuthModalOpen: modalOpen,
    }),
    [runWithAuth, openAuthModal, modalOpen]
  );

  return (
    <AuthActionContext.Provider value={value}>
      {children}
      <AuthModal open={modalOpen} onClose={handleClose} onAuthSuccess={handleAuthSuccess} />
    </AuthActionContext.Provider>
  );
}

export function useRequireAuthAction() {
  const context = useContext(AuthActionContext);
  if (!context) {
    throw new Error("useRequireAuthAction must be used within <AuthActionProvider>");
  }
  return context;
}
