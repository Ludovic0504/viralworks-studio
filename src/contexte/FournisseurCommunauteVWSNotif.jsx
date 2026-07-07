import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/contexte/FournisseurAuth";
import {
  ensureWelcomePrivateMessage,
  getPrivateUnreadStatus,
  getPrivateInboxMeta,
  hasNewPublicMessageSince,
  markConversationRead,
  prefetchPrivateMessagesForConversation,
} from "@/bibliotheque/supabase/communaute";
import { censorMessageText } from "@/bibliotheque/moderation/messageCensor";
import { buildConversationFromUnreadPreview, hydratePrivateMessagesFromUnreadPreview } from "@/bibliotheque/community/onboarding";
import {
  getRememberedOnboardingPrivateMessages,
  rememberOnboardingPrivateMessages,
  mergeRememberedOnboardingPrivateMessages,
} from "@/bibliotheque/community/onboardingProgressCache";
import { rememberSupportConversation } from "@/bibliotheque/community/privateConversationsCache";

export const VWS_PUBLIC_LAST_SEEN_KEY = "vws_public_last_seen";
const DISMISSED_PREVIEW_KEY = "vws_dismissed_private_preview_id";

const FAST_POLL_MS = 500;
const NORMAL_POLL_MS = 8000;
const FAST_POLL_WINDOW_MS = 3 * 60 * 1000;
const PREVIEW_BUBBLE_DELAY_MS = 800;

const CommunauteVWSNotifContext = createContext(null);

function readDismissedPreviewId() {
  try {
    return String(localStorage.getItem(DISMISSED_PREVIEW_KEY) || "");
  } catch {
    return "";
  }
}

function enrichPreview(preview) {
  if (!preview) return null;
  const censored = censorMessageText(preview.contentPreview);
  return {
    ...preview,
    contentPreview: censored || preview.contentPreview,
  };
}

