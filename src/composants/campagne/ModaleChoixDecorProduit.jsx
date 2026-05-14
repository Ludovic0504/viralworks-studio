import { useId, useMemo, useState } from "react";
import CampagneProductPickerShell from "./CampagneProductPickerShell.jsx";
import { ProductCampagneLucideIcon } from "./productCampagneLucide.jsx";
import { PRODUCT_SCENE_DECORS } from "@/bibliotheque/vwsProductCampagneCatalog";

const TABS = [
  { id: "all", label: "Tous" },
  { id: "realiste", label: "Réaliste" },
  { id: "insolite", label: "Insolite" },
];

/**
 * @param {'portal' | 'studioOverlay'} [presentation]
 * @param {(id: string | null) => void} onSelect — `null` = pas de décor spécifique
 */
export default function ModaleChoixDecorProduit({
  open,
  onClose,
  presentation = "portal",
  onSelect,
  currentId = null,
  /** Ids décor catalogue à afficher en premier (ex. secteur d'activité). */
  priorityIds = null,
}) {
  const titleId = useId();
  const [tab, setTab] = useState("all");

  const filtered = useMemo(() => {
    const base =
      tab === "all" ? [...PRODUCT_SCENE_DECORS] : PRODUCT_SCENE_DECORS.filter((d) => d.category === tab);
    if (!priorityIds?.length) return base;
    const inBase = new Set(base.map((d) => d.id));
    const head = [];
    for (const id of priorityIds) {
      if (!inBase.has(id)) continue;
      const def = base.find((d) => d.id === id);
      if (def) head.push(def);
    }
    const headSet = new Set(head.map((d) => d.id));
    const tail = base.filter((d) => !headSet.has(d.id));
    return [...head, ...tail];
  }, [tab, priorityIds]);

  const pickNone = () => {
    onSelect?.(null);
    onClose?.();
  };

  const pick = (id) => {
    onSelect?.(id);
    onClose?.();
  };

  return (
    <CampagneProductPickerShell
      open={open}
      onClose={onClose}
      presentation={presentation}
      titleId={titleId}
      title="Décor de la scène"
      subtitle="Choisis l'environnement qui cadre ta vidéo avec la bonne ambiance."
    >
      <div className="flex flex-wrap gap-1 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              tab === t.id
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "border-[#1e2845] bg-[#161d2e] text-[#8a8f9a] hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={pickNone}
        className={`mb-2 flex w-full items-center justify-center rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
          currentId == null
            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
            : "border-[#1e2845] bg-[#161d2e] text-gray-300 hover:border-[#2a3555]"
        }`}
      >
        Pas de décor spécifique
      </button>

      <div className="grid grid-cols-2 gap-2 pb-4">
        {filtered.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => pick(d.id)}
            className={`flex gap-2.5 rounded-[11px] border bg-[#161d2e] p-2.5 text-left transition-colors hover:border-emerald-500/40 ${
              currentId === d.id
                ? "border-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
                : "border-[#1e2845]"
            }`}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#0f1420]"
              aria-hidden
            >
              <ProductCampagneLucideIcon name={d.iconId} className="h-5 w-5 text-sky-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold leading-tight text-white">{d.name}</div>
              <div className="mt-0.5 text-[10px] leading-snug text-[#8a8f9a]">{d.description}</div>
            </div>
          </button>
        ))}
      </div>
    </CampagneProductPickerShell>
  );
}
