import { useState, useEffect } from "react";
import {
  FileText,
  Image as ImageIcon,
  Video,
  Zap,
  TrendingUp,
  Lightbulb,
  Target,
  Sparkles,
  Settings,
  BookOpen,
  History,
  Users,
  Rocket,
  Save,
  X,
} from "lucide-react";
import { slugifyInformationsUtiles } from "@/bibliotheque/supabase/informationsUtiles";

export const ICONES_SECTIONS_INFORMATIONS = [
  { name: "FileText", icon: FileText },
  { name: "ImageIcon", icon: ImageIcon },
  { name: "Video", icon: Video },
  { name: "Zap", icon: Zap },
  { name: "TrendingUp", icon: TrendingUp },
  { name: "Lightbulb", icon: Lightbulb },
  { name: "Target", icon: Target },
  { name: "Sparkles", icon: Sparkles },
  { name: "Settings", icon: Settings },
  { name: "BookOpen", icon: BookOpen },
  { name: "History", icon: History },
  { name: "Users", icon: Users },
  { name: "Rocket", icon: Rocket },
];

export const COULEURS_SECTIONS = [
  { value: "cyan", label: "Cyan" },
  { value: "violet", label: "Violet" },
  { value: "yellow", label: "Jaune" },
  { value: "emerald", label: "Émeraude" },
];

export function FormulaireSectionInformationsUtiles({
  initial,
  nextSortOrder,
  onSave,
  onCancel,
  saving,
}) {
  const isEdit = Boolean(initial?.id);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [iconName, setIconName] = useState(initial?.icon_name ?? "FileText");
  const [color, setColor] = useState(initial?.color ?? "cyan");
  const [sortOrder, setSortOrder] = useState(
    initial?.sort_order ?? nextSortOrder ?? 0
  );
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  useEffect(() => {
    if (!slugTouched && title) {
      setSlug(slugifyInformationsUtiles(title));
    }
  }, [title, slugTouched]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const s = slug.trim() || slugifyInformationsUtiles(title);
    onSave({
      id: initial?.id,
      slug: s,
      title: title.trim(),
      icon_name: iconName,
      color,
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-strong rounded-xl border border-white/10 p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          {isEdit ? "Modifier la catégorie" : "Nouvelle catégorie"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-lg hover:bg-white/10 text-slate-400"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-1">Titre</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-1">
          Identifiant (slug, URL interne)
        </label>
        <input
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          title="Lettres minuscules, chiffres et tirets"
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Icône</label>
          <select
            value={iconName}
            onChange={(e) => setIconName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-900/80 border border-white/20 text-white"
 style={{ colorScheme: "dark" }}
          >
            {ICONES_SECTIONS_INFORMATIONS.map(({ name }) => (
              <option key={name} value={name} className="bg-gray-900">
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Couleur du thème</label>
          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-900/80 border border-white/20 text-white"
            style={{ colorScheme: "dark" }}
          >
            {COULEURS_SECTIONS.map((c) => (
              <option key={c.value} value={c.value} className="bg-gray-900">
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-1">Ordre d&apos;affichage</label>
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
        />
      </div>

      <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded border-white/20"
        />
        Catégorie visible sur le site
      </label>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isEdit ? "Enregistrer" : "Créer"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

export function FormulaireItemInformationsUtiles({ initial, sectionId, nextSortOrder, onSave, onCancel, saving }) {
  const isEdit = Boolean(initial?.id);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [example, setExample] = useState(initial?.example ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? nextSortOrder ?? 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id: initial?.id,
      section_id: sectionId,
      title: title.trim(),
      content: content.trim(),
      example: example.trim() || null,
      sort_order: Number(sortOrder) || 0,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-strong rounded-xl border border-white/10 p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          {isEdit ? "Modifier l&apos;information" : "Nouvelle information"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-lg hover:bg-white/10 text-slate-400"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-1">Titre</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-1">Contenu</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={5}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-1">
          Exemple (optionnel, encadré monospace)
        </label>
        <textarea
          value={example}
          onChange={(e) => setExample(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-1">Ordre dans la catégorie</label>
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving || !title.trim() || !content.trim()}
          className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isEdit ? "Enregistrer" : "Créer"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
