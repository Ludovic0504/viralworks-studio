import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronUp, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { useT } from "@/contexte/FournisseurLocale";
import {
  feedRowAspectClass,
  feedRowContainsHistoryItem,
  getFeedRowVisibility,
  truncateFeedPrompt,
} from "@/bibliotheque/imageStudio/imageStudioFeed";
import { getImageStudioModelLabel } from "@/bibliotheque/imageStudio/imageStudioModels";
import { getImageUrlFromHistory } from "@/bibliotheque/imageStudio/imageStudioHistory";

const FEED_TOP_THRESHOLD = 48;

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

function isFeedNearBottom(el, threshold = 48) {
  if (!el) return true;
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  return max - el.scrollTop <= threshold;
}

function isFeedNearTop(el, threshold = FEED_TOP_THRESHOLD) {
  if (!el) return true;
  return el.scrollTop <= threshold;
}

function scrollFeedToBottom(el, behavior = "auto") {
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior });
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

function scrollFeedToHistoryItem(feedEl, item, { behavior = "smooth" } = {}) {
  if (!feedEl || !item) return;

  const imageEl = item.id ? feedEl.querySelector(`[data-history-id="${item.id}"]`) : null;
  if (imageEl) {
    scrollChildIntoView(feedEl, imageEl, { block: "center", behavior });
    return;
  }

  const batchId = item.metadata?.batchId;
  if (!batchId) return;
  const batchEl = feedEl.querySelector(`[data-batch-id="${batchId}"]`);
  if (batchEl) {
    scrollChildIntoView(feedEl, batchEl, { block: "center", behavior });
  }
}

