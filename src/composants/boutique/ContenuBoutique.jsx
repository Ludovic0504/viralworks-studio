import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { getUserCredits } from "@/bibliotheque/supabase/credits";
import { track } from "@/bibliotheque/meta/pixel";
import { capturePostHog, trackPostHogError } from "@/bibliotheque/posthog/client";
import {
  getUserSubscription,
  fetchWelcomeGiftNeedsChoice,
} from "@/bibliotheque/supabase/stripe";
import { useStripePayment, payMonthly, payYearly, payVideoPack } from "@/hooks/useStripePayment";
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
      "Inclus : jusqu'à 200 générations de texte et d'images / mois (largement suffisant pour préparer tes vidéos)",
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
      "Jusqu'à 200 générations de texte et d'images / mois",
      "Accès à toutes les fonctionnalités",
      "Support prioritaire",
    ],
    savings: "Économisez environ 17 % par rapport au mensuel",
  },
];

function resolveSectionTab(section) {
  if (section === "subscription") return "subscription";
  if (section === "packs-videos") return "credits";
  return null;
}

export default function ContenuBoutique({ variant = "page", initialSection = null }) {
  const { session } = useAuth();
  const { runWithAuth, openAuthModal } = useRequireAuthAction();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [subscription, setSubscription] = useState(null);
  const { loading, error, startPayment } = useStripePayment();
  const [activeTab, setActiveTab] = useState(() => {
    const fromProps = resolveSectionTab(initialSection);
    if (fromProps) return fromProps;
    const fromUrl = searchParams.get("section");
    return resolveSectionTab(fromUrl) ?? "credits";
  });
  const [refreshing, setRefreshing] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftModalDismissed, setGiftModalDismissed] = useState(false);
  const giftPollAttempts = useRef(0);

  const paymentStatus = searchParams.get("payment");
  const isModal = variant === "modal";

  useEffect(() => {
    capturePostHog("pricing_page_viewed", { page: "boutique", variant });
  }, [variant]);

  useEffect(() => {
    if (error) {
      trackPostHogError(error, "/boutique", "payment");
    }
  }, [error]);

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
          capturePostHog("payment_completed", {
            price:
              typeof last?.billedAmount === "number"
                ? last.billedAmount
                : last?.amount,
            type: last?.type,
            credits: last?.credits,
            plan_name:
              last?.subscriptionPlan === "monthly"
                ? "Abonnement Mensuel"
                : last?.subscriptionPlan === "yearly"
                  ? "Abonnement Annuel"
                  : last?.credits
                    ? `${last.credits} vidéos`
                    : undefined,
          });
          sessionStorage.removeItem("onetool_last_checkout");
        } else {
          track("Purchase");
          capturePostHog("payment_completed");
        }
      } catch {
        track("Purchase");
        capturePostHog("payment_completed");
      }

      setTimeout(() => {
        refreshCredits();
      }, 3000);
    } else if (paymentStatus === "cancelled") {
      console.log("ℹ️ Paiement annulé par l'utilisateur");
      capturePostHog("payment_failed", {
        error_type: "cancelled",
        error_message: "Paiement annulé par l'utilisateur",
      });
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
    if (isModal) {
      const tab = resolveSectionTab(initialSection);
      if (tab) setActiveTab(tab);
      return;
    }
    const section = searchParams.get("section");
    const tab = resolveSectionTab(section);
    if (tab) setActiveTab(tab);
  }, [initialSection, searchParams, isModal]);

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
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
    if (!isModal) {
      navigate("/boutique", { replace: true });
    }
    refreshCredits();
  };

  const handleGiftModalClose = () => {
    setShowGiftModal(false);
    setGiftModalDismissed(true);
  };

  const wrapperClass = isModal ? "" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8";

  /** Classes compactes mobile — modal uniquement (page /boutique inchangée). */
  const m = {
    headerWrap: isModal ? "mb-6 max-md:mb-3" : "mb-8",
    headerRow: isModal ? "flex items-center gap-3 mb-4 max-md:gap-2 max-md:mb-2 max-md:pr-11" : "flex items-center gap-3 mb-4",
    headerIcon: isModal ? "w-12 h-12 rounded-xl max-md:w-9 max-md:h-9 max-md:rounded-lg" : "w-12 h-12 rounded-xl",
    headerIconSvg: isModal ? "w-6 h-6 max-md:w-4 max-md:h-4" : "w-6 h-6",
    headerTitle: isModal ? "font-bold text-gray-200 text-2xl max-md:text-xl" : "font-bold text-gray-200 text-3xl",
    headerSubtitle: isModal ? "text-gray-400 text-sm sm:text-base max-md:text-xs" : "text-gray-400 text-sm sm:text-base",
    statusRow: isModal ? "flex items-center gap-4 flex-wrap max-md:gap-2" : "flex items-center gap-4 flex-wrap",
    statusBadge: isModal ? "flex items-center gap-2 px-4 py-2 rounded-lg max-md:px-2.5 max-md:py-1 max-md:gap-1.5" : "flex items-center gap-2 px-4 py-2 rounded-lg",
    statusBadgeIcon: isModal ? "w-5 h-5 max-md:w-4 max-md:h-4" : "w-5 h-5",
    statusBadgeText: isModal ? "text-sm text-violet-300 max-md:text-xs" : "text-sm text-violet-300",
    refreshBtn: isModal ? "px-3 py-1.5 rounded-lg text-sm max-md:px-2 max-md:py-1 max-md:text-xs" : "px-3 py-1.5 rounded-lg text-sm",
    alertBox: isModal ? "mb-6 p-4 rounded-lg flex items-center gap-3 max-md:mb-3 max-md:p-2.5 max-md:gap-2" : "mb-6 p-4 rounded-lg flex items-center gap-3",
    alertIcon: isModal ? "w-5 h-5 flex-shrink-0 max-md:w-4 max-md:h-4" : "w-5 h-5 flex-shrink-0",
    alertBody: isModal ? "text-emerald-400 text-sm mt-1 max-md:text-xs max-md:mt-0.5" : "text-emerald-400 text-sm mt-1",
    tabs: isModal ? "mb-8 flex gap-4 border-b border-white/10 max-md:mb-4 max-md:gap-2" : "mb-8 flex gap-4 border-b border-white/10",
    tabBtn: isModal ? "px-4 py-2 font-medium relative transition-colors max-md:px-3 max-md:py-1.5 max-md:text-sm" : "px-4 py-2 font-medium relative transition-colors",
    gridCredits: isModal ? "grid grid-cols-1 md:grid-cols-3 gap-6 max-md:gap-3 max-md:pt-1" : "grid grid-cols-1 md:grid-cols-3 gap-6",
    gridSubs: isModal ? "grid grid-cols-1 md:grid-cols-2 gap-6 max-md:gap-3 max-md:pt-1" : "grid grid-cols-1 md:grid-cols-2 gap-6",
    creditCard: isModal
      ? "glass-strong rounded-2xl border p-6 relative transition-all hover:scale-105 max-md:rounded-xl max-md:p-3.5 max-md:hover:scale-100"
      : "glass-strong rounded-2xl border p-6 relative transition-all hover:scale-105",
    subCard: isModal
      ? "glass-strong rounded-2xl border p-6 relative transition-all hover:scale-105 max-md:rounded-xl max-md:p-3.5 max-md:hover:scale-100"
      : "glass-strong rounded-2xl border p-6 relative transition-all hover:scale-105",
    creditCardBody: isModal ? "text-center mb-6 max-md:mb-3" : "text-center mb-6",
    creditEmoji: isModal ? "text-4xl mb-3 max-md:text-3xl max-md:mb-1.5" : "text-4xl mb-3",
    creditName: isModal ? "text-xl font-bold text-gray-200 mb-1 max-md:text-lg max-md:mb-0.5" : "text-xl font-bold text-gray-200 mb-1",
    creditSubtitle: isModal ? "text-xs text-gray-400 mb-3 max-md:mb-1.5" : "text-xs text-gray-400 mb-3",
    creditPrice: isModal ? "text-2xl font-bold text-emerald-400 mb-1 max-md:text-xl max-md:mb-0.5" : "text-2xl font-bold text-emerald-400 mb-1",
    creditUnit: isModal ? "text-sm text-gray-400 max-md:text-xs" : "text-sm text-gray-400",
    buyBtn: isModal ? "w-full py-3 rounded-lg font-semibold transition-all max-md:py-2 max-md:text-sm" : "w-full py-3 rounded-lg font-semibold transition-all",
    subCardBody: isModal ? "text-center mb-6 max-md:mb-3" : "text-center mb-6",
    subIconWrap: isModal ? "w-16 h-16 mx-auto mb-4 rounded-full max-md:w-11 max-md:h-11 max-md:mb-2" : "w-16 h-16 mx-auto mb-4 rounded-full",
    subIcon: isModal ? "w-8 h-8 max-md:w-5 max-md:h-5" : "w-8 h-8",
    subName: isModal ? "text-xl font-bold text-gray-200 mb-2 max-md:text-lg max-md:mb-1" : "text-xl font-bold text-gray-200 mb-2",
    subQuota: isModal ? "mb-2 text-sm text-gray-300 max-md:mb-1 max-md:text-xs" : "mb-2 text-sm text-gray-300",
    subPrice: isModal ? "text-2xl font-bold text-violet-400 mb-1 max-md:text-xl max-md:mb-0.5" : "text-2xl font-bold text-violet-400 mb-1",
    subPriceNote: isModal ? "block text-sm font-normal text-gray-400 mt-1 max-md:text-xs max-md:mt-0.5" : "block text-sm font-normal text-gray-400 mt-1",
    subPriceThen: isModal ? "block text-base font-semibold text-gray-200 mt-2 max-md:text-sm max-md:mt-1" : "block text-base font-semibold text-gray-200 mt-2",
    subSavings: isModal ? "text-sm text-emerald-400 font-medium mt-2 max-md:text-xs max-md:mt-1" : "text-sm text-emerald-400 font-medium mt-2",
    subFeatures: isModal ? "space-y-2 mb-6 max-md:space-y-1 max-md:mb-3" : "space-y-2 mb-6",
    subFeatureItem: isModal ? "flex items-center gap-2 text-sm text-gray-300 max-md:gap-1.5 max-md:text-xs" : "flex items-center gap-2 text-sm text-gray-300",
    subFeatureCheck: isModal ? "w-4 h-4 text-emerald-400 flex-shrink-0 max-md:w-3.5 max-md:h-3.5" : "w-4 h-4 text-emerald-400 flex-shrink-0",
    subActions: isModal ? "space-y-3 max-md:space-y-2" : "space-y-3",
    subLearnMore: isModal
      ? "w-full py-2 rounded-lg border border-white/15 text-sm text-gray-200 hover:bg-white/5 transition-colors max-md:py-1.5 max-md:text-xs"
      : "w-full py-2 rounded-lg border border-white/15 text-sm text-gray-200 hover:bg-white/5 transition-colors",
    secureBlock: isModal ? "mt-8 p-4 rounded-lg max-md:mt-4 max-md:p-2.5 max-md:rounded-md" : "mt-8 p-4 rounded-lg",
    secureInner: isModal ? "flex items-start gap-3 max-md:gap-2" : "flex items-start gap-3",
    secureIcon: isModal ? "w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0 max-md:w-4 max-md:h-4 max-md:mt-0" : "w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0",
    secureTitle: isModal ? "text-sm text-gray-300 mb-1 max-md:text-xs max-md:mb-0.5" : "text-sm text-gray-300 mb-1",
    secureNote: isModal ? "text-xs text-gray-400 max-md:leading-snug" : "text-xs text-gray-400",
    popularBadge: isModal ? "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold max-md:-top-2.5 max-md:px-2 max-md:py-0.5 max-md:text-[10px]" : "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold",
  };

  return (
    <div className={wrapperClass}>
      {loading && (
        <div className="fixed inset-0 bg-black/60 z-[140] flex items-center justify-center">
          <div
            className="rounded-xl p-8 text-center border border-white/10"
            style={{ background: "#1a1a2e" }}
          >
            <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-white text-sm">Redirection vers le paiement sécurisé…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/40 text-red-400 rounded-lg px-4 py-3 text-sm z-[140]">
          {error}
        </div>
      )}

      <div className={m.headerWrap}>
        <div className={m.headerRow}>
          <div className={`bg-gradient-to-br from-emerald-500 to-violet-500 flex items-center justify-center ${m.headerIcon}`}>
            <ShoppingBag className={`text-white ${m.headerIconSvg}`} />
          </div>
          <div>
            <h1 id="modal-boutique-title" className={isModal ? m.headerTitle : `font-bold text-gray-200 text-3xl`}>
              Boutique
            </h1>
            <p className={m.headerSubtitle}>
              Choisis un pack vidéo ou un abonnement
            </p>
          </div>
        </div>

        <div className={m.statusRow}>
          {subscription && (
            <div className={`bg-violet-500/10 border border-violet-500/30 ${m.statusBadge}`}>
              <Crown className={`text-violet-400 ${m.statusBadgeIcon}`} />
              <span className={m.statusBadgeText}>Abonnement actif</span>
            </div>
          )}
          <button
            onClick={() => void runWithAuth(refreshCredits)}
            disabled={refreshing}
            className={`bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all disabled:opacity-50 ${m.refreshBtn}`}
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Actualiser l'état de l'abonnement"
            )}
          </button>
        </div>
      </div>

      {paymentStatus === "success" && (
        <div className={`bg-emerald-500/10 border border-emerald-500/30 ${m.alertBox}`}>
          <CheckCircle className={`text-emerald-400 ${m.alertIcon}`} />
          <div className="flex-1">
            <p className={`text-emerald-300 font-medium${isModal ? " max-md:text-sm" : ""}`}>Paiement réussi !</p>
            <p className={m.alertBody}>
              Ton achat est en cours de prise en compte. Si rien ne change, clique sur
              &quot;Actualiser l&apos;état de l&apos;abonnement&quot;.
            </p>
          </div>
        </div>
      )}

      {paymentStatus === "cancelled" && (
        <div className={`bg-red-500/10 border border-red-500/30 ${m.alertBox}`}>
          <XCircle className={`text-red-400 ${m.alertIcon}`} />
          <p className={`text-red-300${isModal ? " max-md:text-sm" : ""}`}>Paiement annulé.</p>
        </div>
      )}

      <div className={m.tabs}>
        <button
          onClick={() => setActiveTab("credits")}
          className={`transition-colors ${m.tabBtn} ${
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
          className={`transition-colors ${m.tabBtn} ${
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

      {activeTab === "credits" && (
        <div className={m.gridCredits}>
          {CREDIT_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`${m.creditCard} ${
                pkg.popular
                  ? "border-emerald-500/50 bg-emerald-500/5 shadow-lg shadow-emerald-500/10"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              {pkg.popular && (
                <div className={`bg-emerald-500 text-white ${m.popularBadge}`}>
                  Populaire
                </div>
              )}
              <div className={m.creditCardBody}>
                <div className={m.creditEmoji}>{pkg.icon}</div>
                <h3 className={m.creditName}>{pkg.name}</h3>
                <p className={m.creditSubtitle}>{pkg.subtitle}</p>
                <div className={m.creditPrice}>
                  {pkg.price.toFixed(2)} €
                </div>
                <div className={m.creditUnit}>{pkg.pricePerUnit}</div>
              </div>
              <button
                onClick={() => {
                  capturePostHog("plan_selected", {
                    plan_name: pkg.name,
                    price: pkg.price,
                  });
                  void runWithAuth(() =>
                    startPayment(payVideoPack({ videos: pkg.credits, amount: pkg.price }))
                  );
                }}
                disabled={loading}
                className={`${m.buyBtn} ${
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
        <div className={m.gridSubs}>
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`${m.subCard} ${
                plan.popular
                  ? "border-violet-500/50 bg-violet-500/5 shadow-lg shadow-violet-500/10"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              {plan.popular && (
                <div className={`bg-violet-500 text-white ${m.popularBadge}`}>
                  Recommandé
                </div>
              )}
              <div className={m.subCardBody}>
                <div className={`bg-violet-500/20 border border-violet-500/30 flex items-center justify-center ${m.subIconWrap}`}>
                  <Crown className={`text-violet-400 ${m.subIcon}`} />
                </div>
                <h3 className={m.subName}>{plan.name}</h3>
                <div className={m.subQuota}>Jusqu'à 30 vidéos / mois</div>
                <div className={m.subPrice}>
                  {plan.id === "monthly" ? (
                    <>
                      64,50 €
                      <span className={m.subPriceNote}>
                        −50 % le 1er mois — offre de lancement
                      </span>
                      <span className={m.subPriceThen}>
                        puis 129 €/mois
                      </span>
                    </>
                  ) : (
                    <>
                      107 €/mois
                      <span className={m.subPriceNote}>
                        Engagement annuel - 50 % le 1er mois
                      </span>
                    </>
                  )}
                </div>
                {plan.savings && (
                  <div className={m.subSavings}>{plan.savings}</div>
                )}
              </div>
              <ul className={m.subFeatures}>
                {plan.features.map((feature, idx) => (
                  <li key={idx} className={m.subFeatureItem}>
                    <Check className={m.subFeatureCheck} />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className={m.subActions}>
                <button
                  onClick={() => {
                    capturePostHog("plan_selected", {
                      plan_name: plan.name,
                      price: plan.price,
                    });
                    void runWithAuth(() =>
                      startPayment(plan.id === "monthly" ? payMonthly() : payYearly())
                    );
                  }}
                  disabled={loading || subscription !== null}
                  className={`${m.buyBtn} ${
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
                    className={m.subLearnMore}
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

      <div className={`bg-white/5 border border-white/10 ${m.secureBlock}`}>
        <div className={m.secureInner}>
          <CreditCard className={m.secureIcon} />
          <div>
            <p className={m.secureTitle}>
              <strong className="text-gray-200">Paiement sécurisé</strong> - Tous les paiements sont
              traités de manière sécurisée via Stripe.
            </p>
            <p className={m.secureNote}>
              Vos informations de paiement ne sont jamais stockées sur nos serveurs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
