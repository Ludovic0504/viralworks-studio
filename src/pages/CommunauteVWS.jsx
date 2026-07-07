import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import PageTitle from "@/composants/interface/TitrePage";
import { MessageCircle, Users, Send, Paperclip, Plus, X, MoreVertical, Languages, BellOff, ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { useCommunauteVWSNotif } from "@/contexte/FournisseurCommunauteVWSNotif.jsx";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { PAGE_SHELL_INNER_CLASS } from "@/bibliotheque/disposition/dashboardShellLayout";
import { censorMessageText } from "@/bibliotheque/moderation/messageCensor";
import {
  deletePrivateMessage,
  deletePublicMessage,
  ensureWelcomePrivateMessage,
  getCommunitySupportUser,
  hideConversationForMe,
  listPrivateConversations,
  listPrivateMessages,
  listPublicMessages,
  listCommunityUsers,
  markConversationRead,
  mergeInboxMetaIntoConversations,
  getPrivateInboxMeta,
  setConversationNotificationsMuted,
  sendPrivateMessage,
  submitOnboardingQuickReply,
  sendPublicMessage,
  startPrivateConversation,
  isCommunitySupportAccount,
  COMMUNITY_LOCALES,
  getProfilePreferredLocale,
  updateProfilePreferredLocale,
  resolveCommunityMessageTranslations,
  getMemoryCachedTranslation,
} from "@/bibliotheque/supabase/communaute";
import QuickReplyButtons, {
  shouldShowMessageQuickReplies,
} from "@/composants/communaute/QuickReplyButtons";
import {
  enrichCommunityMessage,
  buildConversationFromUnreadPreview,
  resolveQuickReplyOptions,
  mergePrivateMessagesWithServer,
  onboardingMessageRenderKey,
  hydratePrivateMessagesFromUnreadPreview,
} from "@/bibliotheque/community/onboarding";
import {
  applyOnboardingQuickReplyOptimistic,
  resolvePersistedOnboardingMessageId,
  resolveSupportUserId,
  rollbackOnboardingQuickReplySelection,
  syncOnboardingFollowUpAfterReply,
} from "@/bibliotheque/community/onboardingQuickReply";
import {
  getRememberedOnboardingPrivateMessages,
  rememberOnboardingPrivateMessages,
} from "@/bibliotheque/community/onboardingProgressCache";
import {
  sortActivePrivateConversations,
  shouldShowInActivePrivateConversations,
} from "@/bibliotheque/community/conversationSort";
import {
  getCachedPrivateMessages,
  rememberPrivateMessages,
} from "@/bibliotheque/community/privateMessagesCache";
import {
  getRememberedSupportConversation,
  rememberSupportConversation,
  mergeConversationLists,
  mergeConversationRecords,
  upsertConversationInList,
} from "@/bibliotheque/community/privateConversationsCache";

function deriveSupportActivityFromMessages(messages, viewerUserId) {
  if (!Array.isArray(messages) || !messages.length) return null;
  const last = messages[messages.length - 1];
  const viewerId = String(viewerUserId || "");
  const lastOutgoing = [...messages].reverse().find((message) => String(message?.userId || "") === viewerId);
  return {
    lastMessage: String(last?.content || ""),
    lastMessageAt: String(last?.createdAt || ""),
    updatedAt: String(last?.createdAt || ""),
    hasIncomingFromSupport: messages.some((message) => message?.isSupport),
    lastOutgoingAt: lastOutgoing?.createdAt ? String(lastOutgoing.createdAt) : null,
  };
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatConversationTime(iso) {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    const now = new Date();
    const sameDay =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
    if (sameDay) {
      return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

function conversationAvatarStyle(seed) {
  let hash = 0;
  const value = String(seed || "");
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    backgroundColor: `hsla(${hue}, 55%, 42%, 0.35)`,
    borderColor: `hsla(${hue}, 60%, 58%, 0.55)`,
    color: `hsl(${hue}, 75%, 88%)`,
  };
}

function ConversationAvatar({ username, userId, isSupport }) {
  const initial = String(username || "?").trim().charAt(0).toUpperCase() || "?";
  const style = isSupport
    ? {
        backgroundColor: "rgba(6, 182, 212, 0.2)",
        borderColor: "rgba(34, 211, 238, 0.45)",
        color: "rgb(207, 250, 254)",
      }
    : conversationAvatarStyle(userId);

  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold"
      style={style}
      aria-hidden
    >
      {initial}
    </span>
  );
}

const FLOATING_MENU_WIDTH = 160;
/** Hauteur approximative (une ligne + padding) pour le placement au-dessus du trigger si bas de viewport */
const FLOATING_MENU_HEIGHT = 52;

const CHAT_PANEL_BASE_CLASS = "studio-panel p-4 sm:p-5 flex flex-col min-h-0 overflow-hidden";
const COMMUNITY_PAGE_ROOT_CLASS = `${PAGE_SHELL_INNER_CLASS} flex min-h-0 flex-1 flex-col overflow-hidden gap-3 py-3 md:gap-4 md:py-4`;
const COMMUNITY_TOOLBAR_CLASS = "flex shrink-0 flex-wrap items-center gap-2";
const COMMUNITY_MAIN_SECTION_CLASS =
  "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden md:grid md:grid-cols-12 md:items-stretch md:gap-4";
const SIDEBAR_PANEL_BASE_CLASS = `${CHAT_PANEL_BASE_CLASS} gap-2 md:col-span-4 md:h-full md:gap-3`;
const SIDEBAR_PANEL_MOBILE_LIST_CLASS = "max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col";
const SIDEBAR_PANEL_MOBILE_HIDDEN_CLASS = "max-md:hidden";
const PRIVATE_CHAT_PANEL_CLASS = `${CHAT_PANEL_BASE_CLASS} min-h-0 md:col-span-8 md:h-full`;
const PRIVATE_CHAT_PANEL_MOBILE_OPEN_CLASS = "max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col";
const PRIVATE_CHAT_PANEL_MOBILE_HIDDEN_CLASS = "max-md:hidden";
const CHAT_MESSAGES_FRAME_CLASS =
  "flex-1 min-h-0 overflow-y-auto overscroll-y-contain studio-subtle-scrollbar space-y-3 pr-1";
const CHAT_MESSAGES_FRAME_PUBLIC_CLASS =
  "flex-1 min-h-0 overflow-y-auto overscroll-y-contain studio-subtle-scrollbar space-y-3 pr-1";
const CHAT_COMPOSER_CLASS = "border-t border-white/10 pt-3 space-y-2 shrink-0";
const SIDEBAR_CONVERSATIONS_SCROLL_CLASS =
  "flex-1 min-h-0 overflow-y-auto overscroll-y-contain studio-subtle-scrollbar space-y-2 pr-1";
const PUBLIC_CHAT_PANEL_CLASS = `${CHAT_PANEL_BASE_CLASS} min-h-0 flex-1 md:col-span-12 md:h-full`;

function useFloatingMenuCoords(open, anchorRef) {
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;

    const update = () => {
      const a = anchorRef.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const pad = 4;
      let top = r.bottom + pad;
      let left = r.right - FLOATING_MENU_WIDTH;
      left = Math.max(8, Math.min(left, window.innerWidth - FLOATING_MENU_WIDTH - 8));
      if (top + FLOATING_MENU_HEIGHT > window.innerHeight - 8) {
        top = Math.max(8, r.top - FLOATING_MENU_HEIGHT - pad);
      }
      setCoords({ top, left });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef]);

  return coords;
}

function buildInstantTranslations(messages, scope, lang) {
  if (lang === "fr") return {};
  const instant = {};
  for (const message of messages) {
    if (!String(message.content || "").trim()) continue;
    const cached = getMemoryCachedTranslation(message.id, scope, lang);
    if (cached) instant[message.id] = cached;
  }
  return instant;
}
function messagesAreSame(prev, next) {
  if (prev.length !== next.length) return false;
  return prev.every(
    (message, index) =>
      message.id === next[index]?.id &&
      message.content === next[index]?.content &&
      message.createdAt === next[index]?.createdAt &&
      message.quickRepliesClosedAt === next[index]?.quickRepliesClosedAt &&
      message.quickReplySelected === next[index]?.quickReplySelected &&
      JSON.stringify(message.quickReplyOptions || []) ===
        JSON.stringify(next[index]?.quickReplyOptions || [])
  );
}

function MessageItem({
  mine,
  msg,
  onDelete,
  menuOpen,
  onMenuToggle,
  preferredLocale,
  translatedText = "",
  showQuickReplies = false,
  quickRepliesDisabled = false,
  onQuickReply,
  allowDelete = true,
}) {
  const canManage = mine && allowDelete;
  const anchorRef = useRef(null);
  const { top, left } = useFloatingMenuCoords(menuOpen && canManage, anchorRef);
  const [showOriginal, setShowOriginal] = useState(false);

  const shouldAutoTranslate = preferredLocale !== "fr";

  useEffect(() => {
    setShowOriginal(false);
  }, [msg.id, preferredLocale]);

  const displayedText =
    shouldAutoTranslate && translatedText && !showOriginal ? translatedText : msg.content || "";
  const quickReplyOptions = resolveQuickReplyOptions(msg) || [];

  return (
    <div className={`rounded-xl border px-3 py-2 ${mine ? "border-cyan-500/40 bg-cyan-500/10" : "border-white/10 bg-white/[0.03]"}`}>
      <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400 mb-1">
        <span className="font-medium text-gray-300 inline-flex items-center gap-1.5 min-w-0">
          <span className="truncate">{msg.username}</span>
          {msg.isSupport ? (
            <span className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-100 shrink-0">
              Support officiel
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span>{formatDate(msg.createdAt)}</span>
          {canManage ? (
            <>
              <button
                ref={anchorRef}
                type="button"
                aria-label="Actions du message"
                aria-expanded={menuOpen}
                data-community-floating-menu="trigger"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onMenuToggle();
                }}
                className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {menuOpen
                ? createPortal(
                    <div
                      role="menu"
                      data-community-floating-menu="panel"
                      style={{
                        position: "fixed",
                        top,
                        left,
                        width: FLOATING_MENU_WIDTH,
                        zIndex: 99999,
                      }}
                      className="rounded-lg border border-white/10 bg-[#0f1629] py-1 shadow-xl shadow-black/40"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center px-3 py-2.5 text-left text-xs text-red-300 hover:bg-white/5"
                        onClick={() => {
                          onDelete();
                        }}
                      >
                        Supprimer
                      </button>
                    </div>,
                    document.body
                  )
                : null}
            </>
          ) : null}
        </div>
      </div>
      {msg.content ? (
        <>
          <p className="text-sm text-gray-200 whitespace-pre-wrap">{displayedText}</p>
          {shouldAutoTranslate && translatedText && !showOriginal ? (
            <button
              type="button"
              onClick={() => setShowOriginal(true)}
              className="mt-1 text-[11px] text-gray-500 hover:text-gray-300"
            >
              Voir l&apos;original
            </button>
          ) : null}
          {shouldAutoTranslate && showOriginal && translatedText ? (
            <button
              type="button"
              onClick={() => setShowOriginal(false)}
              className="mt-1 text-[11px] text-gray-500 hover:text-gray-300"
            >
              Voir la traduction
            </button>
          ) : null}
        </>
      ) : null}
      {msg.attachment ? (
        <div className="mt-2">
          {msg.attachment.mimeType.startsWith("image/") ? (
            <img src={msg.attachment.url} alt={msg.attachment.fileName || "image"} className="max-h-52 rounded-lg border border-white/10" />
          ) : (
            <video src={msg.attachment.url} controls className="max-h-52 rounded-lg border border-white/10" />
          )}
          <p className="text-[10px] text-gray-500 mt-1">
            {msg.attachment.fileName} · {(msg.attachment.sizeBytes / (1024 * 1024)).toFixed(2)} MB
          </p>
        </div>
      ) : null}
      {showQuickReplies && quickReplyOptions.length ? (
        <QuickReplyButtons
          options={quickReplyOptions}
          disabled={quickRepliesDisabled}
          selectedLabel={msg.quickReplySelected || null}
          onSelect={(label) => {
            const accepted = onQuickReply?.(label, msg.id, msg.onboardingStep ?? null);
            return accepted !== false;
          }}
        />
      ) : null}
    </div>
  );
}

function PrivateConversationRow({
  conversation: c,
  isActive,
  onSelect,
  menuOpen,
  onToggleMenu,
  onRemoveForMe,
  onToggleMute,
  muteBusy = false,
}) {
  const anchorRef = useRef(null);
  const { top, left } = useFloatingMenuCoords(menuOpen, anchorRef);
  const timeLabel = formatConversationTime(c.lastMessageAt || c.updatedAt);
  const unreadCount = Number(c.unreadCount || 0);
  const isMuted = Boolean(c.notificationsMuted);
  const showUnreadBadge = unreadCount > 0;

  return (
    <div
      className={`flex items-stretch gap-1 rounded-lg border ${
        isActive
          ? "border-violet-400/45 bg-violet-500/10 ring-1 ring-violet-400/20"
          : "border-white/10 bg-white/[0.03] hover:border-violet-400/25"
      }`}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <ConversationAvatar username={c.otherUsername} userId={c.otherUserId} isSupport={c.isSupport} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-gray-200 font-medium inline-flex items-center gap-1.5 min-w-0">
                <span className="truncate">{c.otherUsername}</span>
                {c.isSupport ? (
                  <span className="shrink-0 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-100">
                    Support officiel
                  </span>
                ) : null}
                {isMuted ? (
                  <BellOff className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-label="Notifications en sourdine" />
                ) : null}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                {showUnreadBadge ? (
                  <span
                    className={`min-w-[1.15rem] rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                      isMuted ? "bg-gray-600/80 text-gray-200" : "bg-[#BA7517] text-white"
                    }`}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
                {timeLabel ? <span className="text-[10px] text-gray-500">{timeLabel}</span> : null}
              </div>
            </div>
            <p className="mt-0.5 text-xs text-gray-500 truncate">
              {c.lastMessage ? c.lastMessage : "Aucun message — conversation prête"}
            </p>
          </div>
        </div>
      </button>
      <div className="flex shrink-0 items-start pt-1.5 pr-1.5">
        <button
          ref={anchorRef}
          type="button"
          aria-label="Actions de la conversation"
          aria-expanded={menuOpen}
          data-community-floating-menu="trigger"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu();
          }}
          className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuOpen
          ? createPortal(
              <div
                role="menu"
                data-community-floating-menu="panel"
                style={{
                  position: "fixed",
                  top,
                  left,
                  width: FLOATING_MENU_WIDTH,
                  zIndex: 99999,
                }}
                className="rounded-lg border border-white/10 bg-[#0f1629] py-1 shadow-xl shadow-black/40"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={muteBusy}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-gray-200 hover:bg-white/5 disabled:cursor-wait disabled:opacity-50"
                  onClick={() => onToggleMute(c.id, !isMuted)}
                >
                  <BellOff className="h-3.5 w-3.5 shrink-0" />
                  {isMuted ? "Réactiver les notifications" : "Mettre en sourdine"}
                </button>
                {c.isSupport ? null : (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center px-3 py-2.5 text-left text-xs text-red-300 hover:bg-white/5"
                    onClick={() => onRemoveForMe(c.id)}
                  >
                    Supprimer
                  </button>
                )}
              </div>,
              document.body
            )
          : null}
      </div>
    </div>
  );
}

