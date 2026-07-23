import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexte/FournisseurAuth";
import { listHistory } from "@/bibliotheque/supabase/historique";
import {
  getProfilCreditsSnapshot,
  readCachedProfilCreditsSnapshot,
  getCreditTransactions,
  USER_CREDITS_UPDATED_EVENT,
} from "@/bibliotheque/supabase/credits";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import {
  getWorkflowUsage,
  WORKFLOW_LIMITS,
  WORKFLOW_QUOTA_STORAGE_KEY,
  WORKFLOW_QUOTA_UPDATED_EVENT,
} from "@/bibliotheque/workflowQuota";
import { getUserPayments, cancelSubscription } from "@/bibliotheque/supabase/stripe";
import { getUserProfile, readCachedUserProfile } from "@/bibliotheque/supabase/profil";
import { useT } from "@/contexte/FournisseurLocale";
import { useBoutiqueModal } from "@/contexte/ContexteModalBoutique";
import ModalConfirmAnnulationAbonnement from "@/composants/boutique/ModalConfirmAnnulationAbonnement";
import TableauDeBordProfil from "@/composants/profil/TableauDeBordProfil";
import SectionTransactionsProfil from "@/composants/profil/SectionTransactionsProfil";
import { listImageStudioHistory } from "@/bibliotheque/imageStudio/imageStudioHistory";
import {
  listSocialConnections,
  startSocialOAuth,
  disconnectSocialProvider,
  fetchSocialInsights,
} from "@/bibliotheque/supabase/socialConnections";
import {
  User,
  Mail,
  Calendar,
  Settings,
  LogOut,
  X,
  Shield,
  Info,
  LayoutDashboard,
  Receipt,
} from "lucide-react";

function normalizeHistory(items = []) {
  return (items || [])
    .map((h) => ({
      ...h,
      created_at: h.created_at || h.createdAt || null,
      createdAt: h.createdAt || h.created_at || null,
      input: h.input ?? h.prompt ?? "",
      output: h.output ?? "",
      metadata: h.metadata ?? {},
    }))
    .sort((a, b) => {
      const ta = new Date(a.created_at || a.createdAt || 0).getTime();
      const tb = new Date(b.created_at || b.createdAt || 0).getTime();
      return tb - ta;
    });
}

/** Affichage immédiat depuis JWT / OAuth pendant le fetch Supabase. */
function profilePreviewFromSession(session) {
  const user = session?.user;
  if (!user?.id) return null;
  const meta = user.user_metadata || {};
  const stamp = user.created_at || new Date().toISOString();
  return {
    user_id: user.id,
    email: user.email,
    full_name: typeof meta.full_name === "string" ? meta.full_name : undefined,
    first_name: typeof meta.first_name === "string" ? meta.first_name : undefined,
    last_name: typeof meta.last_name === "string" ? meta.last_name : undefined,
    avatar_url:
      typeof meta.avatar_url === "string"
        ? meta.avatar_url
        : typeof meta.picture === "string"
          ? meta.picture
          : undefined,
    role: "user",
    created_at: stamp,
    updated_at: stamp,
  };
}

function resolveInitialProfile(session) {
  const userId = session?.user?.id;
  if (!userId) return null;
  return readCachedUserProfile(userId) ?? profilePreviewFromSession(session);
}

function resolveInitialCredits(session) {
  const userId = session?.user?.id;
  const snapshot = readCachedProfilCreditsSnapshot(userId);
  if (!snapshot) return null;
  return snapshot.credits;
}

function resolveInitialCreditBuckets(session) {
  const snapshot = readCachedProfilCreditsSnapshot(session?.user?.id);
  return (
    snapshot?.buckets ?? {
      text_generation: 0,
      image_generation: 0,
      image_modification: 0,
      video_generation: 0,
    }
  );
}

