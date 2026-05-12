import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { getUserCredits } from "@/bibliotheque/supabase/credits";
import { track } from "@/bibliotheque/meta/pixel";
import {
  getUserSubscription,
  fetchWelcomeGiftNeedsChoice,
} from "@/bibliotheque/supabase/stripe";
import { useStripePayment, payMonthly, payYearly, payVideoPack } from "../hooks/useStripePayment";
import ModalCadeauBienvenue from "@/composants/ModalCadeauBienvenue";
import { CreditCard, Check, Crown, Loader2, CheckCircle, XCircle, ShoppingBag } from "lucide-react";

const CREDIT_PACKAGES = [
  {
    id: "starter",
    name: "+3 vidéos",
    subtitle: "Pour un besoin ponctuel",
    credits: 3,
    price: 14.99,
    popular: false,
    icon: "🎯",
    pricePerUnit: "5 € / vidéo",
  },
  {
    id: "pro",
    name: "+10 vidéos",
    subtitle: "Pour un sprint de contenu",
    credits: 10,
    price: 49.99,
    popular: true,
    icon: "⚡",
    pricePerUnit: "5,00 € / vidéo",
  },
  {
    id: "expert",
    name: "+30 vidéos",
    subtitle: "Pour un gros mois / lancement",
    credits: 30,
    price: 149.99,
    popular: false,
    icon: "🚀",
    pricePerUnit: "5,00 € / vidéo",
  },
];

const SUBSCRIPTION_PLANS = [
  {
    id: "monthly",
    name: "Abonnement Mensuel",
    credits: 30,
    price: 129,
    period: "mois",
    popular: true,
    features: [
      "30 vidéos finales exportables",
      "Scripts Gagnant inclus",
      "Visuels d'accroche inclus",
      "Accès à toutes les fonctionnalités",
      "Support prioritaire",
      "Inclus : jusqu’à 200 générations de texte et d’images / mois (largement suffisant pour préparer tes vidéos)",
    ],
    savings: null,
  },
  {
    id: "yearly",
    name: "Abonnement Annuel",
    credits: 30,
    price: 107 * 12,
    period: "an",
    popular: false,
    features: [
      "30 vidéos finales par mois",
      "Scripts Gagnant inclus",
      "Visuels d'accroche inclus",
      "Jusqu’à 200 générations de texte et d’images / mois",
      "Accès à toutes les fonctionnalités",
      "Support prioritaire",
    ],
    savings: "Économisez environ 17 % par rapport au mensuel",
  },
];

