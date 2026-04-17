import { useState, useEffect } from "react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { isAdmin } from "@/bibliotheque/supabase/credits";
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
  RefreshCw,
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
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    recentSignups: 0,
    verifiedEmails: 0,
    totalPayments: 0,
    totalTransactions: 0,
    totalHistory: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditCategory, setCreditCategory] = useState("workflow_video");
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("users"); // users, payments, transactions, subscriptions, history

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
        if (admin) {
          loadDashboardData();
        }
      } catch (err) {
        console.error("Erreur vérification admin:", err);
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [session]);

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
      }
    } catch (err) {
      console.error("Erreur chargement dashboard:", err);
      alert(`Erreur: ${err.message}`);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      </div>
    );
  }

  if (!isAdminUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="glass-strong rounded-xl p-12 border border-red-500/30 text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-200 mb-2">Accès refusé</h2>
          <p className="text-gray-400">Vous devez être administrateur pour accéder à cette page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageTitle green="Administration" white="Dashboard" subtitle="Gérer les utilisateurs, paiements et transactions" />

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-8">
        <div className="glass-strong rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">Total utilisateurs</p>
              <p className="text-2xl font-bold text-gray-200">{stats.totalUsers}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="glass-strong rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">Abonnements actifs</p>
              <p className="text-2xl font-bold text-blue-400">{stats.activeSubscriptions}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Crown className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="glass-strong rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">Inscriptions (7j)</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.recentSignups}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="glass-strong rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">Emails vérifiés</p>
              <p className="text-2xl font-bold text-green-400">{stats.verifiedEmails}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="glass-strong rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">Total générations</p>
              <p className="text-2xl font-bold text-orange-400">{stats.totalHistory}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
              <History className="w-6 h-6 text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="mt-6">
        <div className="flex gap-2 border-b border-white/10">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 font-medium transition-all ${
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
            className={`px-4 py-2 font-medium transition-all ${
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
            className={`px-4 py-2 font-medium transition-all ${
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
            className={`px-4 py-2 font-medium transition-all ${
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
            className={`px-4 py-2 font-medium transition-all ${
              activeTab === "history"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />
            Historique ({history.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Onglet Utilisateurs */}
          {activeTab === "users" && (
            <div className="glass-strong rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par email ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <button
                  onClick={loadDashboardData}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all flex items-center gap-2"
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
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
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
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Coins className="w-3 h-3" />
                                  Workflow: {user.credits || 0}
                                </span>
                                <span>Texte: {user.credits_text_generation || 0}</span>
                                <span>Img gen: {user.credits_image_generation || 0}</span>
                                <span>Img mod: {user.credits_image_modification || 0}</span>
                                <span>Vidéo gen: {user.credits_video_generation || 0}</span>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
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
            <div className="glass-strong rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par client, email ou session..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <button
                  onClick={loadDashboardData}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredPayments.map((payment) => (
                  <div key={payment.id} className="p-4 rounded-lg border bg-white/5 border-white/10">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs border ${getStatusBadge(payment.status)}`}>
                            {payment.status}
                          </span>
                          <span className="text-sm font-medium text-gray-200">
                            {payment.amount} {payment.currency?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-3 h-3 text-gray-400" />
                          <p className="text-xs text-gray-300">
                            <span className="font-medium">{payment.client_email || "Client inconnu"}</span>
                            {payment.client_name && (
                              <span className="text-gray-400 ml-1">({payment.client_name})</span>
                            )}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 font-mono mb-1">Session: {payment.stripe_session_id}</p>
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
            <div className="glass-strong rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par client ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <button
                  onClick={loadDashboardData}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredTransactions.map((transaction) => (
                  <div key={transaction.id} className="p-4 rounded-lg border bg-white/5 border-white/10">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
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
                          <p className="text-xs text-gray-400 mb-1">Raison: {transaction.reason}</p>
                        )}
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-3 h-3 text-gray-400" />
                          <p className="text-xs text-gray-300">
                            <span className="font-medium">{transaction.client_email || "Client inconnu"}</span>
                            {transaction.client_name && (
                              <span className="text-gray-400 ml-1">({transaction.client_name})</span>
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
            <div className="glass-strong rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par client ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <button
                  onClick={loadDashboardData}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {subscriptions.filter(s => 
                  !searchTerm || 
                  s.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  s.client_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  s.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
                ).map((subscription) => (
                  <div key={subscription.id} className="p-4 rounded-lg border bg-white/5 border-white/10">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs border ${getStatusBadge(subscription.status)}`}>
                            {subscription.status}
                          </span>
                          {subscription.cancel_at_period_end && (
                            <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                              Annulation prévue
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-3 h-3 text-gray-400" />
                          <p className="text-xs text-gray-300">
                            <span className="font-medium">{subscription.client_email || "Client inconnu"}</span>
                            {subscription.client_name && (
                              <span className="text-gray-400 ml-1">({subscription.client_name})</span>
                            )}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 mb-1">Période: {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}</p>
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
            <div className="glass-strong rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par client, type, modèle ou contenu..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <button
                  onClick={loadDashboardData}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
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
                            <div className="flex items-center gap-2 mb-2">
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
                            
                            <div className="flex items-center gap-2 mb-2">
                              <User className="w-3 h-3 text-gray-400" />
                              <p className="text-xs text-gray-300">
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
        </div>

        {/* Panneau latéral - Gestion crédits */}
        <div className="lg:col-span-1">
          <div className="glass-strong rounded-xl p-6 border border-white/10 sticky top-24">
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
