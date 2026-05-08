import { useState, useEffect } from "react";
import {
  Coins,
  Users,
  TrendingUp,
  FileText,
  Crown,
  History,
  Image as ImageIcon,
  Video,
  Sparkles,
  Save,
  X,
  Rocket,
  Settings,
  BookOpen,
  ShoppingBag,
  Info,
  Zap,
  CheckCircle2,
  Star,
  Heart,
  Bell,
  Gift,
  Award,
  Target,
  Lightbulb,
  Code,
  Palette,
  Music,
  Camera,
  Gamepad2,
} from "lucide-react";
import { createNouveaute, updateNouveaute } from "@/bibliotheque/supabase/nouveautes";

export const ICONES_NOUVEAUTES_DISPONIBLES = [
  { name: "Rocket", icon: Rocket },
  { name: "FileText", icon: FileText },
  { name: "ImageIcon", icon: ImageIcon },
  { name: "Video", icon: Video },
  { name: "Settings", icon: Settings },
  { name: "Users", icon: Users },
  { name: "BookOpen", icon: BookOpen },
  { name: "History", icon: History },
  { name: "Sparkles", icon: Sparkles },
  { name: "TrendingUp", icon: TrendingUp },
  { name: "CheckCircle2", icon: CheckCircle2 },
  { name: "Zap", icon: Zap },
  { name: "Star", icon: Star },
  { name: "Heart", icon: Heart },
  { name: "Bell", icon: Bell },
  { name: "Gift", icon: Gift },
  { name: "Award", icon: Award },
  { name: "Target", icon: Target },
  { name: "Lightbulb", icon: Lightbulb },
  { name: "Code", icon: Code },
  { name: "Palette", icon: Palette },
  { name: "Music", icon: Music },
  { name: "Camera", icon: Camera },
  { name: "Gamepad2", icon: Gamepad2 },
  { name: "ShoppingBag", icon: ShoppingBag },
  { name: "Info", icon: Info },
  { name: "Crown", icon: Crown },
  { name: "Coins", icon: Coins },
];

const defaultForm = () => ({
  title: "",
  description: "",
  type: "feature",
  category: "Création",
  redirect_path: "",
  redirect_label: "Découvrir",
  icon_name: "Rocket",
  published_at: new Date().toISOString().split("T")[0],
});

/**
 * Formulaire création / édition d'une nouveauté (même champs que l’admin).
 */