export default function Boutique() {
  const { session } = useAuth();
  const { runWithAuth, openAuthModal } = useRequireAuthAction();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [subscription, setSubscription] = useState(null);
  const { loading, error, startPayment } = useStripePayment();
  const [activeTab, setActiveTab] = useState("credits");
  const [refreshing, setRefreshing] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftModalDismissed, setGiftModalDismissed] = useState(false);
  const giftPollAttempts = useRef(0);

  const paymentStatus = searchParams.get("payment");

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session]);

  useEffect(() => {
    if (paymentStatus === "success") {
      console.log("✅ Paiement réussi !");
      if (!session) {
        openAuthModal();
        return;
      }

      try {
        const raw = sessionStorage.getItem("onetool_last_checkout");
        if (raw) {
          const last = JSON.parse(raw);
          track("Purchase", {
            value: typeof last?.amount === "number" ? last.amount : undefined,
            currency: last?.currency || "EUR",
          });
          sessionStorage.removeItem("onetool_last_checkout");
        } else {
          track("Purchase");
        }
      } catch {
        track("Purchase");
      }

      setTimeout(() => {
        refreshCredits();
      }, 3000);
    } else if (paymentStatus === "cancelled") {
      console.log("ℹ️ Paiement annulé par l'utilisateur");
    }
  }, [paymentStatus, session, openAuthModal]);

  useEffect(() => {
    if (!session || paymentStatus !== "success") {
      giftPollAttempts.current = 0;
      return;
    }

    const tick = async () => {
      const need = await fetchWelcomeGiftNeedsChoice();
      if (need && !giftModalDismissed) {
        setShowGiftModal(true);
        return true;
      }
      return false;
    };

    tick();

    const interval = setInterval(async () => {
      if (giftPollAttempts.current >= 25) {
        clearInterval(interval);
        return;
      }
      giftPollAttempts.current += 1;
      const done = await tick();
      if (done) clearInterval(interval);
    }, 1200);

    return () => clearInterval(interval);
  }, [session, paymentStatus, giftModalDismissed]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const need = await fetchWelcomeGiftNeedsChoice();
      if (!cancelled && need && !giftModalDismissed) setShowGiftModal(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, subscription?.id, giftModalDismissed]);

  useEffect(() => {
    const section = searchParams.get("section");
    if (section === "subscription") {
      setActiveTab("subscription");
      return;
    }
    if (section === "packs-videos") {
      setActiveTab("credits");
    }
  }, [searchParams]);

  const loadData = async () => {
    try {
      await getUserCredits();

      const userSubscription = await getUserSubscription();
      setSubscription(userSubscription);
    } catch (err) {
      console.error("Erreur chargement données:", err);
    }
  };

  const refreshCredits = async () => {
    setRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await getUserCredits();
      const userSubscription = await getUserSubscription();
      setSubscription(userSubscription);
    } catch (err) {
      console.error("Erreur rafraîchissement crédits:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleGiftFlowComplete = () => {
    setGiftModalDismissed(false);
    setShowGiftModal(false);
    giftPollAttempts.current = 0;
    navigate("/boutique", { replace: true });
    refreshCredits();
  };

  const handleGiftModalClose = () => {
    setShowGiftModal(false);
    setGiftModalDismissed(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {loading && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="rounded-xl p-8 text-center border border-white/10" style={{ background: "#1a1a2e" }}>
            <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-white text-sm">Redirection vers le paiement sécurisé…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/40 text-red-400 rounded-lg px-4 py-3 text-sm z-50">
          {error}
        </div>
      )}

      {/* En-tête */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-violet-500 flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-200">Boutique</h1>
            <p className="text-gray-400">Choisis un pack vidéo ou un abonnement</p>
          </div>
        </div>

        {/* Statut d'abonnement (sans mention explicite des crédits) */}
        <div className="flex items-center gap-4 flex-wrap">
          {subscription && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/10 border border-violet-500/30">
              <Crown className="w-5 h-5 text-violet-400" />
              <span className="text-sm text-violet-300">Abonnement actif</span>
            </div>
          )}
          <button
            onClick={() => void runWithAuth(refreshCredits)}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-sm transition-all disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Actualiser l’état de l’abonnement"
            )}
          </button>
        </div>
      </div>

      {/* Message de succès/échec */}
      {paymentStatus === "success" && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-emerald-300 font-medium">Paiement réussi !</p>
            <p className="text-emerald-400 text-sm mt-1">
              Ton achat est en cours de prise en compte. Si rien ne change, clique sur \"Actualiser l’état de l’abonnement\".
            </p>
          </div>
        </div>
      )}

      {paymentStatus === "cancelled" && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-300">Paiement annulé.</p>
        </div>
      )}

      {/* Onglets */}
      <div className="mb-8 flex gap-4 border-b border-white/10">
        <button
          onClick={() => setActiveTab("credits")}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === "credits"
              ? "text-emerald-400"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Packs vidéos
          {activeTab === "credits" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("subscription")}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === "subscription"
              ? "text-emerald-400"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Abonnements
          {activeTab === "subscription" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
          )}
        </button>
      </div>

      {/* Contenu des onglets */}
      {activeTab === "credits" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CREDIT_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`glass-strong rounded-2xl border p-6 relative transition-all hover:scale-105 ${
                pkg.popular
                  ? "border-emerald-500/50 bg-emerald-500/5 shadow-lg shadow-emerald-500/10"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-semibold">
                  Populaire
                </div>
              )}
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">{pkg.icon}</div>
                <h3 className="text-xl font-bold text-gray-200 mb-1">{pkg.name}</h3>
                <p className="text-xs text-gray-400 mb-3">{pkg.subtitle}</p>
                <div className="text-2xl font-bold text-emerald-400 mb-1">
                  {pkg.price.toFixed(2)} €
                </div>
                <div className="text-sm text-gray-400">
                  {pkg.pricePerUnit}
                </div>
              </div>
              <button
                onClick={() =>
                  void runWithAuth(() =>
                    startPayment(payVideoPack({ videos: pkg.credits, amount: pkg.price }))
                  )
                }
                disabled={loading}
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  pkg.popular
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-white/10 hover:bg-white/20 text-gray-200 border border-white/20"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 mx-auto animate-spin" />
                ) : (
                  "Acheter"
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === "subscription" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`glass-strong rounded-2xl border p-6 relative transition-all hover:scale-105 ${
                plan.popular
                  ? "border-violet-500/50 bg-violet-500/5 shadow-lg shadow-violet-500/10"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-violet-500 text-white text-xs font-semibold">
                  Recommandé
                </div>
              )}
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                  <Crown className="w-8 h-8 text-violet-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-200 mb-2">{plan.name}</h3>
                <div className="mb-2 text-sm text-gray-300">
                  {plan.id === "monthly"
                    ? "Jusqu’à 30 vidéos / mois"
                    : "Jusqu’à 30 vidéos / mois"}
                </div>
                <div className="text-2xl font-bold text-violet-400 mb-1">
                  {plan.id === "monthly" ? (
                    <>
                      64,50 €
                      <span className="block text-sm font-normal text-gray-400 mt-1">
                        −50 % le 1er mois — offre de lancement
                      </span>
                      <span className="block text-base font-semibold text-gray-200 mt-2">
                        puis 129 €/mois
                      </span>
                    </>
                  ) : (
                    <>
                      107 €/mois
                      <span className="block text-sm font-normal text-gray-400 mt-1">
                        Engagement annuel - 50 % le 1er mois
                      </span>
                    </>
                  )}
                </div>
                {plan.savings && (
                  <div className="text-sm text-emerald-400 font-medium mt-2">
                    {plan.savings}
                  </div>
                )}
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="space-y-3">
                <button
                  onClick={() =>
                    void runWithAuth(() =>
                      startPayment(plan.id === "monthly" ? payMonthly() : payYearly())
                    )
                  }
                  disabled={loading || subscription !== null}
                  className={`w-full py-3 rounded-lg font-semibold transition-all ${
                    plan.popular
                      ? "bg-violet-500 hover:bg-violet-600 text-white"
                      : "bg-white/10 hover:bg-white/20 text-gray-200 border border-white/20"
                  } ${subscription ? "opacity-50 cursor-not-allowed" : ""} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 mx-auto animate-spin" />
                  ) : subscription ? (
                    "Déjà abonné"
                  ) : (
                    "S'abonner"
                  )}
                </button>
                {plan.id === "monthly" && (
                  <button
                    type="button"
                    className="w-full py-2 rounded-lg border border-white/15 text-sm text-gray-200 hover:bg-white/5 transition-colors"
                  >
                    En savoir plus
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalCadeauBienvenue
        open={showGiftModal}
        onConfirmed={handleGiftFlowComplete}
        onClose={handleGiftModalClose}
      />

      {/* Informations de sécurité */}
      <div className="mt-8 p-4 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-300 mb-1">
              <strong className="text-gray-200">Paiement sécurisé</strong> - Tous les paiements sont traités de manière sécurisée via Stripe.
            </p>
            <p className="text-xs text-gray-400">
              Vos informations de paiement ne sont jamais stockées sur nos serveurs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
