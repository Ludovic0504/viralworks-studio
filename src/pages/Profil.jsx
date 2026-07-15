
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
import { getUserProfile, readCachedUserProfile, updateUserProfile, uploadAvatar, deleteAvatar } from "@/bibliotheque/supabase/profil";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { useT } from "@/contexte/FournisseurLocale";
import { useBoutiqueModal } from "@/contexte/ContexteModalBoutique";
import ModalConfirmAnnulationAbonnement from "@/composants/boutique/ModalConfirmAnnulationAbonnement";
import { useStripePayment, payImage9, payPro59, payPremium129 } from "@/hooks/useStripePayment";
import { SECTORS, getSectorLabelForDisplay } from "@/bibliotheque/sectorDefaults";
import { 
  User, Mail, Calendar, Settings, LogOut, Edit2, Save, X, 
  FileText, Image as ImageIcon, Video, Sparkles,
  Clock, ExternalLink, Coins, Shield, ShoppingBag, CreditCard, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, Upload, Briefcase, Trash2, Crown, AlertTriangle,
  Download, Share2, Link as LinkIcon, Copy, Check, Info
} from "lucide-react";

const LS_HISTORY = "history_v2";

function loadLocalHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS_HISTORY) || "[]");
  } catch {
    return [];
  }
}

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

