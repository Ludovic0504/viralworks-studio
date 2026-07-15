import { getBrowserSupabase } from "./client-navigateur";
import { getUserProfile } from "./profil";
import { enrichCommunityMessage } from "@/bibliotheque/community/onboarding";
import { prefetchPrivateMessages as prefetchPrivateMessagesCache } from "@/bibliotheque/community/privateMessagesCache";

export type CommunityUser = {
  userId: string;
  username: string;
  role?: string | null;
  isSupport?: boolean;
};

export type CommunityAttachment = {
  url: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
  authorId: string;
  createdAt: string;
};

export type CommunityMessage = {
  id: string;
  conversationId?: string | null;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
  attachment: CommunityAttachment | null;
  isSupport?: boolean;
  quickReplyOptions?: string[];
  quickRepliesClosedAt?: string | null;
  quickReplySelected?: string | null;
  responseMethod?: "button" | "text" | null;
  onboardingStep?: number | null;
  isOnboardingAnswer?: boolean;
};

export type CommunityConversation = {
  id: string;
  otherUserId: string;
  otherUsername: string;
  updatedAt: string;
  lastMessage: string;
  lastMessageAt: string;
  isSupport?: boolean;
  hasOnboardingAnswers?: boolean;
  unreadCount?: number;
  notificationsMuted?: boolean;
  lastOutgoingAt?: string | null;
  hasIncomingFromSupport?: boolean;
};

export type ConversationInboxMeta = {
  conversationId: string;
  unreadCount: number;
  notificationsMuted: boolean;
};

export type CommunityMessageScope = "public" | "private";

export type CommunityLocale = "fr" | "en" | "es";

export type UnreadPrivatePreview = {
  messageId: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  isSupport: boolean;
  contentPreview: string;
  createdAt: string;
};

export type PrivateUnreadStatus = {
  count: number;
  preview: UnreadPrivatePreview | null;
};

export type EnsureWelcomePrivateMessageResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  preview: UnreadPrivatePreview | null;
};

function buildWelcomePreviewFromEnsureResult(data: unknown): UnreadPrivatePreview | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const messageId = String(row.messageId || "").trim();
  const conversationId = String(row.conversationId || "").trim();
  const supportUserId = String(row.supportUserId || "").trim();
  if (!messageId || !conversationId) return null;

  return {
    messageId,
    conversationId,
    senderUserId: supportUserId,
    senderName: "Support",
    isSupport: true,
    contentPreview: "Salut 👋",
    createdAt: new Date().toISOString(),
  };
}

export const COMMUNITY_LOCALES: { code: CommunityLocale; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

const COMMUNITY_MEDIA_BUCKET = "community-media";
const SUPPORT_EMAIL = "jean.limonta06@gmail.com";

export function isCommunitySupportAccount(email: string | null | undefined): boolean {
  return String(email || "").toLowerCase() === SUPPORT_EMAIL;
}
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const TRANSLATION_FETCH_CONCURRENCY = 3;

type CommunityReadAction =
  | { action: "listPublic"; limit?: number }
  | { action: "listPrivate"; conversationId: string }
  | { action: "listConversations" };

async function parseInvokeErrorMessage(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object") return null;
  const ctx = (error as { context?: unknown }).context;
  if (!ctx || typeof ctx !== "object" || !("json" in ctx)) return null;
  try {
    const parsed = (await (ctx as Response).clone().json()) as { error?: string };
    return typeof parsed.error === "string" && parsed.error.trim() ? parsed.error : null;
  } catch {
    return null;
  }
}

async function invokeCommunityRead<T>(
  body: CommunityReadAction,
  _accessToken?: string,
): Promise<T> {
  const auth = await ensureAuthSession();

  const invokeOnce = async (token: string) =>
    auth.supabase.functions.invoke("community-read-messages", {
      body: { ...body, accessToken: token },
    });

  let { data, error } = await invokeOnce(auth.accessToken);

  if (error) {
    const detail = await parseInvokeErrorMessage(error);
    const unauthorized =
      detail?.toLowerCase().includes("non autorisé") ||
      detail?.toLowerCase().includes("autorisé");

    if (unauthorized) {
      const { data: refreshed } = await auth.supabase.auth.refreshSession();
      const retryToken = refreshed.session?.access_token;
      if (retryToken) {
        ({ data, error } = await invokeOnce(retryToken));
      }
    }
  }

  if (error) {
    const detail = await parseInvokeErrorMessage(error);
    throw new Error(detail || error.message || "Impossible de charger les messages.");
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

const translationMemoryCache = new Map<string, string>();

function translationMemoryKey(
  messageId: string,
  messageScope: CommunityMessageScope,
  targetLang: CommunityLocale
) {
  return `${messageScope}:${messageId}:${targetLang}`;
}

function rememberTranslation(
  messageId: string,
  messageScope: CommunityMessageScope,
  targetLang: CommunityLocale,
  text: string
) {
  const value = String(text || "").trim();
  if (!value) return;
  translationMemoryCache.set(translationMemoryKey(messageId, messageScope, targetLang), value);
}

export function getMemoryCachedTranslation(
  messageId: string,
  messageScope: CommunityMessageScope,
  targetLang: CommunityLocale
): string | null {
  const text = translationMemoryCache.get(translationMemoryKey(messageId, messageScope, targetLang));
  return text ? String(text) : null;
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  if (!items.length) return;
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item !== undefined) await worker(item);
    }
  });
  await Promise.all(runners);
}

