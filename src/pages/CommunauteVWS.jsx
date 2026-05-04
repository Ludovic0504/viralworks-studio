import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import PageTitle from "@/composants/interface/TitrePage";
import { MessageCircle, Users, Send, Paperclip, Plus, X, MoreVertical } from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { useCommunauteVWSNotif } from "@/contexte/FournisseurCommunauteVWSNotif.jsx";
import {
  deletePrivateMessage,
  deletePublicMessage,
  getCommunityAdminUser,
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

const FLOATING_MENU_WIDTH = 160;
/** Hauteur approximative (une ligne + padding) pour le placement au-dessus du trigger si bas de viewport */
const FLOATING_MENU_HEIGHT = 52;

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

function MessageItem({ mine, msg, onDelete, menuOpen, onMenuToggle }) {
  const anchorRef = useRef(null);
  const { top, left } = useFloatingMenuCoords(menuOpen && mine, anchorRef);

  return (
    <div className={`rounded-xl border px-3 py-2 ${mine ? "border-cyan-500/40 bg-cyan-500/10" : "border-white/10 bg-white/[0.03]"}`}>
      <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400 mb-1">
        <span className="font-medium text-gray-300 inline-flex items-center gap-1.5">
          <span>{msg.username}</span>
          {msg.isSupport ? (
            <span className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-100">
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
      {msg.content ? <p className="text-sm text-gray-200 whitespace-pre-wrap">{msg.content}</p> : null}
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

  return (
    <div
      className={`flex items-stretch gap-1 rounded-lg border ${
        isActive ? "border-cyan-400/40 bg-cyan-500/10" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left px-3 py-2">
        <p className="text-sm text-gray-200 font-medium inline-flex items-center gap-1.5">
          <span>{c.otherUsername}</span>
          {c.isSupport ? (
            <span className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-100">
              Support officiel
            </span>
          ) : null}
        </p>
        <p className="text-xs text-gray-500 truncate">{c.lastMessage || "Aucun message"}</p>
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
  const { runWithAuth, openAuthModal } = useRequireAuthAction();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    unreadPrivateCount,
    hasNewPublicSinceLastVisit,
    refreshUnreadPrivate,
    markPublicTabVisited,
  } = useCommunauteVWSNotif();
  const myUserId = session?.user?.id || "";
  const [tab, setTab] = useState("public");
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

  const publicEndRef = useRef(null);
  const privateEndRef = useRef(null);
  const publicFileRef = useRef(null);
  const privateFileRef = useRef(null);

  const activeConversation = useMemo(
    () => privateConversations.find((c) => c.id === activeConversationId) || null,
    [privateConversations, activeConversationId]
  );

  const refreshPublic = async () => {
    try {
      setPublicMessages(await listPublicMessages());
    } catch (e) {
      setError(e?.message || "Erreur chargement discussion publique.");
    }
  };

  const refreshConversations = async (forceActiveId) => {
    try {
      const list = await listPrivateConversations();
      setPrivateConversations(list);
      setActiveConversationId((prev) => {
        if (
          forceActiveId !== undefined &&
          forceActiveId !== null &&
          forceActiveId !== "" &&
          list.some((c) => c.id === forceActiveId)
        ) {
          return forceActiveId;
        }
        if (prev && list.some((c) => c.id === prev)) {
          return prev;
        }
        return list[0]?.id || "";
      });
    } catch (e) {
      setError(e?.message || "Erreur chargement conversations.");
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
      setPrivateMessages(await listPrivateMessages(conversationId));
    } catch (e) {
      setError(e?.message || "Erreur chargement messages privés.");
    }
  };

  const refreshUsers = async () => {
    try {
      const all = await listCommunityUsers(searchUser);
      const admin = await getCommunityAdminUser();
      const withAdmin = admin && !all.some((u) => u.userId === admin.userId) ? [admin, ...all] : all;
      setUsers(withAdmin);
    } catch (e) {
      setError(e?.message || "Erreur chargement utilisateurs.");
    }
  };

  useEffect(() => {
    if (!session?.user?.id) return;
    const bootstrap = async () => {
      await ensureSupportConversation();
      await refreshPublic();
      await refreshConversations();
      await refreshUsers();
    };
    void bootstrap();
  }, [session?.user?.id]);

  useEffect(() => {
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
    markPublicTabVisited();
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
      await refreshConversations(id);
      await refreshPrivateMessages(id);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <PageTitle
        green="Communauté"
        white="VWS"
        subtitle="Salon public et conversations privées, simple et persistant."
      />

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

      {error ? (
        <p className="text-xs text-red-300 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      ) : null}

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 studio-panel p-4 sm:p-5 space-y-3">
          {tab === "private" ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  placeholder="Chercher un utilisateur..."
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-200"
                />
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 border border-white/10 rounded-lg p-2">
                {users.map((u) => (
                  <button
                    key={u.userId}
                    type="button"
                    onClick={() => void runWithAuth(() => createConversation(u.userId))}
                    className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-white/5 text-gray-300"
                  >
                    <Plus className="w-3 h-3 inline mr-1" />
                    {u.username}
                  </button>
                ))}
              </div>
              <div className="border-t border-white/10 pt-3 space-y-2 max-h-[45vh] overflow-y-auto">
                {privateConversations.map((c) => (
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
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-300">
              <p className="font-medium text-gray-200 mb-1">Salon public</p>
              <p className="text-xs text-gray-500">
                Tous les utilisateurs voient et participent à cette discussion.
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 studio-panel p-4 sm:p-5 space-y-4">
          {tab === "public" ? (
            <>
              <div className="max-h-[56vh] overflow-y-auto space-y-3 pr-1">
                {publicMessages.map((msg) => (
                  <MessageItem
                    key={msg.id}
                    mine={msg.userId === myUserId}
                    msg={msg}
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
              <div className="border-t border-white/10 pt-3 space-y-2">
                {publicFile ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{publicFile.name}</span>
                    <button type="button" onClick={() => setPublicFile(null)} className="text-red-300">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <input
                    value={publicInput}
                    onChange={(e) => setPublicInput(e.target.value)}
                    onFocus={() => {
                      if (!session) openAuthModal();
                    }}
                    placeholder="Écrire un message public..."
                    className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-200"
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
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="text-sm text-gray-200 font-semibold">
                  {activeConversation ? `Conversation avec ${activeConversation.otherUsername}` : "Choisis une conversation"}
                </h3>
              </div>

              <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
                {privateMessages.map((msg) => (
                  <MessageItem
                    key={msg.id}
                    mine={msg.userId === myUserId}
                    msg={msg}
                    menuOpen={msgMenuId === msg.id}
                    onMenuToggle={() => setMsgMenuId((p) => (p === msg.id ? null : msg.id))}
                    onDelete={() =>
                      deletePrivateMessage(msg.id)
                        .then(() => refreshPrivateMessages(activeConversationId))
                        .then(() => setMsgMenuId(null))
                        .catch((e) => setError(e.message))
                    }
                  />
                ))}
                <div ref={privateEndRef} />
              </div>

              <div className="border-t border-white/10 pt-3 space-y-2">
                {privateFile ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{privateFile.name}</span>
                    <button type="button" onClick={() => setPrivateFile(null)} className="text-red-300">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <input
                    value={privateInput}
                    onChange={(e) => setPrivateInput(e.target.value)}
                    onFocus={() => {
                      if (!session) openAuthModal();
                    }}
                    placeholder="Écrire un message privé..."
                    className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-200"
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