function FeedRow({ row, activeHistoryId, onImageOpen, loadingHint, noDescriptionLabel, openImageAria }) {
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
            aria-label={openImageAria}
          >
            <img
              src={image.url}
              alt=""
              className="image-studio-feed-image"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
          </button>
        ))}
        {row.generating
          ? Array.from({ length: slots }).map((_, index) => (
              <div
                key={`loading-${row.id}-${index}`}
                className="image-studio-feed-image-card is-loading"
                aria-hidden={index > 0}
                aria-busy={index === 0 ? "true" : undefined}
                aria-label={index === 0 && loadingHint ? loadingHint : undefined}
              >
                <Loader2 className="h-6 w-6 animate-spin text-white/35" strokeWidth={2} />
              </div>
            ))
          : null}
      </div>

      <div className="image-studio-feed-row-meta">
        <p className="image-studio-feed-row-prompt" title={row.prompt || undefined}>
          {promptSnippet || noDescriptionLabel}
        </p>
        <div className="image-studio-feed-row-tags">
          {modelLabel ? <span className="image-studio-feed-tag">{modelLabel}</span> : null}
          {row.aspectRatio ? (
            <span className="image-studio-feed-tag">{row.aspectRatio}</span>
          ) : null}
          <span className="image-studio-feed-tag">2K</span>
          {row.generating && loadingHint ? (
            <span className="image-studio-feed-loading-hint">{loadingHint}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

const ImageStudioFeedPanel = forwardRef(function ImageStudioFeedPanel(
  {
    feedRows,
    history,
    historyLoading,
    generating,
    generationLoadingHint,
    activeHistoryId,
    onSelectHistoryItem,
    onImageOpen,
    restoreFeedScrollTop,
    restoreThumbScrollTop,
    scrollToEndToken,
    onFeedScroll,
    onThumbScroll,
  },
  ref,
) {
  const t = useT();
  const feedScrollRef = useRef(null);
  const thumbScrollRef = useRef(null);
  const userScrolledRef = useRef(false);
  const restoreTargetsRef = useRef({ feed: undefined, thumb: undefined });
  const prevScrollTokenRef = useRef(scrollToEndToken);
  const pendingScrollItemRef = useRef(null);
  const [feedExpanded, setFeedExpanded] = useState(false);
  const [feedAtTop, setFeedAtTop] = useState(false);

  const thumbHistory = useMemo(() => sortHistoryOldestFirst(history), [history]);
  const historyImageCount = useMemo(
    () => history.filter((item) => getImageUrlFromHistory(item)).length,
    [history],
  );
  const { visibleRows, hiddenCount } = useMemo(
    () => getFeedRowVisibility(feedRows, feedExpanded),
    [feedRows, feedExpanded],
  );
  const showLoadMore = hiddenCount > 0 && !feedExpanded;
  const showEmptyFeed =
    feedRows.length === 0 &&
    !generating &&
    historyImageCount === 0 &&
    !(historyLoading && history.length === 0);

  const expandFeed = useCallback(() => {
    const feedEl = feedScrollRef.current;
    const prevScrollHeight = feedEl?.scrollHeight ?? 0;
    const prevScrollTop = feedEl?.scrollTop ?? 0;

    setFeedExpanded(true);

    requestAnimationFrame(() => {
      const el = feedScrollRef.current;
      if (!el) return;
      const heightDelta = el.scrollHeight - prevScrollHeight;
      if (heightDelta > 0) {
        el.scrollTop = prevScrollTop + heightDelta;
      }
    });
  }, []);

  const scrollToHistoryItem = useCallback(
    (item, { behavior = "smooth", expandIfNeeded = true } = {}) => {
      if (!item) return;

      const needsExpand =
        expandIfNeeded &&
        !feedExpanded &&
        hiddenCount > 0 &&
        !visibleRows.some((row) => feedRowContainsHistoryItem(row, item));

      if (needsExpand) {
        pendingScrollItemRef.current = { item, behavior };
        expandFeed();
        return;
      }

      requestAnimationFrame(() => {
        scrollFeedToHistoryItem(feedScrollRef.current, item, { behavior });
      });
    },
    [expandFeed, feedExpanded, hiddenCount, visibleRows],
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollToItem: (item, options) => scrollToHistoryItem(item, options),
      expandFeed,
    }),
    [expandFeed, scrollToHistoryItem],
  );

  useEffect(() => {
    if (!pendingScrollItemRef.current) return;
    const pending = pendingScrollItemRef.current;
    pendingScrollItemRef.current = null;
    requestAnimationFrame(() => {
      scrollFeedToHistoryItem(feedScrollRef.current, pending.item, {
        behavior: pending.behavior,
      });
    });
  }, [feedExpanded, feedRows.length]);

  useEffect(() => {
    restoreTargetsRef.current = {
      feed: restoreFeedScrollTop,
      thumb: restoreThumbScrollTop,
    };
  }, [restoreFeedScrollTop, restoreThumbScrollTop]);

  const tryRestoreScroll = useCallback(() => {
    if (userScrolledRef.current) return;
    if (historyLoading && feedRows.length === 0 && history.length === 0) return;
    if (feedRows.length === 0 && history.length === 0) return;

    const { feed, thumb } = restoreTargetsRef.current;
    if (typeof feed === "number") {
      clampScrollTop(feedScrollRef.current, feed);
    } else {
      scrollFeedToBottom(feedScrollRef.current, "auto");
    }

    if (typeof thumb === "number") {
      clampScrollTop(thumbScrollRef.current, thumb);
    }
  }, [historyLoading, feedRows.length, history.length]);

  useLayoutEffect(() => {
    tryRestoreScroll();
    const raf = requestAnimationFrame(tryRestoreScroll);

    const feedEl = feedScrollRef.current;
    if (feedEl) {
      setFeedAtTop(isFeedNearTop(feedEl));
    }

    const resizeObserver =
      feedEl && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (!userScrolledRef.current) tryRestoreScroll();
          })
        : null;
    if (feedEl) resizeObserver?.observe(feedEl);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
    };
  }, [tryRestoreScroll, feedRows.length, history.length, visibleRows.length]);

  useEffect(() => {
    if (scrollToEndToken === prevScrollTokenRef.current) return;
    prevScrollTokenRef.current = scrollToEndToken;
    if (!scrollToEndToken) return;

    const feedEl = feedScrollRef.current;
    if (feedEl) {
      scrollFeedToBottom(feedEl, "smooth");
    }
    const thumbEl = thumbScrollRef.current;
    if (thumbEl) {
      thumbEl.scrollTo({ top: thumbEl.scrollHeight, behavior: "smooth" });
    }
    userScrolledRef.current = false;
    setFeedAtTop(false);
  }, [scrollToEndToken]);

  const handleFeedScroll = useCallback(
    (event) => {
      const el = event.currentTarget;
      userScrolledRef.current = !isFeedNearBottom(el);
      setFeedAtTop(isFeedNearTop(el));
      onFeedScroll?.(el.scrollTop);
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

  const handleLoadMore = useCallback(() => {
    expandFeed();
  }, [expandFeed]);

  return (
    <div className="image-studio-feed-shell flex min-h-0 min-w-0 flex-1">
      <div
        ref={feedScrollRef}
        className="studio-subtle-scrollbar image-studio-feed min-h-0 flex-1 overflow-y-auto"
        onScroll={(e) => handleFeedScroll(e)}
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
              {t("imageStudio.emptyKicker")}
            </p>
            <h2 className="image-studio-empty-title">
              Image <span>Studio</span>
            </h2>
            <p className="image-studio-empty-sub">
              {t("imageStudio.emptySub")}
            </p>
          </div>
        ) : (
          <div className="image-studio-feed-list">
            {showLoadMore ? (
              <div
                className={`image-studio-feed-load-more${feedAtTop ? " is-visible" : ""}`}
              >
                <button
                  type="button"
                  className="image-studio-feed-load-more-btn"
                  onClick={handleLoadMore}
                  aria-label={t("imageStudio.loadMoreAria")}
                >
                  <ChevronUp className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  <span>{t("imageStudio.loadMore")}</span>
                </button>
              </div>
            ) : null}
            {visibleRows.map((row) => (
              <FeedRow
                key={row.id}
                row={row}
                activeHistoryId={activeHistoryId}
                onImageOpen={onImageOpen}
                loadingHint={row.generating ? generationLoadingHint : ""}
                noDescriptionLabel={t("imageStudio.noDescription")}
                openImageAria={t("imageStudio.openImageAria")}
              />
            ))}
          </div>
        )}
      </div>

      <aside
        ref={thumbScrollRef}
        className="image-studio-thumb-strip studio-subtle-scrollbar shrink-0"
        aria-label={t("imageStudio.historyAria")}
        onScroll={(e) => handleThumbScroll(e.currentTarget.scrollTop)}
      >
        {historyLoading && history.length === 0 && feedRows.length === 0 ? (
          <div className="image-studio-thumb-strip-skeletons" aria-hidden>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="image-studio-thumb-strip-skeleton" />
            ))}
          </div>
        ) : thumbHistory.length === 0 ? (
          <div className="image-studio-thumb-strip-empty" title={t("imageStudio.noImages")}>
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
                title={item.input?.trim() || t("imageStudio.generatedImage")}
              >
                <img src={thumbUrl} alt="" className="image-studio-thumb-strip-img" loading="lazy" />
              </button>
            );
          })
        )}
      </aside>
    </div>
  );
});

/** @deprecated Utiliser la ref `scrollToItem` du panneau. */
export function scrollImageStudioFeedToItem(item, { behavior = "smooth" } = {}) {
  const feedEl = document.querySelector(".image-studio-feed");
  scrollFeedToHistoryItem(feedEl, item, { behavior });
}

export default ImageStudioFeedPanel;
