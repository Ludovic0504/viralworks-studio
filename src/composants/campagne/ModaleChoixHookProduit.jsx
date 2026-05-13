import { useId, useMemo, useState } from "react";
import CampagneProductPickerShell from "./CampagneProductPickerShell.jsx";
import { ProductCampagneLucideIcon } from "./productCampagneLucide.jsx";
import {
  PRODUCT_OPENING_HOOKS,
  hookCategoryLabelFr,
} from "@/bibliotheque/vwsProductCampagneCatalog";

const TABS = [
  { id: "all", label: "Tous" },
  { id: "stunt", label: "Stunt" },
  { id: "subtil", label: "Subtil" },
];

/**
 * @param {'portal' | 'studioOverlay'} [presentation]
 * @param {(id: string | null) => void} onSelect — `null` = pas de hook
 */
export default function ModaleChoixHookProduit({
  open,
  onClose,
  presentation = "portal",
  onSelect,
  currentId = null,
}) {
  const titleId = useId();
  const [tab, setTab] = useState("all");

  const filtered = useMemo(() => {
    if (tab === "all") return PRODUCT_OPENING_HOOKS;
    return PRODUCT_OPENING_HOOKS.filter((h) => h.category === tab);
  }, [tab]);

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
      title="Hook d'accroche"
      subtitle="Les 3 premières secondes décident si ta vidéo est regardée ou skippée."
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
        Pas de hook
      </button>

      <div className="grid grid-cols-2 gap-2 pb-4">
        {filtered.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => pick(h.id)}
            className={`flex gap-2.5 rounded-[11px] border bg-[#161d2e] p-2.5 text-left transition-colors hover:border-emerald-500/40 ${
              currentId === h.id
                ? "border-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
                : "border-[#1e2845]"
            }`}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#0f1420]"
              aria-hidden
            >
              <ProductCampagneLucideIcon name={h.iconId} className="h-5 w-5 text-emerald-400/90" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={`mb-0.5 text-[9px] font-bold uppercase tracking-wide ${
                  h.category === "stunt" ? "text-red-400/90" : "text-violet-400/90"
                }`}
              >
                {hookCategoryLabelFr(h.category)}
              </div>
              <div className="text-[12px] font-semibold leading-tight text-white">{h.name}</div>
              <div className="mt-0.5 text-[10px] leading-snug text-[#8a8f9a]">{h.description}</div>
            </div>
          </button>
        ))}
      </div>
    </CampagneProductPickerShell>
  );
}
