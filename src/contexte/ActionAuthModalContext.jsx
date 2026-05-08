import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import AuthModal from "@/composants/auth/AuthModal";
import { useAuth } from "@/contexte/FournisseurAuth";

const AuthActionContext = createContext(null);

export function AuthActionProvider({ children }) {
  const { session } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const pendingActionRef = useRef(null);
  const loggedRef = useRef(false);

  const openAuthModal = useCallback(() => {
    // #region agent log
    fetch('http://127.0.0.1:7405/ingest/84f2a250-0990-480e-ba92-160ff926a4b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0480cf'},body:JSON.stringify({sessionId:'0480cf',runId:'auth-bug',hypothesisId:'H4',location:'src/contexte/ActionAuthModalContext.jsx:openAuthModal',message:'openAuthModal called',data:{hasSession:Boolean(session?.user?.id)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    setModalOpen(true);
  }, []);

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

  if (!loggedRef.current) {
    loggedRef.current = true;
    // #region agent log
    fetch('http://127.0.0.1:7405/ingest/84f2a250-0990-480e-ba92-160ff926a4b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0480cf'},body:JSON.stringify({sessionId:'0480cf',runId:'auth-bug',hypothesisId:'H2',location:'src/contexte/ActionAuthModalContext.jsx:mount',message:'AuthActionProvider mounted',data:{initialModalOpen:modalOpen,hasSession:Boolean(session?.user?.id)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }

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