function toUsername(row: any): string {
  const raw =
    row?.full_name ||
    [row?.first_name, row?.last_name].filter(Boolean).join(" ") ||
    row?.first_name ||
    (row?.email ? String(row.email).split("@")[0] : "");
  const value = String(raw || "").trim();
  return value || "Utilisateur";
}

function toAttachment(row: any): CommunityAttachment | null {
  if (!row?.attachment_url) return null;
  return {
    url: String(row.attachment_url),
    mimeType: String(row.attachment_type || ""),
    sizeBytes: Number(row.attachment_size || 0),
    fileName: String(row.attachment_name || ""),
    authorId: String(row.user_id || ""),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

const AUTHOR_NAME_TTL_MS = 60_000;
let authorNameCache: { userId: string; name: string; fetchedAt: number } | null = null;

async function getAuthorDisplayName(
  supabase: ReturnType<typeof getBrowserSupabase>,
  user: { id: string; email?: string | null },
): Promise<string> {
  if (
    authorNameCache?.userId === user.id &&
    Date.now() - authorNameCache.fetchedAt < AUTHOR_NAME_TTL_MS
  ) {
    return authorNameCache.name;
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("full_name, first_name, last_name, email")
    .eq("user_id", user.id)
    .maybeSingle();

  const name = prof
    ? toUsername(prof)
    : user.email
      ? String(user.email).split("@")[0]
      : "Membre";

  authorNameCache = { userId: user.id, name, fetchedAt: Date.now() };
  return name;
}

async function ensureAuthSession(): Promise<{
  supabase: ReturnType<typeof getBrowserSupabase>;
  user: { id: string; email?: string | null };
  accessToken: string;
}> {
  const supabase = getBrowserSupabase();
  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session;
  }

  if (!session?.access_token) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user?.id) {
      throw new Error("Utilisateur non connecté.");
    }
    ({
      data: { session },
    } = await supabase.auth.getSession());
  }

  if (!session?.user?.id || !session.access_token) {
    throw new Error("Utilisateur non connecté.");
  }

  return {
    supabase,
    user: { id: session.user.id, email: session.user.email },
    accessToken: session.access_token,
  };
}

async function ensureAuthUser() {
  const { supabase, user } = await ensureAuthSession();
  return { supabase, user };
}

type ViewerContext = {
  supabase: ReturnType<typeof getBrowserSupabase>;
  user: { id: string; email?: string | null };
  isAdmin: boolean;
  isSupport: boolean;
  canMessageAnyone: boolean;
};

const VIEWER_CONTEXT_TTL_MS = 60_000;
let viewerContextCache: {
  userId: string;
  ctx: ViewerContext;
  fetchedAt: number;
} | null = null;
let viewerContextInflight: {
  userId: string;
  promise: Promise<ViewerContext>;
} | null = null;

