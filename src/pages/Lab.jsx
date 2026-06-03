import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import PageTitle from "../composants/interface/TitrePage";
import { useAuth } from "@/contexte/FournisseurAuth";
import { isAdmin } from "@/bibliotheque/supabase/credits";
import {
  getNouveautes,
  getAllNouveautes,
  deleteNouveaute,
  toggleNouveaute,
} from "@/bibliotheque/supabase/nouveautes";
import BlocFormulaireNouveaute from "@/composants/nouveautes/BlocFormulaireNouveaute";
import {
  Search,
  X,
  Rocket,
  TrendingUp,
  CheckCircle2,
  Zap,
  FileText,
  Image as ImageIcon,
  Video,
  Settings,
  Users,
  BookOpen,
  History,
  Calendar,
  Filter,
  Sparkles,
  Shield,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Star,
  ShoppingBag,
} from "lucide-react";

const EVENT_TYPES = {
  feature: { 
    label: "Nouvelle fonctionnalité", 
    icon: Rocket, 
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-300",
    gradient: "from-emerald-500/20 to-emerald-600/10"
  },
  improvement: { 
    label: "Amélioration", 
    icon: TrendingUp, 
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    text: "text-cyan-300",
    gradient: "from-cyan-500/20 to-cyan-600/10"
  },
  fix: { 
    label: "Correction", 
    icon: CheckCircle2, 
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    text: "text-violet-300",
    gradient: "from-violet-500/20 to-violet-600/10"
  },
  update: { 
    label: "Mise à jour", 
    icon: Zap, 
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-300",
    gradient: "from-yellow-500/20 to-yellow-600/10"
  },
};

const ICON_MAP = {
  Rocket,
  FileText,
  ImageIcon,
  Video,
  Settings,
  Users,
  BookOpen,
  History,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Zap,
  Star,
  ShoppingBag,
};

