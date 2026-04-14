import { useMemo, useState } from "react";
import { usePromptCtx } from "../../contexte/ContextePrompt";

export default function HistoryList({ kind }) {
  const { getByKind, setSelectedId, removeItem, togglePin, clearAll } = usePromptCtx();
  const [q, setQ] = useState("");
  const items = getByKind(kind);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const t = q.toLowerCase();
    return items.filter(i =>
      (i.input || "").toLowerCase().includes(t) ||
      (i.output || "").toLowerCase().includes(t)
    );
  }, [q, items]);

  const pinned = filtered.filter(i => i.pinned);
  const others = filtered.filter(i => !i.pinned);

  const Row = ({ i }) => (
    <button
      onClick={() => setSelectedId(i.id)}
      className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50"
      title={i.input}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-sm font-medium">
          {(i.output?.slice(0, 60) || i.input?.slice(0, 60) || "Sans titre")}{(i.output?.length > 60 || i.input?.length > 60) ? "…" : ""}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            className={`text-xs px-2 py-1 rounded ${i.pinned ? "bg-amber-200" : "bg-gray-200"}`}
            onClick={(e) => { e.stopPropagation(); togglePin(i.id); }}
          >
            {i.pinned ? "Épinglé" : "Épingler"}
          </button>
          <button
            className="text-xs px-2 py-1 rounded bg-red-100 hover:bg-red-200"
            onClick={(e) => { e.stopPropagation(); removeItem(i.id); }}
          >
            Suppr.
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {new Date(i.createdAt).toLocaleString()} · {i.model?.toUpperCase?.()}
      </div>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher…"
          className="w-full border rounded-xl px-3 py-2 outline-none"
        />
        <button
          onClick={() => clearAll(kind)}
          className="text-xs px-3 py-2 rounded-xl border hover:bg-gray-50"
          title="Effacer l'historique non épinglé de cette page"
        >
          Nettoyer
        </button>
      </div>

      {pinned.length > 0 && (
        <div>
          <div className="text-xs uppercase text-gray-500 mb-1">Épinglés</div>
          <div className="flex flex-col gap-2">{pinned.map(i => <Row key={i.id} i={i} />)}</div>
        </div>
      )}

      <div>
        <div className="text-xs uppercase text-gray-500 mb-1">Historique</div>
        {others.length
          ? <div className="flex flex-col gap-2">{others.map(i => <Row key={i.id} i={i} />)}</div>
          : <div className="text-sm text-gray-500">Aucun élément</div>}
      </div>
    </div>
  );
}