export default function CommunauteVWS() {
  const { session, loading } = useAuth();
  const { isAdmin: isAdminUser, loading: adminAccessLoading } = useAdminAccess();
  const { runWithAuth, openAuthModal } = useRequireAuthAction();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    unreadPrivateCount,
    hasNewPublicSinceLastVisit,
    refreshUnreadPrivate,
    markPublicTabVisited,
    latestUnreadPrivatePreviewRaw,
    prefetchPrivateMessagesForConversation,
    setPrivateMessagesViewActive,
    setActivePrivateConversationId,
    setCommunityPageActive,
    privateInboxMeta,
    patchPrivateInboxMeta,
  } = useCommunauteVWSNotif();
  const myUserId = session?.user?.id || "";
  const isSupportViewer = isCommunitySupportAccount(session?.user?.email);
  const initialPrivateConversationId = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return sp.get("conversation") || "";
  }, []);
  const [tab, setTab] = useState(() => {
    const sp = new URLSearchParams(window.location.search);
    return sp.get("tab") === "private" || sp.get("conversation") ? "private" : "public";
  });
  const tabQueryHandledRef = useRef(false);
  const [publicMessages, setPublicMessages] = useState([]);
  const [privateConversations, setPrivateConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(() => {
    const sp = new URLSearchParams(window.location.search);
    return sp.get("conversation") || "";
  });
  const [privateMessages, setPrivateMessages] = useState([]);
  const [publicInput, setPublicInput] = useState("");
  const [privateInput, setPrivateInput] = useState("");
  const [publicFile, setPublicFile] = useState(null);
  const [privateFile, setPrivateFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [searchUser, setSearchUser] = useState("");
  const [msgMenuId, setMsgMenuId] = useState(null);
  const [convMenuId, setConvMenuId] = useState(null);
  const [muteOverrides, setMuteOverrides] = useState({});
  const [muteBusyConversationId, setMuteBusyConversationId] = useState("");
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [preferredLocale, setPreferredLocale] = useState("fr");
  const [messageTranslations, setMessageTranslations] = useState({});
  const [quickReplyInFlightStep, setQuickReplyInFlightStep] = useState(null);
  const quickReplyInFlightRef = useRef(new Set());

  const publicEndRef = useRef(null);
  const userSearchRef = useRef(null);
  const localeMenuRef = useRef(null);
  const privateEndRef = useRef(null);
  const publicFileRef = useRef(null);
  const privateFileRef = useRef(null);
  const activeConversationIdRef = useRef(activeConversationId);
  const activeConversationSnapshotRef = useRef(null);
  const privateMessagesRef = useRef([]);
  const translationRequestRef = useRef(0);

  useEffect(() => {
    censorMessageText("");
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    void getProfilePreferredLocale()
      .then(setPreferredLocale)
      .catch(() => setPreferredLocale("fr"));
  }, [session?.user?.id]);

  useEffect(() => {
    if (preferredLocale === "fr" || tab !== "public") {
      if (tab === "public") setMessageTranslations({});
      return;
    }

    const requestId = ++translationRequestRef.current;
    setMessageTranslations(buildInstantTranslations(publicMessages, "public", preferredLocale));
    if (!publicMessages.length) return;

    void resolveCommunityMessageTranslations({
      messages: publicMessages.map((message) => ({ id: message.id, content: message.content })),
      messageScope: "public",
      targetLang: preferredLocale,
    }).then((map) => {
      if (translationRequestRef.current !== requestId) return;
      setMessageTranslations(map);
    });
  }, [tab, publicMessages, preferredLocale]);

  useEffect(() => {
    if (preferredLocale === "fr" || tab !== "private" || !activeConversationId) {
      if (tab === "private") setMessageTranslations({});
      return;
    }

    const requestId = ++translationRequestRef.current;
    setMessageTranslations(buildInstantTranslations(privateMessages, "private", preferredLocale));
    if (!privateMessages.length) return;

    void resolveCommunityMessageTranslations({
      messages: privateMessages.map((message) => ({ id: message.id, content: message.content })),
      messageScope: "private",
      conversationId: activeConversationId,
      targetLang: preferredLocale,
    }).then((map) => {
      if (translationRequestRef.current !== requestId) return;
      setMessageTranslations(map);
    });
  }, [tab, privateMessages, activeConversationId, preferredLocale]);

  useEffect(() => {
    setCommunityPageActive(true);
    return () => setCommunityPageActive(false);
  }, [setCommunityPageActive]);

  useEffect(() => {
    setPrivateMessagesViewActive(tab === "private");
    return () => setPrivateMessagesViewActive(false);
  }, [tab, setPrivateMessagesViewActive]);

  useEffect(() => {
    if (tab === "private") {
      setActivePrivateConversationId(activeConversationId);
      return;
    }
    setActivePrivateConversationId("");
  }, [tab, activeConversationId, setActivePrivateConversationId]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    privateMessagesRef.current = privateMessages;
  }, [privateMessages]);

  useLayoutEffect(() => {
    if (isSupportViewer) return;

    const convFromUrl = searchParams.get("conversation") || initialPrivateConversationId;
    const convId =
      convFromUrl ||
      latestUnreadPrivatePreviewRaw?.conversationId ||
      getRememberedSupportConversation()?.id ||
      "";
    if (!convId) return;

    setTab("private");
    setActiveConversationId(convId);
    activeConversationIdRef.current = convId;

    const previewStub =
      latestUnreadPrivatePreviewRaw?.conversationId === convId
        ? buildConversationFromUnreadPreview(latestUnreadPrivatePreviewRaw)
        : null;
    const remembered = getRememberedSupportConversation();
    const stub = previewStub || (remembered?.id === convId ? remembered : null);
    if (stub) {
      rememberSupportConversation(stub);
      setPrivateConversations((prev) => upsertConversationInList(prev, stub));
    }

    const cached = getCachedPrivateMessages(convId);
    const rememberedOnboarding = getRememberedOnboardingPrivateMessages(convId);
    const instant =
      cached?.length && rememberedOnboarding?.length
        ? mergePrivateMessagesWithServer(rememberedOnboarding, cached)
        : rememberedOnboarding?.length
          ? rememberedOnboarding
          : cached?.length
            ? cached
            : null;

    if (instant?.length) {
      const hydrated = instant.map(enrichCommunityMessage);
      setPrivateMessages(hydrated);
      rememberOnboardingPrivateMessages(convId, hydrated);
      return;
    }

    if (latestUnreadPrivatePreviewRaw?.conversationId === convId) {
      const hydrated = hydratePrivateMessagesFromUnreadPreview(
        convId,
        latestUnreadPrivatePreviewRaw,
        rememberedOnboarding,
      );
      setPrivateMessages(hydrated);
      rememberOnboardingPrivateMessages(convId, hydrated);
    }
  }, [
    searchParams,
    initialPrivateConversationId,
    latestUnreadPrivatePreviewRaw?.conversationId,
    latestUnreadPrivatePreviewRaw?.messageId,
    isSupportViewer,
  ]);

  useLayoutEffect(() => {
    if (tab !== "private" || isSupportViewer) return;

    const previewStub = latestUnreadPrivatePreviewRaw?.conversationId
      ? buildConversationFromUnreadPreview(latestUnreadPrivatePreviewRaw)
      : null;
    const remembered = getRememberedSupportConversation();
    const stub = previewStub || remembered;
    if (!stub?.id) return;

    rememberSupportConversation(stub);
    setPrivateConversations((prev) => upsertConversationInList(prev, stub));

    if (!activeConversationIdRef.current && !isAdminUser) {
      setActiveConversationId(stub.id);
      activeConversationIdRef.current = stub.id;
    }
  }, [
    tab,
    isAdminUser,
    isSupportViewer,
    latestUnreadPrivatePreviewRaw?.conversationId,
    latestUnreadPrivatePreviewRaw?.messageId,
  ]);

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null;

    const rememberSnapshot = (conversation) => {
      if (conversation?.id === activeConversationId) {
        activeConversationSnapshotRef.current = conversation;
      }
      return conversation;
    };

    const fromList = privateConversations.find((c) => c.id === activeConversationId);
    if (fromList) return rememberSnapshot(fromList);

    const remembered = getRememberedSupportConversation();
    if (remembered?.id === activeConversationId) return rememberSnapshot(remembered);

    if (
      tab === "private" &&
      activeConversationSnapshotRef.current?.id === activeConversationId
    ) {
      return activeConversationSnapshotRef.current;
    }

    if (latestUnreadPrivatePreviewRaw?.conversationId === activeConversationId) {
      return rememberSnapshot(buildConversationFromUnreadPreview(latestUnreadPrivatePreviewRaw));
    }

    return activeConversationSnapshotRef.current?.id === activeConversationId
      ? activeConversationSnapshotRef.current
      : null;
  }, [
    privateConversations,
    activeConversationId,
    latestUnreadPrivatePreviewRaw?.conversationId,
    tab,
  ]);

  const activeConversations = useMemo(() => {
    if (isSupportViewer) {
      return privateConversations
        .filter((c) => !c.isSupport && c.otherUserId !== myUserId)
        .sort((a, b) => String(b.updatedAt || b.lastMessageAt).localeCompare(String(a.updatedAt || a.lastMessageAt)));
    }

    const remembered = getRememberedSupportConversation();
    const previewConversationId = String(latestUnreadPrivatePreviewRaw?.conversationId || "");
    const suppressPreviewStub =
      tab === "private" &&
      activeConversationId &&
      previewConversationId === activeConversationId;
    const previewStub =
      !suppressPreviewStub &&
      previewConversationId &&
      latestUnreadPrivatePreviewRaw?.isSupport
        ? {
            ...buildConversationFromUnreadPreview(latestUnreadPrivatePreviewRaw),
            hasIncomingFromSupport: true,
          }
        : null;
    const seeded = sortActivePrivateConversations(
      mergeConversationLists(privateConversations, [previewStub, remembered].filter(Boolean)),
    );

    return seeded.filter((conversation) =>
      shouldShowInActivePrivateConversations(conversation, {
        activeConversationId,
        isAdminUser,
      }),
    );
  }, [
    privateConversations,
    isAdminUser,
    isSupportViewer,
    myUserId,
    activeConversationId,
    tab,
    latestUnreadPrivatePreviewRaw?.conversationId,
    latestUnreadPrivatePreviewRaw?.isSupport,
  ]);

  const conversationsForSidebar = useMemo(() => {
    const merged = mergeInboxMetaIntoConversations(activeConversations, privateInboxMeta, muteOverrides);
    if (!activeConversationId || tab !== "private") return merged;
    return merged.map((conversation) =>
      conversation.id === activeConversationId ? { ...conversation, unreadCount: 0 } : conversation,
    );
  }, [activeConversations, privateInboxMeta, muteOverrides, activeConversationId, tab]);

  useEffect(() => {
    if (!privateInboxMeta.length) return;
    setMuteOverrides((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [conversationId, muted] of Object.entries(prev)) {
        const server = privateInboxMeta.find((row) => row.conversationId === conversationId);
        if (server && server.notificationsMuted === muted) {
          delete next[conversationId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [privateInboxMeta]);

  const privateTabUnreadCount = useMemo(() => {
    return conversationsForSidebar.reduce((sum, conversation) => {
      if (conversation.id === activeConversationId) return sum;
      return sum + Number(conversation.unreadCount || 0);
    }, 0);
  }, [conversationsForSidebar, activeConversationId]);

  const accessToken = session?.access_token || "";

  const markConversationAsViewed = async (conversationId) => {
    const id = String(conversationId || "").trim();
    if (!id) return;
    patchPrivateInboxMeta(id, { unreadCount: 0 });
    setPrivateConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === id ? { ...conversation, unreadCount: 0 } : conversation,
      ),
    );
    try {
      await markConversationRead(id);
      await refreshUnreadPrivate();
    } catch {
      /* non-bloquant */
    }
  };

  const refreshPublic = async () => {
    if (!accessToken) return;
    try {
      const messages = await listPublicMessages(300, accessToken);
      setPublicMessages((prev) => (messagesAreSame(prev, messages) ? prev : messages));
    } catch (e) {
      setError(e?.message || "Erreur chargement discussion publique.");
    }
  };

  const refreshConversations = async (forceActiveId, forceOtherUserId) => {
    if (!accessToken) return "";
    try {
      const [list, inboxMeta] = await Promise.all([
        listPrivateConversations(accessToken),
        getPrivateInboxMeta().catch(() => null),
      ]);
      let merged = list;
      if (!isSupportViewer) {
        const remembered = getRememberedSupportConversation();
        const previewStub =
          latestUnreadPrivatePreviewRaw?.conversationId && latestUnreadPrivatePreviewRaw?.isSupport
            ? buildConversationFromUnreadPreview(latestUnreadPrivatePreviewRaw)
            : null;
        merged = mergeConversationLists(merged, [remembered, previewStub].filter(Boolean));
      }
      setPrivateConversations((prev) => {
        let next = mergeConversationLists(merged, prev);
        if (inboxMeta) {
          next = mergeInboxMetaIntoConversations(next, inboxMeta, muteOverrides);
        }
        const support = next.find((c) => c.isSupport);
        if (support && !isSupportViewer) rememberSupportConversation(support);
        return next;
      });
      setError("");
      let resolvedId = "";
      setActiveConversationId((prev) => {
        if (
          forceActiveId !== undefined &&
          forceActiveId !== null &&
          forceActiveId !== "" &&
          merged.some((c) => c.id === forceActiveId)
        ) {
          resolvedId = forceActiveId;
          return forceActiveId;
        }
        if (forceOtherUserId) {
          const match = merged.find((c) => c.otherUserId === forceOtherUserId);
          if (match) {
            resolvedId = match.id;
            return match.id;
          }
        }
        if (prev && merged.some((c) => c.id === prev)) {
          resolvedId = prev;
          return prev;
        }
        if (isSupportViewer) {
          const memberConv = merged.find(
            (c) => !c.isSupport && String(c.otherUserId) !== myUserId,
          );
          resolvedId = memberConv?.id || "";
          return resolvedId;
        }
        const supportConv = merged.find((c) => c.isSupport);
        const withMessages = merged.filter((c) => Boolean(c.lastMessageAt));
        resolvedId = isAdminUser ? withMessages[0]?.id || "" : supportConv?.id || "";
        return resolvedId;
      });
      return resolvedId;
    } catch (e) {
      setError(e?.message || "Erreur chargement conversations.");
      return "";
    }
  };

  const ensureSupportConversation = async () => {
    if (isSupportViewer) return "";
    try {
      const support = await getCommunitySupportUser();
      if (!support?.userId) return "";
      const convId = await startPrivateConversation(support.userId);
      const remembered = getRememberedSupportConversation();
      const stub = {
        id: convId,
        otherUserId: support.userId,
        otherUsername: support.username || "Support officiel",
        updatedAt: remembered?.updatedAt || new Date().toISOString(),
        lastMessage: remembered?.lastMessage || "",
        lastMessageAt: remembered?.lastMessageAt || "",
        isSupport: true,
      };
      rememberSupportConversation(stub);
      setPrivateConversations((prev) => upsertConversationInList(prev, stub));
      if (!activeConversationIdRef.current && !isAdminUser) {
        setActiveConversationId(convId);
        activeConversationIdRef.current = convId;
      }
      return convId;
    } catch (e) {
      // Non-bloquant: la page doit rester utilisable même si la création auto échoue.
      console.warn("Support conversation bootstrap failed:", e);
      return "";
    }
  };

  const refreshPrivateMessages = async (conversationId) => {
    if (!conversationId) {
      setPrivateMessages([]);
      return [];
    }
    if (!accessToken) return [];
    try {
      if (activeConversationIdRef.current === conversationId) {
        patchPrivateInboxMeta(conversationId, { unreadCount: 0 });
      }
      const messages = (await listPrivateMessages(conversationId, accessToken)).map(enrichCommunityMessage);
      if (activeConversationIdRef.current !== conversationId) return messages;
      setPrivateMessages((prev) => {
        const merged = mergePrivateMessagesWithServer(prev, messages);
        const next = messagesAreSame(prev, merged) ? prev : merged;
        rememberPrivateMessages(conversationId, next);
        rememberOnboardingPrivateMessages(conversationId, next);
        return next;
      });
      setPrivateConversations((prev) => {
        const activity = deriveSupportActivityFromMessages(messages, myUserId);
        if (!activity?.hasIncomingFromSupport && !activity?.lastOutgoingAt) return prev;

        let conv = prev.find((row) => row.id === conversationId);
        if (!conv) {
          const remembered = getRememberedSupportConversation();
          if (remembered?.id === conversationId) conv = remembered;
        }
        if (!conv?.isSupport && !activity.hasIncomingFromSupport) return prev;

        const base =
          conv ||
          ({
            id: conversationId,
            otherUserId: "",
            otherUsername: "Support officiel",
            updatedAt: activity.updatedAt,
            lastMessage: "",
            lastMessageAt: "",
            isSupport: true,
          });
        const enriched = mergeConversationRecords(base, { ...base, ...activity });
        const existing = prev.find((row) => row.id === conversationId);
        if (
          existing &&
          existing.hasIncomingFromSupport === enriched.hasIncomingFromSupport &&
          String(existing.lastOutgoingAt || "") === String(enriched.lastOutgoingAt || "") &&
          String(existing.lastMessageAt || "") === String(enriched.lastMessageAt || "") &&
          String(existing.lastMessage || "") === String(enriched.lastMessage || "")
        ) {
          return prev;
        }
        const next = upsertConversationInList(prev, enriched);
        rememberSupportConversation(enriched);
        return next;
      });
      setError("");
      if (activeConversationIdRef.current === conversationId) {
        void markConversationAsViewed(conversationId);
      }
      return messages;
    } catch (e) {
      if (activeConversationIdRef.current !== conversationId) return [];
      setError(e?.message || "Erreur chargement messages privés.");
      return [];
    }
  };

  const refreshUsers = async (query = searchUser) => {
    try {
      setUsers(await listCommunityUsers(query));
    } catch (e) {
      setError(e?.message || "Erreur chargement utilisateurs.");
    }
  };

  useEffect(() => {
    if (loading || adminAccessLoading || !session?.user?.id || !accessToken) return;
    const bootstrap = async () => {
      setError("");
      const knownConversationId =
        activeConversationIdRef.current ||
        latestUnreadPrivatePreviewRaw?.conversationId ||
        initialPrivateConversationId ||
        "";

      if (knownConversationId) {
        void prefetchPrivateMessagesForConversation(knownConversationId, accessToken);
        void refreshPrivateMessages(knownConversationId);
      }

      await Promise.all([
        isSupportViewer ? Promise.resolve() : ensureSupportConversation(),
        isSupportViewer ? Promise.resolve() : ensureWelcomePrivateMessage().catch(() => {}),
      ]);
      await Promise.all([refreshPublic(), refreshUsers()]);
      const conversationId = await refreshConversations(
        knownConversationId || undefined,
        undefined,
      );
      const targetId = conversationId || knownConversationId;
      if (targetId) {
        await refreshPrivateMessages(targetId);
      }
    };
    void bootstrap();
  }, [
    loading,
    adminAccessLoading,
    session?.user?.id,
    accessToken,
    isAdminUser,
    initialPrivateConversationId,
    latestUnreadPrivatePreviewRaw?.conversationId,
  ]);

  useEffect(() => {
    if (tab !== "private" || !session?.user?.id || !accessToken || isSupportViewer) return;
    void ensureSupportConversation();
    void ensureWelcomePrivateMessage().catch(() => {});
  }, [tab, session?.user?.id, accessToken, isSupportViewer]);

  useEffect(() => {
    if (!activeConversationId) {
      setPrivateMessages([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const messages = await refreshPrivateMessages(activeConversationId);
      if (cancelled || messages.length > 0) return;

      const remembered = getRememberedSupportConversation();
      const supportConversation = Boolean(
        remembered?.id === activeConversationId && remembered?.isSupport,
      );
      const shouldPoll =
        supportConversation ||
        Boolean(remembered?.id === activeConversationId && remembered?.lastMessageAt) ||
        unreadPrivateCount > 0;
      if (!shouldPoll) return;

      if (supportConversation) {
        try {
          await ensureWelcomePrivateMessage();
        } catch {
          /* non-bloquant */
        }
        if (cancelled || activeConversationIdRef.current !== activeConversationId) return;
        const afterEnsure = await refreshPrivateMessages(activeConversationId);
        if (cancelled || afterEnsure.length > 0) return;
      }

      for (let attempt = 0; attempt < 24; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 0 : 200));
        if (cancelled || activeConversationIdRef.current !== activeConversationId) return;
        const nextMessages = await refreshPrivateMessages(activeConversationId);
        if (nextMessages.length > 0) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  useEffect(() => {
    setMessageTranslations({});
  }, [activeConversationId]);

  useEffect(() => {
    if (loading || !session?.user?.id || !accessToken) return;
    const waitingSupportWelcome =
      tab === "private" &&
      Boolean(activeConversation?.isSupport) &&
      privateMessages.length === 0;
    const pollMs = waitingSupportWelcome ? 1200 : 5000;
    const id = setInterval(() => {
      if (tab === "public") void refreshPublic();
      if (tab === "private") {
        void refreshConversations();
        void refreshPrivateMessages(activeConversationId);
      }
    }, pollMs);
    return () => clearInterval(id);
  }, [
    tab,
    activeConversationId,
    activeConversation?.isSupport,
    privateMessages.length,
    loading,
    session?.user?.id,
    accessToken,
  ]);

  useEffect(() => {
    publicEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [publicMessages.length]);

  useEffect(() => {
    privateEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [privateMessages.length]);

  useEffect(() => {
    if (!session?.user?.id) return;
    void refreshUsers();
  }, [searchUser, session?.user?.id]);

  useEffect(() => {
    if (msgMenuId === null && convMenuId === null) return;
    const onDoc = (e) => {
      if (e.target.closest("[data-community-floating-menu]")) return;
      setMsgMenuId(null);
      setConvMenuId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [msgMenuId, convMenuId]);

  useEffect(() => {
    if (!userSearchOpen) return;
    const onDoc = (e) => {
      if (userSearchRef.current?.contains(e.target)) return;
      setUserSearchOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [userSearchOpen]);

  useEffect(() => {
    if (!localeMenuOpen) return;
    const onDoc = (e) => {
      if (localeMenuRef.current?.contains(e.target)) return;
      setLocaleMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [localeMenuOpen]);

  useEffect(() => {
    if (tabQueryHandledRef.current) return;
    const tabParam = searchParams.get("tab");
    const convParam = searchParams.get("conversation");
    if (tabParam !== "private" && !convParam) return;
    tabQueryHandledRef.current = true;
    setTab("private");
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("tab");
        next.delete("conversation");
        return next;
      },
      { replace: true }
    );
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (tab !== "public" || !session?.user?.id) return;
    const timer = setTimeout(() => {
      markPublicTabVisited();
    }, 2000);
    return () => clearTimeout(timer);
  }, [tab, session?.user?.id, markPublicTabVisited]);

  useEffect(() => {
    if (tab !== "private" || !session?.user?.id || !activeConversationId) return;
    void markConversationAsViewed(activeConversationId);
  }, [tab, activeConversationId, session?.user?.id]);

  useEffect(() => {
    if (tab !== "private" || !activeConversationId) return;
    patchPrivateInboxMeta(activeConversationId, { unreadCount: 0 });
  }, [tab, activeConversationId, privateMessages.length, patchPrivateInboxMeta]);

  const sendToPublic = async () => {
    const text = publicInput.trim();
    const file = publicFile;
    if (!text && !file) return;

    const tempId = `temp-public-${Date.now()}`;
    const optimistic = {
      id: tempId,
      userId: myUserId,
      username: session?.user?.email?.split("@")[0] || "Moi",
      content: text ? censorMessageText(text) : "",
      createdAt: new Date().toISOString(),
      attachment: null,
    };

    try {
      setBusy(true);
      setError("");
      setPublicMessages((prev) => [...prev, optimistic]);
      setPublicInput("");
      setPublicFile(null);
      if (publicFileRef.current) publicFileRef.current.value = "";

      await sendPublicMessage({ content: text, file });
      await refreshPublic();
      markPublicTabVisited();
    } catch (e) {
      setPublicMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(e?.message || "Impossible d'envoyer le message public.");
    } finally {
      setBusy(false);
    }
  };

  const refreshPrivateAfterSend = async (conversationId, options = {}) => {
    const waitForFollowup = options.waitForFollowup === true;
    const expectOnboardingStep = Number(options.expectOnboardingStep || 0) || null;
    const delays = waitForFollowup ? [0, 250, 500, 900, 1400] : [0];
    let messages = [];

      if (
        waitForFollowup &&
        expectOnboardingStep &&
        (expectOnboardingStep === 2 || expectOnboardingStep === 3)
      ) {
        const supportUserId = resolveSupportUserId(privateMessagesRef.current, activeConversation);
        const answeredStep = expectOnboardingStep - 1;
        const synced = await syncOnboardingFollowUpAfterReply(
          () => listPrivateMessages(conversationId, accessToken),
          () => privateMessagesRef.current,
          expectOnboardingStep,
          supportUserId
            ? {
                answeredStep: answeredStep === 1 ? 1 : 2,
                conversationId,
                supportUserId,
              }
            : null,
          (merged) => {
            privateMessagesRef.current = merged;
            setPrivateMessages(merged);
            rememberPrivateMessages(conversationId, merged);
            rememberOnboardingPrivateMessages(conversationId, merged);
          },
        );
        messages = synced;
      } else {
        for (const delay of delays) {
          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          const fetched = await listPrivateMessages(conversationId, accessToken);
          setPrivateMessages((prev) => {
            const merged = mergePrivateMessagesWithServer(prev, fetched);
            rememberPrivateMessages(conversationId, merged);
            rememberOnboardingPrivateMessages(conversationId, merged);
            return merged;
          });
          messages = fetched;

          if (
            waitForFollowup &&
            expectOnboardingStep &&
            fetched.some((message) => message.onboardingStep === expectOnboardingStep)
          ) {
            break;
          }
        }
      }

    const latest = messages[messages.length - 1];
    if (latest) {
      setPrivateConversations((prev) =>
        sortActivePrivateConversations(
          prev.map((conversation) => {
            if (conversation.id !== conversationId) return conversation;
            const patch = {
              ...conversation,
              lastMessage: latest.content,
              lastMessageAt: latest.createdAt,
            };
            if (latest.userId === myUserId) {
              patch.lastOutgoingAt = latest.createdAt;
              patch.updatedAt = latest.createdAt;
            } else if (latest.isSupport) {
              patch.hasIncomingFromSupport = true;
            }
            return patch;
          }),
        ),
      );
    }
    if (activeConversationIdRef.current === conversationId) {
      patchPrivateInboxMeta(conversationId, { unreadCount: 0 });
      void markConversationRead(conversationId).catch(() => {});
    }
    void refreshConversations().catch(() => {});
    void refreshUnreadPrivate().catch(() => {});
    return messages;
  };

  const sendToPrivate = async () => {
    if (!activeConversationId) return;
    const text = privateInput.trim();
    const file = privateFile;
    if (!text && !file) return;

    const tempId = `temp-private-${Date.now()}`;
    const sentAt = new Date().toISOString();
    const optimistic = {
      id: tempId,
      conversationId: activeConversationId,
      userId: myUserId,
      username: session?.user?.email?.split("@")[0] || "Moi",
      content: text ? censorMessageText(text) : "",
      createdAt: sentAt,
      attachment: null,
      responseMethod: "text",
    };

    try {
      setBusy(true);
      setError("");
      setPrivateMessages((prev) => [...prev, optimistic]);
      setPrivateConversations((prev) =>
        sortActivePrivateConversations(
          prev.map((conversation) =>
            conversation.id === activeConversationId
              ? {
                  ...conversation,
                  lastOutgoingAt: sentAt,
                  updatedAt: sentAt,
                  lastMessage: optimistic.content || conversation.lastMessage,
                  lastMessageAt: sentAt,
                }
              : conversation,
          ),
        ),
      );
      setPrivateInput("");
      setPrivateFile(null);
      if (privateFileRef.current) privateFileRef.current.value = "";

      await sendPrivateMessage({
        conversationId: activeConversationId,
        content: text,
        file,
        responseMethod: activeConversation?.isSupport ? "text" : undefined,
      });

      await refreshPrivateAfterSend(activeConversationId, {
        waitForFollowup: activeConversation?.isSupport === true,
      });
    } catch (e) {
      setPrivateMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(e?.message || "Impossible d'envoyer le message privé.");
    } finally {
      setBusy(false);
    }
  };

  const applyPrivateQuickReplyOptimistic = (label, sourceMessageId, sourceOnboardingStep = null) => {
    const stepKey = Number(sourceOnboardingStep || 0) || null;
    if (
      !activeConversationId ||
      !label?.trim() ||
      (stepKey != null && quickReplyInFlightRef.current.has(stepKey))
    ) {
      return null;
    }

    const messages = privateMessagesRef.current;
    const supportUserId = resolveSupportUserId(messages, activeConversation);
    const optimistic = applyOnboardingQuickReplyOptimistic(messages, {
      sourceMessageId,
      sourceOnboardingStep,
      label,
      conversationId: activeConversationId,
      supportUserId,
    });
    if (!optimistic) return null;

    quickReplyInFlightRef.current.add(optimistic.answeredStep);
    setQuickReplyInFlightStep(optimistic.answeredStep);
    setError("");
    setPrivateMessages(optimistic.messages);
    privateMessagesRef.current = optimistic.messages;
    rememberPrivateMessages(activeConversationId, optimistic.messages);
    rememberOnboardingPrivateMessages(activeConversationId, optimistic.messages);

    return {
      text: label.trim(),
      answeredStep: optimistic.answeredStep,
      followUpStep: optimistic.followUpStep,
      sourceMessageId: optimistic.sourceMessageId,
    };
  };

  const clearQuickReplyInFlight = (answeredStep) => {
    if (answeredStep != null) {
      quickReplyInFlightRef.current.delete(answeredStep);
    }
    setQuickReplyInFlightStep((current) => (current === answeredStep ? null : current));
  };

  const sendPrivateQuickReply = async (label, sourceMessageId, answeredStep) => {
    if (!activeConversationId || !label?.trim()) return;

    const text = label.trim();
    const supportUserId = resolveSupportUserId(privateMessagesRef.current, activeConversation);
    const followUpStep = answeredStep === 1 ? 2 : answeredStep === 2 ? 3 : null;

    try {
      const persistedMessageId = await resolvePersistedOnboardingMessageId(
        () => listPrivateMessages(activeConversationId, accessToken),
        sourceMessageId,
        answeredStep,
        () => privateMessagesRef.current,
      );

      await submitOnboardingQuickReply({
        conversationId: activeConversationId,
        messageId: persistedMessageId,
        label: text,
      });

      if (followUpStep) {
        const synced = await syncOnboardingFollowUpAfterReply(
          () => listPrivateMessages(activeConversationId, accessToken),
          () => privateMessagesRef.current,
          followUpStep,
          supportUserId
            ? {
                answeredStep: answeredStep === 1 ? 1 : 2,
                conversationId: activeConversationId,
                supportUserId,
              }
            : null,
          (merged) => {
            privateMessagesRef.current = merged;
            setPrivateMessages(merged);
            rememberPrivateMessages(activeConversationId, merged);
            rememberOnboardingPrivateMessages(activeConversationId, merged);
          },
        );
        privateMessagesRef.current = synced;
        setPrivateMessages(synced);
        rememberPrivateMessages(activeConversationId, synced);
        rememberOnboardingPrivateMessages(activeConversationId, synced);

        const latest = synced[synced.length - 1];
        if (latest) {
          setPrivateConversations((prev) =>
            sortActivePrivateConversations(
              prev.map((conversation) => {
                if (conversation.id !== activeConversationId) return conversation;
                return {
                  ...conversation,
                  lastMessage: latest.content,
                  lastMessageAt: latest.createdAt,
                  hasIncomingFromSupport: latest.isSupport === true,
                };
              }),
            ),
          );
        }
      } else {
        await refreshPrivateAfterSend(activeConversationId, {
          waitForFollowup: true,
          expectOnboardingStep: null,
        });
      }

      if (activeConversationIdRef.current === activeConversationId) {
        patchPrivateInboxMeta(activeConversationId, { unreadCount: 0 });
        void markConversationRead(activeConversationId).catch(() => {});
      }
      void refreshConversations().catch(() => {});
      void refreshUnreadPrivate().catch(() => {});
    } catch (e) {
      setPrivateMessages((prev) => {
        const rolledBack = rollbackOnboardingQuickReplySelection(prev, answeredStep);
        privateMessagesRef.current = rolledBack;
        return rolledBack;
      });
      setError(e?.message || "Impossible d'envoyer la réponse rapide.");
    } finally {
      clearQuickReplyInFlight(answeredStep);
    }
  };

  const createConversation = async (otherUserId) => {
    try {
      setBusy(true);
      setError("");
      const id = await startPrivateConversation(otherUserId);
      await refreshConversations(id, otherUserId);
      const freshList = await listPrivateConversations(accessToken);
      setPrivateConversations(freshList);
      const match = freshList.find((c) => c.otherUserId === otherUserId);
      const visibleId = match?.id || id;
      setActiveConversationId(visibleId);
      activeConversationIdRef.current = visibleId;
      await refreshPrivateMessages(visibleId);
      setConvMenuId(null);
    } catch (e) {
      setError(e?.message || "Impossible de créer la conversation.");
    } finally {
      setBusy(false);
    }
  };

  const toggleConversationMute = async (conversationId, muted) => {
    const id = String(conversationId || "").trim();
    if (!id || muteBusyConversationId === id) return;

    setConvMenuId(null);
    setError("");
    setMuteBusyConversationId(id);
    setMuteOverrides((prev) => ({ ...prev, [id]: muted === true }));
    patchPrivateInboxMeta(id, { notificationsMuted: muted === true });

    try {
      const savedMuted = await setConversationNotificationsMuted(id, muted);
      setMuteOverrides((prev) => {
        const next = { ...prev };
        if (next[id] === savedMuted) {
          delete next[id];
        } else {
          next[id] = savedMuted;
        }
        return next;
      });
      patchPrivateInboxMeta(id, { notificationsMuted: savedMuted });
      await refreshUnreadPrivate();
    } catch (e) {
      setMuteOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      const previous = privateInboxMeta.find((row) => row.conversationId === id);
      patchPrivateInboxMeta(id, {
        notificationsMuted: previous?.notificationsMuted === true,
      });
      setError(e?.message || "Impossible de modifier la sourdine.");
    } finally {
      setMuteBusyConversationId("");
    }
  };

  const selectPrivateConversation = (conversationId) => {
    setActiveConversationId(conversationId);
    activeConversationIdRef.current = conversationId;
    setConvMenuId(null);
    void markConversationAsViewed(conversationId);
  };

  const backToPrivateConversationList = () => {
    setActiveConversationId("");
    activeConversationIdRef.current = "";
    setConvMenuId(null);
  };

  const removePrivateConversationForMe = async (conversationId) => {
    setConvMenuId(null);
    const target = privateConversations.find((c) => c.id === conversationId);
    if (target?.isSupport) {
      setError("La conversation Support officiel ne peut pas être supprimée.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await hideConversationForMe(conversationId);
      await refreshConversations();
    } catch (e) {
      setError(e?.message || "Impossible de masquer la conversation.");
    } finally {
      setBusy(false);
    }
  };

  const mobilePrivateInChat = tab === "private" && Boolean(activeConversationId);

  return (
    <div className={COMMUNITY_PAGE_ROOT_CLASS}>
      <PageTitle
        green="Communauté"
        subtitle="Salon public et conversations privées, simple et persistant."
        className="mb-0 shrink-0 !mb-1 md:!mb-2"
        titleClassName="text-2xl md:text-3xl"
      />

      <div className={COMMUNITY_TOOLBAR_CLASS}>
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => void runWithAuth(async () => setTab("public"))}
            className={`px-4 py-2 rounded-lg text-sm ${tab === "public" ? "bg-cyan-500/20 text-cyan-100 border border-cyan-400/40" : "text-gray-400"}`}
          >
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>Discussion publique</span>
              {hasNewPublicSinceLastVisit ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
              ) : null}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void runWithAuth(async () => setTab("private"))}
            className={`px-4 py-2 rounded-lg text-sm ${tab === "private" ? "bg-cyan-500/20 text-cyan-100 border border-cyan-400/40" : "text-gray-400"}`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-4 h-4 shrink-0" />
              <span>Conversations privées</span>
              {privateTabUnreadCount > 0 ? (
                <span className="min-w-[1.25rem] rounded-full bg-[#BA7517] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {privateTabUnreadCount > 99 ? "99+" : privateTabUnreadCount}
                </span>
              ) : null}
            </span>
          </button>
        </div>

        <div ref={localeMenuRef} className="relative">
          <button
            type="button"
            aria-label="Langue des traductions"
            aria-expanded={localeMenuOpen}
            title="Langue des traductions"
            onClick={() => setLocaleMenuOpen((open) => !open)}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
              localeMenuOpen
                ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                : "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-gray-200"
            }`}
          >
            <Languages className="w-4 h-4" />
          </button>
          {localeMenuOpen ? (
            <div
              role="menu"
              className="absolute left-0 z-20 mt-1 min-w-[10.5rem] overflow-hidden rounded-lg border border-white/10 bg-[#0f1629] py-1 shadow-xl shadow-black/40"
            >
              <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                Langue des traductions
              </p>
              {COMMUNITY_LOCALES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={preferredLocale === l.code}
                  onClick={() => {
                    setPreferredLocale(l.code);
                    setLocaleMenuOpen(false);
                    void runWithAuth(async () => {
                      await updateProfilePreferredLocale(l.code);
                    });
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                    preferredLocale === l.code
                      ? "bg-cyan-500/10 text-cyan-100"
                      : "text-gray-300 hover:bg-white/5"
                  }`}
                >
                  <span>{l.label}</span>
                  {preferredLocale === l.code ? (
                    <span className="text-[10px] text-cyan-300">Actif</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="shrink-0 text-xs text-red-300 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      ) : null}

      <section className={COMMUNITY_MAIN_SECTION_CLASS}>
        {tab === "private" ? (
          <div
            className={`${SIDEBAR_PANEL_BASE_CLASS} ${SIDEBAR_PANEL_MOBILE_LIST_CLASS} ${
              mobilePrivateInChat ? SIDEBAR_PANEL_MOBILE_HIDDEN_CLASS : ""
            }`}
          >
            <div ref={userSearchRef} className="relative shrink-0">
                <input
                  value={searchUser}
                  onChange={(e) => {
                    setSearchUser(e.target.value);
                    setUserSearchOpen(true);
                    void refreshUsers(e.target.value);
                  }}
                  onFocus={() => {
                    setUserSearchOpen(true);
                    void refreshUsers(searchUser);
                  }}
                  placeholder="Chercher un utilisateur pour envoyer un message..."
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-200"
                />
                {userSearchOpen ? (
                  <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-[#0f1629] py-1 shadow-xl shadow-black/40">
                    {users.length > 0 ? (
                      users.map((u) => (
                        <button
                          key={u.userId}
                          type="button"
                          onClick={() => {
                            setUserSearchOpen(false);
                            setSearchUser("");
                            void runWithAuth(() => createConversation(u.userId));
                          }}
                          className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/5"
                        >
                          <Plus className="w-3 h-3 shrink-0 text-gray-500" />
                          <span className="truncate">{u.username}</span>
                          {u.isSupport ? (
                            <span className="ml-auto shrink-0 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-100">
                              Support
                            </span>
                          ) : null}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-xs text-gray-500">Aucun utilisateur trouvé.</p>
                    )}
                  </div>
                ) : null}
              </div>
              <p className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Conversations actives
              </p>
              <div className={SIDEBAR_CONVERSATIONS_SCROLL_CLASS}>
                {activeConversations.length > 0 ? (
                  conversationsForSidebar.map((c) => (
                  <PrivateConversationRow
                    key={c.id}
                    conversation={c}
                    isActive={activeConversationId === c.id}
                    menuOpen={convMenuId === c.id}
                    muteBusy={muteBusyConversationId === c.id}
                    onSelect={() => selectPrivateConversation(c.id)}
                    onToggleMenu={() => setConvMenuId((prev) => (prev === c.id ? null : c.id))}
                    onRemoveForMe={removePrivateConversationForMe}
                    onToggleMute={(conversationId, nextMuted) => {
                      void toggleConversationMute(conversationId, nextMuted);
                    }}
                  />
                  ))
                ) : (
                  <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-4 text-xs text-gray-500 text-center">
                    Aucune conversation active. Utilise la recherche ci-dessus pour envoyer un message.
                  </p>
                )}
              </div>
          </div>
        ) : null}

        <div
          className={
            tab === "private"
              ? `${PRIVATE_CHAT_PANEL_CLASS} ${
                  mobilePrivateInChat
                    ? PRIVATE_CHAT_PANEL_MOBILE_OPEN_CLASS
                    : PRIVATE_CHAT_PANEL_MOBILE_HIDDEN_CLASS
                }`
              : PUBLIC_CHAT_PANEL_CLASS
          }
        >
          {tab === "public" ? (
            <>
              <div className={CHAT_MESSAGES_FRAME_PUBLIC_CLASS}>
                {publicMessages.map((msg) => (
                  <MessageItem
                    key={msg.id}
                    mine={msg.userId === myUserId}
                    msg={msg}
                    preferredLocale={preferredLocale}
                    translatedText={messageTranslations[msg.id] || ""}
                    menuOpen={msgMenuId === msg.id}
                    onMenuToggle={() => setMsgMenuId((p) => (p === msg.id ? null : msg.id))}
                    onDelete={() => {
                      const id = msg.id;
                      setPublicMessages((prev) => prev.filter((m) => m.id !== id));
                      setMsgMenuId(null);
                      void deletePublicMessage(id)
                        .then(() => refreshPublic())
                        .catch((e) => {
                          setError(e.message);
                          void refreshPublic();
                        });
                    }}
                  />
                ))}
                <div ref={publicEndRef} />
              </div>
              <div className={CHAT_COMPOSER_CLASS}>
                {publicFile ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{publicFile.name}</span>
                    <button type="button" onClick={() => setPublicFile(null)} className="text-red-300">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : null}
                <div className="flex gap-2 items-end">
                  <textarea
                    value={publicInput}
                    onChange={(e) => setPublicInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void runWithAuth(sendToPublic);
                      }
                    }}
                    onFocus={() => {
                      if (!session) openAuthModal();
                    }}
                    placeholder="Écrire un message public..."
                    rows={2}
                    className="flex-1 resize-y min-h-[2.75rem] max-h-40 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-200"
                  />
                  <input
                    ref={publicFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                    onChange={(e) => setPublicFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => publicFileRef.current?.click()}
                    className="px-3 py-2 rounded-lg border border-white/10 text-gray-300"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runWithAuth(sendToPublic)}
                    className="px-4 py-2 rounded-lg bg-cyan-500 text-white"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {activeConversation || mobilePrivateInChat ? (
                <div className="mb-3 flex shrink-0 items-center gap-2 border-b border-white/10 pb-2">
                  <button
                    type="button"
                    onClick={backToPrivateConversationList}
                    aria-label="Retour aux conversations"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-gray-300 transition-colors hover:border-white/20 hover:text-white md:hidden"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-200">
                      {activeConversation?.otherUsername || "Conversation"}
                    </p>
                    {isSupportViewer ? (
                      <p className="text-[11px] text-gray-500">Onboarding et messagerie privée</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className={CHAT_MESSAGES_FRAME_CLASS}>
                {privateMessages.length > 0 ? (
                  privateMessages.map((msg) => (
                    <MessageItem
                      key={onboardingMessageRenderKey(msg)}
                      mine={msg.userId === myUserId}
                      msg={msg}
                      preferredLocale={preferredLocale}
                      translatedText={messageTranslations[msg.id] || ""}
                      menuOpen={msgMenuId === msg.id}
                      onMenuToggle={() => setMsgMenuId((p) => (p === msg.id ? null : msg.id))}
                      allowDelete={!msg.isOnboardingAnswer}
                      showQuickReplies={shouldShowMessageQuickReplies(msg, privateMessages, myUserId, {
                        viewerIsSupport: isSupportViewer,
                      })}
                      quickRepliesDisabled={
                        (msg.onboardingStep != null &&
                          quickReplyInFlightStep === msg.onboardingStep) ||
                        busy
                      }
                      onQuickReply={(label, sourceMessageId, sourceOnboardingStep) => {
                        const optimistic = applyPrivateQuickReplyOptimistic(
                          label,
                          sourceMessageId,
                          sourceOnboardingStep,
                        );
                        if (!optimistic) return false;
                        void runWithAuth(() =>
                          sendPrivateQuickReply(
                            label,
                            optimistic.sourceMessageId,
                            optimistic.answeredStep,
                          ),
                        );
                        return true;
                      }}
                      onDelete={() => {
                        const id = msg.id;
                        setPrivateMessages((prev) => prev.filter((m) => m.id !== id));
                        setMsgMenuId(null);
                        void deletePrivateMessage(id)
                          .then(() => refreshPrivateMessages(activeConversationId))
                          .then(() => refreshConversations())
                          .catch((e) => {
                            setError(e.message);
                            void refreshPrivateMessages(activeConversationId);
                          });
                      }}
                    />
                  ))
                ) : (
                  <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-4 text-xs text-gray-500 text-center">
                    {activeConversation
                      ? `Conversation avec ${activeConversation.otherUsername} — aucun message pour l'instant.`
                      : isSupportViewer
                        ? "Sélectionne une conversation dans la liste."
                        : "Choisis une conversation dans la liste ou via la recherche."}
                  </p>
                )}
                <div ref={privateEndRef} />
              </div>

              <div className={CHAT_COMPOSER_CLASS}>
                {privateFile ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{privateFile.name}</span>
                    <button type="button" onClick={() => setPrivateFile(null)} className="text-red-300">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : null}
                <div className="flex gap-2 items-end">
                  <textarea
                    value={privateInput}
                    onChange={(e) => setPrivateInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void runWithAuth(sendToPrivate);
                      }
                    }}
                    onFocus={() => {
                      if (!session) openAuthModal();
                    }}
                    placeholder="Écrire un message privé..."
                    rows={2}
                    className="flex-1 resize-y min-h-[2.75rem] max-h-40 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-200"
                  />
                  <input
                    ref={privateFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                    onChange={(e) => setPrivateFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => privateFileRef.current?.click()}
                    className="px-3 py-2 rounded-lg border border-white/10 text-gray-300"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={busy || !activeConversationId}
                    onClick={() => void runWithAuth(sendToPrivate)}
                    className="px-4 py-2 rounded-lg bg-cyan-500 text-white disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

