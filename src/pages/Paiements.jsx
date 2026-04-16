import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexte/FournisseurAuth";
import { getUserCredits } from "@/bibliotheque/supabase/credits";
import { redirectToCheckout, getUserSubscription } from "@/bibliotheque/supabase/stripe";
import { 
  Coins, CreditCard, Sparkles, Check, Zap, Crown, 
  Loader2, CheckCircle, XCircle, ArrowLeft
} from "lucide-react";

const CREDIT_PACKAGES = [
  { id: "starter", name: "Starter", credits: 3, price: 9.99, popular: false },
  { id: "pro", name: "Pro", credits: 10, price: 39.99, popular: true },
  { id: "expert", name: "Expert", credits: 30, price: 99.99, popular: false },
];

const SUBSCRIPTION_PLANS = [
  {
    id: "monthly",
    name: "Abonnement Mensuel",
    credits: 1000,
    price: 29.99,
    period: "mois",
    popular: true,
    features: ["1000 crédits/mois", "Support prioritaire", "Accès à toutes les fonctionnalités"],
  },
  {
    id: "yearly",
    name: "Abonnement Annuel",
    credits: 12000,
    price: 299.99,
    period: "an",
    popular: false,
    features: ["12000 crédits/an", "Économisez 17%", "Support prioritaire", "Accès à toutes les fonctionnalités"],
  },
];

export default function Paiements() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [credits, setCredits] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("credits");

  const paymentStatus = searchParams.get("payment");

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session]);

  useEffect(() => {
    if (paymentStatus === "success") {
      setTimeout(() => {
        loadData();
      }, 2000);
    }
  }, [paymentStatus]);

  const loadData = async () => {
    try {
      const userCredits = await getUserCredits();
      setCredits(userCredits);

      const userSubscription = await getUserSubscription();
      setSubscription(userSubscription);
    } catch (err) {
      console.error("Erreur chargement données:", err);
    }
  };

  const handlePurchaseCredits = async (packageId) => {
    const packageData = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!packageData) return;

    setLoading(true);
    try {
      await redirectToCheckout(packageData.price, packageData.credits, "credits");
    } catch (err) {
      console.error("Erreur achat crédits:", err);
      const errorMessage = err?.message || "Erreur lors de l'achat. Veuillez réessayer.";
      console.error("Détails de l'erreur:", errorMessage);
      alert(`Erreur lors de l'achat: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId) => {
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
    if (!plan) return;

    setLoading(true);
    try {
      await redirectToCheckout(plan.price, plan.credits, "subscription");
    } catch (err) {
      console.error("Erreur abonnement:", err);
      const errorMessage = err?.message || "Erreur lors de l'abonnement. Veuillez réessayer.";
      console.error("Détails de l'erreur:", errorMessage);
      alert(`Erreur lors de l'abonnement: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-400">Veuillez vous connecter pour accéder aux paiements.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Message de succès/échec */}
      {paymentStatus === "success" && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <p className="text-emerald-300">Paiement réussi ! Vos crédits ont été ajoutés à votre compte.</p>
        </div>
      )}

      {paymentStatus === "cancelled" && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-300">Paiement annulé.</p>
        </div>
      )}

      {/* En-tête */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/profil")}
          className="mb-4 flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au profil
        </button>
        <h1 className="text-3xl font-bold text-gray-200 mb-2">Acheter des crédits</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <Coins className="w-5 h-5 text-emerald-400" />
            <span className="text-lg font-semibold text-gray-200">
              {credits !== null ? credits : "..."} crédits disponibles
            </span>
          </div>
          {subscription && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/10 border border-violet-500/30">
              <Crown className="w-5 h-5 text-violet-400" />
              <span className="text-sm text-violet-300">Abonnement actif</span>
            </div>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div className="mb-8 flex gap-4 border-b border-white/10">
        <button
          onClick={() => setActiveTab("credits")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "credits"
              ? "text-emerald-400 border-b-2 border-emerald-400"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Achat de crédits
        </button>
        <button
          onClick={() => setActiveTab("subscription")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "subscription"
              ? "text-emerald-400 border-b-2 border-emerald-400"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Abonnements
        </button>
      </div>

      {/* Contenu des onglets */}
      {activeTab === "credits" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CREDIT_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`glass-strong rounded-2xl border p-6 relative ${
                pkg.popular
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-white/10"
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-semibold">
                  Populaire
                </div>
              )}
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-200 mb-2">{pkg.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-200">{pkg.credits}</span>
                  <span className="text-gray-400 ml-2">crédits</span>
                </div>
                <div className="text-2xl font-bold text-emerald-400 mb-1">
                  {pkg.price.toFixed(2)} €
                </div>
                <div className="text-sm text-gray-400">
                  {(pkg.price / pkg.credits).toFixed(3)} € / crédit
                </div>
              </div>
              <button
                onClick={() => handlePurchaseCredits(pkg.id)}
                disabled={loading}
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  pkg.popular
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-white/10 hover:bg-white/20 text-gray-200 border border-white/20"
                }`}
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
              className={`glass-strong rounded-2xl border p-6 relative ${
                plan.popular
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-white/10"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-semibold">
                  Recommandé
                </div>
              )}
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                  <Crown className="w-8 h-8 text-violet-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-200 mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-200">{plan.credits}</span>
                  <span className="text-gray-400 ml-2">crédits</span>
                </div>
                <div className="text-2xl font-bold text-violet-400 mb-1">
                  {plan.price.toFixed(2)} € / {plan.period}
                </div>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading || subscription !== null}
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  plan.popular
                    ? "bg-violet-500 hover:bg-violet-600 text-white"
                    : "bg-white/10 hover:bg-white/20 text-gray-200 border border-white/20"
                } ${subscription ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 mx-auto animate-spin" />
                ) : subscription ? (
                  "Déjà abonné"
                ) : (
                  "S'abonner"
                )}
              </button>
            </div>
          ))}
        </div>
      )}

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
