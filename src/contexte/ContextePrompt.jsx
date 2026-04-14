/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const PromptContext = createContext();


function load() {
  try {
    const v2 = localStorage.getItem("history_v2");
    if (v2) return JSON.parse(v2);

    const v1 = localStorage.getItem("prompt_history_v1");
    if (v1) {
      const itemsV1 = JSON.parse(v1);

      return itemsV1.map(i => ({ ...i, kind: "prompt" }));
    }
  } catch (err) {
    console.warn("Impossible de charger l'historique local:", err);
  }
  return [];
}

export function PromptProvider({ children }) {
  const [items, setItems] = useState(load);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    // Utiliser un debounce pour éviter trop de sauvegardes
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem("history_v2", JSON.stringify(items));
      } catch (e) {
        console.warn("Erreur sauvegarde historique:", e);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [items]);

  const selected = useMemo(
    () => items.find(i => i.id === selectedId) || null,
    [items, selectedId]
  );

  const addItem = ({ kind, input, output, model = "gpt-4o-mini" }) => {
    const id = crypto.randomUUID?.() || String(Date.now());
    const createdAt = new Date().toISOString();
    const item = { id, kind, input, output, model, createdAt, pinned: false };
    setItems(prev => [item, ...prev]);
    setSelectedId(id);
  };

  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));
  const togglePin = (id) => setItems(prev => prev.map(i => i.id === id ? { ...i, pinned: !i.pinned } : i));
  const clearAll = (kind) =>
    setItems(prev => prev.filter(i => i.pinned || (kind ? i.kind !== kind : true)));

  const getByKind = (kind) => items.filter(i => i.kind === kind);

  return (
    <PromptContext.Provider
      value={{ items, selected, selectedId, setSelectedId, addItem, removeItem, togglePin, clearAll, getByKind }}
    >
      {children}
    </PromptContext.Provider>
  );
}

export const usePromptCtx = () => useContext(PromptContext);