async function getViewerContext(): Promise<ViewerContext> {
  const { supabase, user } = await ensureAuthUser();

  if (
    viewerContextCache?.userId === user.id &&
    Date.now() - viewerContextCache.fetchedAt < VIEWER_CONTEXT_TTL_MS
  ) {
    return viewerContextCache.ctx;
  }

  if (viewerContextInflight?.userId === user.id) {
    return viewerContextInflight.promise;
  }

  const promise = (async () => {
    const profile = await getUserProfile(user.id);
    const isAdmin = String(profile?.role || "").toLowerCase() === "admin";
    const isSupport = String(user.email || "").toLowerCase() === SUPPORT_EMAIL;
    const ctx: ViewerContext = {
      supabase,
      user,
      isAdmin,
      isSupport,
      canMessageAnyone: isAdmin || isSupport,
    };
    viewerContextCache = { userId: user.id, ctx, fetchedAt: Date.now() };
    return ctx;
  })().finally(() => {
    if (viewerContextInflight?.userId === user.id) {
      viewerContextInflight = null;
    }
  });

  viewerContextInflight = { userId: user.id, promise };
  return promise;
}

async function loadProfilesMap(userIds: string[]): Promise<Map<string, CommunityUser>> {
  const map = new Map<string, CommunityUser>();
  if (!userIds.length) return map;
  const { supabase } = await ensureAuthUser();
  const { data } = await supabase
    .from("profiles")
    .select("user_id, full_name, first_name, last_name, email, role")
    .in("user_id", userIds);
  for (const row of data || []) {
    const email = String(row.email || "").toLowerCase();
    map.set(String(row.user_id), {
      userId: String(row.user_id),
      username: toUsername(row),
      role: row.role ?? null,
      isSupport: email === SUPPORT_EMAIL,
    });
  }
  return map;
}

function assertAllowedFile(file: File) {
  const mime = String(file.type || "").toLowerCase();
  if (ALLOWED_IMAGE_TYPES.has(mime)) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("Image trop lourde (max 8 MB).");
    }
    return "image";
  }
  if (ALLOWED_VIDEO_TYPES.has(mime)) {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error("Vidéo trop lourde (max 25 MB).");
    }
    return "video";
  }
  throw new Error("Format non autorisé. Images/Vidéos uniquement.");
}

async function compressImageIfNeeded(file: File): Promise<File> {
  const needCompression = file.size > 2.5 * 1024 * 1024;
  if (!needCompression) return file;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      URL.revokeObjectURL(url);
      resolve(i);
    };
    i.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire l'image."));
    };
    i.src = url;
  });
  const maxW = 1920;
  const maxH = 1920;
  let { width, height } = img;
  const ratio = Math.min(maxW / width, maxH / height, 1);
  width = Math.max(1, Math.round(width * ratio));
  height = Math.max(1, Math.round(height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82)
  );
  if (!blob) return file;
  if (blob.size > MAX_IMAGE_BYTES) throw new Error("Image trop lourde après compression.");
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

async function uploadAttachment(file: File, userId: string): Promise<CommunityAttachment> {
  const { supabase } = await ensureAuthUser();
  const kind = assertAllowedFile(file);
  const prepared = kind === "image" ? await compressImageIfNeeded(file) : file;
  const ext = (prepared.name.split(".").pop() || "bin").toLowerCase();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from(COMMUNITY_MEDIA_BUCKET)
    .upload(path, prepared, { contentType: prepared.type, upsert: false });
  if (error) throw new Error(error.message || "Upload impossible.");
  const { data } = supabase.storage.from(COMMUNITY_MEDIA_BUCKET).getPublicUrl(path);
  return {
    url: data.publicUrl,
    mimeType: prepared.type,
    sizeBytes: prepared.size,
    fileName: prepared.name,
    authorId: userId,
    createdAt: new Date().toISOString(),
  };
}

