import { useMemo, useRef, useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { getImageUrlFromHistory } from "@/bibliotheque/imageStudio/imageStudioHistory";
import { getImageStudioUserPrompt } from "@/bibliotheque/imageStudio/promptMentions";
import {
  IMAGE_STUDIO_HISTORY_DRAG_MIME,
  serializeHistoryDragPayload,
} from "@/bibliotheque/imageStudio/imageStudioHistoryDrag";

/** Miniatures visibles avant « Voir plus » (bandeau Projets). */
export const PROJECTS_HISTORY_PREVIEW_LIMIT = 6;

function LoadMoreStackedLabel({ label }) {
  const parts = String(label || "")
    .trim()
    .split(/\s+/);
  if (parts.length < 2) {
    return <span>{label}</span>;
  }
  return (
    <span className="image-studio-load-more-stack" aria-hidden>
      <span>{parts[0]}</span>
      <span>{parts.slice(1).join(" ")}</span>
    </span>
  );
}

function sortNewestFirst(items) {
  return [...items].sort((a, b) => {
    const ta = new Date(a.created_at ?? 0).getTime();
    const tb = new Date(b.created_at ?? 0).getTime();
    if (ta !== tb) return tb - ta;
    return String(b.id).localeCompare(String(a.id));
  });
}

export default function ImageStudioProjectsHistoryStrip({
  history,
  historyLoading,
  onAddImage,
  t,
}) {
  const items = useMemo(() => sortNewestFirst(history), [history]);
  const didDragRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const canClickAdd = typeof onAddImage === "function";

  const visibleItems = expanded
    ? items
    : items.slice(0, PROJECTS_HISTORY_PREVIEW_LIMIT);
  const hasMore = !expanded && items.length > PROJECTS_HISTORY_PREVIEW_LIMIT;

  return (
    <aside
      className="image-studio-projects-history"
      aria-label={t("imageStudio.projectsHistoryAria")}
    >
      <div className="image-studio-projects-history-head">
        <span className="image-studio-projects-history-title">
          {t("imageStudio.projectsHistoryTitle")}
        </span>
        <span className="image-studio-projects-history-hint">
          {canClickAdd
            ? t("imageStudio.projectsHistoryHintCanvas")
            : t("imageStudio.projectsHistoryHint")}
        </span>
      </div>

      {historyLoading && items.length === 0 ? (
        <div className="image-studio-projects-history-loading">
          <Loader2 className="h-4 w-4 animate-spin text-white/35" aria-hidden />
        </div>
      ) : items.length === 0 ? (
        <div className="image-studio-projects-history-empty">
          <ImageIcon className="h-4 w-4 opacity-30" aria-hidden />
          <span>{t("imageStudio.projectsHistoryEmpty")}</span>
        </div>
      ) : (
        <ul className="image-studio-projects-history-strip studio-subtle-scrollbar">
          {visibleItems.map((item) => {
            const url = getImageUrlFromHistory(item);
            if (!url) return null;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="image-studio-projects-history-thumb"
                  draggable
                  title={
                    getImageStudioUserPrompt(item?.input) ||
                    t("imageStudio.generatedImage")
                  }
                  aria-label={
                    canClickAdd
                      ? t("imageStudio.projectsHistoryAddAria")
                      : t("imageStudio.projectsHistoryDragAria")
                  }
                  onDragStart={(e) => {
                    const payload = serializeHistoryDragPayload(item);
                    if (!payload) {
                      e.preventDefault();
                      return;
                    }
                    didDragRef.current = true;
                    e.dataTransfer.setData(IMAGE_STUDIO_HISTORY_DRAG_MIME, payload);
                    e.dataTransfer.setData("application/json", payload);
                    e.dataTransfer.setData("text/plain", payload);
                    e.dataTransfer.effectAllowed = "copy";
                    e.currentTarget.classList.add("is-dragging");
                  }}
                  onDragEnd={(e) => {
                    e.currentTarget.classList.remove("is-dragging");
                  }}
                  onClick={() => {
                    if (didDragRef.current) {
                      didDragRef.current = false;
                      return;
                    }
                    if (!canClickAdd) return;
                    onAddImage(item);
                  }}
                >
                  <img
                    src={url}
                    alt=""
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                  />
                </button>
              </li>
            );
          })}
          {hasMore ? (
            <li className="image-studio-projects-history-more-item">
              <button
                type="button"
                className="image-studio-projects-history-more-btn"
                onClick={() => setExpanded(true)}
                aria-label={t("imageStudio.loadMoreAria")}
              >
                <LoadMoreStackedLabel label={t("imageStudio.loadMore")} />
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </aside>
  );
}