function profileToFormData(userProfile) {
  if (!userProfile) {
    return {
      first_name: "",
      last_name: "",
      full_name: "",
      job: "",
      birth_date: "",
      avatar_url: "",
      secteur: "",
    };
  }
  return {
    first_name: userProfile.first_name || "",
    last_name: userProfile.last_name || "",
    full_name: userProfile.full_name || "",
    job: userProfile.job || "",
    birth_date: userProfile.birth_date || "",
    avatar_url: userProfile.avatar_url || "",
    secteur: userProfile.secteur != null ? String(userProfile.secteur) : "",
  };
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
  const { openBoutiqueModal, subscriptionDetails, refreshSubscriptionDetails } = useBoutiqueModal();
  const subscription = subscriptionDetails?.subscription ?? null;
  const subscriptionPlanName = subscriptionDetails?.planName ?? null;
  const subscriptionPlanKey = subscriptionDetails?.planKey ?? null;
  const { runWithAuth } = useRequireAuthAction();
  const { startPayment } = useStripePayment();
  const [isEditing, setIsEditing] = useState(false);
  const [recentHistory, setRecentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [credits, setCredits] = useState(() => resolveInitialCredits(session));
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [profile, setProfile] = useState(() => resolveInitialProfile(session));
  const [profileRefreshing, setProfileRefreshing] = useState(
    () => Boolean(session?.user?.id) && !readCachedUserProfile(session?.user?.id),
  );
  const [saving, setSaving] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);
  const [selectedVideoItem, setSelectedVideoItem] = useState(null);
  const [downloadFormat, setDownloadFormat] = useState("png");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showQuotaDetails, setShowQuotaDetails] = useState(false);
  const [creditBuckets, setCreditBuckets] = useState(() => resolveInitialCreditBuckets(session));
  /** Compteurs studio (localStorage) : générations déjà faites dans le cycle courant. */
  const [workflowStudioUsage, setWorkflowStudioUsage] = useState(() => getWorkflowUsage());
  
  const [formData, setFormData] = useState(() => profileToFormData(resolveInitialProfile(session)));

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const cached = readCachedUserProfile(userId);
    if (cached) {
      setProfile(cached);
      setFormData(profileToFormData(cached));
      setProfileRefreshing(false);
    } else {
      const preview = profilePreviewFromSession(session);
      if (preview) {
        setProfile((prev) => prev ?? preview);
        setFormData((prev) => (prev.first_name || prev.last_name || prev.full_name ? prev : profileToFormData(preview)));
      }
      setProfileRefreshing(true);
    }

    void loadProfile(userId);
    void loadCredits(userId);

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
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "credit_transactions", filter: `user_id=eq.${userId}` },
        () => {
          loadCredits();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_credit_buckets", filter: `user_id=eq.${userId}` },
        () => {
          loadCredits();
        }
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

  const loadSubscription = async () => {
    await refreshSubscriptionDetails({ skipCache: true });
  };

  const loadProfile = async (userId = session?.user?.id) => {
    if (!userId) return;
    const hadCachedProfile = Boolean(readCachedUserProfile(userId));
    if (!hadCachedProfile) setProfileRefreshing(true);
    try {
      const userProfile = await getUserProfile(userId);
      if (userProfile) {
        setProfile(userProfile);
        setFormData(profileToFormData(userProfile));
        if (userProfile.role) {
          setUserRole(userProfile.role === "admin" ? "admin" : "user");
        }
      }
    } catch (err) {
      console.error("Erreur chargement profil:", err);
    } finally {
      setProfileRefreshing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateUserProfile({
        first_name: formData.first_name,
        last_name: formData.last_name,
        full_name: formData.full_name || `${formData.first_name} ${formData.last_name}`.trim(),
        job: formData.job,
        birth_date: formData.birth_date,
        avatar_url: formData.avatar_url,
        secteur: formData.secteur.trim() || null,
      });

      if (result.success) {
        await loadProfile();
        setIsEditing(false);
      } else {
        alert(`Erreur: ${result.error}`);
      }
    } catch (err) {
      console.error("Erreur sauvegarde profil:", err);
      alert("Erreur lors de la sauvegarde du profil");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    try {
      if (formData.avatar_url) {
        await deleteAvatar(formData.avatar_url);
      }

      const result = await uploadAvatar(file);
      if (result.success && result.url) {
        setFormData({ ...formData, avatar_url: result.url });
        await updateUserProfile({ avatar_url: result.url });
        await loadProfile();
      } else {
        alert(`Erreur upload: ${result.error}`);
      }
    } catch (err) {
      console.error("Erreur upload avatar:", err);
      alert("Erreur lors de l'upload de l'avatar");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!formData.avatar_url) return;

    try {
      await deleteAvatar(formData.avatar_url);
      setFormData({ ...formData, avatar_url: "" });
      await updateUserProfile({ avatar_url: "" });
      await loadProfile();
    } catch (err) {
      console.error("Erreur suppression avatar:", err);
      alert("Erreur lors de la suppression de l'avatar");
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
        alert(result.message || "Abonnement annulé avec succès. Il restera actif jusqu'à la fin de la période.");
        await loadSubscription();
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

  const handleDownloadImage = async (url, format = "png") => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout lors du chargement de l'image"));
        }, 30000); // 30 secondes max
        
        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          if (img.crossOrigin) {
            console.warn("Erreur CORS, tentative sans crossOrigin");
            img.crossOrigin = null;
            img.src = url;
          } else {
            reject(new Error("Impossible de charger l'image. Vérifiez que l'URL est accessible."));
          }
        };
        
        img.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        throw new Error("Impossible de créer le contexte canvas");
      }

      ctx.drawImage(img, 0, 0);

      const mimeType = format === "jpg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
      
      const blob = await new Promise((resolve, reject) => {
        if (format === "png") {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Erreur lors de la conversion en PNG"));
              }
            },
            mimeType
          );
        } else {
          const quality = format === "jpg" ? 0.92 : 0.9;
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error(`Erreur lors de la conversion en ${format.toUpperCase()}`));
              }
            },
            mimeType,
            quality
          );
        }
      });

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `image.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn("Erreur conversion canvas (CORS), téléchargement direct:", err);
      
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        
        let extension = format;
        const contentType = blob.type;
        if (contentType.includes("jpeg") || contentType.includes("jpg")) {
          extension = "jpg";
        } else if (contentType.includes("webp")) {
          extension = "webp";
        } else if (contentType.includes("png")) {
          extension = "png";
        } else {
          const urlMatch = url.match(/\.(jpg|jpeg|png|webp)/i);
          if (urlMatch) {
            extension = urlMatch[1].toLowerCase();
          }
        }
        
        link.download = `image.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        
        if (extension !== format) {
          alert(`⚠️ Conversion impossible (CORS). Image téléchargée au format ${extension.toUpperCase()} (format original).`);
        }
      } catch (fetchErr) {
        console.error("Erreur téléchargement direct:", fetchErr);
        alert(`Erreur lors du téléchargement : ${err.message || "Erreur inconnue"}\n\nSi le problème persiste, essayez de télécharger l'image directement depuis son URL.`);
      }
    }
  };

  const handleCopyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("✅ URL copiée dans le presse-papiers !");
    } catch (err) {
      console.error("Erreur copie:", err);
      alert("Impossible de copier l'URL");
    }
  };

  const handleShare = async (url, title, text) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || "Image générée",
          text: text || "Image générée avec IA",
          url: url,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Erreur partage:", err);
          handleCopyUrl(url);
        }
      }
    } else {
      handleCopyUrl(url);
    }
  };

  const handleSendEmail = (url, title, text) => {
    const subject = encodeURIComponent(title || "Image générée avec IA");
    const body = encodeURIComponent(
      `${text || "Image générée"}\n\nLien : ${url}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleLogout = async () => {
    try {
      await signOut?.();
    } catch (err) {
      console.error("Erreur déconnexion:", err);
    }
  };

  const getKindIcon = (kind) => {
    switch (kind) {
      case "prompt": return <FileText className="w-4 h-4" />;
      case "image": return <ImageIcon className="w-4 h-4" />;
      case "video": return <Video className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getKindLabel = (kind) => {
    switch (kind) {
      case "prompt": return "Texte";
      case "image": return "Image";
      case "video": return "Vidéo";
      default: return kind;
    }
  };

  const getKindPath = (kind) => {
    switch (kind) {
      case "prompt": return "/viralworks";
      case "image": return "/viralworks";
      case "video": return "/viralworks";
      default: return "/";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Date inconnue";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());

  const getProxyUrl = (imageUrl) => {
    if (!imageUrl) return "";
    const normalizedUrl = String(imageUrl).trim().replace(/^http:\/\//i, "https://");
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return normalizedUrl;

    const isHailuoUrl =
      normalizedUrl.includes("hailuo-image") || normalizedUrl.includes("aliyuncs.com");
    if (!isHailuoUrl) return normalizedUrl;

    const encodedUrl = encodeURIComponent(normalizedUrl);
    return `${supabaseUrl}/functions/v1/image-proxy?url=${encodedUrl}`;
  };

  const getImageUrls = (item) => {
    if (Array.isArray(item?.metadata?.urls) && item.metadata.urls.length > 0) {
      return item.metadata.urls
        .map((u) => getProxyUrl(u))
        .filter(Boolean);
    }
    if (typeof item?.metadata?.urls === "string" && item.metadata.urls.trim()) {
      return [getProxyUrl(item.metadata.urls)];
    }
    if (Array.isArray(item?.urls) && item.urls.length > 0) {
      return item.urls
        .map((u) => getProxyUrl(u))
        .filter(Boolean);
    }
    if (typeof item?.url === "string" && item.url.trim()) {
      return [getProxyUrl(item.url)];
    }
    return [];
  };

  const getVideoImageUrl = (item) => {
    const candidates = [
      item?.metadata?.hookImageUrl,
      item?.metadata?.image_url,
      item?.metadata?.imageUrl,
      item?.hookImageUrl,
      item?.metadata?.url,
    ];
    const found = candidates.find((v) => isHttpUrl(v));
    return found ? getProxyUrl(found) : "";
  };

  const compactText = (value, max = 120) => {
    const clean = String(value || "").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    return clean.length > max ? `${clean.slice(0, max)}…` : clean;
  };

  const getPaymentStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "pending":
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "cancelled":
        return <XCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPaymentStatusLabel = (status) => {
    switch (status) {
      case "completed":
        return "Payé";
      case "pending":
        return "En attente";
      case "failed":
        return "Échoué";
      case "cancelled":
        return "Annulé";
      default:
        return status;
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "text-emerald-400";
      case "pending":
        return "text-yellow-400";
      case "failed":
        return "text-red-400";
      case "cancelled":
        return "text-gray-400";
      default:
        return "text-gray-400";
    }
  };

  if (!session) {
    return null;
  }

  const user = session.user;
  const email = user.email;
  const createdAt = user.created_at ? new Date(user.created_at).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }) : "Date inconnue";

  /** Solde workflow (user_credits) : c’est ce que vérifient Prompt, Image, Vidéo et le studio. */
  const workflowBal = credits === null ? null : Number(credits) || 0;
  const workflowPackCount = workflowBal === null ? null : Math.max(0, workflowBal);

  // 1 crédit workflow complet = 1 texte, 3 générations image, 5 modifications image,
  // 1 génération vidéo + 1 variante vidéo. Les « restants » soustraient l’usage studio (local).
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

  return (
    <div className="profil-page mx-auto w-full min-w-0 max-w-5xl px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
      {showQuotaDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowQuotaDetails(false)}
        >
          <div
            className="glass-strong max-h-[min(90dvh,32rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 p-4 sm:max-h-none sm:overflow-visible sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-100">Détails des quotas</h3>
              <button
                type="button"
                onClick={() => setShowQuotaDetails(false)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-sm text-emerald-100 font-medium">Workflow vidéo (complet)</p>
                <p className="text-xs text-emerald-300 mt-1">
                  Même solde que la carte « Vidéos disponibles » :{" "}
                  {credits !== null ? credits : "…"}
                </p>
                <p className="text-[11px] text-emerald-300/90 mt-1">
                  Packs workflow actifs : {workflowPackCount === null ? "…" : workflowPackCount}
                </p>
              </div>
              <p className="text-[11px] text-gray-500 px-0.5">
                Les « restants » tiennent compte de ton utilisation dans ViralWorks Studio (compteur local,
                mois en cours). Le solde workflow serveur (carte ci-dessus) ne diminue qu’à la fin du
                parcours lorsque la vidéo est débitée du solde. Les bonus admin s’ajoutent par catégorie.
              </p>
              <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-3">
                <p className="text-sm text-cyan-100">Texte - génération</p>
                <p className="text-xs text-cyan-200 mt-1 font-medium">
                  Restant (studio) : {quotaTextRem === null ? "…" : quotaTextRem}
                </p>
                <p className="text-[11px] text-cyan-300/90 mt-1">
                  Plafond {quotaTextCap === null ? "…" : quotaTextCap} · Déjà utilisé :{" "}
                  {u.scriptAttemptsUsed || 0} · Workflow (
                  {workflowPackCount === null ? "…" : workflowPackCount} × {WORKFLOW_LIMITS.scriptAttempts}) ·
                  Bonus : {creditBuckets.text_generation}
                </p>
              </div>
              <div className="rounded-lg border border-violet-500/25 bg-violet-500/10 p-3">
                <p className="text-sm text-violet-100">Image</p>
                <p className="text-xs text-violet-200 mt-1 font-medium">
                  Génération — restant (studio) : {quotaImgGenRem === null ? "…" : quotaImgGenRem}
                </p>
                <p className="text-[11px] text-violet-300/90">
                  Plafond {quotaImgGenCap === null ? "…" : quotaImgGenCap} · Déjà utilisé :{" "}
                  {u.imageGenerationsUsed || 0} · Workflow (
                  {workflowPackCount === null ? "…" : workflowPackCount} × {WORKFLOW_LIMITS.imageGenerations})
                  · Bonus : {creditBuckets.image_generation}
                </p>
                <p className="text-xs text-violet-200 mt-2 font-medium">
                  Modification — restant (studio) : {quotaImgModRem === null ? "…" : quotaImgModRem}
                </p>
                <p className="text-[11px] text-violet-300/90">
                  Plafond {quotaImgModCap === null ? "…" : quotaImgModCap} · Déjà utilisé :{" "}
                  {u.imageModificationsUsed || 0} · Workflow (
                  {workflowPackCount === null ? "…" : workflowPackCount} ×{" "}
                  {WORKFLOW_LIMITS.imageModifications}) · Bonus : {creditBuckets.image_modification}
                </p>
              </div>
              <div className="rounded-lg border border-yellow-500/25 bg-yellow-500/10 p-3">
                <p className="text-sm text-yellow-100">Vidéo</p>
                <p className="text-xs text-yellow-200 mt-1 font-medium">
                  Génération — restant (studio) : {quotaVidGenRem === null ? "…" : quotaVidGenRem}
                </p>
                <p className="text-[11px] text-yellow-300/90 mt-1">
                  Plafond {quotaVidGenCap === null ? "…" : quotaVidGenCap} · Passages vidéo lancés :{" "}
                  {vAttempts} · Workflow ({workflowPackCount === null ? "…" : workflowPackCount} × 1) · Bonus
                  : {creditBuckets.video_generation}
                </p>
                <p className="text-xs text-yellow-200 mt-2 font-medium">
                  Variante (si la 1re ne convient pas) — restant (studio) :{" "}
                  {quotaVidVarRem === null ? "…" : quotaVidVarRem}
                </p>
                <p className="text-[11px] text-yellow-300/90">
                  Plafond variante {quotaVidVarCap === null ? "…" : quotaVidVarCap} · Workflow (
                  {workflowPackCount === null ? "…" : workflowPackCount} × 1)
                </p>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-4">
              Chaque pack workflow complet définit un plafond ; les lignes « restant » se mettent à jour
              dès qu’une étape consomme un quota dans le studio (y compris sans fermer ce pop-up).
            </p>
          </div>
        </div>
      )}
      <div className="profil-layout">
        <ProfilSection
          title={t("profile.title")}
          icon={User}
          action={
            !isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="profil-edit-btn"
                title="Modifier le profil"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            ) : null
          }
        >
          {profileRefreshing ? (
            <p className="mb-2 text-xs text-gray-500">Mise à jour…</p>
          ) : null}
          {isEditing ? (
            <div className="space-y-4">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="relative">
                  {formData.avatar_url ? (
                    <div className="relative group">
                      <img
                        src={formData.avatar_url}
                        alt="Avatar"
                        className="w-24 h-24 rounded-full object-cover border-2 border-emerald-500/30"
                      />
                      <button
                        onClick={handleRemoveAvatar}
                        className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Supprimer l'avatar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/30 flex items-center justify-center">
                      <User className="w-12 h-12 text-emerald-400" />
                    </div>
                  )}
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={avatarUploading}
                  />
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium transition-all">
                    {avatarUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />
                        Upload...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        {formData.avatar_url ? "Changer l'avatar" : "Ajouter un avatar"}
                      </>
                    )}
                  </div>
                </label>
              </div>

              {/* Formulaire */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">{t("auth.firstName")}</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    placeholder="Votre prénom"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">{t("auth.lastName")}</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    placeholder="Votre nom"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">{t("auth.email")}</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">L'email ne peut pas être modifié</p>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    Métier
                  </label>
                  <input
                    type="text"
                    value={formData.job}
                    onChange={(e) => setFormData({ ...formData, job: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    placeholder="Votre métier"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Secteur d&apos;activité (Studio)</label>
                  <input
                    type="text"
                    list="profil-secteur-suggestions"
                    value={formData.secteur}
                    onChange={(e) => setFormData({ ...formData, secteur: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    placeholder="ex. artisan_btp ou une courte description…"
                  />
                  <datalist id="profil-secteur-suggestions">
                    {SECTORS.map((s) => (
                      <option key={s.id} value={s.id} label={`${s.icon} ${s.label}`} />
                    ))}
                  </datalist>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Choisis une suggestion ou précise ton activité en texte libre (comme à l&apos;inscription Studio).
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Date de naissance
                  </label>
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
              </div>

              {/* Boutons */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 font-medium transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />
                      {t("profile.saving")}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {t("profile.save")}
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    loadProfile(); // Recharger pour annuler les modifications
                  }}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="profil-profile-header">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="profil-avatar" />
                ) : (
                  <div className="profil-avatar-fallback">
                    <User className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-100">
                    {profile?.full_name || profile?.first_name || profile?.last_name
                      ? `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || profile?.full_name
                      : profileRefreshing
                        ? "Chargement…"
                        : t("profile.notProvided")}
                  </p>
                  <p className="truncate text-xs text-gray-500">{email}</p>
                </div>
              </div>

              <div className="profil-info-list">
                <ProfilInfoRow icon={Mail} label={t("auth.email")}>
                  {email}
                </ProfilInfoRow>

                {profile?.job ? (
                  <ProfilInfoRow icon={Briefcase} label="Métier">
                    {profile.job}
                  </ProfilInfoRow>
                ) : null}

                {profile?.secteur && String(profile.secteur).trim() ? (
                  <ProfilInfoRow icon={Sparkles} label="Secteur (Studio)">
                    {getSectorLabelForDisplay(String(profile.secteur))}
                  </ProfilInfoRow>
                ) : null}

                {profile?.birth_date ? (
                  <ProfilInfoRow icon={Calendar} label="Date de naissance">
                    {new Date(profile.birth_date).toLocaleDateString("fr-FR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </ProfilInfoRow>
                ) : null}

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
                ) : null}

                <div className="profil-info-row profil-info-row--videos">
                  <Video className="profil-info-icon" strokeWidth={2} aria-hidden />
                  <div className="profil-info-value profil-info-value--videos min-w-0 flex-1">
                    <span className="profil-videos-count">{credits !== null ? credits : "…"}</span>
                    <span className="profil-videos-label">{t("profile.videosAvailable")}</span>
                    <div className="profil-videos-credit-actions">
                        <button
                          type="button"
                          onClick={() => setShowQuotaDetails(true)}
                          className="profil-videos-credit-btn profil-videos-credit-btn--info"
                          title="Voir workflow vidéo et autres quotas"
                          aria-label="Voir workflow vidéo et autres quotas"
                        >
                          <Info className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openBoutiqueModal("packs-videos")}
                          className="profil-videos-credit-btn profil-videos-credit-btn--buy"
                          aria-label={t("shop.buyVideos")}
                          title={t("shop.buyVideos")}
                        >
                          <ShoppingBag className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </ProfilSection>

        <div className="profil-section-stack">
          <ProfilSection title="Paramètres" icon={Settings}>
            <button onClick={handleLogout} className="profil-action-btn" type="button">
              <div className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                <span>{t("auth.signOut")}</span>
              </div>
            </button>
          </ProfilSection>

          <ProfilSection title="Historique des paiements" icon={CreditCard}>
            {payments.length > 0 ? (
              <>
                <div>
                  {(showAllPayments ? payments : payments.slice(0, 3)).map((payment) => (
                    <div
                      key={payment.id}
                      className="profil-list-row flex-col sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          {getPaymentStatusIcon(payment.status)}
                          <p className="text-sm font-medium text-gray-200">
                            {payment.amount.toFixed(2)} €
                          </p>
                          <span className={`text-xs font-medium ${getPaymentStatusColor(payment.status)}`}>
                            {getPaymentStatusLabel(payment.status)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {formatDate(payment.created_at)}
                          {payment.metadata?.credits && ` • ${payment.metadata.credits} vidéos`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {payments.length > 3 && (
                  <button
                    onClick={() => setShowAllPayments(!showAllPayments)}
                    className="profil-expand-btn"
                    type="button"
                  >
                    {showAllPayments ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        {t("profile.seeLess")}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        {t("profile.seeAll")} ({payments.length})
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <div className="profil-empty">Aucun paiement</div>
            )}
          </ProfilSection>

          <ProfilSection title={t("profile.mySubscription")} icon={Crown} iconClass="text-violet-400">
            {subscription ? (
              <div className="profil-subpanel profil-subpanel--violet">
                  <div className="mb-3">
                    <span className="text-sm font-semibold text-violet-300">
                      {subscriptionPlanName ?? "Abonnement actif"}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span className="shrink-0 text-gray-400">Statut:</span>
                      <span className="font-medium capitalize text-emerald-400 sm:text-right">{subscription.status}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                      <span className="shrink-0 text-gray-400">Période actuelle:</span>
                      <span className="min-w-0 break-words text-gray-200 sm:text-right">
                        {new Date(subscription.current_period_start).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short"
                        })} - {new Date(subscription.current_period_end).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })}
                      </span>
                    </div>
                    {subscription.cancel_at_period_end && (
                      <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-yellow-300 font-medium mb-1">Abonnement annulé</p>
                          <p className="text-xs text-yellow-400">
                            Votre abonnement restera actif jusqu'au {new Date(subscription.current_period_end).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "long",
                              year: "numeric"
                            })}. Vous continuerez à bénéficier de tous les avantages jusqu'à cette date.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {!subscription.cancel_at_period_end && (
                    <button
                      onClick={handleCancelSubscription}
                      disabled={cancellingSubscription}
                      className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 font-medium transition-all disabled:opacity-50"
                    >
                      {cancellingSubscription ? (
                        <>
                          <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                          Annulation...
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          Annuler l'abonnement
                        </>
                      )}
                    </button>
                  )}
              </div>
            ) : (
              <div className="profil-empty">
                <Crown className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                <p className="mb-3">Vous n&apos;avez pas d&apos;abonnement actif</p>
                <button
                  type="button"
                  onClick={() => openBoutiqueModal("subscription")}
                  className="inline-flex items-center gap-2 rounded-md border border-[#2e2840] bg-[#1a1724] px-3 py-1.5 text-sm font-medium text-violet-300 transition-colors hover:bg-[#211c2c]"
                >
                  <Crown className="h-4 w-4" />
                  Voir les abonnements
                </button>
              </div>
            )}
          </ProfilSection>

          <ProfilSection title="Transactions vidéo" icon={Coins}>
            {transactions.length > 0 ? (
              <>
                <div>
                  {(showAllTransactions ? transactions : transactions.slice(0, 3)).map((tx) => (
                    <div key={tx.id} className="profil-list-row items-start sm:items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium text-gray-200">
                          {tx.reason === "prompt_generation" && "Génération de prompt"}
                          {tx.reason === "image_generation" && "Génération d'image"}
                          {tx.reason === "video_generation" && "Génération de vidéo"}
                          {tx.reason === "admin_manual" && "Ajout manuel"}
                          {tx.reason === "admin_manual_workflow_video" && "Admin - vidéos workflow"}
                          {tx.reason === "admin_manual_text_generation" && "Admin - quota texte"}
                          {tx.reason === "admin_manual_image_generation" && "Admin - quota image (génération)"}
                          {tx.reason === "admin_manual_image_modification" && "Admin - quota image (modification)"}
                          {tx.reason === "admin_manual_video_generation" && "Admin - quota vidéo (génération)"}
                          {tx.reason === "stripe_payment" && "Achat de vidéos"}
                          {tx.reason === "subscription_payment" && "Abonnement"}
                          {tx.reason === "subscription_renewal" && "Renouvellement abonnement"}
                          {!tx.reason && "Transaction"}
                        </p>
                        <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
                      </div>
                      <div className={`shrink-0 text-sm font-semibold ${tx.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </div>
                    </div>
                  ))}
                </div>
                {transactions.length > 3 && (
                  <button
                    onClick={() => setShowAllTransactions(!showAllTransactions)}
                    className="profil-expand-btn"
                    type="button"
                  >
                    {showAllTransactions ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        {t("profile.seeLess")}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        {t("profile.seeAll")} ({transactions.length})
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <div className="profil-empty">Aucune transaction</div>
            )}
          </ProfilSection>

          <ProfilSection
            title={t("profile.photoGallery")}
            icon={ImageIcon}
            iconClass="text-violet-400"
            action={
              <Link
                to="/galerie"
                className="flex w-fit items-center gap-1 text-[11px] text-emerald-400 transition-colors hover:text-emerald-300"
              >
                Voir toute la galerie
                <ExternalLink className="h-3 w-3" />
              </Link>
            }
          >
            {historyLoading ? (
              <div className="profil-empty">Chargement...</div>
            ) : (() => {
              const images = recentHistory
                .map((h) => ({ ...h, resolvedUrls: getImageUrls(h) }))
                .filter((h) => h.kind === "image" && h.resolvedUrls.length > 0);
              return images.length > 0 ? (
                <>
                  <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {images.slice(0, 12).map((item, index) => {
                      const imageUrl = item.resolvedUrls[0];
                      const isSelected = selectedImageUrl === imageUrl;
                      const imageModel = String(item.model || item.meta?.model || item.metadata?.model || "").toUpperCase();
                      return (
                        <div
                          key={index}
                          onClick={() => setSelectedImageUrl(isSelected ? null : imageUrl)}
                          className={`profil-gallery-thumb group relative aspect-square cursor-pointer overflow-hidden transition-all ${
                            isSelected ? "is-selected" : ""
                          }`}
                        >
                          <img
                            src={imageUrl}
                            alt={item.input || "Image"}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-violet-500/80 text-white text-[10px] font-semibold">
                              IMAGE
                            </span>
                            {imageModel ? (
                              <span className="px-1.5 py-0.5 rounded bg-black/70 border border-white/20 text-white text-[10px] font-medium">
                                {imageModel}
                              </span>
                            ) : null}
                          </div>
                          {isSelected && (
                            <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                                <Check className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="absolute bottom-0 left-0 right-0 p-2">
                              <p className="text-xs text-white line-clamp-2 mb-1">
                                {compactText(item.input, 90) || "Image validée"}
                              </p>
                              <p className="text-[10px] text-gray-300">{formatDate(item.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Panneau d'actions pour l'image sélectionnée */}
                  {selectedImageUrl && (
                    <div className="profil-subpanel profil-subpanel--emerald mb-3">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-emerald-300 flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" />
                          Image sélectionnée
                        </label>
                        <button
                          onClick={() => setSelectedImageUrl(null)}
                          className="text-gray-400 hover:text-gray-200 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Sélection du format de téléchargement */}
                      <div className="mb-3">
                        <label className="block text-xs text-gray-400 mb-2">Format de téléchargement</label>
                        <div className="flex gap-2">
                          {["png", "jpg", "webp"].map((format) => (
                            <button
                              key={format}
                              onClick={() => setDownloadFormat(format)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                downloadFormat === format
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                                  : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
                              }`}
                            >
                              {format.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleDownloadImage(selectedImageUrl, downloadFormat)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-sm font-medium transition-all"
                        >
                          <Download className="w-4 h-4" />
                          {t("common.download")} ({downloadFormat.toUpperCase()})
                        </button>
                        <button
                          onClick={() => handleCopyUrl(selectedImageUrl)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-sm font-medium transition-all"
                        >
                          <Copy className="w-4 h-4" />
                          {t("common.copy")}
                        </button>
                        <button
                          onClick={() => {
                            const item = images.find(img => img.resolvedUrls?.[0] === selectedImageUrl);
                            handleShare(selectedImageUrl, "Image générée", item?.input || "Image générée avec IA");
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-sm font-medium transition-all"
                        >
                          <Share2 className="w-4 h-4" />
                          {t("common.share")}
                        </button>
                        <button
                          onClick={() => {
                            const item = images.find(img => img.resolvedUrls?.[0] === selectedImageUrl);
                            handleSendEmail(selectedImageUrl, "Image générée avec IA", item?.input || "Image générée");
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 text-sm font-medium transition-all"
                        >
                          <Mail className="w-4 h-4" />
                          Envoyer par mail
                        </button>
                        <a
                          href={selectedImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/30 text-gray-300 text-sm font-medium transition-all"
                        >
                          <LinkIcon className="w-4 h-4" />
                          Ouvrir dans un nouvel onglet
                        </a>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="profil-empty">Aucune image</div>
              );
            })()}
          </ProfilSection>

          <ProfilSection
            title={t("profile.videoGallery")}
            icon={Video}
            iconClass="text-yellow-400"
            action={
              <Link
                to="/galerie"
                className="flex w-fit items-center gap-1 text-[11px] text-emerald-400 transition-colors hover:text-emerald-300"
              >
                Voir toute la galerie
                <ExternalLink className="h-3 w-3" />
              </Link>
            }
          >
            {historyLoading ? (
              <div className="profil-empty">Chargement...</div>
            ) : (() => {
              const videos = recentHistory
                .filter(h => h.kind === "video")
                .map((h) => ({
                  ...h,
                  videoUrl: isHttpUrl(h?.output) ? String(h.output).trim() : "",
                  videoImageUrl: getVideoImageUrl(h),
                  promptText: isHttpUrl(h?.output) ? (h.input || "") : (h.output || h.input || ""),
                }))
                .filter((h) => h.videoUrl);
              return videos.length > 0 ? (
                <>
                  <div className="mb-3">
                    {videos.slice(0, 6).map((item, index) => {
                      const isSelected = selectedVideoItem?.id === item.id;
                      const modelLabel = String(item.model || "").toUpperCase();
                      return (
                        <div
                          key={index}
                          onClick={() => setSelectedVideoItem(isSelected ? null : item)}
                          className={`profil-list-row cursor-pointer items-center ${
                            isSelected ? "text-yellow-200" : ""
                          }`}
                        >
                          <div className="profil-gallery-thumb flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden">
                            {item.videoImageUrl ? (
                              <img src={item.videoImageUrl} alt="Visuel vidéo" className="w-full h-full object-cover" loading="lazy" />
                            ) : isSelected ? (
                              <Check className="w-6 h-6 text-yellow-400" />
                            ) : (
                              <Video className="w-6 h-6 text-yellow-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded bg-yellow-500/80 text-black text-[10px] font-semibold">
                                {item.videoUrl ? "VIDEO" : "PROMPT"}
                              </span>
                              {modelLabel ? (
                                <span className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-white text-[10px] font-medium">
                                  {modelLabel}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm font-medium text-gray-200 truncate">
                              {item.videoUrl
                                ? compactText(item.input, 80) || "Vidéo générée"
                                : compactText(item.promptText, 80) || "Prompt vidéo"}
                            </p>
                            <p className="text-xs text-gray-400">{formatDate(item.created_at)}</p>
                          </div>
                          {isSelected && (
                            <Check className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Panneau d'actions pour la vidéo sélectionnée */}
                  {selectedVideoItem && (
                    <div className="profil-subpanel profil-subpanel--yellow mb-3">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-yellow-300 flex items-center gap-2">
                          <Video className="w-4 h-4" />
                          Vidéo sélectionnée
                        </label>
                        <button
                          onClick={() => setSelectedVideoItem(null)}
                          className="text-gray-400 hover:text-gray-200 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mb-3 p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-yellow-500/80 text-black text-[10px] font-semibold">
                            {selectedVideoItem.videoUrl ? "VIDEO" : "PROMPT"}
                          </span>
                          {selectedVideoItem.model ? (
                            <span className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-white text-[10px] font-medium">
                              {String(selectedVideoItem.model).toUpperCase()}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-gray-300 mb-1">
                          {compactText(selectedVideoItem.input || selectedVideoItem.promptText, 220) || "Création vidéo"}
                        </p>
                      </div>
                      {selectedVideoItem.videoUrl ? (
                        <div className="mb-3 rounded-lg overflow-hidden border border-white/10 bg-black/50">
                          <video
                            src={selectedVideoItem.videoUrl}
                            controls
                            className="w-full max-h-[320px] bg-black"
                          />
                        </div>
                      ) : null}
                      {selectedVideoItem.videoImageUrl ? (
                        <div className="mb-3 rounded-lg overflow-hidden border border-white/10 bg-black/30">
                          <img src={selectedVideoItem.videoImageUrl} alt="Visuel utilisé" className="w-full max-h-[220px] object-cover" loading="lazy" />
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {selectedVideoItem.videoUrl ? (
                          <>
                            <button
                              onClick={() => handleCopyUrl(selectedVideoItem.videoUrl)}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 text-sm font-medium transition-all"
                            >
                              <Copy className="w-4 h-4" />
                              Copier le lien vidéo
                            </button>
                            <a
                              href={selectedVideoItem.videoUrl}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-sm font-medium transition-all"
                            >
                              <Download className="w-4 h-4" />
                              {t("common.download")}
                            </a>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              const prompt = selectedVideoItem.promptText || selectedVideoItem.input;
                              if (prompt) {
                                navigator.clipboard.writeText(prompt).then(() => {
                                  alert("✅ Prompt copié dans le presse-papiers !");
                                }).catch(() => {
                                  alert("Impossible de copier le prompt");
                                });
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 text-sm font-medium transition-all"
                          >
                            <Copy className="w-4 h-4" />
                            Copier le prompt
                          </button>
                        )}
                        <button
                          onClick={() => {
                            handleShare(
                              selectedVideoItem.videoUrl || window.location.href,
                              "Vidéo générée",
                              selectedVideoItem.input || "Vidéo générée avec IA"
                            );
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-sm font-medium transition-all"
                        >
                          <Share2 className="w-4 h-4" />
                          {t("common.share")}
                        </button>
                        <button
                          onClick={() => {
                            handleSendEmail(
                              selectedVideoItem.videoUrl || window.location.href,
                              "Vidéo générée avec IA",
                              selectedVideoItem.input || "Vidéo générée"
                            );
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 text-sm font-medium transition-all"
                        >
                          <Mail className="w-4 h-4" />
                          Envoyer par mail
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="profil-empty">Aucune vidéo</div>
              );
            })()}
          </ProfilSection>

          <ProfilSection title="Historique récent" icon={Clock}>
            {historyLoading ? (
              <div className="profil-empty">Chargement...</div>
            ) : recentHistory.length > 0 ? (
              <>
                <div>
                  {(showAllHistory ? recentHistory : recentHistory.slice(0, 3)).map((item, index) => (
                    <Link
                      key={index}
                      to={getKindPath(item.kind)}
                      className="profil-list-row group"
                    >
                      <div className="profil-list-row-icon">
                        {getKindIcon(item.kind)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-200">{getKindLabel(item.kind)}</p>
                        <p className="text-xs text-gray-400">{formatDate(item.created_at)}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0 text-gray-500 transition-colors group-hover:text-emerald-400" />
                    </Link>
                  ))}
                </div>
                {recentHistory.length > 3 && (
                  <button
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className="profil-expand-btn"
                    type="button"
                  >
                    {showAllHistory ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        {t("profile.seeLess")}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        {t("profile.seeAll")} ({recentHistory.length})
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <div className="profil-empty">Aucun historique</div>
            )}
          </ProfilSection>
        </div>
      </div>

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
