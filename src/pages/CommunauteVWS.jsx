import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import PageTitle from "@/composants/interface/TitrePage";
import { MessageCircle, Users, Send, Paperclip, Plus, X, MoreVertical, Languages } from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { useCommunauteVWSNotif } from "@/contexte/FournisseurCommunauteVWSNotif.jsx";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { PAGE_SHELL_INNER_CLASS } from "@/bibliotheque/disposition/dashboardShellLayout";
import {
  deletePrivateMessage,
  deletePublicMessage,
  getCommunitySupportUser,
  hideConversationForMe,
  listPrivateConversations,
  listPrivateMessages,
  listPublicMessages,
  listCommunityUsers,
  markAllPrivateConversationsRead,
  markConversationRead,
  sendPrivateMessage,
  sendPublicMessage,
  startPrivateConversation,
  COMMUNITY_LOCALES,
  getProfilePreferredLocale,
  updateProfilePreferredLocale,
  resolveCommunityMessageTranslations,
  getMemoryCachedTranslation,
} from "@/bibliotheque/supabase/communaute";

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

const CHAT_PANEL_BASE_CLASS = "studio-panel p-4 sm:p-5 flex flex-col min-h-0";
const SIDEBAR_PANEL_CLASS = `${CHAT_PANEL_BASE_CLASS} md:col-span-4 gap-3`;
const CHAT_MESSAGES_FRAME_CLASS =
  "flex-1 min-h-[48vh] md:min-h-0 overflow-y-auto space-y-3 pr-1";
const CHAT_MESSAGES_FRAME_PUBLIC_CLASS =
  "min-h-[56vh] max-h-[56vh] overflow-y-auto space-y-3 pr-1";
const CHAT_COMPOSER_CLASS = "border-t border-white/10 pt-3 space-y-2 shrink-0";
const SIDEBAR_SCROLL_FRAME_CLASS = "flex-1 min-h-0 overflow-y-auto space-y-2";
const COMMUNITY_GRID_CLASS = "grid grid-cols-1 md:grid-cols-12 gap-4 md:items-stretch";
const COMMUNITY_PANEL_HEIGHT_CLASS = "md:min-h-[calc(56vh+7.5rem)]";

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
      message.createdAt === next[index]?.createdAt
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
}) {
  const anchorRef = useRef(null);
  const { top, left } = useFloatingMenuCoords(menuOpen && mine, anchorRef);
  const [showOriginal, setShowOriginal] = useState(false);

  const shouldAutoTranslate = preferredLocale !== "fr";

  useEffect(() => {
    setShowOriginal(false);
  }, [msg.id, preferredLocale]);

  const displayedText =
    shouldAutoTranslate && translatedText && !showOriginal ? translatedText : msg.content || "";

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
          {mine ? (
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
    </div>
  );
}

function PrivateConversationRow({ conversation: c, isActive, onSelect, menuOpen, onToggleMenu, onRemoveForMe }) {
  const anchorRef = useRef(null);
  const { top, left } = useFloatingMenuCoords(menuOpen, anchorRef);
  const timeLabel = formatConversationTime(c.lastMessageAt || c.updatedAt);

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
              </p>
              {timeLabel ? <span className="shrink-0 text-[10px] text-gray-500">{timeLabel}</span> : null}
            </div>
            <p className="mt-0.5 text-xs text-gray-500 truncate">
              {c.lastMessage ? c.lastMessage : "Aucun message — conversation prête"}
            </p>
          </div>
        </div>
      </button>
      <div className="flex shrink-0 items-start pt-1.5 pr-1.5">
        {c.isSupport ? null : (
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
        )}
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
                  onClick={() => onRemoveForMe(c.id)}
                >
                  Supprimer
                </button>
              </div>,
              document.body
            )
          : null}
      </div>
    </div>
  );
}