export default function BlocFormulaireNouveaute({ editingNouveaute, onCancel, onSuccess }) {
  const [nouveauteForm, setNouveauteForm] = useState(defaultForm);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (editingNouveaute) {
      setNouveauteForm({
        title: editingNouveaute.title,
        description: editingNouveaute.description,
        type: editingNouveaute.type,
        category: editingNouveaute.category,
        redirect_path: editingNouveaute.redirect_path || "",
        redirect_label: editingNouveaute.redirect_label || "Découvrir",
        icon_name: editingNouveaute.icon_name || "Rocket",
        published_at: editingNouveaute.published_at
          ? editingNouveaute.published_at.split("T")[0]
          : new Date().toISOString().split("T")[0],
      });
    } else {
      setNouveauteForm(defaultForm());
    }
    setShowIconPicker(false);
  }, [editingNouveaute]);

  const handleSave = async () => {
    if (!nouveauteForm.title || !nouveauteForm.description) {
      alert("Veuillez remplir le titre et la description");
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        ...nouveauteForm,
        redirect_path: nouveauteForm.redirect_path || null,
        redirect_label: nouveauteForm.redirect_label || null,
        icon_name: nouveauteForm.icon_name || null,
        published_at: nouveauteForm.published_at
          ? new Date(nouveauteForm.published_at).toISOString()
          : null,
      };

      if (editingNouveaute) {
        const result = await updateNouveaute(editingNouveaute.id, payload);
        if (!result.success) throw new Error(result.error);
        alert("Nouveauté mise à jour avec succès.");
      } else {
        const result = await createNouveaute(payload);
        if (!result.success) throw new Error(result.error);
        alert("Nouveauté créée avec succès.");
      }

      onSuccess?.();
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="glass-strong rounded-xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-gray-200">
          {editingNouveaute ? "Modifier la nouveauté" : "Créer une nouveauté"}
        </h4>
        <button
          onClick={() => {
            setShowIconPicker(false);
            onCancel?.();
          }}
          className="p-2 rounded-lg hover:bg-white/10 text-gray-400"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Titre *</label>
          <input
            type="text"
            value={nouveauteForm.title}
            onChange={(e) => setNouveauteForm({ ...nouveauteForm, title: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            placeholder="Ex: Génération de vidéos avec IA"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
          <textarea
            value={nouveauteForm.description}
            onChange={(e) => setNouveauteForm({ ...nouveauteForm, description: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            placeholder="Description détaillée de la nouveauté..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Type *</label>
            <select
              value={nouveauteForm.type}
              onChange={(e) => setNouveauteForm({ ...nouveauteForm, type: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-white/20 bg-gray-900/50 text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
              style={{ colorScheme: "dark" }}
            >
              <option value="feature" className="bg-gray-900 text-gray-100">
                Nouvelle fonctionnalité
              </option>
              <option value="improvement" className="bg-gray-900 text-gray-100">
                Amélioration
              </option>
              <option value="fix" className="bg-gray-900 text-gray-100">
                Correction
              </option>
              <option value="update" className="bg-gray-900 text-gray-100">
                Mise à jour
              </option>
              <option value="creation" className="bg-gray-900 text-gray-100">
                Création
              </option>
              <option value="fonctionnalite" className="bg-gray-900 text-gray-100">
                Fonctionnalité
              </option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Catégorie *</label>
            <select
              value={nouveauteForm.category}
              onChange={(e) => setNouveauteForm({ ...nouveauteForm, category: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-white/20 bg-gray-900/50 text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
              style={{ colorScheme: "dark" }}
            >
              <option value="Création" className="bg-gray-900 text-gray-100">
                Création
              </option>
              <option value="Interface" className="bg-gray-900 text-gray-100">
                Interface
              </option>
              <option value="Fonctionnalité" className="bg-gray-900 text-gray-100">
                Fonctionnalité
              </option>
              <option value="Ressources" className="bg-gray-900 text-gray-100">
                Ressources
              </option>
              <option value="Technique" className="bg-gray-900 text-gray-100">
                Technique
              </option>
              <option value="Sécurité" className="bg-gray-900 text-gray-100">
                Sécurité
              </option>
              <option value="Boutique" className="bg-gray-900 text-gray-100">
                Boutique
              </option>
              <option value="Profil" className="bg-gray-900 text-gray-100">
                Profil
              </option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Redirection (chemin)</label>
            <select
              value={nouveauteForm.redirect_path}
              onChange={(e) => setNouveauteForm({ ...nouveauteForm, redirect_path: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-white/20 bg-gray-900/50 text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
              style={{ colorScheme: "dark" }}
            >
              <option value="" className="bg-gray-900 text-gray-100">
                Aucune redirection
              </option>
              <option value="/" className="bg-gray-900 text-gray-100">
                Accueil
              </option>
              <option value="/viralworks" className="bg-gray-900 text-gray-100">
                Script/Visuel/Vidéo (ViralWorks)
              </option>
              <option value="/boutique" className="bg-gray-900 text-gray-100">
                Boutique
              </option>
              <option value="/profil" className="bg-gray-900 text-gray-100">
                Profil
              </option>
              <option value="/lab" className="bg-gray-900 text-gray-100">
                Nouveautés
              </option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Label du bouton</label>
            <input
              type="text"
              value={nouveauteForm.redirect_label}
              onChange={(e) => setNouveauteForm({ ...nouveauteForm, redirect_label: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              placeholder="Ex: Découvrir"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Icône</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-full px-4 py-2 rounded-lg border border-white/20 bg-gray-900/50 text-gray-100 hover:bg-gray-800/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {nouveauteForm.icon_name ? (
                    <>
                      {(() => {
                        const iconData = ICONES_NOUVEAUTES_DISPONIBLES.find(
                          (i) => i.name === nouveauteForm.icon_name
                        );
                        const IconComponent = iconData?.icon || Rocket;
                        return <IconComponent className="w-4 h-4 text-emerald-400" />;
                      })()}
                      <span>{nouveauteForm.icon_name}</span>
                    </>
                  ) : (
                    <span className="text-gray-400">Sélectionner une icône</span>
                  )}
                </div>
                <Sparkles className="w-4 h-4 text-gray-400" />
              </button>

              {showIconPicker && (
                <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 px-4 pointer-events-none">
                  <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
                    onClick={() => setShowIconPicker(false)}
                  />
                  <div
                    className="relative z-[10000] w-full max-w-2xl glass-strong rounded-xl border border-white/20 bg-gray-900/95 backdrop-blur-sm p-4 max-h-64 overflow-y-auto shadow-2xl pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                      {ICONES_NOUVEAUTES_DISPONIBLES.map((iconData) => {
                        const IconComponent = iconData.icon;
                        const isSelected = nouveauteForm.icon_name === iconData.name;
                        return (
                          <button
                            key={iconData.name}
                            type="button"
                            onClick={() => {
                              setNouveauteForm({ ...nouveauteForm, icon_name: iconData.name });
                              setShowIconPicker(false);
                            }}
                            className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                              isSelected
                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                                : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20"
                            }`}
                            title={iconData.name}
                          >
                            <IconComponent className="w-5 h-5" />
                            <span className="text-[10px] truncate w-full text-center">{iconData.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Date de publication</label>
            <input
              type="date"
              value={nouveauteForm.published_at}
              onChange={(e) => setNouveauteForm({ ...nouveauteForm, published_at: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-white/20 bg-gray-900/50 text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
              style={{ colorScheme: "dark" }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-white/10">
          <button
            onClick={handleSave}
            disabled={processing || !nouveauteForm.title || !nouveauteForm.description}
            className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {editingNouveaute ? "Mettre à jour" : "Créer"}
          </button>
          <button
            onClick={() => {
              setShowIconPicker(false);
              onCancel?.();
            }}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