function ProfilSection({ title, icon: Icon, iconClass = "text-emerald-400", action, children, className = "" }) {
  return (
    <section className={`profil-section${className ? ` ${className}` : ""}`}>
      <div className="profil-section-head">
        <div className="profil-section-head-main">
          {Icon ? <Icon className={`profil-section-icon ${iconClass}`} strokeWidth={2} aria-hidden /> : null}
          <h3 className="profil-section-title">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ProfilInfoRow({ icon: Icon, label, children, tone = "default" }) {
  return (
    <div className={`profil-info-row${tone !== "default" ? ` profil-info-row--${tone}` : ""}`}>
      {Icon ? <Icon className="profil-info-icon" strokeWidth={2} aria-hidden /> : null}
      <div className="profil-info-content">
        <p className="profil-info-label">{label}</p>
        <div className="profil-info-value">{children}</div>
      </div>
    </div>
  );
}

export default function Profil() {
  const t = useT();
  const { session, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openBoutiqueModal, subscriptionDetails, refreshSubscriptionDetails } = useBoutiqueModal();
  const subscription = subscriptionDetails?.subscription ?? null;
  const subscriptionPlanName = subscriptionDetails?.planName ?? null;
  const subscriptionPlanKey = subscriptionDetails?.planKey ?? null;

  const activeTab =
    searchParams.get("tab") === "settings"
      ? "settings"
      : searchParams.get("tab") === "transactions"
        ? "transactions"
        : "dashboard";

  const setActiveTab = (tab) => {
    if (tab === "settings") {
      setSearchParams({ tab: "settings" }, { replace: true });
    } else if (tab === "transactions") {
      setSearchParams({ tab: "transactions" }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const [recentHistory, setRecentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [credits, setCredits] = useState(() => resolveInitialCredits(session));
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [profile, setProfile] = useState(() => resolveInitialProfile(session));
  const [showQuotaDetails, setShowQuotaDetails] = useState(false);
  const [creditBuckets, setCreditBuckets] = useState(() => resolveInitialCreditBuckets(session));
  const [workflowStudioUsage, setWorkflowStudioUsage] = useState(() => getWorkflowUsage());
  const [imageStudioHistory, setImageStudioHistory] = useState([]);
  const [imageStudioHistoryLoading, setImageStudioHistoryLoading] = useState(false);
  const [socialConnections, setSocialConnections] = useState([]);
  const [socialBusyProvider, setSocialBusyProvider] = useState(null);
  const [socialFlash, setSocialFlash] = useState(null);
  const [socialInsights, setSocialInsights] = useState([]);
  const [socialInsightsLoading, setSocialInsightsLoading] = useState(false);
  const [socialInsightsError, setSocialInsightsError] = useState(null);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const cached = readCachedUserProfile(userId);
    if (cached) {
      setProfile(cached);
    } else {
      const preview = profilePreviewFromSession(session);
      if (preview) setProfile((prev) => prev ?? preview);
    }

    void loadProfile(userId);
    void loadCredits(userId);
    void loadSocialConnections();

    const historyTimer = window.setTimeout(() => {
      void loadRecentHistory(userId);
    }, 0);

    const paymentsTimer = window.setTimeout(() => {
      void loadPayments(userId);
      void loadTransactions(userId);
    }, 250);

    return () => {
      window.clearTimeout(historyTimer);
      window.clearTimeout(paymentsTimer);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session) return;
    const refresh = () => {
      void loadRecentHistory();
    };
    const refreshCreditsOnly = () => {
      void loadCredits();
      setWorkflowStudioUsage(getWorkflowUsage());
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        loadRecentHistory();
        loadCredits();
      }
    };
    window.addEventListener("onetool:history:changed", refresh);
    window.addEventListener(USER_CREDITS_UPDATED_EVENT, refreshCreditsOnly);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("onetool:history:changed", refresh);
      window.removeEventListener(USER_CREDITS_UPDATED_EVENT, refreshCreditsOnly);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`profil-credits-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_credits", filter: `user_id=eq.${userId}` },
        () => {
          loadCredits();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "credit_transactions", filter: `user_id=eq.${userId}` },
        () => {
          loadCredits();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_credit_buckets", filter: `user_id=eq.${userId}` },
        () => {
          loadCredits();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (showQuotaDetails && session?.user?.id) {
      void loadCredits();
      setWorkflowStudioUsage(getWorkflowUsage());
    }
  }, [showQuotaDetails, session?.user?.id]);

  useEffect(() => {
    const syncStudioUsage = () => setWorkflowStudioUsage(getWorkflowUsage());
    syncStudioUsage();
    window.addEventListener(WORKFLOW_QUOTA_UPDATED_EVENT, syncStudioUsage);
    const onStorage = (e) => {
      if (e.key === WORKFLOW_QUOTA_STORAGE_KEY) syncStudioUsage();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(WORKFLOW_QUOTA_UPDATED_EVENT, syncStudioUsage);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (session) setWorkflowStudioUsage(getWorkflowUsage());
  }, [session]);

  useEffect(() => {
    if (activeTab !== "transactions" || !session?.user?.id) return;
    let cancelled = false;
    setImageStudioHistoryLoading(true);
    void listImageStudioHistory(200)
      .then((rows) => {
        if (!cancelled) setImageStudioHistory(rows || []);
      })
      .catch((err) => {
        console.warn("Erreur chargement historique Image Studio:", err);
        if (!cancelled) setImageStudioHistory([]);
      })
      .finally(() => {
        if (!cancelled) setImageStudioHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, session?.user?.id]);

  useEffect(() => {
    const social = searchParams.get("social");
    if (!social) return;
    const provider = searchParams.get("provider");
    const message = searchParams.get("message");
    if (social === "connected") {
      setSocialFlash({
        type: "ok",
        message: provider
          ? `Compte ${provider} connecté avec succès.`
          : "Compte social connecté avec succès.",
      });
      void loadSocialConnections();
    } else if (social === "error") {
      setSocialFlash({
        type: "error",
        message: message || "La connexion au réseau social a échoué.",
      });
    }
    const next = new URLSearchParams(searchParams);
    next.delete("social");
    next.delete("provider");
    next.delete("message");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!showQuotaDetails) return;
    const id = window.setInterval(() => {
      setWorkflowStudioUsage(getWorkflowUsage());
    }, 1000);
    return () => window.clearInterval(id);
  }, [showQuotaDetails]);

  const loadRecentHistory = async (userId = session?.user?.id) => {
    if (!userId) return;
    setHistoryLoading(true);
    try {
      const allHistory = await listHistory({ limit: 50, userId });
      setRecentHistory(normalizeHistory(allHistory));
    } catch (err) {
      console.warn("Erreur chargement historique récent (Profil):", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadCredits = async (userId = session?.user?.id) => {
    try {
      const snapshot = await getProfilCreditsSnapshot(userId);
      setCredits(snapshot.credits);
      setCreditBuckets(snapshot.buckets);
    } catch (err) {
      console.error("Erreur chargement crédits:", err);
    }
  };

  const loadTransactions = async (userId = session?.user?.id) => {
    try {
      const userTransactions = await getCreditTransactions(100, userId);
      setTransactions(userTransactions);
    } catch (err) {
      console.error("Erreur chargement transactions:", err);
    }
  };

  const loadPayments = async (userId = session?.user?.id) => {
    try {
      const userPayments = await getUserPayments(100, userId);
      setPayments(userPayments);
    } catch (err) {
      console.error("Erreur chargement paiements:", err);
    }
  };

  const loadProfile = async (userId = session?.user?.id) => {
    if (!userId) return;
    try {
      const userProfile = await getUserProfile(userId);
      if (userProfile) {
        setProfile(userProfile);
        if (userProfile.role) {
          setUserRole(userProfile.role === "admin" ? "admin" : "user");
        }
      }
    } catch (err) {
      console.error("Erreur chargement profil:", err);
    }
  };

  const loadSocialConnections = async () => {
    try {
      const rows = await listSocialConnections();
      const connected = rows.filter((r) => r.status === "connected");
      setSocialConnections(connected);
      if (connected.length > 0) {
        void loadSocialInsights();
      } else {
        setSocialInsights([]);
        setSocialInsightsError(null);
      }
    } catch (err) {
      console.warn("Erreur chargement connexions sociales:", err);
      setSocialConnections([]);
      setSocialInsights([]);
    }
  };

  const loadSocialInsights = async (forceRefresh = false) => {
    setSocialInsightsLoading(true);
    setSocialInsightsError(null);
    try {
      const result = await fetchSocialInsights({ forceRefresh });
      if (result.error) {
        setSocialInsightsError(result.error);
        setSocialInsights([]);
        return;
      }
      setSocialInsights(result.data?.providers || []);
    } catch (err) {
      console.warn("Erreur chargement insights sociaux:", err);
      setSocialInsightsError(err instanceof Error ? err.message : "Erreur stats");
      setSocialInsights([]);
    } finally {
      setSocialInsightsLoading(false);
    }
  };

  const handleConnectSocial = async (provider) => {
    setSocialBusyProvider(provider);
    setSocialFlash(null);
    try {
      const result = await startSocialOAuth(provider);
      if (result.error || !result.url) {
        setSocialFlash({
          type: "error",
          message: result.error || "Impossible de démarrer la connexion.",
        });
        return;
      }
      window.location.assign(result.url);
    } catch (err) {
      setSocialFlash({
        type: "error",
        message: err instanceof Error ? err.message : "Erreur de connexion",
      });
    } finally {
      setSocialBusyProvider(null);
    }
  };

  const handleDisconnectSocial = async (provider) => {
    setSocialBusyProvider(provider);
    setSocialFlash(null);
    try {
      const result = await disconnectSocialProvider(provider);
      if (!result.success) {
        setSocialFlash({
          type: "error",
          message: result.error || "Déconnexion impossible",
        });
        return;
      }
      await loadSocialConnections();
      setSocialFlash({
        type: "ok",
        message: `Compte ${provider} déconnecté.`,
      });
      setSocialInsights((prev) =>
        (prev || []).map((p) =>
          p.provider === provider
            ? {
                ...p,
                status: "not_connected",
                profile: { views: null, likes: null },
                lastPost: null,
                topVideos: [],
              }
            : p,
        ),
      );
    } catch (err) {
      setSocialFlash({
        type: "error",
        message: err instanceof Error ? err.message : "Erreur de déconnexion",
      });
    } finally {
      setSocialBusyProvider(null);
    }
  };

  const handleCancelSubscription = () => {
    if (!subscription) return;
    setCancelModalOpen(true);
  };

  const executeCancelSubscription = async ({ reason, reasonDetail }) => {
    if (!subscription) return;

    setCancellingSubscription(true);
    try {
      const result = await cancelSubscription({
        cancellationReason: reason,
        cancellationReasonDetail: reasonDetail,
      });
      if (result.success) {
        setCancelModalOpen(false);
        alert(
          result.message ||
            "Abonnement annulé avec succès. Il restera actif jusqu'à la fin de la période.",
        );
        await refreshSubscriptionDetails({ skipCache: true });
      } else {
        alert(`Erreur: ${result.error}`);
      }
    } catch (err) {
      console.error("Erreur annulation abonnement:", err);
      alert("Erreur lors de l'annulation de l'abonnement");
    } finally {
      setCancellingSubscription(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut?.();
    } catch (err) {
      console.error("Erreur déconnexion:", err);
    }
  };

  const getKindPath = (kind) => {
    switch (kind) {
      case "prompt":
        return "/viralworks";
      case "image":
        return "/image-studio";
      case "video":
        return "/viralworks";
      default:
        return "/";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      return new Date(dateString).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(dateString);
    }
  };

  if (!session) {
    return null;
  }

  const user = session.user;
  const email = user.email;
  const createdAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Date inconnue";

  const workflowBal = credits === null ? null : Number(credits) || 0;
  const workflowPackCount = workflowBal === null ? null : Math.max(0, workflowBal);
  const u = workflowStudioUsage;

  const quotaTextCap =
    workflowPackCount === null
      ? null
      : workflowPackCount * WORKFLOW_LIMITS.scriptAttempts + (creditBuckets.text_generation || 0);
  const quotaTextRem =
    quotaTextCap === null ? null : Math.max(0, quotaTextCap - (u.scriptAttemptsUsed || 0));

  const quotaImgGenCap =
    workflowPackCount === null
      ? null
      : workflowPackCount * WORKFLOW_LIMITS.imageGenerations + (creditBuckets.image_generation || 0);
  const quotaImgGenRem =
    quotaImgGenCap === null ? null : Math.max(0, quotaImgGenCap - (u.imageGenerationsUsed || 0));

  const quotaImgModCap =
    workflowPackCount === null
      ? null
      : workflowPackCount * WORKFLOW_LIMITS.imageModifications +
        (creditBuckets.image_modification || 0);
  const quotaImgModRem =
    quotaImgModCap === null ? null : Math.max(0, quotaImgModCap - (u.imageModificationsUsed || 0));

  const vAttempts = u.videoAttemptsUsed || 0;
  const quotaVidGenCap =
    workflowPackCount === null
      ? null
      : workflowPackCount * 1 + (creditBuckets.video_generation || 0);
  const quotaVidGenRem =
    quotaVidGenCap === null ? null : Math.max(0, quotaVidGenCap - Math.min(1, vAttempts));

  const quotaVidVarCap = workflowPackCount === null ? null : workflowPackCount * 1;
  const quotaVidVarRem =
    quotaVidVarCap === null ? null : Math.max(0, quotaVidVarCap - Math.max(0, vAttempts - 1));

  const displayName =
    profile?.first_name?.trim() ||
    profile?.full_name?.trim() ||
    (profile?.last_name ? String(profile.last_name).trim() : "") ||
    "";

  let planSubtitle = t("profile.freePlan");
  if (subscription && subscriptionPlanName) {
    const end = subscription.current_period_end
      ? new Date(subscription.current_period_end).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;
    const statusBit =
      subscription.status === "active" || subscription.status === "trialing"
        ? "actif"
        : subscription.status;
    planSubtitle = end
      ? `${subscriptionPlanName} · ${statusBit} jusqu'au ${end}`
      : `${subscriptionPlanName} · ${statusBit}`;
  }

  const nowForMonth = new Date();
  const creationsThisMonth = (recentHistory || []).filter((h) => {
    const d = new Date(h.created_at || h.createdAt || 0);
    if (Number.isNaN(d.getTime())) return false;
    return d.getFullYear() === nowForMonth.getFullYear() && d.getMonth() === nowForMonth.getMonth();
  }).length;

  const activityForDashboard = (recentHistory || []).filter((h) => {
    const kind = String(h.kind || "").toLowerCase();
    return kind === "image" || kind === "video" || kind === "prompt" || kind === "text";
  });

  return (
    <div className="profil-page mx-auto w-full min-w-0 max-w-5xl px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
      <div className="dash-tabs" role="tablist" aria-label="Navigation profil">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "dashboard"}
          className={`dash-tab${activeTab === "dashboard" ? " is-active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          <LayoutDashboard className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Tableau de bord
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "settings"}
          className={`dash-tab${activeTab === "settings" ? " is-active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          <Settings className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Paramètres
        </button>
        <button
          type="button"
          className={`dash-tab dash-tab--secondary${activeTab === "transactions" ? " is-active" : ""}`}
          onClick={() => setActiveTab("transactions")}
          aria-pressed={activeTab === "transactions"}
        >
          <Receipt className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Transactions
        </button>
      </div>

      {showQuotaDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowQuotaDetails(false)}
        >
          <div
            className="glass-strong max-h-[min(90dvh,32rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 p-4 sm:max-h-none sm:overflow-visible sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-100">Détails des quotas</h3>
              <button
                type="button"
                onClick={() => setShowQuotaDetails(false)}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-300 hover:bg-white/10"
                title="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-sm font-medium text-emerald-100">Workflow vidéo (complet)</p>
                <p className="mt-1 text-xs text-emerald-300">
                  Même solde que la carte « Vidéos disponibles » : {credits !== null ? credits : "…"}
                </p>
                <p className="mt-1 text-[11px] text-emerald-300/90">
                  Packs workflow actifs : {workflowPackCount === null ? "…" : workflowPackCount}
                </p>
              </div>
              <p className="px-0.5 text-[11px] text-gray-500">
                Les « restants » tiennent compte de ton utilisation dans ViralWorks Studio (compteur
                local, mois en cours).
              </p>
              <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-3">
                <p className="text-sm text-cyan-100">Texte - génération</p>
                <p className="mt-1 text-xs font-medium text-cyan-200">
                  Restant (studio) : {quotaTextRem === null ? "…" : quotaTextRem}
                </p>
                <p className="mt-1 text-[11px] text-cyan-300/90">
                  Plafond {quotaTextCap === null ? "…" : quotaTextCap} · Déjà utilisé :{" "}
                  {u.scriptAttemptsUsed || 0} · Bonus : {creditBuckets.text_generation}
                </p>
              </div>
              <div className="rounded-lg border border-violet-500/25 bg-violet-500/10 p-3">
                <p className="text-sm text-violet-100">Image</p>
                <p className="mt-1 text-xs font-medium text-violet-200">
                  Génération — restant : {quotaImgGenRem === null ? "…" : quotaImgGenRem}
                </p>
                <p className="mt-2 text-xs font-medium text-violet-200">
                  Modification — restant : {quotaImgModRem === null ? "…" : quotaImgModRem}
                </p>
              </div>
              <div className="rounded-lg border border-yellow-500/25 bg-yellow-500/10 p-3">
                <p className="text-sm text-yellow-100">Vidéo</p>
                <p className="mt-1 text-xs font-medium text-yellow-200">
                  Génération — restant : {quotaVidGenRem === null ? "…" : quotaVidGenRem}
                </p>
                <p className="mt-2 text-xs font-medium text-yellow-200">
                  Variante — restant : {quotaVidVarRem === null ? "…" : quotaVidVarRem}
                </p>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-2 text-[11px] text-gray-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Les compteurs se mettent à jour dès qu’une étape consomme un quota dans le studio.
            </p>
          </div>
        </div>
      )}

      {activeTab === "dashboard" ? (
        <TableauDeBordProfil
          displayName={displayName}
          planSubtitle={planSubtitle}
          avatarUrl={profile?.avatar_url || ""}
          accountCreatedLabel={createdAt}
          isAdmin={userRole === "admin"}
          videosRemaining={credits}
          creationsThisMonth={creationsThisMonth}
          networksConnected={socialConnections.length}
          socialConnections={socialConnections}
          socialBusyProvider={socialBusyProvider}
          socialFlash={socialFlash}
          socialInsights={socialInsights}
          socialInsightsLoading={socialInsightsLoading}
          socialInsightsError={socialInsightsError}
          onRefreshSocialInsights={() => loadSocialInsights(true)}
          onConnectSocial={handleConnectSocial}
          onDisconnectSocial={handleDisconnectSocial}
          onDismissSocialFlash={() => setSocialFlash(null)}
          recentActivity={activityForDashboard}
          historyLoading={historyLoading}
          onOpenQuotaCoach={() => setShowQuotaDetails(true)}
          formatDate={formatDate}
          getKindPath={getKindPath}
        />
      ) : activeTab === "transactions" ? (
        <SectionTransactionsProfil
          payments={payments}
          transactions={transactions}
          imageStudioHistory={imageStudioHistory}
          imageStudioHistoryLoading={imageStudioHistoryLoading}
          subscription={subscription}
          subscriptionPlanName={subscriptionPlanName}
          subscriptionPlanKey={subscriptionPlanKey}
          cancellingSubscription={cancellingSubscription}
          onCancelSubscription={handleCancelSubscription}
          openBoutiqueModal={openBoutiqueModal}
          formatDate={formatDate}
          t={t}
        />
      ) : (
        <div className="profil-layout profil-layout--settings">
          <ProfilSection title="Compte" icon={User}>
            <div className="profil-info-list">
              <ProfilInfoRow icon={Mail} label={t("auth.email")}>
                {email}
              </ProfilInfoRow>
              <ProfilInfoRow icon={Calendar} label={t("profile.accountCreated")}>
                {createdAt}
              </ProfilInfoRow>
              {userRole === "admin" ? (
                <ProfilInfoRow icon={Shield} label="Rôle" tone="accent">
                  <div className="flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center">
                    <span>{t("profile.administrator")}</span>
                    <Link to="/admin" className="text-xs text-violet-400 underline hover:text-violet-300">
                      {t("profile.adminPanel")}
                    </Link>
                  </div>
                </ProfilInfoRow>
              ) : (
                <ProfilInfoRow icon={Shield} label="Rôle">
                  Utilisateur
                </ProfilInfoRow>
              )}
            </div>
          </ProfilSection>

          <div className="profil-section-stack">
            <ProfilSection title="Session" icon={LogOut}>
              <button onClick={handleLogout} className="profil-action-btn" type="button">
                <div className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  <span>{t("auth.signOut")}</span>
                </div>
              </button>
            </ProfilSection>
          </div>
        </div>
      )}

      <ModalConfirmAnnulationAbonnement
        open={cancelModalOpen}
        onClose={() => {
          if (!cancellingSubscription) setCancelModalOpen(false);
        }}
        currentPlanKey={subscriptionPlanKey}
        currentPlanName={subscriptionPlanName}
        onConfirmCancel={executeCancelSubscription}
        cancelling={cancellingSubscription}
      />
    </div>
  );
}
