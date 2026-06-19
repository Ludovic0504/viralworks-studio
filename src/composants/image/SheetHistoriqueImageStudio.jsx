import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Clock, ImageIcon, X } from "lucide-react";
import { getImageUrlFromHistory } from "@/bibliotheque/imageStudio/imageStudioHistory";

function sortHistoryNewestFirst(items) {
  return [...items].sort((a, b) => {
    const ta = new Date(a.created_at ?? 0).getTime();
    const tb = new Date(b.created_at ?? 0).getTime();
    if (ta !== tb) return tb - ta;
    return String(b.id).localeCompare(String(a.id));
  });
}

export default function SheetHistoriqueImageStudio({
  open,
  onClose,
  history,
  historyLoading,
  activeHistoryId,
  onSelectItem,
  scrollToStartToken,
}) {
  const stripRef = useRef(null);
  const prevScrollTokenRef = useRef(scrollToStartToken);
  const historyItems = useMemo(() => sortHistoryNewestFirst(history), [history]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (scrollToStartToken === prevScrollTokenRef.current) return;
    prevScrollTokenRef.current = scrollToStartToken;
    if (!scrollToStartToken) return;
    const el = stripRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: "smooth" });
  }, [scrollToStartToken]);

  if (!open) return null;

  return createPortal(
    <div
      className="image-studio-history-sheet-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="image-studio-history-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-studio-history-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="image-studio-history-sheet-handle" aria-hidden />

        <div className="image-studio-history-sheet-header">
          <h2 id="image-studio-history-sheet-title" className="image-studio-history-sheet-title">
            <Clock className="h-4 w-4" strokeWidth={2} aria-hidden />
            Historique
            <span className="image-studio-history-sheet-count">{historyItems.length}</span>
          </h2>
          <button
            type="button"
            className="image-studio-history-sheet-close"
            onClick={onClose}
            aria-label="Fermer l'historique"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={stripRef} className="image-studio-history-sheet-body studio-subtle-scrollbar">
          {historyLoading && historyItems.length === 0 ? (
            <div className="image-studio-history-sheet-grid">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="image-studio-history-strip-skeleton" />
              ))}
            </div>
          ) : historyItems.length === 0 ? (
            <div className="image-studio-history-sheet-empty">
              <ImageIcon className="h-8 w-8 opacity-25" strokeWidth={1.5} aria-hidden />
              <p>Aucune image générée</p>
            </div>
          ) : (
            <ul className="image-studio-history-sheet-grid">
              {historyItems.map((item) => {
                const thumbUrl = getImageUrlFromHistory(item);
                if (!thumbUrl) return null;
                const isActive = activeHistoryId === item.id;

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`image-studio-history-strip-item${isActive ? " is-active" : ""}`}
                      onClick={() => {
                        onSelectItem?.(item);
                        onClose?.();
                      }}
                      title={item.input?.trim() || "Image générée"}
                      aria-label={item.input?.trim() || "Image générée"}
                    >
                      <img
                        src={thumbUrl}
                        alt=""
                        className="image-studio-history-strip-img"
                        loading="lazy"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
