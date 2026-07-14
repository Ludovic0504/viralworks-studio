import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import ModalBoutique from "@/composants/boutique/ModalBoutique";
import { useAuth } from "@/contexte/FournisseurAuth";
import {
  getUserSubscriptionDetails,
  hasCachedUserSubscriptionDetails,
  invalidateUserSubscriptionDetailsCache,
  readCachedUserSubscriptionDetails,
  syncSubscriptionFromStripe,
} from "@/bibliotheque/supabase/stripe";

const BoutiqueModalContext = createContext(null);

export function BoutiqueModalProvider({ children }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [modalState, setModalState] = useState({
    open: false,
    section: "subscription",
    paymentReturn: null,
  });

  const [subscriptionDetails, setSubscriptionDetails] = useState(() =>
    readCachedUserSubscriptionDetails(userId),
  );
  const [subscriptionLoading, setSubscriptionLoading] = useState(
    () => Boolean(userId) && !hasCachedUserSubscriptionDetails(userId),
  );

  const refreshSubscriptionDetails = useCallback(
    async ({ skipCache = false } = {}) => {
      if (!userId) {
        setSubscriptionDetails(null);
        setSubscriptionLoading(false);
        return null;
      }

      if (skipCache) {
        invalidateUserSubscriptionDetailsCache();
        setSubscriptionLoading(true);
      } else if (hasCachedUserSubscriptionDetails(userId)) {
        setSubscriptionDetails(readCachedUserSubscriptionDetails(userId));
        setSubscriptionLoading(false);
      } else {
        setSubscriptionLoading(true);
      }

      try {
        await syncSubscriptionFromStripe();
        const details = await getUserSubscriptionDetails({ skipCache, userId });
        setSubscriptionDetails(details);
        return details;
      } catch (err) {
        console.error("Erreur chargement abonnement boutique:", err);
        return null;
      } finally {
        setSubscriptionLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      setSubscriptionDetails(null);
      setSubscriptionLoading(false);
      return;
    }

    setSubscriptionDetails(readCachedUserSubscriptionDetails(userId));
    setSubscriptionLoading(!hasCachedUserSubscriptionDetails(userId));
    void refreshSubscriptionDetails();
  }, [userId, refreshSubscriptionDetails]);

  const openBoutiqueModal = useCallback(
    (section = "subscription", opts = {}) => {
      void refreshSubscriptionDetails();
      setModalState({
        open: true,
        section,
        paymentReturn: opts.paymentReturn ?? null,
      });
    },
    [refreshSubscriptionDetails],
  );

  const closeBoutiqueModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, open: false, paymentReturn: null }));
  }, []);

  const value = useMemo(
    () => ({
      openBoutiqueModal,
      closeBoutiqueModal,
      isBoutiqueModalOpen: modalState.open,
      subscriptionDetails,
      subscriptionLoading,
      refreshSubscriptionDetails,
    }),
    [
      openBoutiqueModal,
      closeBoutiqueModal,
      modalState.open,
      subscriptionDetails,
      subscriptionLoading,
      refreshSubscriptionDetails,
    ],
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
