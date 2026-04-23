import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { isAdmin } from "@/bibliotheque/supabase/credits";
import {
  fetchInformationsUtiles,
  createInformationUtileSection,
  updateInformationUtileSection,
  upsertInformationUtileSection,
  deleteInformationUtileSection,
  createInformationUtileItem,
  upsertInformationUtileItem,
  deleteInformationUtileItem,
} from "@/bibliotheque/supabase/informationsUtiles";
import {
  importerContenuInformationsUtilesDefautDepuisLApp,
  ensureDefaultSectionsInDb,
  INFORMATIONS_UTILES_SECTION_IDS,
  INFORMATIONS_UTILES_DEFAULT_SECTIONS,
  INFORMATIONS_UTILES_DEFAULT_ITEMS,
  INFORMATIONS_UTILES_DEFAULT_SECTION_ID_SET,
} from "@/bibliotheque/supabase/informationsUtilesDefaults";
import {
  FormulaireSectionInformationsUtiles,
  FormulaireItemInformationsUtiles,
} from "@/composants/informationsUtiles/FormulairesAdminInformationsUtiles";
import {
  Image as ImageIcon,
  FileText,
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
  ArrowRight,
  CheckCircle2,
  Shield,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";

const ICON_MAP = {
  FileText,
  ImageIcon,
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
};

const GRADIENT = {
  cyan: "from-cyan-500/20 to-cyan-400/10",
  violet: "from-violet-500/20 to-violet-400/10",
  yellow: "from-yellow-500/20 to-yellow-400/10",
  emerald: "from-emerald-500/20 to-emerald-400/10",
};

const BORDER = {
  cyan: "border-cyan-500/30",
  violet: "border-violet-500/30",
  yellow: "border-yellow-500/30",
  emerald: "border-emerald-500/30",
};

const TEXT_COLOR = {
  cyan: "text-cyan-300",
  violet: "text-violet-300",
  yellow: "text-yellow-300",
  emerald: "text-emerald-300",
};

/** Contenu statique si la base est vide (ex. migration non appliquée) — lecture seule. */
const LEGACY_SECTIONS = [
  {
    id: "legacy-prompts",
    icon: FileText,
    title: "Création de prompts",
    color: "cyan",
    gradient: GRADIENT.cyan,
    border: BORDER.cyan,
    is_active: true,
    items: [
      {
        title: "Structure efficace",
        content:
          "Commence par définir le contexte, puis l'action principale, et termine par le style souhaité. Exemple : 'Un développeur dans un bureau moderne, en train de coder sur un écran lumineux, style cinématique avec éclairage dramatique'.",
        example: "Contexte -> Action -> Style",
      },
      {
        title: "Détails techniques",
        content:
          "Spécifie la caméra, l'éclairage et le ton. Pour VEO3, utilise les paramètres Scene, Style, Camera, Lighting et Tone pour un contrôle précis du rendu final.",
        example: "Camera: close-up | Lighting: golden hour",
      },
      {
        title: "Dialogues en français",
        content:
          "Pour les vidéos avec dialogues, indique clairement les répliques en français. Le système traduira et adaptera automatiquement la prononciation.",
        example: "Dialogue: 'Bonjour, comment allez-vous ?'",
      },
    ],
  },
  {
    id: "legacy-images",
    icon: ImageIcon,
    title: "Génération d'images",
    color: "violet",
    gradient: GRADIENT.violet,
    border: BORDER.violet,
    is_active: true,
    items: [
      {
        title: "Descriptions précises",
        content:
          "Plus ta description est détaillée, meilleur sera le résultat. Mentionne la composition, les couleurs, l'ambiance et le style artistique souhaité.",
        example: "Portrait d'une femme, style réaliste, éclairage doux, fond flou",
      },
      {
        title: "Personnages de référence",
        content:
          "Utilise l'option de personnage de référence pour maintenir la cohérence visuelle dans une série d'images. Idéal pour créer des personnages récurrents.",
        example: "Même personnage, différentes poses",
      },
      {
        title: "Formats adaptés",
        content:
          "Choisis le format selon l'usage : carré pour Instagram, paysage pour bannières, portrait pour stories. Chaque format a son impact visuel.",
        example: "16:9 pour vidéos | 1:1 pour posts",
      },
    ],
  },
  {
    id: "legacy-workflow",
    icon: Zap,
    title: "Workflow optimisé",
    color: "yellow",
    gradient: GRADIENT.yellow,
    border: BORDER.yellow,
    is_active: true,
    items: [
      {
        title: "Organisation par projets",
        content:
          "Regroupe tes créations par projet pour garder une vue d'ensemble. Un projet peut contenir plusieurs prompts, images et vidéos liés.",
        example: "Projet 'Campagne Marketing' -> 5 prompts, 10 images",
      },
      {
        title: "Historique intelligent",
        content:
          "Tous tes contenus sont sauvegardés automatiquement. Tu peux retrouver, modifier et réutiliser n'importe quelle création précédente.",
        example: "Accès rapide aux dernières créations",
      },
      {
        title: "Itérations rapides",
        content:
          "Teste plusieurs variations en ajustant légèrement tes prompts. Les meilleurs résultats viennent souvent de petites modifications successives.",
        example: "Version 1 -> Ajustement -> Version 2 -> Final",
      },
    ],
  },
  {
    id: "legacy-tips",
    icon: Lightbulb,
    title: "Conseils pratiques",
    color: "emerald",
    gradient: GRADIENT.emerald,
    border: BORDER.emerald,
    is_active: true,
    items: [
      {
        title: "Commence simple",
        content:
          "Pour tes premiers essais, utilise des prompts courts et clairs. Une fois que tu maîtrises, tu peux ajouter plus de détails et de complexité.",
        example:
          "Simple: 'Un chat dans un jardin' -> Avancé: 'Un chat persan orange dans un jardin japonais, style photographie macro, éclairage naturel matinal'",
      },
      {
        title: "Expérimente les styles",
        content:
          "N'hésite pas à tester différents styles artistiques : réaliste, cartoon, cinématique, abstrait. Chaque style apporte une émotion différente.",
        example: "Même sujet, styles différents = résultats uniques",
      },
      {
        title: "Sauvegarde tes favoris",
        content:
          "Quand tu trouves un prompt qui fonctionne bien, sauvegarde-le comme modèle. Tu pourras le réutiliser et l'adapter pour d'autres créations.",
        example: "Modèles réutilisables dans l'historique",
      },
    ],
  },
];

const LEGACY_KEY_TO_DEFAULT_UUID = {
  "legacy-prompts": INFORMATIONS_UTILES_SECTION_IDS.prompts,
  "legacy-images": INFORMATIONS_UTILES_SECTION_IDS.images,
  "legacy-workflow": INFORMATIONS_UTILES_SECTION_IDS.workflow,
  "legacy-tips": INFORMATIONS_UTILES_SECTION_IDS.tips,
};

function mapDbRowToSection(row) {
  const Icon = ICON_MAP[row.icon_name] || FileText;
  const color = row.color in GRADIENT ? row.color : "cyan";
  return {
    id: row.id,
    slug: row.slug,
    db: row,
    icon: Icon,
    title: row.title,
    color,
    gradient: GRADIENT[color],
    border: BORDER[color],
    is_active: row.is_active,
    items: (row.items || []).map((it) => ({
      id: it.id,
      title: it.title,
      content: it.content,
      example: it.example,
      db: it,
    })),
  };
}

/** Toujours au moins le contenu intégré ; Supabase ne remplace l’affichage que lorsqu’il y a des fiches en base. */
function buildMergedInformationsUtilesSections(dbSections, isAdminUser) {
  const dbById = new Map(dbSections.map((s) => [s.id, s]));
  const legacySlotIds = new Set(Object.values(INFORMATIONS_UTILES_SECTION_IDS));

  const core = LEGACY_SECTIONS.map((legacy) => {
    const uuid = LEGACY_KEY_TO_DEFAULT_UUID[legacy.id];
    const meta = INFORMATIONS_UTILES_DEFAULT_SECTIONS.find((s) => s.id === uuid);
    const dbRow = dbById.get(uuid);

    if (dbRow && !isAdminUser && !dbRow.is_active) {
      return null;
    }

    if (dbRow) {
      const mapped = mapDbRowToSection(dbRow);
      if (mapped.items.length > 0) {
        return mapped;
      }
      const color = dbRow.color in GRADIENT ? dbRow.color : "cyan";
      const Icon = ICON_MAP[dbRow.icon_name] || FileText;
      const defItems = [...INFORMATIONS_UTILES_DEFAULT_ITEMS]
        .filter((d) => d.section_id === uuid)
        .sort((a, b) => a.sort_order - b.sort_order);
      return {
        id: uuid,
        slug: dbRow.slug,
        db: dbRow,
        icon: Icon,
        title: dbRow.title,
        color,
        gradient: GRADIENT[color],
        border: BORDER[color],
        is_active: dbRow.is_active,
        items: legacy.items.map((it, idx) => ({
          ...it,
          id: defItems[idx]?.id ?? `${uuid}-slot-${idx}`,
          db: null,
        })),
      };
    }

    return {
      ...legacy,
      id: uuid,
      slug: meta?.slug ?? "categorie",
      db: null,
      items: legacy.items.map((it, idx) => {
        const defItems = [...INFORMATIONS_UTILES_DEFAULT_ITEMS]
          .filter((d) => d.section_id === uuid)
          .sort((a, b) => a.sort_order - b.sort_order);
        const defItem = defItems[idx];
        return {
          ...it,
          id: defItem?.id ?? `${uuid}-slot-${idx}`,
          db: null,
        };
      }),
    };
  }).filter(Boolean);

  const extras = dbSections
    .filter((s) => !legacySlotIds.has(s.id))
    .filter((s) => isAdminUser || s.is_active)
    .map(mapDbRowToSection);

  return [...core, ...extras];
}

function SectionCard({
  section,
  isExpanded,
  onToggle,
  isAdmin,
  adminBusy,
  onEditSection,
  onDeleteSection,
  onToggleSectionActive,
  onAddItem,
  onEditItem,
  onDeleteItem,
}) {
  const Icon = section.icon;
  const tc = TEXT_COLOR[section.color] || TEXT_COLOR.cyan;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-white/20">
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-0">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 p-5 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className={`p-3 rounded-lg bg-gradient-to-br ${section.gradient} ${section.border} border shrink-0`}>
              <Icon className={`w-6 h-6 ${tc}`} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white truncate">{section.title}</h2>
              {isAdmin && section.is_active === false && (
                <span className="text-xs text-amber-300 mt-1 inline-block">Masquée (inactive)</span>
              )}
            </div>
          </div>
          <ArrowRight
            className={`w-5 h-5 text-slate-400 transition-transform duration-300 shrink-0 ml-2 ${
              isExpanded ? "rotate-90" : ""
            }`}
          />
        </button>

        {isAdmin && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-3 py-3 sm:flex-col sm:justify-center sm:border-l border-white/10 bg-white/[0.03]">
            <button
              type="button"
              disabled={adminBusy}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSectionActive(section);
              }}
              className={`p-2 rounded-lg border transition-all disabled:opacity-50 ${
                section.is_active
                  ? "bg-green-500/15 border-green-500/30 text-green-300"
                  : "bg-gray-500/15 border-gray-500/30 text-slate-400"
              }`}
              title={section.is_active ? "Masquer la catégorie" : "Afficher la catégorie"}
            >
              {section.is_active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            </button>
            <button
              type="button"
              disabled={adminBusy}
              onClick={(e) => {
                e.stopPropagation();
                onEditSection(section);
              }}
              className="p-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 disabled:opacity-50"
              title="Modifier la catégorie"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={adminBusy}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSection(section);
              }}
              className="p-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 disabled:opacity-50"
              title="Supprimer la catégorie"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={adminBusy}
              onClick={(e) => {
                e.stopPropagation();
                onAddItem(section);
              }}
              className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 disabled:opacity-50"
              title="Ajouter une information"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="px-5 pt-4 pb-5 space-y-4 border-t border-white/10 animate-fadeIn">
          {section.items.map((item, index) => (
            <div
              key={item.id || `legacy-${section.id}-${index}`}
              className="p-4 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start gap-3 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={adminBusy}
                          onClick={() => onEditItem(section, item)}
                          className="p-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 disabled:opacity-50"
                          title="Modifier"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={adminBusy}
                          onClick={() => onDeleteItem(item.id)}
                          className="p-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 disabled:opacity-50"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed mb-3">{item.content}</p>
                  {item.example && (
                    <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/20">
                      <p className="text-xs text-cyan-300 font-mono">{item.example}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Asavoir() {
  const { session } = useAuth();
  const [expandedSections, setExpandedSections] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [dbSections, setDbSections] = useState([]);
  const [sectionForm, setSectionForm] = useState(null);
  const [itemForm, setItemForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [importingDefaults, setImportingDefaults] = useState(false);
  const sectionsEnsuredRef = useRef(false);

  const loadData = useCallback(async () => {
    setSyncing(true);
    try {
      let admin = false;
      if (session) {
        admin = await isAdmin();
      }
      setIsAdminUser(admin);
      if (admin && !sectionsEnsuredRef.current) {
        const ens = await ensureDefaultSectionsInDb();
        if (ens.success) {
          sectionsEnsuredRef.current = true;
        } else {
          console.warn("ensureDefaultSectionsInDb:", ens.error);
        }
      }
      const rows = await fetchInformationsUtiles(admin);
      setDbSections(rows);
    } catch (err) {
      console.error("Erreur chargement page informations utiles:", err);
      setDbSections([]);
    } finally {
      setSyncing(false);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const displaySections = useMemo(
    () => buildMergedInformationsUtilesSections(dbSections, isAdminUser),
    [dbSections, isAdminUser]
  );

  const visibleSections = displaySections.length > 0 ? displaySections : LEGACY_SECTIONS;

  const usingIntegratedFallback = useMemo(() => {
    const totalItems = dbSections.reduce((n, s) => n + (s.items?.length ?? 0), 0);
    return totalItems < 10;
  }, [dbSections]);

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
    );
  };

  const nextSectionSortOrder = useMemo(() => {
    if (!dbSections.length) return 0;
    return Math.max(...dbSections.map((s) => s.sort_order), -1) + 1;
  }, [dbSections]);

  const handleSaveSection = async (payload) => {
    setSaving(true);
    try {
      if (payload.id) {
        if (INFORMATIONS_UTILES_DEFAULT_SECTION_ID_SET.has(payload.id)) {
          await ensureDefaultSectionsInDb();
        }
        const r = await upsertInformationUtileSection({
          id: payload.id,
          slug: payload.slug,
          title: payload.title,
          icon_name: payload.icon_name,
          color: payload.color,
          sort_order: payload.sort_order,
          is_active: payload.is_active,
        });
        if (!r.success) throw new Error(r.error);
      } else {
        const r = await createInformationUtileSection({
          slug: payload.slug,
          title: payload.title,
          icon_name: payload.icon_name,
          color: payload.color,
          sort_order: payload.sort_order,
          is_active: payload.is_active,
        });
        if (!r.success) throw new Error(r.error);
      }
      setSectionForm(null);
      await loadData();
    } catch (e) {
      alert(e.message || "Erreur enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSection = async (section) => {
    if (!section.db) {
      alert("Catégorie introuvable en base. Vérifiez Supabase ou rechargez la page.");
      return;
    }
    if (!confirm(`Supprimer la catégorie « ${section.title} » et toutes ses informations ?`)) return;
    setAdminBusy(true);
    try {
      const r = await deleteInformationUtileSection(section.db.id);
      if (!r.success) throw new Error(r.error);
      await loadData();
    } catch (e) {
      alert(e.message || "Erreur suppression");
    } finally {
      setAdminBusy(false);
    }
  };

  const handleToggleSectionActive = async (section) => {
    if (!section.db) {
      alert("Catégorie introuvable en base. Vérifiez Supabase ou rechargez la page.");
      return;
    }
    setAdminBusy(true);
    try {
      const r = await updateInformationUtileSection(section.db.id, {
        is_active: !section.db.is_active,
      });
      if (!r.success) throw new Error(r.error);
      await loadData();
    } catch (e) {
      alert(e.message || "Erreur");
    } finally {
      setAdminBusy(false);
    }
  };

  const handleSaveItem = async (payload) => {
    setSaving(true);
    try {
      if (INFORMATIONS_UTILES_DEFAULT_SECTION_ID_SET.has(payload.section_id)) {
        await ensureDefaultSectionsInDb();
      }
      if (payload.id) {
        const r = await upsertInformationUtileItem({
          id: payload.id,
          section_id: payload.section_id,
          title: payload.title,
          content: payload.content,
          example: payload.example ?? null,
          sort_order: payload.sort_order,
        });
        if (!r.success) throw new Error(r.error);
      } else {
        const r = await createInformationUtileItem({
          section_id: payload.section_id,
          title: payload.title,
          content: payload.content,
          example: payload.example,
          sort_order: payload.sort_order,
        });
        if (!r.success) throw new Error(r.error);
      }
      setItemForm(null);
      await loadData();
    } catch (e) {
      alert(e.message || "Erreur enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm("Supprimer cette information ?")) return;
    setAdminBusy(true);
    try {
      const r = await deleteInformationUtileItem(itemId);
      if (!r.success) throw new Error(r.error);
      await loadData();
    } catch (e) {
      alert(e.message || "Erreur suppression");
    } finally {
      setAdminBusy(false);
    }
  };

  const handleImporterContenuDefaut = async () => {
    setImportingDefaults(true);
    try {
      const r = await importerContenuInformationsUtilesDefautDepuisLApp();
      if (!r.success) {
        alert(
          r.error ||
            "Impossible d’importer. Vérifiez que les tables Supabase existent (migration) et que votre compte est admin."
        );
        return;
      }
      if (r.skippedAlreadyPresent) {
        alert("Des catégories existent déjà en base. Rechargez la page si l’affichage ne suit pas.");
        await loadData();
        return;
      }
      await loadData();
    } finally {
      setImportingDefaults(false);
    }
  };

  return (
    <main className="min-h-full relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <header className="mb-8">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-white mb-3">
              <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-cyan-200 bg-clip-text text-transparent">
                Informations utiles
              </span>
            </h1>
            <p className="text-slate-400 text-base max-w-2xl">
              Guide pratique pour tirer le meilleur parti de ViralWorks Studio. Découvre les meilleures pratiques,
              astuces et workflows pour créer du contenu de qualité.
            </p>
          </div>
        </header>

        {isAdminUser && (
          <div className="mb-8 glass-strong rounded-xl border border-violet-500/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2 text-violet-200">
              <Shield className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-medium">Mode administrateur</p>
                <p className="text-sm text-slate-400">
                  Gérez les catégories et les fiches. Les visiteurs voient toujours les textes d’origine tant qu’aucune
                  fiche n’est enregistrée dans Supabase ; après édition, c’est la base qui fait foi. Les catégories
                  inactives sont masquées pour le public.
                  {usingIntegratedFallback && (
                    <>
                      {" "}
                      <span className="text-slate-300">Astuce :</span> le bouton ci-dessous importe les 12 fiches d’un
                      coup si la base est vide.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              {usingIntegratedFallback && (
                <button
                  type="button"
                  disabled={adminBusy || saving || importingDefaults}
                  onClick={handleImporterContenuDefaut}
                  className="px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                >
                  {importingDefaults ? "Import…" : "Importer le contenu d’origine dans Supabase"}
                </button>
              )}
              <button
                type="button"
                disabled={adminBusy || saving}
                onClick={() => {
                  setItemForm(null);
                  setSectionForm("new");
                }}
                className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Nouvelle catégorie
              </button>
            </div>
          </div>
        )}

        {isAdminUser && sectionForm && (
          <div className="mb-6">
            <FormulaireSectionInformationsUtiles
              key={sectionForm === "new" ? "section-new" : sectionForm.id}
              initial={sectionForm === "new" ? null : sectionForm}
              nextSortOrder={nextSectionSortOrder}
              saving={saving}
              onCancel={() => setSectionForm(null)}
              onSave={handleSaveSection}
            />
          </div>
        )}

        {isAdminUser && itemForm && (
          <div className="mb-6">
            <FormulaireItemInformationsUtiles
              key={itemForm.item?.id ?? `item-new-${itemForm.sectionId}`}
              sectionId={itemForm.sectionId}
              initial={itemForm.item}
              nextSortOrder={itemForm.nextSortOrder}
              saving={saving}
              onCancel={() => setItemForm(null)}
              onSave={handleSaveItem}
            />
          </div>
        )}

        <div className="space-y-5">
          {visibleSections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              isExpanded={expandedSections.includes(section.id)}
              onToggle={() => toggleSection(section.id)}
              isAdmin={isAdminUser}
              adminBusy={adminBusy || saving || syncing}
              onEditSection={(s) => {
                setItemForm(null);
                if (s.db) {
                  setSectionForm(s.db);
                } else {
                  const meta = INFORMATIONS_UTILES_DEFAULT_SECTIONS.find((x) => x.id === s.id);
                  setSectionForm({
                    id: s.id,
                    slug: meta?.slug ?? "categorie",
                    title: s.title,
                    icon_name: meta?.icon_name ?? "FileText",
                    color: meta?.color ?? "cyan",
                    sort_order: meta?.sort_order ?? 0,
                    is_active: true,
                  });
                }
              }}
              onDeleteSection={handleDeleteSection}
              onToggleSectionActive={handleToggleSectionActive}
              onAddItem={(s) => {
                setSectionForm(null);
                const n = s.items?.length ?? 0;
                setItemForm({
                  sectionId: s.db?.id ?? s.id,
                  item: null,
                  nextSortOrder: n,
                });
              }}
              onEditItem={(sec, it) => {
                setSectionForm(null);
                const idx = sec.items.findIndex((x) => x.id === it.id);
                const sortOrder = it.db?.sort_order ?? (idx >= 0 ? idx : 0);
                setItemForm({
                  sectionId: sec.db?.id ?? sec.id,
                  item:
                    it.db ??
                    {
                      id: it.id,
                      section_id: sec.db?.id ?? sec.id,
                      title: it.title,
                      content: it.content,
                      example: it.example ?? null,
                      sort_order: sortOrder,
                    },
                  nextSortOrder: sortOrder,
                });
              }}
              onDeleteItem={handleDeleteItem}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </main>
  );
}
