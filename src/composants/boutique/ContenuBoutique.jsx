import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { getUserCredits } from "@/bibliotheque/supabase/credits";
import { track } from "@/bibliotheque/meta/pixel";
import { capturePostHog, trackPostHogError } from "@/bibliotheque/posthog/client";
import {
  getUserSubscription,
  fetchWelcomeGiftNeedsChoice,
} from "@/bibliotheque/supabase/stripe";
import { useStripePayment, payImage9, payPro59, payPremium129, payVideoPack } from "@/hooks/useStripePayment";
import ModalCadeauBienvenue from "@/composants/ModalCadeauBienvenue";
import "./BoutiqueSubCard.css";
import { CreditCard, Check, Crown, Loader2, CheckCircle, ShoppingBag, ImageIcon, Zap } from "lucide-react";

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
    id: "image_9",
    name: "ViralWorks Image",
    credits: 0,
    price: 9,
    period: "mois",
    popular: false,
    features: [
      "Image Studio — jusqu'à 200 générations / mois",
      "Génération d'images par prompt",
      "Accès aux outils image ViralWorks",
    ],
    savings: null,
  },
  {
    id: "pro_59",
    name: "ViralWorks Pro",
    credits: 10,
    price: 59,
    period: "mois",
    popular: false,
    features: [
      "Image Studio — 200 générations NanaBanana Pro / mois",
      "Génération vidéo IA complète — 10 / mois",
      "Avatars IA — 5 / mois",
      "Scripts Gagnant inclus",
      "Visuels d'accroche inclus",
    ],
    savings: null,
  },
  {
    id: "premium_129",
    name: "ViralWorks Studio",
    credits: 30,
    price: 129,
    period: "mois",
    popular: true,
    features: [
      "Génération vidéo IA complète — 30 / mois",
      "Image Studio — 200 générations NanaBanana Pro / mois",
      "Avatars IA — 5 / mois",
      "Scripts Gagnant inclus",
      "Visuels d'accroche inclus",
      "Support prioritaire",
    ],
    savings: null,
  },
];

function resolveSectionTab(section) {
  if (section === "subscription") return "subscription";
  if (section === "packs-videos") return "credits";
  return null;
}

