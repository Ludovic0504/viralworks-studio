import { createContext, useCallback, useContext, useMemo, useState } from "react";
import ModalBoutique from "@/composants/boutique/ModalBoutique";

const BoutiqueModalContext = createContext(null);

export function BoutiqueModalProvider({ children }) {
  const [modalState, setModalState] = useState({
    open: false,
    section: "subscription",
    paymentReturn: null,
  });

  const openBoutiqueModal = useCallback((section = "subscription", opts = {}) => {
    setModalState({
      open: true,
      section,
      paymentReturn: opts.paymentReturn ?? null,
    });
  }, []);

  const closeBoutiqueModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, open: false, paymentReturn: null }));
  }, []);

  const value = useMemo(
    () => ({
      openBoutiqueModal,
      closeBoutiqueModal,
      isBoutiqueModalOpen: modalState.open,
    }),
    [openBoutiqueModal, closeBoutiqueModal, modalState.open]
  );

  return (
    <BoutiqueModalContext.Provider value={value}>
      {children}
      <ModalBoutique
        open={modalState.open}
        section={modalState.section}
        paymentReturn={modalState.paymentReturn}
        onClose={closeBoutiqueModal}
      />
    </BoutiqueModalContext.Provider>
  );
}

export function useBoutiqueModal() {
  const context = useContext(BoutiqueModalContext);
  if (!context) {
    throw new Error("useBoutiqueModal must be used within <BoutiqueModalProvider>");
  }
  return context;
}