export function FournisseurCommunauteVWSNotif({ children }) {
  const { session } = useAuth();
  const uid = session?.user?.id;
  const [unreadPrivateCount, setUnreadPrivateCount] = useState(0);
  const [latestUnreadPrivatePreview, setLatestUnreadPrivatePreview] = useState(null);
  const [dismissedPreviewMessageId, setDismissedPreviewMessageId] = useState(readDismissedPreviewId);
  const [hasNewPublicSinceLastVisit, setHasNewPublicSinceLastVisit] = useState(false);
  const [previewBubbleDelayReady, setPreviewBubbleDelayReady] = useState(false);
  const [isViewingPrivateMessages, setIsViewingPrivateMessages] = useState(false);
  const [isViewingCommunityPage, setIsViewingCommunityPage] = useState(false);
  const [privateInboxMeta, setPrivateInboxMeta] = useState([]);
  const sessionStartedAtRef = useRef(0);
  const isViewingPrivateMessagesRef = useRef(false);
  const activePrivateConversationIdRef = useRef("");
  const markReadInFlightRef = useRef(false);

  const setPrivateMessagesViewActive = useCallback((active) => {
    const isActive = active === true;
    isViewingPrivateMessagesRef.current = isActive;
    setIsViewingPrivateMessages(isActive);
  }, []);

  const setActivePrivateConversationId = useCallback((conversationId) => {
    const id = String(conversationId || "").trim();
    activePrivateConversationIdRef.current = id;
    if (!id) return;

    setPrivateInboxMeta((prev) =>
      prev.map((row) => (row.conversationId === id ? { ...row, unreadCount: 0 } : row)),
    );
    setLatestUnreadPrivatePreview((prev) => (prev?.conversationId === id ? null : prev));
  }, []);

  const setCommunityPageActive = useCallback((active) => {
    setIsViewingCommunityPage(active === true);
  }, []);

  const applyUnreadStatus = useCallback((status) => {
    setUnreadPrivateCount(status.count);
    setLatestUnreadPrivatePreview(enrichPreview(status.preview));
  }, []);

  const adjustUnreadForActiveConversation = useCallback((status, inboxMeta) => {
    const activeId = activePrivateConversationIdRef.current;
    if (!isViewingPrivateMessagesRef.current || !activeId) {
      return { status, inboxMeta };
    }

    const activeRow = inboxMeta.find((row) => row.conversationId === activeId);
    let unreadFromActive = Number(activeRow?.unreadCount || 0);

    let adjustedPreview = status.preview;
    let adjustedCount = status.count;

    if (status.preview?.conversationId === activeId) {
      adjustedPreview = null;
      if (unreadFromActive <= 0) {
        unreadFromActive = Math.min(Math.max(adjustedCount, 0), 1);
      }
    }

    if (unreadFromActive > 0) {
      adjustedCount = Math.max(0, adjustedCount - unreadFromActive);
    }

    const adjustedInbox = inboxMeta.map((row) =>
      row.conversationId === activeId ? { ...row, unreadCount: 0 } : row,
    );

    return {
      status: {
        count: adjustedCount,
        preview: adjustedPreview,
      },
      inboxMeta: adjustedInbox,
    };
  }, []);

  const refreshUnreadPrivate = useCallback(async () => {
    if (!uid) {
      setUnreadPrivateCount(0);
      setLatestUnreadPrivatePreview(null);
      setPrivateInboxMeta([]);
      return null;
    }
    try {
      const status = await getPrivateUnreadStatus();
      let inboxMeta = [];
      try {
        inboxMeta = await getPrivateInboxMeta();
      } catch {
        inboxMeta = [];
      }

      const activeId = activePrivateConversationIdRef.current;
      const shouldMarkActiveRead =
        isViewingPrivateMessagesRef.current &&
        activeId &&
        !markReadInFlightRef.current &&
        (status.preview?.conversationId === activeId ||
          inboxMeta.some((row) => row.conversationId === activeId && Number(row.unreadCount || 0) > 0));

      if (shouldMarkActiveRead) {
        markReadInFlightRef.current = true;
        void markConversationRead(activeId)
          .catch(() => {})
          .finally(() => {
            markReadInFlightRef.current = false;
          });
      }

      const adjusted = adjustUnreadForActiveConversation(status, inboxMeta);
      applyUnreadStatus(adjusted.status);
      setPrivateInboxMeta(adjusted.inboxMeta);
      return adjusted.status;
    } catch {
      setUnreadPrivateCount(0);
      setLatestUnreadPrivatePreview(null);
      return null;
    }
  }, [uid, applyUnreadStatus, adjustUnreadForActiveConversation]);

  const bootstrapWelcomeAndUnread = useCallback(async () => {
    const welcome = await ensureWelcomePrivateMessage().catch(() => ({
      ok: false,
      preview: null,
    }));

    if (welcome.ok && welcome.preview && !welcome.skipped) {
      setUnreadPrivateCount((count) => Math.max(count, 1));
      setLatestUnreadPrivatePreview(enrichPreview(welcome.preview));
    }

    await refreshUnreadPrivate();

    for (const delay of [300, 900, 2000]) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
      const status = await refreshUnreadPrivate();
      if ((status?.count ?? 0) > 0 && status?.preview) break;
    }
  }, [refreshUnreadPrivate]);

  const patchPrivateInboxMeta = useCallback((conversationId, patch) => {
    const id = String(conversationId || "").trim();
    if (!id) return;
    setPrivateInboxMeta((prev) => {
      const index = prev.findIndex((row) => row.conversationId === id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      }
      return [
        ...prev,
        {
          conversationId: id,
          unreadCount: Number(patch.unreadCount || 0),
          notificationsMuted: patch.notificationsMuted === true,
        },
      ];
    });
  }, []);

  const refreshPublicIndicator = useCallback(async () => {
    if (!uid) {
      setHasNewPublicSinceLastVisit(false);
      return;
    }
    try {
      const raw =
        typeof localStorage !== "undefined" ? localStorage.getItem(VWS_PUBLIC_LAST_SEEN_KEY) : null;
      const hasNew = await hasNewPublicMessageSince(raw);
      setHasNewPublicSinceLastVisit(hasNew);
    } catch {
      setHasNewPublicSinceLastVisit(false);
    }
  }, [uid]);

  const dismissPrivateMessagePreview = useCallback((messageId) => {
    const id = String(messageId || "").trim();
    if (!id) return;
    setDismissedPreviewMessageId(id);
    try {
      localStorage.setItem(DISMISSED_PREVIEW_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const markPublicTabVisited = useCallback(() => {
    try {
      localStorage.setItem(VWS_PUBLIC_LAST_SEEN_KEY, new Date().toISOString());
      setHasNewPublicSinceLastVisit(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!uid) {
      sessionStartedAtRef.current = 0;
      setPreviewBubbleDelayReady(false);
      setUnreadPrivateCount(0);
      setLatestUnreadPrivatePreview(null);
      setDismissedPreviewMessageId("");
      try {
        localStorage.removeItem(DISMISSED_PREVIEW_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    sessionStartedAtRef.current = Date.now();
    void bootstrapWelcomeAndUnread();
    void refreshPublicIndicator();
  }, [uid, bootstrapWelcomeAndUnread, refreshPublicIndicator]);

  useEffect(() => {
    if (!uid) {
      setPreviewBubbleDelayReady(false);
      return undefined;
    }

    setPreviewBubbleDelayReady(false);
    const id = window.setTimeout(() => {
      setPreviewBubbleDelayReady(true);
    }, PREVIEW_BUBBLE_DELAY_MS);

    return () => window.clearTimeout(id);
  }, [uid]);

  useEffect(() => {
    if (!uid) return undefined;

    let cancelled = false;
    let timeoutId = 0;

    const tick = () => {
      if (!cancelled) void refreshUnreadPrivate();
    };

    const schedule = () => {
      const elapsed = Date.now() - sessionStartedAtRef.current;
      const delay = elapsed < FAST_POLL_WINDOW_MS ? FAST_POLL_MS : NORMAL_POLL_MS;
      timeoutId = window.setTimeout(() => {
        tick();
        schedule();
      }, delay);
    };

    tick();
    schedule();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [uid, refreshUnreadPrivate]);

  useEffect(() => {
    if (!uid) return undefined;
    const id = window.setInterval(() => {
      void refreshPublicIndicator();
    }, 15000);
    return () => window.clearInterval(id);
  }, [uid, refreshPublicIndicator]);

  useEffect(() => {
    if (!uid) return undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshUnreadPrivate();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [uid, refreshUnreadPrivate]);

  useEffect(() => {
    if (unreadPrivateCount === 0) {
      setLatestUnreadPrivatePreview(null);
    }
  }, [unreadPrivateCount]);

  useEffect(() => {
    const conversationId = String(latestUnreadPrivatePreview?.conversationId || "").trim();
    if (!conversationId || unreadPrivateCount <= 0 || !latestUnreadPrivatePreview?.isSupport) return;
    if (
      isViewingPrivateMessagesRef.current &&
      activePrivateConversationIdRef.current === conversationId
    ) {
      return;
    }
    rememberSupportConversation(buildConversationFromUnreadPreview(latestUnreadPrivatePreview));
    const remembered = getRememberedOnboardingPrivateMessages(conversationId);
    const hydrated = hydratePrivateMessagesFromUnreadPreview(
      conversationId,
      latestUnreadPrivatePreview,
      remembered,
    );
    rememberOnboardingPrivateMessages(conversationId, hydrated);
    void prefetchPrivateMessagesForConversation(conversationId)
      .then((messages) => mergeRememberedOnboardingPrivateMessages(conversationId, messages))
      .catch(() => {});
  }, [
    latestUnreadPrivatePreview?.conversationId,
    latestUnreadPrivatePreview?.messageId,
    latestUnreadPrivatePreview?.isSupport,
    unreadPrivateCount,
  ]);

  useEffect(() => {
    if (!isViewingPrivateMessages || !latestUnreadPrivatePreview?.messageId) return;
    dismissPrivateMessagePreview(latestUnreadPrivatePreview.messageId);
  }, [
    isViewingPrivateMessages,
    latestUnreadPrivatePreview?.messageId,
    dismissPrivateMessagePreview,
  ]);

  const visibleUnreadPrivatePreview = useMemo(() => {
    if (isViewingPrivateMessages) return null;
    if (!previewBubbleDelayReady) return null;
    if (!latestUnreadPrivatePreview || unreadPrivateCount <= 0) return null;
    if (!latestUnreadPrivatePreview.isSupport) return null;
    if (latestUnreadPrivatePreview.messageId === dismissedPreviewMessageId) return null;
    return latestUnreadPrivatePreview;
  }, [
    latestUnreadPrivatePreview,
    unreadPrivateCount,
    dismissedPreviewMessageId,
    previewBubbleDelayReady,
    isViewingPrivateMessages,
  ]);

  const headerUnreadPrivateCount = useMemo(() => {
    if (isViewingCommunityPage) return 0;
    return unreadPrivateCount;
  }, [isViewingCommunityPage, unreadPrivateCount]);

  const value = useMemo(
    () => ({
      unreadPrivateCount,
      headerUnreadPrivateCount,
      privateInboxMeta,
      latestUnreadPrivatePreview: visibleUnreadPrivatePreview,
      latestUnreadPrivatePreviewRaw: latestUnreadPrivatePreview,
      hasNewPublicSinceLastVisit,
      refreshUnreadPrivate,
      refreshPublicIndicator,
      markPublicTabVisited,
      dismissPrivateMessagePreview,
      prefetchPrivateMessagesForConversation,
      setPrivateMessagesViewActive,
      setActivePrivateConversationId,
      setCommunityPageActive,
      patchPrivateInboxMeta,
    }),
    [
      unreadPrivateCount,
      headerUnreadPrivateCount,
      privateInboxMeta,
      visibleUnreadPrivatePreview,
      latestUnreadPrivatePreview,
      hasNewPublicSinceLastVisit,
      refreshUnreadPrivate,
      refreshPublicIndicator,
      markPublicTabVisited,
      dismissPrivateMessagePreview,
      setPrivateMessagesViewActive,
      setActivePrivateConversationId,
      setCommunityPageActive,
      patchPrivateInboxMeta,
    ],
  );

  return (
    <CommunauteVWSNotifContext.Provider value={value}>{children}</CommunauteVWSNotifContext.Provider>
  );
}

export function useCommunauteVWSNotif() {
  const ctx = useContext(CommunauteVWSNotifContext);
  if (!ctx) {
    return {
      unreadPrivateCount: 0,
      headerUnreadPrivateCount: 0,
      privateInboxMeta: [],
      latestUnreadPrivatePreview: null,
      latestUnreadPrivatePreviewRaw: null,
      hasNewPublicSinceLastVisit: false,
      refreshUnreadPrivate: async () => {},
      refreshPublicIndicator: async () => {},
      markPublicTabVisited: () => {},
      dismissPrivateMessagePreview: () => {},
      prefetchPrivateMessagesForConversation: async () => [],
      setPrivateMessagesViewActive: () => {},
      setActivePrivateConversationId: () => {},
      setCommunityPageActive: () => {},
      patchPrivateInboxMeta: () => {},
    };
  }
  return ctx;
}