export default function ContenuBoutique({
  variant = "page",
  initialSection = null,
  initialPaymentReturn = null,
}) {
  const { session, loading: authLoading } = useAuth();
  const { runWithAuth, openAuthModal } = useRequireAuthAction();
  const [searchParams] = useSearchParams();
  const [subscription, setSubscription] = useState(null);
  const { loading: paymentLoading, error, startPayment } = useStripePayment();
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

  const paymentStatus = searchParams.get("payment") ?? initialPaymentReturn;
  const highlightPlanId = searchParams.get("highlight") === "image_9" ? "image_9" : null;
  const isModal = variant === "modal";

  useEffect(() => {
    capturePostHog("pricing_page_viewed", { page: "boutique", variant });
  }, [variant]);

  useEffect(() => {
    const section = searchParams.get("section");
    const tab = resolveSectionTab(section);
    if (tab) setActiveTab(tab);
  }, [searchParams]);

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
      if (authLoading) return;

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
              last?.subscriptionPlan === "image_9"
                ? "ViralWorks Image"
                : last?.subscriptionPlan === "pro_59"
                  ? "ViralWorks Pro"
                : last?.subscriptionPlan === "premium_129" ||
                    last?.subscriptionPlan === "monthly"
                  ? "ViralWorks Studio"
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
  }, [paymentStatus, session, authLoading, openAuthModal]);

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
    refreshCredits();
  };

  const handleGiftModalClose = () => {
    setShowGiftModal(false);
    setGiftModalDismissed(true);
  };

  const wrapperClass = isModal
    ? "flex min-h-0 flex-1 flex-col"
    : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8";

  /** Classes compactes mobile — modal uniquement (page /boutique inchangée). */
  const m = {
    headerWrap: isModal ? "mb-3 max-md:mb-2" : "mb-8",
    headerRow: isModal ? "flex items-center gap-2.5 mb-2 max-md:gap-2 max-md:mb-1.5 max-md:pr-11" : "flex items-center gap-3 mb-4",
    headerIcon: isModal ? "w-10 h-10 rounded-xl max-md:w-9 max-md:h-9 max-md:rounded-lg" : "w-12 h-12 rounded-xl",
    headerIconSvg: isModal ? "w-5 h-5 max-md:w-4 max-md:h-4" : "w-6 h-6",
    headerTitle: isModal ? "font-bold text-gray-200 text-xl max-md:text-lg" : "font-bold text-gray-200 text-3xl",
    headerSubtitle: isModal ? "text-gray-400 text-sm max-md:text-xs" : "text-gray-400 text-sm sm:text-base",
    statusRow: isModal ? "flex items-center gap-4 flex-wrap max-md:gap-2" : "flex items-center gap-4 flex-wrap",
    statusBadge: isModal ? "flex items-center gap-1.5 px-3 py-1.5 rounded-lg max-md:px-2.5 max-md:py-1 max-md:gap-1.5" : "flex items-center gap-2 px-4 py-2 rounded-lg",
    statusBadgeIcon: isModal ? "w-4 h-4 max-md:w-4 max-md:h-4" : "w-5 h-5",
    statusBadgeText: isModal ? "text-xs text-violet-300 max-md:text-xs" : "text-sm text-violet-300",
    alertBox: isModal ? "mb-3 p-3 rounded-lg flex items-center gap-2.5 max-md:mb-2 max-md:p-2.5 max-md:gap-2" : "mb-6 p-4 rounded-lg flex items-center gap-3",
    alertIcon: isModal ? "w-5 h-5 flex-shrink-0 max-md:w-4 max-md:h-4" : "w-5 h-5 flex-shrink-0",
    alertBody: isModal ? "text-emerald-400 text-sm mt-1 max-md:text-xs max-md:mt-0.5" : "text-emerald-400 text-sm mt-1",
    tabs: isModal ? "mb-4 flex gap-3 border-b border-white/10 max-md:mb-3 max-md:gap-2" : "mb-8 flex gap-4 border-b border-white/10",
    tabBtn: isModal ? "px-3 py-1.5 text-sm font-medium relative transition-colors max-md:px-3 max-md:py-1.5 max-md:text-sm" : "px-4 py-2 font-medium relative transition-colors",
    gridCredits: isModal
      ? "grid grid-cols-1 items-stretch gap-4 max-md:gap-3 md:grid-cols-3"
      : "grid grid-cols-1 md:grid-cols-3 gap-6",
    gridSubs: isModal
      ? "grid grid-cols-1 items-stretch gap-4 max-md:gap-3 md:grid-cols-3"
      : "grid grid-cols-1 items-stretch md:grid-cols-3 gap-6",
    creditCard: isModal
      ? "glass-strong flex flex-col rounded-2xl border p-4 relative transition-all max-md:rounded-xl max-md:p-3.5"
      : "glass-strong rounded-2xl border p-6 relative transition-all",
    subCard: isModal
      ? "boutique-sub-card glass-strong flex h-full flex-col rounded-2xl border relative transition-all max-md:rounded-xl"
      : "boutique-sub-card glass-strong flex h-full flex-col rounded-2xl border relative transition-all",
    creditCardBody: isModal ? "text-center mb-4 max-md:mb-3" : "text-center mb-6",
    creditEmoji: isModal ? "text-4xl mb-3 max-md:text-3xl max-md:mb-1.5" : "text-4xl mb-3",
    creditName: isModal ? "text-xl font-bold text-gray-200 mb-1 max-md:text-lg max-md:mb-0.5" : "text-xl font-bold text-gray-200 mb-1",
    creditSubtitle: isModal ? "text-xs text-gray-400 mb-3 max-md:mb-1.5" : "text-xs text-gray-400 mb-3",
    creditPrice: isModal ? "text-2xl font-bold text-emerald-400 mb-1 max-md:text-xl max-md:mb-0.5" : "text-2xl font-bold text-emerald-400 mb-1",
    creditUnit: isModal ? "text-sm text-gray-400 max-md:text-xs" : "text-sm text-gray-400",
    buyBtn: isModal ? "w-full py-2.5 rounded-lg font-semibold transition-all max-md:py-2 max-md:text-sm" : "w-full py-3 rounded-lg font-semibold transition-all",
    subCardBody: isModal ? "boutique-sub-card__header text-center mb-3 max-md:mb-2.5" : "boutique-sub-card__header text-center mb-5",
    subIconWrap: isModal ? "w-12 h-12 mx-auto mb-2.5 rounded-full max-md:w-11 max-md:h-11 max-md:mb-2" : "w-16 h-16 mx-auto mb-4 rounded-full",
    subIcon: isModal ? "w-6 h-6 max-md:w-5 max-md:h-5" : "w-8 h-8",
    subName: isModal ? "text-lg font-bold text-gray-200 mb-1 max-md:text-base max-md:mb-0.5" : "text-xl font-bold text-gray-200 mb-2",
    subQuota: isModal ? "mb-2 text-sm text-gray-300 max-md:mb-1 max-md:text-xs" : "mb-2 text-sm text-gray-300",
    subPrice: isModal ? "text-xl font-bold text-violet-400 mb-0.5 max-md:text-lg max-md:mb-0.5" : "text-2xl font-bold text-violet-400 mb-1",
    subPriceNote: isModal ? "block text-xs font-normal text-gray-400 mt-0.5 max-md:text-xs" : "block text-sm font-normal text-gray-400 mt-1",
    subPriceThen: isModal ? "block text-sm font-semibold text-gray-200 mt-1 max-md:text-sm max-md:mt-0.5" : "block text-base font-semibold text-gray-200 mt-2",
    subSavings: isModal ? "text-xs text-emerald-400 font-medium mt-1 max-md:text-xs" : "text-sm text-emerald-400 font-medium mt-2",
    subFeatures: isModal
      ? "boutique-sub-card__features mb-3 flex-1 space-y-2 max-md:mb-2.5 max-md:space-y-1.5"
      : "boutique-sub-card__features mb-5 flex-1 space-y-2.5",
    subFeatureItem: isModal ? "flex items-center gap-1.5 text-xs text-gray-300 max-md:gap-1 max-md:text-[11px]" : "flex items-center gap-2 text-sm text-gray-300",
    subFeatureCheck: isModal ? "w-3.5 h-3.5 text-emerald-400 flex-shrink-0 max-md:w-3 max-md:h-3" : "w-4 h-4 text-emerald-400 flex-shrink-0",
    subActions: isModal ? "boutique-sub-card__actions mt-auto shrink-0 space-y-3 max-md:space-y-2" : "boutique-sub-card__actions mt-auto shrink-0 space-y-3",
    subLearnMore: isModal
      ? "w-full py-2 rounded-lg border border-white/15 text-sm text-gray-200 hover:bg-white/5 transition-colors max-md:py-1.5 max-md:text-xs"
      : "w-full py-2 rounded-lg border border-white/15 text-sm text-gray-200 hover:bg-white/5 transition-colors",
    secureBlock: "mt-8 p-4 rounded-lg",
    secureInner: "flex items-start gap-3",
    secureIcon: "w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0",
    secureTitle: "text-sm text-gray-300 mb-1",
    secureNote: "text-xs text-gray-400",
    popularBadge: isModal ? "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold max-md:-top-2.5 max-md:px-2 max-md:py-0.5 max-md:text-[10px]" : "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold",
  };

  return (
    <div className={wrapperClass}>
      {paymentLoading && (
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
        </div>
      </div>

      {paymentStatus === "success" && (
        <div className={`bg-emerald-500/10 border border-emerald-500/30 ${m.alertBox}`}>
          <CheckCircle className={`text-emerald-400 ${m.alertIcon}`} />
          <div className="flex-1">
            <p className={`text-emerald-300 font-medium${isModal ? " max-md:text-sm" : ""}`}>Paiement réussi !</p>
            <p className={m.alertBody}>
              Ton achat est en cours de prise en compte.
            </p>
          </div>
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

      <div className={isModal ? "flex min-h-0 flex-1 flex-col" : undefined}>
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
                disabled={paymentLoading}
                className={`${m.buyBtn} mt-auto ${
                  pkg.popular
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-white/10 hover:bg-white/20 text-gray-200 border border-white/20"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {paymentLoading ? (
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
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isHighlighted = highlightPlanId === plan.id;
            const PlanIcon =
              plan.id === "image_9" ? ImageIcon : plan.id === "pro_59" ? Zap : Crown;
            const iconWrapClass =
              plan.id === "image_9"
                ? "bg-emerald-500/20 border border-emerald-500/30"
                : plan.id === "pro_59"
                  ? "bg-sky-500/20 border border-sky-500/30"
                  : "bg-violet-500/20 border border-violet-500/30";
            const iconClass =
              plan.id === "image_9"
                ? "text-emerald-400"
                : plan.id === "pro_59"
                  ? "text-sky-400"
                  : "text-violet-400";
            const accentBorder =
              plan.id === "image_9"
                ? "border-emerald-500/50 bg-emerald-500/5 shadow-lg shadow-emerald-500/10"
                : plan.id === "pro_59"
                  ? "border-sky-500/50 bg-sky-500/5 shadow-lg shadow-sky-500/10"
                  : "border-violet-500/50 bg-violet-500/5 shadow-lg shadow-violet-500/10";
            const badgeClass =
              plan.id === "image_9"
                ? "bg-emerald-500"
                : plan.id === "pro_59"
                  ? "bg-sky-500"
                  : "bg-violet-500";

            return (
            <div
              key={plan.id}
              className={`${m.subCard} ${
                isHighlighted
                  ? `${accentBorder} ring-2 ring-emerald-500/40`
                  : plan.popular
                  ? accentBorder
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              {(plan.popular || isHighlighted) && (
                <div className={`${badgeClass} text-white ${m.popularBadge}`}>
                  {isHighlighted ? "Pour vous" : "Recommandé"}
                </div>
              )}
              <div className={m.subCardBody}>
                <div className={`${iconWrapClass} flex items-center justify-center ${m.subIconWrap}`}>
                  <PlanIcon className={`${iconClass} ${m.subIcon}`} />
                </div>
                <h3 className={m.subName}>{plan.name}</h3>
                <div className={m.subPrice}>
                  {plan.id === "premium_129" ? (
                    <>
                      64,50 €
                      <span className={m.subPriceNote}>
                        −50 % le 1er mois — offre de lancement
                      </span>
                      <span className={m.subPriceThen}>
                        puis 129 €/mois
                      </span>
                    </>
                  ) : plan.id === "pro_59" ? (
                    <>
                      59,00 €
                      <span className={m.subPriceNote}>/ mois</span>
                    </>
                  ) : (
                    <>
                      9,00 €
                      <span className={m.subPriceNote}>/ mois</span>
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
                      startPayment(
                        plan.id === "image_9"
                          ? payImage9()
                          : plan.id === "pro_59"
                            ? payPro59()
                            : payPremium129(),
                      ),
                    );
                  }}
                  disabled={paymentLoading || subscription !== null}
                  className={`${m.buyBtn} mt-auto ${
                    plan.popular
                      ? "bg-violet-500 hover:bg-violet-600 text-white"
                      : plan.id === "image_9"
                        ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                        : plan.id === "pro_59"
                          ? "bg-sky-500 hover:bg-sky-600 text-white"
                          : "bg-white/10 hover:bg-white/20 text-gray-200 border border-white/20"
                  } ${subscription ? "opacity-50 cursor-not-allowed" : ""} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {paymentLoading ? (
                    <Loader2 className="w-5 h-5 mx-auto animate-spin" />
                  ) : subscription ? (
                    "Déjà abonné"
                  ) : (
                    "S'abonner"
                  )}
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
      </div>

      <ModalCadeauBienvenue
        open={showGiftModal}
        onConfirmed={handleGiftFlowComplete}
        onClose={handleGiftModalClose}
      />

      {!isModal && (
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
      )}
    </div>
  );
}