export default function CommunauteVWS() {
  const { session } = useAuth();
  const { isAdmin: isAdminUser } = useAdminAccess();
  const { runWithAuth, openAuthModal } = useRequireAuthAction();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    unreadPrivateCount,
    hasNewPublicSinceLastVisit,
    refreshUnreadPrivate,
    markPublicTabVisited,
  } = useCommunauteVWSNotif();
  const myUserId = session?.user?.id || "";
  const [tab, setTab] = useState(() =>
    new URLSearchParams(window.location.search).get("tab") === "private" ? "private" : "public"
  );
  const tabQueryHandledRef = useRef(false);
  const [publicMessages, setPublicMessages] = useState([]);
  const [privateConversations, setPrivateConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState("");
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
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [preferredLocale, setPreferredLocale] = useState("fr");
  const [messageTranslations, setMessageTranslations] = useState({});

  const publicEndRef = useRef(null);
  const userSearchRef = useRef(null);
  const localeMenuRef = useRef(null);
  const privateEndRef = useRef(null);
  const publicFileRef = useRef(null);
  const privateFileRef = useRef(null);
  const activeConversationIdRef = useRef(activeConversationId);
  const translationRequestRef = useRef(0);

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
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const activeConversation = useMemo(
    () => privateConversations.find((c) => c.id === activeConversationId) || null,
    [privateConversations, activeConversationId]
  );

  const activeConversations = useMemo(
    () => privateConversations.filter((c) => c.isSupport || Boolean(c.lastMessageAt)),
    [privateConversations]
  );

  const refreshPublic = async () => {
    try {
      const messages = await listPublicMessages();
      setPublicMessages((prev) => (messagesAreSame(prev, messages) ? prev : messages));
    } catch (e) {
      setError(e?.message || "Erreur chargement discussion publique.");
    }
  };

  const refreshConversations = async (forceActiveId, forceOtherUserId) => {
    try {
      const list = await listPrivateConversations();
      setPrivateConversations(list);
      let resolvedId = "";
      setActiveConversationId((prev) => {
        if (
          forceActiveId !== undefined &&
          forceActiveId !== null &&
          forceActiveId !== "" &&
          list.some((c) => c.id === forceActiveId)
        ) {
          resolvedId = forceActiveId;
          return forceActiveId;
        }
        if (forceOtherUserId) {
          const match = list.find((c) => c.otherUserId === forceOtherUserId);
          if (match) {
            resolvedId = match.id;
            return match.id;
          }
        }
        if (prev && list.some((c) => c.id === prev)) {
          resolvedId = prev;
          return prev;
        }
        const supportConv = list.find((c) => c.isSupport);
        const withMessages = list.filter((c) => Boolean(c.lastMessageAt));
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
    try {
      const support = await getCommunitySupportUser();
      if (!support?.userId) return;
      await startPrivateConversation(support.userId);
    } catch (e) {
      // Non-bloquant: la page doit rester utilisable même si la création auto échoue.
      console.warn("Support conversation bootstrap failed:", e);
    }
  };

  const refreshPrivateMessages = async (conversationId) => {
    if (!conversationId) {
      setPrivateMessages([]);
      return;
    }
    try {
      const messages = await listPrivateMessages(conversationId);
      if (activeConversationIdRef.current !== conversationId) return;
      setPrivateMessages((prev) => (messagesAreSame(prev, messages) ? prev : messages));
    } catch (e) {
      if (activeConversationIdRef.current !== conversationId) return;
      setError(e?.message || "Erreur chargement messages privés.");
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
    if (!session?.user?.id) return;
    const bootstrap = async () => {
      await Promise.all([
        ensureSupportConversation(),
        refreshPublic(),
        refreshConversations(),
        refreshUsers(),
      ]);
    };
    void bootstrap();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!activeConversationId) {
      setPrivateMessages([]);
      return;
    }
    setPrivateMessages([]);
    setMessageTranslations({});
    void refreshPrivateMessages(activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const id = setInterval(() => {
      if (tab === "public") void refreshPublic();
      if (tab === "private") {
        void refreshConversations();
        void refreshPrivateMessages(activeConversationId);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [tab, activeConversationId, session?.user?.id]);

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
    if (searchParams.get("tab") !== "private") return;
    tabQueryHandledRef.current = true;
    setTab("private");
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("tab");
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
    if (tab !== "private" || !session?.user?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        await markAllPrivateConversationsRead();
        if (!cancelled) await refreshUnreadPrivate();
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, session?.user?.id, refreshUnreadPrivate]);

  useEffect(() => {
    if (tab !== "private" || !session?.user?.id || !activeConversationId) return;
    let cancelled = false;
    void (async () => {
      try {
        await markConversationRead(activeConversationId);
        if (!cancelled) await refreshUnreadPrivate();
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, activeConversationId, session?.user?.id, refreshUnreadPrivate]);

  const sendToPublic = async () => {
    try {
      setBusy(true);
      setError("");
      await sendPublicMessage({ content: publicInput, file: publicFile });
      setPublicInput("");
      setPublicFile(null);
      if (publicFileRef.current) publicFileRef.current.value = "";
      await refreshPublic();
      markPublicTabVisited();
    } catch (e) {
      setError(e?.message || "Impossible d'envoyer le message public.");
    } finally {
      setBusy(false);
    }
  };

  const sendToPrivate = async () => {
    if (!activeConversationId) return;
    try {
      setBusy(true);
      setError("");
      await sendPrivateMessage({
        conversationId: activeConversationId,
        content: privateInput,
        file: privateFile,
      });
      setPrivateInput("");
      setPrivateFile(null);
      if (privateFileRef.current) privateFileRef.current.value = "";
      await refreshConversations();
      await refreshPrivateMessages(activeConversationId);
    } catch (e) {
      setError(e?.message || "Impossible d'envoyer le message privé.");
    } finally {
      setBusy(false);
    }
  };

  const createConversation = async (otherUserId) => {
    try {
      setBusy(true);
      setError("");
      const id = await startPrivateConversation(otherUserId);
      await refreshConversations(id, otherUserId);
      const freshList = await listPrivateConversations();
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

  return (
    <div className={`${PAGE_SHELL_INNER_CLASS} py-6 space-y-6`}>
      <PageTitle
        green="Communauté"
        subtitle="Salon public et conversations privées, simple et persistant."
      />

      <div className="flex flex-wrap items-center gap-2">
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
              {unreadPrivateCount > 0 ? (
                <span className="min-w-[1.25rem] rounded-full bg-[#BA7517] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {unreadPrivateCount > 99 ? "99+" : unreadPrivateCount}
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
        <p className="text-xs text-red-300 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      ) : null}

      <section className={COMMUNITY_GRID_CLASS}>
        {tab === "private" ? (
          <div className={`${SIDEBAR_PANEL_CLASS} ${COMMUNITY_PANEL_HEIGHT_CLASS}`}>
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
              <div className={SIDEBAR_SCROLL_FRAME_CLASS}>
                {activeConversations.length > 0 ? (
                  activeConversations.map((c) => (
                  <PrivateConversationRow
                    key={c.id}
                    conversation={c}
                    isActive={activeConversationId === c.id}
                    menuOpen={convMenuId === c.id}
                    onSelect={() => {
                      setActiveConversationId(c.id);
                      setConvMenuId(null);
                    }}
                    onToggleMenu={() => setConvMenuId((prev) => (prev === c.id ? null : c.id))}
                    onRemoveForMe={removePrivateConversationForMe}
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
          className={`${CHAT_PANEL_BASE_CLASS} ${COMMUNITY_PANEL_HEIGHT_CLASS} ${
            tab === "public" ? "md:col-span-12" : "md:col-span-8"
          }`}
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
                    onDelete={() =>
                      deletePublicMessage(msg.id)
                        .then(refreshPublic)
                        .then(() => setMsgMenuId(null))
                        .catch((e) => setError(e.message))
                    }
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
              <div className={CHAT_MESSAGES_FRAME_CLASS}>
                {privateMessages.length > 0 ? (
                  privateMessages.map((msg) => (
                    <MessageItem
                      key={msg.id}
                      mine={msg.userId === myUserId}
                      msg={msg}
                      preferredLocale={preferredLocale}
                      translatedText={messageTranslations[msg.id] || ""}
                      menuOpen={msgMenuId === msg.id}
                      onMenuToggle={() => setMsgMenuId((p) => (p === msg.id ? null : msg.id))}
                      onDelete={() =>
                        deletePrivateMessage(msg.id)
                          .then(() => refreshPrivateMessages(activeConversationId))
                          .then(() => setMsgMenuId(null))
                          .catch((e) => setError(e.message))
                      }
                    />
                  ))
                ) : (
                  <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-4 text-xs text-gray-500 text-center">
                    {activeConversation
                      ? `Conversation avec ${activeConversation.otherUsername} — aucun message pour l'instant.`
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