export async function listCommunityUsers(search = ""): Promise<CommunityUser[]> {
  const { supabase, user, canMessageAnyone } = await getViewerContext();
  const q = search.trim().toLowerCase();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name, first_name, last_name, email, role")
    .neq("user_id", user.id)
    .limit(200);
  if (error) throw new Error(error.message);
  return (data || [])
    .map((row) => {
      const email = String(row.email || "").toLowerCase();
      return {
        userId: String(row.user_id),
        username: toUsername(row),
        role: row.role ?? null,
        isSupport: email === SUPPORT_EMAIL,
      };
    })
    .filter((u) => {
      if (!canMessageAnyone && String(u.role || "").toLowerCase() === "admin") return false;
      return q ? u.username.toLowerCase().includes(q) : true;
    })
    .sort((a, b) => a.username.localeCompare(b.username, "fr"));
}

export async function getCommunityAdminUser(): Promise<CommunityUser | null> {
  const users = await listCommunityUsers();
  return users.find((u) => String(u.role || "").toLowerCase() === "admin") || null;
}

export async function getCommunitySupportUser(): Promise<CommunityUser | null> {
  const { supabase, user } = await ensureAuthUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name, first_name, last_name, email, role")
    .ilike("email", SUPPORT_EMAIL)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const userId = String(data.user_id || "");
  if (!userId || userId === user.id) return null;
  return {
    userId,
    username: toUsername(data),
    role: data.role ?? null,
    isSupport: true,
  };
}

export async function listPublicMessages(
  limit = 300,
  accessToken?: string,
): Promise<CommunityMessage[]> {
  const data = await invokeCommunityRead<{ messages: CommunityMessage[] }>(
    { action: "listPublic", limit },
    accessToken,
  );
  return data.messages || [];
}

export async function sendPublicMessage(input: {
  content: string;
  file: File | null;
}): Promise<void> {
  const { supabase, user } = await ensureAuthUser();
  const text = String(input.content || "").trim();
  const file = input.file;
  if (!text && !file) throw new Error("Message vide.");
  const authorDisplayName = await getAuthorDisplayName(supabase, user);
  const attachment = file ? await uploadAttachment(file, user.id) : null;
  const { error } = await supabase.from("community_public_messages").insert({
    user_id: user.id,
    author_display_name: authorDisplayName,
    content: text,
    attachment_url: attachment?.url || null,
    attachment_type: attachment?.mimeType || null,
    attachment_size: attachment?.sizeBytes || null,
    attachment_name: attachment?.fileName || null,
  });
  if (error) throw new Error(error.message);
}

