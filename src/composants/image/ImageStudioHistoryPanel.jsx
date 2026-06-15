import { useEffect, useMemo, useRef } from "react";
import { Clock, ImageIcon } from "lucide-react";
import { getImageUrlFromHistory } from "@/bibliotheque/imageStudio/imageStudioHistory";

function sortHistoryNewestFirst(items) {
  return [...items].sort((a, b) => {
    const ta = new Date(a.created_at ?? 0).getTime();
    const tb = new Date(b.created_at ?? 0).getTime();
    if (ta !== tb) return tb - ta;
    return String(b.id).localeCompare(String(a.id));
  });
}

export default function ImageStudioHistoryPanel({
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
    if (scrollToStartToken === prevScrollTokenRef.current) return;
    prevScrollTokenRef.current = scrollToStartToken;
    if (!scrollToStartToken) return;
    const el = stripRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: "smooth" });
  }, [scrollToStartToken]);

  return (
    <section
      className="image-studio-history-panel image-studio-history-panel--mobile"
      aria-label="Historique des générations"
    >
      <header className="image-studio-history-header">
        <h2 className="image-studio-history-header-title">
          <Clock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Historique
        </h2>
        <span className="image-studio-history-count" aria-label={`${historyItems.length} images`}>
          {historyItems.length}
        </span>
      </header>

      <div
        ref={stripRef}
        className="image-studio-history-strip studio-subtle-scrollbar"
      >
        {historyLoading && historyItems.length === 0 ? (
          <div className="image-studio-history-strip-skeletons" aria-hidden>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="image-studio-history-strip-skeleton" />
            ))}
          </div>
        ) : historyItems.length === 0 ? (
          <div className="image-studio-history-strip-empty" title="Aucune image">
            <ImageIcon className="h-4 w-4 opacity-30" strokeWidth={1.75} aria-hidden />
          </div>
        ) : (
          <ul className="image-studio-history-strip-list">
            {historyItems.map((item) => {
              const thumbUrl = getImageUrlFromHistory(item);
              if (!thumbUrl) return null;
              const isActive = activeHistoryId === item.id;

              return (
                <li key={item.id} className="image-studio-history-strip-item-wrap">
                  <button
                    type="button"
                    className={`image-studio-history-strip-item${isActive ? " is-active" : ""}`}
                    onClick={() => {
                      onSelectItem?.(item);
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
    </section>
  );
}
