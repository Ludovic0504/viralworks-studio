import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexte/FournisseurAuth";
import { isAdmin, notifyUserCreditsUpdated } from "@/bibliotheque/supabase/credits";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import PageTitle from "../composants/interface/TitrePage";
import {
  Coins,
  Search,
  Plus,
  Minus,
  User,
  Shield,
  Users,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Trash2,
  MailOpen,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  FileText,
  Crown,
  History,
  Image as ImageIcon,
  Video,
  FileEdit,
} from "lucide-react";

export default function Admin() {
  const { session } = useAuth();
  const location = useLocation();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [history, setHistory] = useState([]);
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [selectedNotifIds, setSelectedNotifIds] = useState(() => new Set());
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    recentSignups: 0,
    verifiedEmails: 0,
    totalPayments: 0,
    totalTransactions: 0,
    totalHistory: 0,
    unreadAdminNotifications: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditCategory, setCreditCategory] = useState("workflow_video");
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("users"); // users, payments, transactions, subscriptions, history, notifications

  const visibleNotifIds = useMemo(() => adminNotifications.map((n) => n.id).filter(Boolean), [adminNotifications]);
  const allVisibleSelected = useMemo(() => {
    if (!visibleNotifIds.length) return false;
    for (const id of visibleNotifIds) if (!selectedNotifIds.has(id)) return false;
    return true;
  }, [visibleNotifIds, selectedNotifIds]);
  const selectedCount = selectedNotifIds.size;

  const CREDIT_CATEGORY_OPTIONS = [
    { value: "workflow_video", label: "Workflow vidéo" },
    { value: "text_generation", label: "Texte - génération" },
    { value: "image_generation", label: "Image - génération" },
    { value: "image_modification", label: "Image - modification" },
    { value: "video_generation", label: "Vidéo - génération" },
  ];

  const selectedCreditCategoryLabel =
    CREDIT_CATEGORY_OPTIONS.find((opt) => opt.value === creditCategory)?.label || "Crédits";

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!session) {
        setLoading(false);
        return;
      }

      try {
        const admin = await isAdmin();
        setIsAdminUser(admin);
        if (admin) loadDashboardData();
      } catch (err) {
        console.error("Erreur vérification admin:", err);
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [session]);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const tab = sp.get("tab");
    const allowed = new Set(["users", "payments", "transactions", "subscriptions", "history", "notifications"]);
    if (tab && allowed.has(tab)) setActiveTab(tab);
  }, [location.search]);

  const loadDashboardData = async () => {
    try {
      const supabase = getBrowserSupabase();
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession?.access_token) {
        console.error("Pas de token d'accès");
        return;
      }

      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || "Erreur chargement données");
      }

      if (data) {
        setStats(data.stats || {});
        setUsers(data.users || []);
        setPayments(data.payments || []);
        setTransactions(data.transactions || []);
        setSubscriptions(data.subscriptions || []);
        setHistory(data.history || []);
        setAdminNotifications(data.adminNotifications || []);
        setSelectedNotifIds(new Set());
      }
    } catch (err) {
      console.error("Erreur chargement dashboard:", err);
      alert(`Erreur: ${err.message}`);
    }
  };

  const toggleNotifSelection = (id) => {
    if (!id) return;
    setSelectedNotifIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedNotifIds((prev) => {
      const next = new Set(prev);
      const shouldSelectAll = !allVisibleSelected;
      if (shouldSelectAll) {
        for (const id of visibleNotifIds) next.add(id);
      } else {
        for (const id of visibleNotifIds) next.delete(id);
      }
      return next;
    });
  };

  const runNotifAction = async (action, ids) => {
    const supabase = getBrowserSupabase();
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) throw new Error("Session expirée, reconnectez-vous");

    const payload =
      action === "mark_all_read"
        ? { action }
        : { action, ids: Array.isArray(ids) ? ids : [] };

    const { data, error } = await supabase.functions.invoke("admin-notifications", {
      headers: { Authorization: `Bearer ${currentSession.access_token}` },
      body: payload,
    });

    if (error) throw new Error(error.message || "Erreur action notifications");
    return data;
  };

  const handleMarkRead = async (ids) => {
    const list = Array.isArray(ids) ? ids : Array.from(selectedNotifIds);
    if (!list.length) return;
    setProcessing(true);
    try {
      await runNotifAction("mark_read", list);
      await loadDashboardData();
    } catch (e) {
      alert(`❌ Erreur: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteNotifs = async (ids) => {
    const list = Array.isArray(ids) ? ids : Array.from(selectedNotifIds);
    if (!list.length) return;
    if (!confirm(`Supprimer ${list.length} notification(s) ?`)) return;
    setProcessing(true);
    try {
      await runNotifAction("delete", list);
      await loadDashboardData();
    } catch (e) {
      alert(`❌ Erreur: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleAddCredits = async () => {
    if (!selectedUser || !creditAmount) return;

    setProcessing(true);
    try {
      const targetUserId = selectedUser.user_id || selectedUser.id;
      const parsedAmount = Number.parseInt(creditAmount, 10);
      if (!targetUserId) {
        throw new Error("Utilisateur invalide");
      }
      if (Number.isNaN(parsedAmount) || parsedAmount === 0) {
        throw new Error("Montant invalide");
      }

      const supabase = getBrowserSupabase();
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error("Session expirée, reconnectez-vous");
      }
      const { error } = await supabase.functions.invoke("admin-credits", {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: {
          target_user_id: targetUserId,
          amount: parsedAmount,
          reason: reason || `admin_manual_${creditCategory}`,
          metadata: {
            credit_category: creditCategory,
            credit_category_label: selectedCreditCategoryLabel,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (creditCategory === "workflow_video" && targetUserId === currentSession.user.id) {
        notifyUserCreditsUpdated();
      }

      alert(`✅ ${creditAmount} crédit(s) "${selectedCreditCategoryLabel}" ajouté(s) avec succès !`);
      setCreditAmount("");
      setCreditCategory("workflow_video");
      setReason("");
      setSelectedUser(null);
      loadDashboardData();
    } catch (err) {
      alert(`❌ Erreur: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveCredits = async () => {
    if (!selectedUser || !creditAmount) return;

    setProcessing(true);
    try {
      const targetUserId = selectedUser.user_id || selectedUser.id;
      const parsedAmount = Number.parseInt(creditAmount, 10);
      if (!targetUserId) {
        throw new Error("Utilisateur invalide");
      }
      if (Number.isNaN(parsedAmount) || parsedAmount === 0) {
        throw new Error("Montant invalide");
      }

      const supabase = getBrowserSupabase();
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error("Session expirée, reconnectez-vous");
      }
      const { error } = await supabase.functions.invoke("admin-credits", {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: {
          target_user_id: targetUserId,
          amount: -Math.abs(parsedAmount),
          reason: reason || `admin_manual_${creditCategory}`,
          metadata: {
            credit_category: creditCategory,
            credit_category_label: selectedCreditCategoryLabel,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (creditCategory === "workflow_video" && targetUserId === currentSession.user.id) {
        notifyUserCreditsUpdated();
      }

      alert(`✅ ${creditAmount} crédit(s) "${selectedCreditCategoryLabel}" retiré(s) avec succès !`);
      setCreditAmount("");
      setCreditCategory("workflow_video");
      setReason("");
      setSelectedUser(null);
      loadDashboardData();
    } catch (err) {
      alert(`❌ Erreur: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Jamais";
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      failed: "bg-red-500/20 text-red-300 border-red-500/30",
      active: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      canceled: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    };
    return statusColors[status] || statusColors.pending;
  };

  const formatNotifDate = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredUsers = users.filter(
    (user) =>
      user.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPayments = payments.filter(
    (payment) =>
      payment.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.stripe_session_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.client_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTransactions = transactions.filter(
    (transaction) =>
      transaction.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.client_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHistory = history.filter(
    (item) =>
      item.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.client_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.kind?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.input?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      </div>
    );
  }

  if (!isAdminUser) {
    return (
      <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        <div className="glass-strong rounded-xl p-12 border border-red-500/30 text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-200 mb-2">Accès refusé</h2>
          <p className="text-gray-400">Vous devez être administrateur pour accéder à cette page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="max-lg:[&_h1]:text-2xl max-lg:[&_header]:mb-4 flex-1">
          <PageTitle green="Administration" white="Dashboard" subtitle="Gérer les utilisateurs, paiements et transactions" />
        </div>
        <Link
          to="/admin/stats"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/30 transition-all text-sm shrink-0"
        >
          <BarChart3 className="w-4 h-4" />
          Analytics réseaux
        </Link>
      </div>

      {/* Statistiques globales */}
      <div className="mt-8 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5 lg:gap-4">
        <div className="glass-strong min-w-0 rounded-xl border border-white/10 p-3 lg:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="mb-1 text-[10px] leading-tight text-gray-400 sm:text-xs">Total utilisateurs</p>
              <p className="text-xl font-bold max-lg:text-lg text-gray-200">{stats.totalUsers}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/20 max-lg:h-9 max-lg:w-9">
              <Users className="h-6 w-6 text-blue-400 max-lg:h-5 max-lg:w-5" />
            </div>
          </div>
        </div>

        <div className="glass-strong min-w-0 rounded-xl border border-white/10 p-3 lg:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="mb-1 text-[10px] leading-tight text-gray-400 sm:text-xs">Abonnements actifs</p>
              <p className="text-xl font-bold max-lg:text-lg text-blue-400">{stats.activeSubscriptions}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/20 max-lg:h-9 max-lg:w-9">
              <Crown className="h-6 w-6 text-blue-400 max-lg:h-5 max-lg:w-5" />
            </div>
          </div>
        </div>

        <div className="glass-strong min-w-0 rounded-xl border border-white/10 p-3 lg:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="mb-1 text-[10px] leading-tight text-gray-400 sm:text-xs">Inscriptions (7j)</p>
              <p className="text-xl font-bold max-lg:text-lg text-emerald-400">{stats.recentSignups}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/20 max-lg:h-9 max-lg:w-9">
              <TrendingUp className="h-6 w-6 text-emerald-400 max-lg:h-5 max-lg:w-5" />
            </div>
          </div>
        </div>

        <div className="glass-strong min-w-0 rounded-xl border border-white/10 p-3 lg:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="mb-1 text-[10px] leading-tight text-gray-400 sm:text-xs">Emails vérifiés</p>
              <p className="text-xl font-bold max-lg:text-lg text-green-400">{stats.verifiedEmails}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-green-500/30 bg-green-500/20 max-lg:h-9 max-lg:w-9">
              <CheckCircle className="h-6 w-6 text-green-400 max-lg:h-5 max-lg:w-5" />
            </div>
          </div>
        </div>

        <div className="glass-strong min-w-0 rounded-xl border border-white/10 p-3 lg:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="mb-1 text-[10px] leading-tight text-gray-400 sm:text-xs">Total générations</p>
              <p className="text-xl font-bold max-lg:text-lg text-orange-400">{stats.totalHistory}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/20 max-lg:h-9 max-lg:w-9">
              <History className="h-6 w-6 text-orange-400 max-lg:h-5 max-lg:w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="mt-6">
        <div className="flex gap-2 border-b border-white/10 max-lg:overflow-x-auto max-lg:-mx-4 max-lg:px-4 max-lg:pb-1 max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden max-lg:[-webkit-overflow-scrolling:touch]">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 font-medium transition-all max-lg:shrink-0 max-lg:whitespace-nowrap max-lg:px-3 max-lg:text-sm ${
              activeTab === "users"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Utilisateurs
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`px-4 py-2 font-medium transition-all max-lg:shrink-0 max-lg:whitespace-nowrap max-lg:px-3 max-lg:text-sm ${
              activeTab === "payments"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <CreditCard className="w-4 h-4 inline mr-2" />
            Paiements ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`px-4 py-2 font-medium transition-all max-lg:shrink-0 max-lg:whitespace-nowrap max-lg:px-3 max-lg:text-sm ${
              activeTab === "transactions"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Transactions ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab("subscriptions")}
            className={`px-4 py-2 font-medium transition-all max-lg:shrink-0 max-lg:whitespace-nowrap max-lg:px-3 max-lg:text-sm ${
              activeTab === "subscriptions"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Crown className="w-4 h-4 inline mr-2" />
            Abonnements ({subscriptions.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 font-medium transition-all max-lg:shrink-0 max-lg:whitespace-nowrap max-lg:px-3 max-lg:text-sm ${
              activeTab === "history"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />
            Historique ({history.length})
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`px-4 py-2 font-medium transition-all max-lg:shrink-0 max-lg:whitespace-nowrap max-lg:px-3 max-lg:text-sm ${
              activeTab === "notifications"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <span>Notifications</span>
              {stats.unreadAdminNotifications ? (
                <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {stats.unreadAdminNotifications}
                </span>
              ) : null}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="space-y-6 lg:col-span-2">
          {/* Onglet Utilisateurs */}
          {activeTab === "users" && (
            <div className="glass-strong min-w-0 overflow-hidden rounded-xl border border-white/10 p-4 lg:p-6">
              <div className="mb-4 flex items-center gap-3 max-lg:flex-col max-lg:items-stretch max-lg:gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 max-lg:w-full">
                  <Search className="h-5 w-5 shrink-0 text-gray-400" />
                  <input
                  type="text"
                  placeholder="Rechercher par email ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="min-w-0 w-full flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                </div>
                <button
                  onClick={loadDashboardData}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-gray-300 transition-all hover:bg-white/10 max-lg:self-end"
                  title="Rafraîchir"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Aucun utilisateur trouvé</p>
                </div>
              ) : (
                <>
                  <div className="mb-2 text-xs text-gray-400">
                    {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? "s" : ""}
                  </div>
                  <div className="min-w-0 space-y-2 max-h-[600px] overflow-y-auto">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.user_id}
                        onClick={() => setSelectedUser(user)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedUser?.user_id === user.user_id
                            ? "bg-emerald-500/10 border-emerald-500/50"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                              <User className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium text-gray-200 truncate">
                                  {user.email || "Sans email"}
                                </p>
                                {user.email_verified ? (
                                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" title="Email vérifié" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" title="Email non vérifié" />
                                )}
                                {user.role === "admin" && (
                                  <Shield className="w-4 h-4 text-violet-400 flex-shrink-0" title="Administrateur" />
                                )}
                              </div>
                              <p className="text-xs text-gray-400 font-mono truncate">{user.user_id}</p>
                              <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 max-lg:flex-wrap max-lg:gap-x-3 max-lg:gap-y-1">
                                <span className="flex items-center gap-1">
                                  <Coins className="w-3 h-3" />
                                  Workflow: {user.credits || 0}
                                </span>
                                <span>Texte: {user.credits_text_generation || 0}</span>
                                <span>Img gen: {user.credits_image_generation || 0}</span>
                                <span>Img mod: {user.credits_image_modification || 0}</span>
                                <span>Vidéo gen: {user.credits_video_generation || 0}</span>
                              </div>
                              <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 max-lg:flex-wrap max-lg:gap-x-3 max-lg:gap-y-1">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Inscrit: {formatDate(user.created_at_auth || user.created_at)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Dernière connexion: {formatDate(user.last_sign_in_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Onglet Paiements */}
          {activeTab === "payments" && (
            <div className="glass-strong min-w-0 overflow-hidden rounded-xl border border-white/10 p-4 lg:p-6">
              <div className="mb-4 flex items-center gap-3 max-lg:flex-col max-lg:items-stretch max-lg:gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 max-lg:w-full">
                  <Search className="h-5 w-5 shrink-0 text-gray-400" />
                  <input
                  type="text"
                  placeholder="Rechercher par client, email ou session..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="min-w-0 w-full flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                </div>
                <button
                  onClick={loadDashboardData}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-gray-300 transition-all hover:bg-white/10 max-lg:self-end"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="min-w-0 space-y-2 max-h-[600px] overflow-y-auto">
                {filteredPayments.map((payment) => (
                  <div key={payment.id} className="p-4 rounded-lg border bg-white/5 border-white/10">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs border ${getStatusBadge(payment.status)}`}>
                            {payment.status}
                          </span>
                          <span className="text-sm font-medium text-gray-200">
                            {payment.amount} {payment.currency?.toUpperCase()}
                          </span>
                        </div>
                        <div className="mb-1 flex min-w-0 items-center gap-2">
                          <User className="h-3 w-3 shrink-0 text-gray-400" />
                          <p className="min-w-0 truncate text-xs text-gray-300">
                            <span className="font-medium">{payment.client_email || "Client inconnu"}</span>
                            {payment.client_name && (
                              <span className="ml-1 text-gray-400">({payment.client_name})</span>
                            )}
                          </p>
                        </div>
                        <p
                          className="mb-1 break-all font-mono text-xs text-gray-400"
                          title={payment.stripe_session_id}
                        >
                          Session: {payment.stripe_session_id}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">{formatDate(payment.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Onglet Transactions */}
          {activeTab === "transactions" && (
            <div className="glass-strong min-w-0 overflow-hidden rounded-xl border border-white/10 p-4 lg:p-6">
              <div className="mb-4 flex items-center gap-3 max-lg:flex-col max-lg:items-stretch max-lg:gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 max-lg:w-full">
                  <Search className="h-5 w-5 shrink-0 text-gray-400" />
                  <input
                  type="text"
                  placeholder="Rechercher par client ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="min-w-0 w-full flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                </div>
                <button
                  onClick={loadDashboardData}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-gray-300 transition-all hover:bg-white/10 max-lg:self-end"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="min-w-0 space-y-2 max-h-[600px] overflow-y-auto">
                {filteredTransactions.map((transaction) => (
                  <div key={transaction.id} className="p-4 rounded-lg border bg-white/5 border-white/10">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            transaction.type === 'credit' || transaction.type === 'purchase' || transaction.type === 'admin_add'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}>
                            {transaction.type}
                          </span>
                          <span className={`text-sm font-medium ${
                            transaction.amount > 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {transaction.amount > 0 ? '+' : ''}{transaction.amount} crédits
                          </span>
                        </div>
                        {transaction.reason && (
                          <p className="mb-1 break-words text-xs text-gray-400">Raison: {transaction.reason}</p>
                        )}
                        <div className="mb-1 flex min-w-0 items-center gap-2">
                          <User className="h-3 w-3 shrink-0 text-gray-400" />
                          <p className="min-w-0 truncate text-xs text-gray-300">
                            <span className="font-medium">{transaction.client_email || "Client inconnu"}</span>
                            {transaction.client_name && (
                              <span className="ml-1 text-gray-400">({transaction.client_name})</span>
                            )}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{formatDate(transaction.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Onglet Abonnements */}
          {activeTab === "subscriptions" && (
            <div className="glass-strong min-w-0 overflow-hidden rounded-xl border border-white/10 p-4 lg:p-6">
              <div className="mb-4 flex items-center gap-3 max-lg:flex-col max-lg:items-stretch max-lg:gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 max-lg:w-full">
                  <Search className="h-5 w-5 shrink-0 text-gray-400" />
                  <input
                  type="text"
                  placeholder="Rechercher par client ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="min-w-0 w-full flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                </div>
                <button
                  onClick={loadDashboardData}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-gray-300 transition-all hover:bg-white/10 max-lg:self-end"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="min-w-0 space-y-2 max-h-[600px] overflow-y-auto">
                {subscriptions.filter(s => 
                  !searchTerm || 
                  s.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  s.client_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  s.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
                ).map((subscription) => (
                  <div key={subscription.id} className="p-4 rounded-lg border bg-white/5 border-white/10">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs border ${getStatusBadge(subscription.status)}`}>
                            {subscription.status}
                          </span>
                          {subscription.cancel_at_period_end && (
                            <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                              Annulation prévue
                            </span>
                          )}
                        </div>
                        <div className="mb-1 flex min-w-0 items-center gap-2">
                          <User className="h-3 w-3 shrink-0 text-gray-400" />
                          <p className="min-w-0 truncate text-xs text-gray-300">
                            <span className="font-medium">{subscription.client_email || "Client inconnu"}</span>
                            {subscription.client_name && (
                              <span className="ml-1 text-gray-400">({subscription.client_name})</span>
                            )}
                          </p>
                        </div>
                        <p className="mb-1 break-words text-xs text-gray-400 max-lg:text-[11px]">Période: {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}</p>
                        <p className="text-xs text-gray-500 mt-2">Créé: {formatDate(subscription.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Onglet Historique */}
          {activeTab === "history" && (
            <div className="glass-strong min-w-0 overflow-hidden rounded-xl border border-white/10 p-4 lg:p-6">
              <div className="mb-4 flex items-center gap-3 max-lg:flex-col max-lg:items-stretch max-lg:gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 max-lg:w-full">
                  <Search className="h-5 w-5 shrink-0 text-gray-400" />
                  <input
                  type="text"
                  placeholder="Rechercher par client, type, modèle ou contenu..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="min-w-0 w-full flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                </div>
                <button
                  onClick={loadDashboardData}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-gray-300 transition-all hover:bg-white/10 max-lg:self-end"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="min-w-0 space-y-2 max-h-[600px] overflow-y-auto">
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Aucune génération trouvée</p>
                  </div>
                ) : (
                  filteredHistory.map((item) => {
                    const getKindIcon = () => {
                      switch (item.kind) {
                        case "prompt":
                          return <FileEdit className="w-4 h-4 text-blue-400" />;
                        case "image":
                          return <ImageIcon className="w-4 h-4 text-purple-400" />;
                        case "video":
                          return <Video className="w-4 h-4 text-red-400" />;
                        default:
                          return <FileText className="w-4 h-4 text-gray-400" />;
                      }
                    };

                    const getKindBadge = () => {
                      const colors = {
                        prompt: "bg-blue-500/20 text-blue-300 border-blue-500/30",
                        image: "bg-purple-500/20 text-purple-300 border-purple-500/30",
                        video: "bg-red-500/20 text-red-300 border-red-500/30",
                      };
                      return colors[item.kind] || "bg-gray-500/20 text-gray-300 border-gray-500/30";
                    };

                    return (
                      <div key={item.id} className="p-4 rounded-lg border bg-white/5 border-white/10">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2 max-lg:gap-y-1">
                              {getKindIcon()}
                              <span className={`px-2 py-1 rounded text-xs border ${getKindBadge()}`}>
                                {item.kind?.toUpperCase() || "UNKNOWN"}
                              </span>
                              {item.model && (
                                <span className="px-2 py-1 rounded text-xs bg-gray-500/20 text-gray-300 border border-gray-500/30">
                                  {item.model}
                                </span>
                              )}
                              {item.credits_used !== null && (
                                <span className="px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                  <Coins className="w-3 h-3" />
                                  {item.credits_used} crédit{item.credits_used > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                            
                            <div className="mb-2 flex min-w-0 items-center gap-2">
                              <User className="h-3 w-3 shrink-0 text-gray-400" />
                              <p className="min-w-0 truncate text-xs text-gray-300">
                                <span className="font-medium">{item.client_email || "Client inconnu"}</span>
                                {item.client_name && (
                                  <span className="text-gray-400 ml-1">({item.client_name})</span>
                                )}
                              </p>
                            </div>

                            {item.input && (
                              <p className="text-xs text-gray-400 mb-1 truncate" title={item.input}>
                                <span className="font-medium">Input:</span> {item.input.length > 100 ? item.input.substring(0, 100) + "..." : item.input}
                              </p>
                            )}

                            {item.output && (
                              <p className="text-xs text-gray-400 mb-1 truncate" title={item.output}>
                                <span className="font-medium">Output:</span> {item.output.length > 100 ? item.output.substring(0, 100) + "..." : item.output}
                              </p>
                            )}

                            <p className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              {formatDate(item.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Onglet Notifications */}
          {activeTab === "notifications" && (
            <div className="glass-strong min-w-0 overflow-hidden rounded-xl border border-white/10 p-4 lg:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-200">Notifications admin</p>
                  <p className="text-xs text-gray-400">
                    Dernières notifications (inscriptions, etc.)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={toggleSelectAllVisible}
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Sélectionner tout"
                    disabled={!adminNotifications.length || processing}
                  >
                    {allVisibleSelected ? "Tout désélectionner" : "Tout sélectionner"}
                  </button>
                  <button
                    onClick={() => handleMarkRead()}
                    className="px-3 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 transition-all text-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Marquer comme lu"
                    disabled={processing || selectedCount === 0}
                  >
                    <MailOpen className="w-4 h-4" />
                    Marquer lu{selectedCount ? ` (${selectedCount})` : ""}
                  </button>
                  <button
                    onClick={() => handleDeleteNotifs()}
                    className="px-3 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-200 transition-all text-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Supprimer"
                    disabled={processing || selectedCount === 0}
                  >
                    <Trash2 className="w-4 h-4" />
                    Supprimer{selectedCount ? ` (${selectedCount})` : ""}
                  </button>
                  <button
                    onClick={loadDashboardData}
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Rafraîchir"
                    disabled={processing}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Rafraîchir
                  </button>
                </div>
              </div>

              {adminNotifications.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>Aucune notification</p>
                </div>
              ) : (
                <div className="min-w-0 space-y-2 max-h-[600px] overflow-y-auto">
                  {adminNotifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-4 rounded-lg border transition-all ${
                        n.read_at
                          ? "bg-white/5 border-white/10"
                          : "bg-emerald-500/10 border-emerald-500/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5">
                          <input
                            type="checkbox"
                            checked={Boolean(n.id && selectedNotifIds.has(n.id))}
                            onChange={() => toggleNotifSelection(n.id)}
                            className="h-4 w-4 accent-emerald-500"
                            aria-label="Sélectionner la notification"
                          />
                        </div>

                        <div className="flex min-w-0 flex-1 items-start justify-between gap-3 max-lg:flex-col max-lg:gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-200">
                              {n.title || "Notification"}
                            </p>
                            {n.body ? (
                              <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">
                                {n.body}
                              </p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                              <span>{formatNotifDate(n.created_at)}</span>
                              {n.actor_email ? <span className="truncate">{n.actor_email}</span> : null}
                              {!n.read_at ? (
                                <span className="text-emerald-300">Non lu</span>
                              ) : (
                                <span className="text-gray-400">Lu</span>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-start gap-2 max-lg:w-full max-lg:flex-wrap max-lg:justify-end">
                            {!n.read_at ? (
                              <button
                                onClick={() => handleMarkRead([n.id])}
                                className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 transition-all text-xs inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={processing}
                                title="Marquer comme lu"
                              >
                                <MailOpen className="w-3.5 h-3.5" />
                                Lu
                              </button>
                            ) : null}
                            <button
                              onClick={() => handleDeleteNotifs([n.id])}
                              className="px-2 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-200 transition-all text-xs inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={processing}
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Suppr.
                            </button>
                            <span className="px-2 py-0.5 rounded text-xs bg-white/5 border border-white/10 text-gray-300 self-start">
                              {n.kind || "info"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panneau latéral - Gestion crédits */}
        <div className="lg:col-span-1">
          <div className="glass-strong min-w-0 overflow-hidden rounded-xl border border-white/10 p-4 max-lg:static lg:sticky lg:top-24 lg:p-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-400" />
              Gérer les crédits
            </h3>

            {selectedUser ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-sm text-gray-400 mb-1">Utilisateur sélectionné</p>
                  <p className="text-sm font-medium text-gray-200 truncate">{selectedUser.email || "Sans email"}</p>
                  <p className="text-xs text-gray-400 font-mono mt-1 truncate">{selectedUser.user_id}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Type de crédit
                  </label>
                  <select
                    value={creditCategory}
                    onChange={(e) => setCreditCategory(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {CREDIT_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} className="bg-gray-900 text-gray-200">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre de crédits
                  </label>
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder={`Nombre de crédits (${selectedCreditCategoryLabel})`}
                    className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Raison (optionnel)
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Raison de l'ajout/retrait"
                    className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleAddCredits}
                    disabled={!creditAmount || processing}
                    className="flex-1 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter
                  </button>
                  <button
                    onClick={handleRemoveCredits}
                    disabled={!creditAmount || processing}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    <Minus className="w-4 h-4" />
                    Retirer
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Sélectionnez un utilisateur</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