export default function Lab() {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [nouveautes, setNouveautes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [editingNouveaute, setEditingNouveaute] = useState(null);
  const [showNouveauteForm, setShowNouveauteForm] = useState(false);
  const [adminActionBusy, setAdminActionBusy] = useState(false);

  const loadNouveautes = useCallback(async () => {
    setLoading(true);
    try {
      let admin = false;
      if (session) {
        admin = await isAdmin();
        setIsAdminUser(admin);
      } else {
        setIsAdminUser(false);
      }
      const data = session && admin ? await getAllNouveautes() : await getNouveautes();
      setNouveautes(data);
    } catch (err) {
      console.error("Erreur chargement nouveautés:", err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadNouveautes();
  }, [loadNouveautes]);

  const handleDeleteNouveaute = async (id) => {
    if (!confirm("Supprimer cette nouveauté ? Cette action est définitive.")) return;
    setAdminActionBusy(true);
    try {
      const result = await deleteNouveaute(id);
      if (!result.success) throw new Error(result.error);
      await loadNouveautes();
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setAdminActionBusy(false);
    }
  };

  const handleToggleNouveaute = async (id, currentStatus) => {
    setAdminActionBusy(true);
    try {
      const result = await toggleNouveaute(id, !currentStatus);
      if (!result.success) throw new Error(result.error);
      await loadNouveautes();
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setAdminActionBusy(false);
    }
  };

  const events = useMemo(() => {
    return nouveautes.map((n) => {
      const iconName = n.icon_name || "Rocket";
      const Icon = ICON_MAP[iconName] || Rocket;

      return {
        id: n.id,
        type: n.type === "creation" || n.type === "fonctionnalite" ? "feature" : n.type,
        title: n.title,
        description: n.description,
        date: n.published_at ? new Date(n.published_at) : new Date(n.created_at),
        category: n.category,
        link: n.redirect_path,
        linkLabel: n.redirect_label || "Découvrir",
        is_active: n.is_active,
        icon: Icon,
        nouveauteSource: n,
      };
    });
  }, [nouveautes]);

  const categories = useMemo(() => {
    return [...new Set(events.map(e => e.category))].sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    let filtered = [...events].sort((a, b) => b.date.getTime() - a.date.getTime());

    if (selectedType !== "all") {
      filtered = filtered.filter(e => e.type === selectedType);
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter(e => e.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.title.toLowerCase().includes(query) || 
        e.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [events, searchQuery, selectedType, selectedCategory]);

  const stats = useMemo(() => {
    return {
      total: events.length,
      features: events.filter(e => e.type === "feature" || e.type === "creation" || e.type === "fonctionnalite").length,
      improvements: events.filter(e => e.type === "improvement").length,
      fixes: events.filter(e => e.type === "fix").length,
      updates: events.filter(e => e.type === "update").length,
    };
  }, [events]);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageTitle
          green="Journal"
          white="des Événements"
          subtitle="Découvrez l'évolution et les nouveautés de la plateforme"
        />

        <div className="mt-6 mb-8 glass-strong rounded-xl border border-white/10 p-5 flex items-start gap-3">
          <div className="mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-emerald-200" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-100">Nouveau : l’app est installable (PWA)</p>
            <p className="mt-1 text-sm text-gray-300">
              Ajoutez ViralWorks Studio à l’écran d’accueil depuis le menu de votre navigateur (sur mobile et desktop compatibles).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-8 mb-8">
          <div className="glass-strong rounded-xl border border-white/10 p-4 text-center">
            <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-violet-300">
              {stats.total}
            </div>
            <div className="text-sm text-gray-400 mt-1">Total</div>
          </div>
          <div className="glass-strong rounded-xl border border-white/10 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-300">{stats.features}</div>
            <div className="text-sm text-gray-400 mt-1">Fonctionnalités</div>
          </div>
          <div className="glass-strong rounded-xl border border-white/10 p-4 text-center">
            <div className="text-2xl font-bold text-cyan-300">{stats.improvements}</div>
            <div className="text-sm text-gray-400 mt-1">Améliorations</div>
          </div>
          <div className="glass-strong rounded-xl border border-white/10 p-4 text-center">
            <div className="text-2xl font-bold text-violet-300">{stats.fixes}</div>
            <div className="text-sm text-gray-400 mt-1">Corrections</div>
          </div>
          <div className="glass-strong rounded-xl border border-white/10 p-4 text-center col-span-2 sm:col-span-1 lg:col-span-1">
            <div className="text-2xl font-bold text-yellow-300">{stats.updates}</div>
            <div className="text-sm text-gray-400 mt-1">Mises à jour</div>
          </div>
        </div>

        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un événement..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-12 py-3 glass-strong border border-white/10 rounded-xl text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSelectedType("all")}
              className={`px-4 py-2 rounded-lg border transition-all ${
                selectedType === "all"
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                  : "glass-strong border-white/10 text-gray-300 hover:border-white/20"
              }`}
            >
              <Filter className="w-4 h-4 inline mr-2" />
              Tout
            </button>
            {Object.entries(EVENT_TYPES).map(([key, type]) => {
              const Icon = type.icon;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedType(key)}
                  className={`px-4 py-2 rounded-lg border transition-all flex items-center gap-2 ${
                    selectedType === key
                      ? `${type.bg} ${type.border} ${type.text}`
                      : "glass-strong border-white/10 text-gray-300 hover:border-white/20"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {type.label}
                </button>
              );
            })}
      </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                selectedCategory === "all"
                  ? "bg-white/10 border-white/30 text-white"
                  : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
              }`}
            >
              Toutes les catégories
            </button>
            {categories.map((category) => (
          <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                  selectedCategory === category
                    ? "bg-white/10 border-white/30 text-white"
                    : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                }`}
          >
                {category}
          </button>
            ))}
          </div>
        </div>

        {isAdminUser && (
          <div className="mb-6 glass-strong rounded-xl border border-violet-500/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2 text-violet-200">
              <Shield className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-medium">Mode administrateur</p>
                <p className="text-sm text-gray-400">
                  Ajoutez, modifiez ou supprimez des événements directement depuis cette page.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingNouveaute(null);
                setShowNouveauteForm(true);
              }}
              disabled={adminActionBusy}
              className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nouvel événement
            </button>
          </div>
        )}

        {isAdminUser && showNouveauteForm && (
          <div className="mb-6">
            <BlocFormulaireNouveaute
              editingNouveaute={editingNouveaute}
              onCancel={() => {
                setShowNouveauteForm(false);
                setEditingNouveaute(null);
              }}
              onSuccess={() => {
                setShowNouveauteForm(false);
                setEditingNouveaute(null);
                loadNouveautes();
              }}
            />
          </div>
        )}

        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500/30 via-violet-500/30 to-yellow-500/30 hidden md:block" />

          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-16 glass-strong rounded-xl border border-white/10">
                <div className="w-8 h-8 mx-auto border-2 border-white/10 border-t-emerald-500/50 rounded-full animate-spin" />
                <p className="mt-4 text-gray-400">Chargement des nouveautés...</p>
              </div>
            ) : filteredEvents.length > 0 ? (
              filteredEvents.map((event, index) => {
                const eventType = EVENT_TYPES[event.type] || EVENT_TYPES.update;
                const EventIcon = event.icon || eventType.icon;
                const isEven = index % 2 === 0;
                
                return (
                  <div
                    key={event.id}
                    className="relative flex items-start gap-6 group"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="hidden md:flex items-center justify-center w-16 flex-shrink-0 relative z-10">
                      <div className={`w-4 h-4 rounded-full border-2 ${eventType.border} ${eventType.bg} flex items-center justify-center`}>
                        <EventIcon className={`w-2.5 h-2.5 ${eventType.text}`} />
                      </div>
                    </div>

                    <div
                      className={`flex-1 glass-strong rounded-xl border border-white/10 p-6 hover:border-white/20 hover:bg-white/5 transition-all group-hover:scale-[1.02] ${
                        isEven ? "md:ml-0" : "md:ml-16"
                      } ${isAdminUser && event.is_active === false ? "opacity-60 border-amber-500/20" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`w-12 h-12 rounded-lg ${eventType.bg} ${eventType.border} border flex items-center justify-center flex-shrink-0`}>
                            <EventIcon className={`w-6 h-6 ${eventType.text}`} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              {event.link === "/studio" &&
                              event.linkLabel === "Essayer" &&
                              event.title === "Créez votre avatar à votre image" ? (
                                <span className="text-xs font-semibold px-2 py-1 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                                  NOUVEAU
                                </span>
                              ) : null}
                              <span className={`text-xs font-medium px-2 py-1 rounded ${eventType.bg} ${eventType.border} border ${eventType.text}`}>
                                {eventType.label}
                              </span>
                              <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded border border-white/10">
                                {event.category}
                              </span>
                              {isAdminUser && event.is_active === false && (
                                <span className="text-xs px-2 py-1 rounded border border-amber-500/40 text-amber-200 bg-amber-500/10">
                                  Masqué (inactif)
                                </span>
                              )}
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Calendar className="w-3 h-3" />
                                {event.date.toLocaleDateString("fr-FR", { 
                                  day: "numeric", 
                                  month: "long", 
                                  year: "numeric" 
                                })}
                              </div>
                            </div>
                            
                            <h3 className="text-lg font-semibold text-gray-200 mb-2 group-hover:text-white transition-colors">
                              {event.title}
                            </h3>
                            
                            <p className="text-gray-300 leading-relaxed mb-4">
                              {event.description}
                            </p>
                            
                            {event.link && (
                              /^https?:\/\//i.test(event.link) ? (
                                <a
                                  href={event.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors group/link"
                                >
                                  {event.linkLabel}
                                  <Sparkles className="w-4 h-4 group-hover/link:scale-110 transition-transform" />
                                </a>
                              ) : (
                                <Link
                                  to={event.link}
                                  className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors group/link"
                                >
                                  {event.linkLabel}
                                  <Sparkles className="w-4 h-4 group-hover/link:scale-110 transition-transform" />
                                </Link>
                              )
                            )}

                            {isAdminUser && (
                              <div className="mt-4 flex flex-wrap items-center gap-2 pt-4 border-t border-white/10">
                                <button
                                  type="button"
                                  disabled={adminActionBusy}
                                  onClick={() =>
                                    handleToggleNouveaute(event.id, event.is_active)
                                  }
                                  className={`p-2 rounded-lg border transition-all disabled:opacity-50 ${
                                    event.is_active
                                      ? "bg-green-500/20 border-green-500/30 text-green-300 hover:bg-green-500/30"
                                      : "bg-gray-500/20 border-gray-500/30 text-gray-400 hover:bg-gray-500/30"
                                  }`}
                                  title={event.is_active ? "Désactiver (masquer du public)" : "Activer"}
                                >
                                  {event.is_active ? (
                                    <CheckCircle className="w-4 h-4" />
                                  ) : (
                                    <XCircle className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  disabled={adminActionBusy}
                                  onClick={() => {
                                    setEditingNouveaute(event.nouveauteSource);
                                    setShowNouveauteForm(true);
                                  }}
                                  className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-all disabled:opacity-50"
                                  title="Modifier"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={adminActionBusy}
                                  onClick={() => handleDeleteNouveaute(event.id)}
                                  className="p-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-all disabled:opacity-50"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 glass-strong rounded-xl border border-white/10">
                <p className="text-gray-400 text-lg">Aucun événement trouvé</p>
                <p className="text-gray-500 text-sm mt-2">Essayez de modifier vos filtres</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