export async function deletePublicMessage(messageId: string): Promise<void> {
  if (messageId.startsWith("temp-")) return;
  const { supabase } = await ensureAuthUser();
  const { data, error } = await supabase.rpc("community_delete_own_public_message", {
    p_message_id: messageId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Message introuvable ou déjà supprimé.");
}

async function findOrCreateDirectConversation(otherUserId: string): Promise<string> {
  const { supabase, user } = await ensureAuthUser();
  const { data: rowAb, error: errAb } = await supabase
    .from("community_private_conversations")
    .select("id")
    .eq("kind", "direct")
    .eq("user_a", user.id)
    .eq("user_b", otherUserId)
    .limit(1)
    .maybeSingle();
  if (errAb) throw new Error(errAb.message);
  const { data: rowBa, error: errBa } = await supabase
    .from("community_private_conversations")
    .select("id")
    .eq("kind", "direct")
    .eq("user_a", otherUserId)
    .eq("user_b", user.id)
    .limit(1)
    .maybeSingle();
  if (errBa) throw new Error(errBa.message);
  const existingId = rowAb?.id ? String(rowAb.id) : rowBa?.id ? String(rowBa.id) : null;
  if (existingId) {
    const { error: unhideErr } = await supabase
      .from("community_private_hidden")
      .delete()
      .eq("conversation_id", existingId)
      .eq("user_id", user.id);
    if (unhideErr) throw new Error(unhideErr.message);
    return existingId;
  }
  const { data: created, error: createErr } = await supabase
    .from("community_private_conversations")
    .insert({ kind: "direct", user_a: user.id, user_b: otherUserId })
    .select("id")
    .single();
  if (createErr) throw new Error(createErr.message);
  const conversationId = String(created.id);
  const { error: partErr } = await supabase.from("community_private_participants").insert([
    { conversation_id: conversationId, user_id: user.id },
    { conversation_id: conversationId, user_id: otherUserId },
  ]);
  if (partErr) throw new Error(partErr.message);
  const { error: unhideErr } = await supabase
    .from("community_private_hidden")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (unhideErr) throw new Error(unhideErr.message);
  return conversationId;
}

export async function listPrivateConversations(
  accessToken?: string,
): Promise<CommunityConversation[]> {
  const data = await invokeCommunityRead<{ conversations: CommunityConversation[] }>(
    { action: "listConversations" },
    accessToken,
  );
  return data.conversations || [];
}

export async function startPrivateConversation(otherUserId: string): Promise<string> {
  return findOrCreateDirectConversation(otherUserId);
}

export async function listPrivateMessages(
  conversationId: string,
  accessToken?: string,
): Promise<CommunityMessage[]> {
  const data = await invokeCommunityRead<{ messages: CommunityMessage[] }>(
    { action: "listPrivate", conversationId },
    accessToken,
  );
  return (data.messages || []).map((message) =>
    enrichCommunityMessage({
      ...message,
      conversationId,
    }),
  );
}

export async function prefetchPrivateMessagesForConversation(
  conversationId: string,
  accessToken?: string,
): Promise<CommunityMessage[]> {
  const id = String(conversationId || "").trim();
  if (!id) return [];
  return prefetchPrivateMessagesCache(id, () => listPrivateMessages(id, accessToken));
}

export async function submitOnboardingQuickReply(input: {
  conversationId: string;
  messageId: string;
  label: string;
}): Promise<void> {
  const auth = await ensureAuthSession();
  const messageId = String(input.messageId || "").trim();
  const conversationId = String(input.conversationId || "").trim();
  const label = String(input.label || "").trim();
  if (!messageId || !conversationId || !label) {
    throw new Error("Paramètres manquants.");
  }

  const invokeOnce = async (token: string) =>
    auth.supabase.functions.invoke("onboarding-private-quick-reply", {
      body: {
        accessToken: token,
        messageId,
        conversationId,
        label,
      },
    });

  let { data, error } = await invokeOnce(auth.accessToken);

  if (error) {
    const detail = await parseInvokeErrorMessage(error);
    const unauthorized =
      detail?.toLowerCase().includes("non autorisé") ||
      detail?.toLowerCase().includes("autorisé");

    if (unauthorized) {
      const { data: refreshed } = await auth.supabase.auth.refreshSession();
      const retryToken = refreshed.session?.access_token;
      if (retryToken) {
        ({ data, error } = await invokeOnce(retryToken));
      }
    }
  }

  if (error) {
    const detail = await parseInvokeErrorMessage(error);
    throw new Error(detail || error.message || "Impossible d'enregistrer la réponse rapide.");
  }
  if (data?.error) throw new Error(String(data.error));
  if (data?.ok === false) throw new Error(String(data.error || "Réponse rapide refusée."));
}

export async function sendPrivateMessage(input: {
  conversationId: string;
  content: string;
  file: File | null;
  responseMethod?: "button" | "text";
}): Promise<void> {
  const { supabase, user } = await ensureAuthUser();
  const text = String(input.content || "").trim();
  if (!text && !input.file) throw new Error("Message vide.");
  const attachment = input.file ? await uploadAttachment(input.file, user.id) : null;
  const now = new Date().toISOString();

  const responseMethod =
    input.responseMethod === "button" || input.responseMethod === "text"
      ? input.responseMethod
      : null;

  const { error } = await supabase.from("community_private_messages").insert({
    conversation_id: input.conversationId,
    user_id: user.id,
    content: text,
    response_method: responseMethod,
    attachment_url: attachment?.url || null,
    attachment_type: attachment?.mimeType || null,
    attachment_size: attachment?.sizeBytes || null,
    attachment_name: attachment?.fileName || null,
  });
  if (error) throw new Error(error.message);

  await Promise.all([
    supabase.from("community_private_conversations").update({ updated_at: now }).eq("id", input.conversationId),
    supabase
      .from("community_private_hidden")
      .delete()
      .eq("conversation_id", input.conversationId)
      .eq("user_id", user.id),
  ]);
}

export async function deletePrivateMessage(messageId: string): Promise<void> {
  if (messageId.startsWith("temp-") || messageId.startsWith("onboarding-answer-")) return;
  const { supabase } = await ensureAuthUser();
  const { data, error } = await supabase.rpc("community_delete_own_private_message", {
    p_message_id: messageId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Message introuvable ou déjà supprimé.");
}

/** Compte les messages privés reçus (auteur ≠ moi) non couverts par last_read_at du participant. */
export async function countUnreadPrivateMessages(): Promise<number> {
  const status = await getPrivateUnreadStatus();
  return status.count;
}

function parseUnreadPreview(raw: unknown): UnreadPrivatePreview | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const messageId = String(row.message_id || "").trim();
  if (!messageId) return null;
  return {
    messageId,
    conversationId: String(row.conversation_id || ""),
    senderUserId: String(row.sender_user_id || ""),
    senderName: String(row.sender_name || "Utilisateur"),
    isSupport: row.is_support === true,
    contentPreview: String(row.content_preview || ""),
    createdAt: String(row.created_at || ""),
  };
}

/** Compteur + aperçu du dernier message privé non lu (header / toast). Exclut les conversations en mute. */
export async function getPrivateUnreadStatus(): Promise<PrivateUnreadStatus> {
  const { supabase } = await ensureAuthUser();
  const { data, error } = await supabase.rpc("community_private_unread_status");
  if (error) {
    const { data: countData, error: countError } = await supabase.rpc(
      "community_unread_private_message_count",
    );
    if (countError) throw new Error(error.message);
    const count = typeof countData === "number" ? countData : Number(countData ?? 0);
    return {
      count: Number.isFinite(count) ? count : 0,
      preview: null,
    };
  }

  const payload =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};

  const countRaw = payload.count;
  const count =
    typeof countRaw === "number"
      ? countRaw
      : Number(countRaw ?? 0);

  return {
    count: Number.isFinite(count) ? count : 0,
    preview: parseUnreadPreview(payload.preview),
  };
}

function parseInboxMetaRow(raw: unknown): ConversationInboxMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const conversationId = String(row.conversation_id || "").trim();
  if (!conversationId) return null;
  const unreadRaw = row.unread_count;
  const unreadCount =
    typeof unreadRaw === "number" ? unreadRaw : Number(unreadRaw ?? 0);
  return {
    conversationId,
    unreadCount: Number.isFinite(unreadCount) ? Math.max(0, unreadCount) : 0,
    notificationsMuted: row.notifications_muted === true,
  };
}

function normalizeInboxMetaPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Non-lus et mute par conversation (badges dans la liste). */
export async function getPrivateInboxMeta(): Promise<ConversationInboxMeta[]> {
  const { supabase } = await ensureAuthUser();
  const { data, error } = await supabase.rpc("community_private_inbox_meta");
  if (error) throw new Error(error.message);
  return normalizeInboxMetaPayload(data)
    .map(parseInboxMetaRow)
    .filter((row): row is ConversationInboxMeta => Boolean(row));
}

export function mergeInboxMetaIntoConversations(
  conversations: CommunityConversation[],
  inboxMeta: ConversationInboxMeta[],
  muteOverrides: Record<string, boolean> = {},
): CommunityConversation[] {
  const metaById = new Map(inboxMeta.map((row) => [row.conversationId, row]));
  return conversations.map((conversation) => {
    const meta = metaById.get(conversation.id);
    const hasOverride = Object.prototype.hasOwnProperty.call(muteOverrides, conversation.id);
    const notificationsMuted = hasOverride
      ? muteOverrides[conversation.id] === true
      : meta !== undefined
        ? meta.notificationsMuted
        : Boolean(conversation.notificationsMuted);
    const unreadCount =
      meta !== undefined ? meta.unreadCount : Number(conversation.unreadCount || 0);

    if (!meta && !hasOverride && conversation.unreadCount == null && !conversation.notificationsMuted) {
      return conversation;
    }

    return {
      ...conversation,
      unreadCount,
      notificationsMuted,
    };
  });
}

export async function setConversationNotificationsMuted(
  conversationId: string,
  muted: boolean,
): Promise<boolean> {
  const { supabase, user } = await ensureAuthUser();
  const id = String(conversationId || "").trim();
  if (!id) throw new Error("Conversation introuvable.");
  const { data, error } = await supabase
    .from("community_private_participants")
    .update({ notifications_muted: muted === true })
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .select("notifications_muted")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("Conversation introuvable ou accès refusé.");
  }
  return data.notifications_muted === true;
}

