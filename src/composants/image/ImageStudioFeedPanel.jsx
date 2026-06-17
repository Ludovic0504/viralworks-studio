import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { ImageIcon, Loader2, Sparkles } from "lucide-react";
import {
  feedRowAspectClass,
  truncateFeedPrompt,
} from "@/bibliotheque/imageStudio/imageStudioFeed";
import { getImageStudioModelLabel } from "@/bibliotheque/imageStudio/imageStudioModels";
import { getImageUrlFromHistory } from "@/bibliotheque/imageStudio/imageStudioHistory";

function sortHistoryOldestFirst(items) {
  return [...items].sort((a, b) => {
    const ta = new Date(a.created_at ?? 0).getTime();
    const tb = new Date(b.created_at ?? 0).getTime();
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
}

function clampScrollTop(el, top) {
  if (!el || typeof top !== "number" || Number.isNaN(top)) return;
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  el.scrollTop = Math.min(Math.max(0, top), max);
}

function scrollChildIntoView(container, child, { block = "center", behavior = "smooth" } = {}) {
  if (!container || !child) return;
  const containerRect = container.getBoundingClientRect();
  const childRect = child.getBoundingClientRect();
  const childOffsetTop = childRect.top - containerRect.top + container.scrollTop;
  let target = childOffsetTop;

  if (block === "end") {
    target = childOffsetTop - container.clientHeight + childRect.height;
  } else if (block === "center") {
    target = childOffsetTop - (container.clientHeight - childRect.height) / 2;
  }

  const max = Math.max(0, container.scrollHeight - container.clientHeight);
  container.scrollTo({
    top: Math.min(Math.max(0, target), max),
    behavior,
  });
}

export function scrollImageStudioFeedToItem(item, { behavior = "smooth" } = {}) {
  if (!item) return;
  const feedEl = document.querySelector(".image-studio-feed");
  if (!feedEl) return;

  const imageEl = item.id ? document.querySelector(`[data-history-id="${item.id}"]`) : null;
  if (imageEl) {
    scrollChildIntoView(feedEl, imageEl, { block: "center", behavior });
    return;
  }

  const batchId = item.metadata?.batchId;
  if (!batchId) return;
  const batchEl = document.querySelector(`[data-batch-id="${batchId}"]`);
  if (batchEl) {
    scrollChildIntoView(feedEl, batchEl, { block: "center", behavior });
  }
}

function FeedRow({ row, activeHistoryId, onImageOpen }) {
  const aspectClass = feedRowAspectClass(row.aspectRatio);
  const promptSnippet = truncateFeedPrompt(row.prompt);
  const modelLabel = row.model ? getImageStudioModelLabel(row.model) : null;
  const slots = row.generating
    ? Math.max(0, (row.progress?.total ?? 1) - row.images.length)
    : 0;

  return (
    <article className="image-studio-feed-row" data-batch-id={row.id}>
      <div className={`image-studio-feed-row-images ${aspectClass}`}>
        {row.images.map((image) => (
          <button
            key={image.historyId ?? image.url}
            type="button"
            className={`image-studio-feed-image-card${
              activeHistoryId && image.historyId === activeHistoryId ? " is-active" : ""
            }`}
            data-history-id={image.historyId || undefined}
            onClick={() =>
              onImageOpen?.({
                url: image.url,
                historyId: image.historyId,
                prompt: row.prompt,
                model: row.model,
                aspectRatio: row.aspectRatio,
              })
            }
            aria-label="Ouvrir l'image en grand"
          >
            <img src={image.url} alt="" className="image-studio-feed-image" loading="lazy" />
          </button>
        ))}
        {row.generating
          ? Array.from({ length: slots }).map((_, index) => (
              <div
                key={`loading-${row.id}-${index}`}
                className="image-studio-feed-image-card is-loading"
                aria-hidden
              >
                <Loader2 className="h-6 w-6 animate-spin text-white/35" strokeWidth={2} />
              </div>
            ))
          : null}
      </div>

      <div className="image-studio-feed-row-meta">
        <p className="image-studio-feed-row-prompt" title={row.prompt || undefined}>
          {promptSnippet || "Sans description"}
        </p>
        <div className="image-studio-feed-row-tags">
          {modelLabel ? <span className="image-studio-feed-tag">{modelLabel}</span> : null}
          {row.aspectRatio ? (
            <span className="image-studio-feed-tag">{row.aspectRatio}</span>
          ) : null}
          <span className="image-studio-feed-tag">2K</span>
        </div>
      </div>
    </article>
  );
}

export default function ImageStudioFeedPanel({
  feedRows,
  history,
  historyLoading,
  generating,
  activeHistoryId,
  onSelectHistoryItem,
  onImageOpen,
  restoreFeedScrollTop,
  restoreThumbScrollTop,
  scrollToEndToken,
  onFeedScroll,
  onThumbScroll,
}) {
  const feedScrollRef = useRef(null);
  const thumbScrollRef = useRef(null);
  const userScrolledRef = useRef(false);
  const restoreTargetsRef = useRef({ feed: undefined, thumb: undefined });
  const prevScrollTokenRef = useRef(scrollToEndToken);
  const thumbHistory = useMemo(() => sortHistoryOldestFirst(history), [history]);
  const historyImageCount = useMemo(
    () => history.filter((item) => getImageUrlFromHistory(item)).length,
    [history],
  );
  const showEmptyFeed = feedRows.length === 0 && !generating && historyImageCount === 0;

  useEffect(() => {
    restoreTargetsRef.current = {
      feed: restoreFeedScrollTop,
      thumb: restoreThumbScrollTop,
    };
  }, [restoreFeedScrollTop, restoreThumbScrollTop]);

  const tryRestoreScroll = useCallback(() => {
    if (userScrolledRef.current || historyLoading) return;
    if (feedRows.length === 0 && history.length === 0) return;

    const { feed, thumb } = restoreTargetsRef.current;
    if (typeof feed === "number") {
      clampScrollTop(feedScrollRef.current, feed);
    }
    if (typeof thumb === "number") {
      clampScrollTop(thumbScrollRef.current, thumb);
    }
  }, [historyLoading, feedRows.length, history.length]);

  useLayoutEffect(() => {
    tryRestoreScroll();
    const raf = requestAnimationFrame(tryRestoreScroll);
    const t1 = window.setTimeout(tryRestoreScroll, 80);
    const t2 = window.setTimeout(tryRestoreScroll, 350);

    const feedEl = feedScrollRef.current;
    const resizeObserver =
      feedEl && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (!userScrolledRef.current) tryRestoreScroll();
          })
        : null;
    if (feedEl) resizeObserver?.observe(feedEl);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      resizeObserver?.disconnect();
    };
  }, [tryRestoreScroll]);

  useEffect(() => {
    if (scrollToEndToken === prevScrollTokenRef.current) return;
    prevScrollTokenRef.current = scrollToEndToken;
    if (!scrollToEndToken) return;

    userScrolledRef.current = true;
    const feedEl = feedScrollRef.current;
    if (feedEl) {
      feedEl.scrollTo({ top: feedEl.scrollHeight, behavior: "smooth" });
    }
    const thumbEl = thumbScrollRef.current;
    if (thumbEl) {
      thumbEl.scrollTo({ top: thumbEl.scrollHeight, behavior: "smooth" });
    }
  }, [scrollToEndToken]);

  const handleFeedScroll = useCallback(
    (scrollTop) => {
      userScrolledRef.current = true;
      onFeedScroll?.(scrollTop);
    },
    [onFeedScroll],
  );

  const handleThumbScroll = useCallback(
    (scrollTop) => {
      userScrolledRef.current = true;
      onThumbScroll?.(scrollTop);
    },
    [onThumbScroll],
  );

  return (
    <div className="image-studio-feed-shell flex min-h-0 min-w-0 flex-1">
      <div
        ref={feedScrollRef}
        className="studio-subtle-scrollbar image-studio-feed min-h-0 flex-1 overflow-y-auto"
        onScroll={(e) => handleFeedScroll(e.currentTarget.scrollTop)}
      >
        {showEmptyFeed ? (
          <div className="image-studio-feed-empty">
            <div className="image-studio-empty-showcase" aria-hidden>
              <div className="image-studio-empty-glow" />
              <div className="image-studio-empty-card image-studio-empty-card--1" />
              <div className="image-studio-empty-card image-studio-empty-card--2" />
              <div className="image-studio-empty-card image-studio-empty-card--3" />
              <div className="image-studio-empty-card image-studio-empty-card--4" />
            </div>
            <p className="image-studio-empty-kicker">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Commencez à créer avec
            </p>
            <h2 className="image-studio-empty-title">
              Image <span>Studio</span>
            </h2>
            <p className="image-studio-empty-sub">
              Décrivez une scène — chaque génération apparaît ici, image par image.
            </p>
          </div>
        ) : (
          <div className="image-studio-feed-list">
            {feedRows.map((row) => (
              <FeedRow
                key={row.id}
                row={row}
                activeHistoryId={activeHistoryId}
                onImageOpen={onImageOpen}
              />
            ))}
          </div>
        )}
      </div>

      <aside
        ref={thumbScrollRef}
        className="image-studio-thumb-strip studio-subtle-scrollbar shrink-0"
        aria-label="Historique des images"
        onScroll={(e) => handleThumbScroll(e.currentTarget.scrollTop)}
      >
        {historyLoading && history.length === 0 ? (
          <div className="image-studio-thumb-strip-skeletons" aria-hidden>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="image-studio-thumb-strip-skeleton" />
            ))}
          </div>
        ) : thumbHistory.length === 0 ? (
          <div className="image-studio-thumb-strip-empty" title="Aucune image">
            <ImageIcon className="h-3.5 w-3.5 opacity-30" strokeWidth={1.75} aria-hidden />
          </div>
        ) : (
          thumbHistory.map((item) => {
            const thumbUrl = getImageUrlFromHistory(item);
            if (!thumbUrl) return null;
            const isActive = activeHistoryId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`image-studio-thumb-strip-item${isActive ? " is-active" : ""}`}
                onClick={() => {
                  onSelectHistoryItem(item);
                }}
                title={item.input?.trim() || "Image générée"}
              >
                <img src={thumbUrl} alt="" className="image-studio-thumb-strip-img" loading="lazy" />
              </button>
            );
          })
        )}
      </aside>
    </div>
  );
}
