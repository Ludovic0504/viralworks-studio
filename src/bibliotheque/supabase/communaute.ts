import { getBrowserSupabase } from "./client-navigateur";

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
};

export type CommunityConversation = {
  id: string;
  otherUserId: string;
  otherUsername: string;
  updatedAt: string;
  lastMessage: string;
  lastMessageAt: string;
  isSupport?: boolean;
};

const COMMUNITY_MEDIA_BUCKET = "community-media";
const SUPPORT_EMAIL = "jean.limonta06@gmail.com";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

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

async function ensureAuthUser() {
  const supabase = getBrowserSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Utilisateur non connecté.");
  return { supabase, user };
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
  const { supabase, user } = await ensureAuthUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name, first_name, last_name, email, role")
    .neq("user_id", user.id)
    .limit(200);
  if (error) throw new Error(error.message);
  const q = search.trim().toLowerCase();
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
    .filter((u) => (q ? u.username.toLowerCase().includes(q) : true))
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

export async function listPublicMessages(limit = 300): Promise<CommunityMessage[]> {
  const { supabase } = await ensureAuthUser();
  const { data, error } = await supabase
    .from("community_public_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  const userIds = [
    ...new Set(
      (data || [])
        .map((m) => (m.user_id != null ? String(m.user_id) : ""))
        .filter(Boolean)
    ),
  ];
  const users = await loadProfilesMap(userIds);
  return (data || []).map((row) => {
    const uid = row.user_id != null ? String(row.user_id) : "";
    const snapshot = String(row.author_display_name || "").trim();
    const fromProfile = uid ? users.get(uid)?.username : undefined;
    const username = fromProfile || snapshot || (uid ? "Utilisateur" : "Ancien membre");
    return {
      id: String(row.id),
      userId: uid,
      username,
      content: String(row.content || ""),
      createdAt: String(row.created_at || ""),
      attachment: toAttachment(row),
      isSupport: uid ? users.get(uid)?.isSupport === true : false,
    };
  });
}

export async function sendPublicMessage(input: {
  content: string;
  file: File | null;
}): Promise<void> {
  const { supabase, user } = await ensureAuthUser();
  const text = String(input.content || "").trim();
  const file = input.file;
  if (!text && !file) throw new Error("Message vide.");
  const { data: prof } = await supabase
    .from("profiles")
    .select("full_name, first_name, last_name, email")
    .eq("user_id", user.id)
    .maybeSingle();
  const authorDisplayName = prof ? toUsername(prof) : user.email ? String(user.email).split("@")[0] : "Membre";
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
  const { supabase, user } = await ensureAuthUser();
  const { error } = await supabase
    .from("community_public_messages")
    .delete()
    .eq("id", messageId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
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

export async function listPrivateConversations(): Promise<CommunityConversation[]> {
  const { supabase, user } = await ensureAuthUser();
  const isSupportViewer = String(user.email || "").toLowerCase() === SUPPORT_EMAIL;
  const { data: hiddenRows } = await supabase
    .from("community_private_hidden")
    .select("conversation_id")
    .eq("user_id", user.id);
  const hidden = new Set((hiddenRows || []).map((r) => String(r.conversation_id)));
  const { data: convRows, error: convErr } = await supabase
    .from("community_private_conversations")
    .select("id, kind, updated_at, user_a, user_b")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order("updated_at", { ascending: false });
  if (convErr) throw new Error(convErr.message);
  const visibleConvs = (convRows || []).filter((c) => !hidden.has(String(c.id)));
  const ids = visibleConvs.map((c) => String(c.id));
  if (!ids.length) return [];
  const userIds = [
    ...new Set(
      visibleConvs
        .flatMap((c) => [String(c.user_a || ""), String(c.user_b || "")])
        .filter(Boolean)
    ),
  ];
  const users = await loadProfilesMap(userIds);
  const { data: msgRows } = await supabase
    .from("community_private_messages")
    .select("conversation_id, user_id, content, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false });
  const lastByConv = new Map<string, { content: string; createdAt: string }>();
  const hasIncomingByConv = new Map<string, boolean>();
  for (const row of msgRows || []) {
    const id = String(row.conversation_id);
    if (!lastByConv.has(id)) {
      lastByConv.set(id, {
        content: String(row.content || ""),
        createdAt: String(row.created_at || ""),
      });
    }
    if (!hasIncomingByConv.has(id)) {
      hasIncomingByConv.set(id, false);
    }
    if (String(row.user_id || "") !== user.id) {
      hasIncomingByConv.set(id, true);
    }
  }
  const rows = visibleConvs.map((conv) => {
    const convId = String(conv.id);
    const userA = String(conv.user_a || "");
    const userB = String(conv.user_b || "");
    const otherId = userA === user.id ? userB : userA;
    const other = users.get(otherId);
    const last = lastByConv.get(convId);
    return {
      id: convId,
      otherUserId: otherId,
      otherUsername: other?.username || "Utilisateur",
      updatedAt: String(conv.updated_at || ""),
      lastMessage: last?.content || "",
      lastMessageAt: last?.createdAt || "",
      isSupport: other?.isSupport === true,
    };
  });
  const rowsVisibleForViewer = isSupportViewer
    ? rows.filter((row) => hasIncomingByConv.get(String(row.id)) === true)
    : rows;
  // Garder une seule conversation visible par interlocuteur (évite les doublons "Support").
  const dedupByOther = new Map<string, CommunityConversation>();
  for (const row of rowsVisibleForViewer) {
    const key = String(row.otherUserId || "");
    const existing = dedupByOther.get(key);
    if (!existing) {
      dedupByOther.set(key, row);
      continue;
    }
    if (String(row.updatedAt || "").localeCompare(String(existing.updatedAt || "")) > 0) {
      dedupByOther.set(key, row);
    }
  }
  return [...dedupByOther.values()].sort((a, b) => {
    if (a.isSupport && !b.isSupport) return -1;
    if (!a.isSupport && b.isSupport) return 1;
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });
}

export async function startPrivateConversation(otherUserId: string): Promise<string> {
  return findOrCreateDirectConversation(otherUserId);
}

export async function listPrivateMessages(conversationId: string): Promise<CommunityMessage[]> {
  const { supabase } = await ensureAuthUser();
  const { data, error } = await supabase
    .from("community_private_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const userIds = [...new Set((data || []).map((m) => String(m.user_id)))];
  const users = await loadProfilesMap(userIds);
  return (data || []).map((row) => ({
    id: String(row.id),
    conversationId: String(row.conversation_id),
    userId: String(row.user_id),
    username: users.get(String(row.user_id))?.username || "Utilisateur",
    content: String(row.content || ""),
    createdAt: String(row.created_at || ""),
    attachment: toAttachment(row),
    isSupport: users.get(String(row.user_id))?.isSupport === true,
  }));
}

export async function sendPrivateMessage(input: {
  conversationId: string;
  content: string;
  file: File | null;
}): Promise<void> {
  const { supabase, user } = await ensureAuthUser();
  const text = String(input.content || "").trim();
  if (!text && !input.file) throw new Error("Message vide.");
  const attachment = input.file ? await uploadAttachment(input.file, user.id) : null;
  const { error } = await supabase.from("community_private_messages").insert({
    conversation_id: input.conversationId,
    user_id: user.id,
    content: text,
    attachment_url: attachment?.url || null,
    attachment_type: attachment?.mimeType || null,
    attachment_size: attachment?.sizeBytes || null,
    attachment_name: attachment?.fileName || null,
  });
  if (error) throw new Error(error.message);
  await supabase
    .from("community_private_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.conversationId);
  await supabase
    .from("community_private_hidden")
    .delete()
    .eq("conversation_id", input.conversationId)
    .eq("user_id", user.id);
}

export async function deletePrivateMessage(messageId: string): Promise<void> {
  const { supabase, user } = await ensureAuthUser();
  const { error } = await supabase
    .from("community_private_messages")
    .delete()
    .eq("id", messageId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
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