/** Déclenche le message de bienvenue support si pas encore envoyé (idempotent, côté client après connexion). */
export async function ensureWelcomePrivateMessage(): Promise<EnsureWelcomePrivateMessageResult> {
  const auth = await ensureAuthSession();
  const { data, error } = await auth.supabase.functions.invoke("ensure-welcome-private-message", {
    body: { accessToken: auth.accessToken },
  });
  if (error) {
    console.warn("[ensureWelcomePrivateMessage]", error.message);
    return { ok: false, reason: error.message, preview: null };
  }

  const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const ok = payload?.ok === true;
  return {
    ok,
    skipped: payload?.skipped === true,
    reason: typeof payload?.reason === "string" ? payload.reason : undefined,
    preview: ok ? buildWelcomePreviewFromEnsureResult(payload) : null,
  };
}

/** Met à jour last_read_at pour la conversation active (marquer comme lu jusqu’à maintenant). */
export async function markConversationRead(conversationId: string): Promise<void> {
  const { supabase, user } = await ensureAuthUser();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("community_private_participants")
    .update({ last_read_at: now })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

/** Marque toutes les conversations privées comme lues (legacy — éviter pour l’UX inbox). */
export async function markAllPrivateConversationsRead(): Promise<void> {
  const { supabase, user } = await ensureAuthUser();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("community_private_participants")
    .update({ last_read_at: now })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

/** Indique s’il existe au moins un message public postérieur au timestamp (ISO). Si sinceIso est null, tout message existant compte comme « nouveau ». */
export async function hasNewPublicMessageSince(sinceIso: string | null): Promise<boolean> {
  const { supabase } = await ensureAuthUser();
  const { data, error } = await supabase.rpc("community_has_new_public_message_since", {
    p_since: sinceIso?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function hideConversationForMe(conversationId: string): Promise<void> {
  const { supabase, user } = await ensureAuthUser();
  const { data: conv, error: convErr } = await supabase
    .from("community_private_conversations")
    .select("id, user_a, user_b")
    .eq("id", conversationId)
    .limit(1)
    .maybeSingle();
  if (convErr) throw new Error(convErr.message);
  if (conv) {
    const otherId = String(conv.user_a) === user.id ? String(conv.user_b) : String(conv.user_a);
    const { data: otherProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", otherId)
      .limit(1)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    if (String(otherProfile?.email || "").toLowerCase() === SUPPORT_EMAIL) {
      throw new Error("La conversation Support officiel ne peut pas être supprimée.");
    }
  }
  const { error: delErr } = await supabase
    .from("community_private_hidden")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (delErr) throw new Error(delErr.message);
  const { error } = await supabase.from("community_private_hidden").insert({
    conversation_id: conversationId,
    user_id: user.id,
    hidden_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function getProfilePreferredLocale(): Promise<CommunityLocale> {
  const { user } = await ensureAuthUser();
  const profile = await getUserProfile(user.id);
  const raw = String(profile?.preferred_locale || "fr").toLowerCase();
  if (raw === "en" || raw === "es") return raw;
  return "fr";
}

export async function updateProfilePreferredLocale(locale: CommunityLocale): Promise<void> {
  const { supabase, user } = await ensureAuthUser();
  const { error } = await supabase
    .from("profiles")
    .update({ preferred_locale: locale })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function getCachedCommunityMessageTranslation(input: {
  messageId: string;
  messageScope: CommunityMessageScope;
  targetLang: CommunityLocale;
}): Promise<string | null> {
  const memory = getMemoryCachedTranslation(input.messageId, input.messageScope, input.targetLang);
  if (memory) return memory;
  return null;
}

export async function listCachedCommunityMessageTranslations(input: {
  messageIds: string[];
  messageScope: CommunityMessageScope;
  targetLang: CommunityLocale;
}): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const messageId of input.messageIds) {
    const memory = getMemoryCachedTranslation(messageId, input.messageScope, input.targetLang);
    if (memory) result[messageId] = memory;
  }
  return result;
}

export async function resolveCommunityMessageTranslations(input: {
  messages: Array<{ id: string; content: string }>;
  messageScope: CommunityMessageScope;
  conversationId?: string | null;
  targetLang: CommunityLocale;
}): Promise<Record<string, string>> {
  if (input.targetLang === "fr") return {};

  const result: Record<string, string> = {};
  const pending: Array<{ id: string; content: string }> = [];

  for (const message of input.messages) {
    const content = String(message.content || "").trim();
    if (!content) continue;

    const memory = getMemoryCachedTranslation(message.id, input.messageScope, input.targetLang);
    if (memory) {
      result[message.id] = memory;
      continue;
    }
    pending.push({ id: message.id, content });
  }

  if (!pending.length) return result;

  const cached = await listCachedCommunityMessageTranslations({
    messageIds: pending.map((m) => m.id),
    messageScope: input.messageScope,
    targetLang: input.targetLang,
  });
  Object.assign(result, cached);

  const toTranslate = pending.filter((message) => !result[message.id]);
  await mapWithConcurrency(toTranslate, TRANSLATION_FETCH_CONCURRENCY, async (message) => {
    try {
      const translated = await translateCommunityMessage({
        messageId: message.id,
        messageScope: input.messageScope,
        conversationId: input.messageScope === "private" ? input.conversationId : null,
        targetLang: input.targetLang,
      });
      result[message.id] = translated;
    } catch {
      // Garder l'original censuré si une traduction échoue.
    }
  });

  return result;
}

export async function translateCommunityMessage(input: {
  messageId: string;
  messageScope: CommunityMessageScope;
  conversationId?: string | null;
  targetLang: CommunityLocale;
  accessToken?: string;
}): Promise<string> {
  const cached = await getCachedCommunityMessageTranslation({
    messageId: input.messageId,
    messageScope: input.messageScope,
    targetLang: input.targetLang,
  });
  if (cached) return cached;

  const auth = await ensureAuthSession();
  const token = auth.accessToken;

  const invokeOnce = async (accessToken: string) =>
    auth.supabase.functions.invoke("translate-community-message", {
      body: {
        messageId: input.messageId,
        messageScope: input.messageScope,
        conversationId: input.messageScope === "private" ? input.conversationId : null,
        targetLang: input.targetLang,
        accessToken,
      },
    });

  let { data, error } = await invokeOnce(token);

  if (error) throw new Error(error.message || "Traduction impossible.");
  if (data?.error) throw new Error(String(data.error));
  const translated = String(data?.translatedText || "").trim();
  if (!translated) throw new Error("Traduction vide.");
  rememberTranslation(input.messageId, input.messageScope, input.targetLang, translated);
  return translated;
}

/** Contenu brut d'un message — réservé aux admins (signalement / litige). */
export async function getCommunityMessageRawAdmin(input: {
  messageId: string;
  messageScope: CommunityMessageScope;
  conversationId?: string | null;
}): Promise<string> {
  const { supabase } = await ensureAuthUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Utilisateur non connecté.");

  const { data, error } = await supabase.functions.invoke("admin-get-community-message-raw", {
    body: {
      messageId: input.messageId,
      messageScope: input.messageScope,
      conversationId: input.messageScope === "private" ? input.conversationId : null,
    },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) throw new Error(error.message || "Impossible de lire le message brut.");
  if (data?.error) throw new Error(String(data.error));
  return String(data?.message?.content || "");
}
