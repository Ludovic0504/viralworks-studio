import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const COMMUNITY_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const SUPPORT_EMAIL = "jean.limonta06@gmail.com";

export type AuthedClients = {
  userId: string;
  userEmail: string | null;
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
};

export async function getAuthedClients(
  req: Request,
  accessToken?: string | null,
): Promise<AuthedClients> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Response(JSON.stringify({ error: "Configuration serveur incomplète." }), {
      status: 500,
      headers: { ...COMMUNITY_CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const headerAuth = (req.headers.get("Authorization") ?? "").trim();
  const tokenFromHeader = headerAuth.replace(/^Bearer\s+/i, "").trim();
  const looksLikeUserJwt =
    Boolean(tokenFromHeader) &&
    tokenFromHeader !== supabaseAnonKey &&
    tokenFromHeader.split(".").length === 3;

  const userToken = String(accessToken ?? "").trim() || (looksLikeUserJwt ? tokenFromHeader : "");

  if (!userToken) {
    throw new Response(JSON.stringify({ error: "Non autorisé." }), {
      status: 401,
      headers: { ...COMMUNITY_CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const authHeader = `Bearer ${userToken}`;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    throw new Response(JSON.stringify({ error: "Non autorisé." }), {
      status: 401,
      headers: { ...COMMUNITY_CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    userId: user.id,
    userEmail: user.email ?? null,
    userClient,
    adminClient,
  };
}

export async function assertIsAdmin(userClient: SupabaseClient, userId: string): Promise<void> {
  const { data: profile, error } = await userClient
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || String(profile?.role || "").toLowerCase() !== "admin") {
    throw new Response(JSON.stringify({ error: "Accès admin requis." }), {
      status: 403,
      headers: { ...COMMUNITY_CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...COMMUNITY_CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export function toUsername(row: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): string {
  const raw =
    row.full_name ||
    [row.first_name, row.last_name].filter(Boolean).join(" ") ||
    row.first_name ||
    (row.email ? String(row.email).split("@")[0] : "");
  const value = String(raw || "").trim();
  return value || "Utilisateur";
}

export type ProfileInfo = {
  userId: string;
  username: string;
  role: string | null;
  isSupport: boolean;
};

export async function loadProfilesMap(
  adminClient: SupabaseClient,
  userIds: string[],
): Promise<Map<string, ProfileInfo>> {
  const map = new Map<string, ProfileInfo>();
  if (!userIds.length) return map;

  const { data } = await adminClient
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

export type MessageRow = {
  id: string;
  user_id: string | null;
  conversation_id?: string | null;
  content: string;
  created_at: string;
  author_display_name?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
  attachment_name?: string | null;
  quick_reply_options?: string[] | null;
  quick_replies_closed_at?: string | null;
  quick_reply_selected?: string | null;
  response_method?: string | null;
  onboarding_step?: number | null;
};

export type CommunityMessageDto = {
  id: string;
  conversationId?: string | null;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
  attachment: {
    url: string;
    mimeType: string;
    sizeBytes: number;
    fileName: string;
    authorId: string;
    createdAt: string;
  } | null;
  isSupport?: boolean;
  quickReplyOptions?: string[];
  quickRepliesClosedAt?: string | null;
  quickReplySelected?: string | null;
  responseMethod?: "button" | "text" | null;
  onboardingStep?: number | null;
};

export function toAttachment(row: MessageRow): CommunityMessageDto["attachment"] {
  if (!row.attachment_url) return null;
  return {
    url: String(row.attachment_url),
    mimeType: String(row.attachment_type || ""),
    sizeBytes: Number(row.attachment_size || 0),
    fileName: String(row.attachment_name || ""),
    authorId: String(row.user_id || ""),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

export function mapMessageRow(
  row: MessageRow,
  profiles: Map<string, ProfileInfo>,
  censoredContent: string,
): CommunityMessageDto {
  const uid = row.user_id != null ? String(row.user_id) : "";
  const snapshot = String(row.author_display_name || "").trim();
  const fromProfile = uid ? profiles.get(uid)?.username : undefined;
  const username = fromProfile || snapshot || (uid ? "Utilisateur" : "Ancien membre");

  const quickReplyOptions = Array.isArray(row.quick_reply_options)
    ? row.quick_reply_options.map((label) => String(label)).filter(Boolean)
    : undefined;

  const responseMethod =
    row.response_method === "button" || row.response_method === "text"
      ? row.response_method
      : null;

  return {
    id: String(row.id),
    conversationId: row.conversation_id != null ? String(row.conversation_id) : null,
    userId: uid,
    username,
    content: censoredContent,
    createdAt: String(row.created_at || ""),
    attachment: toAttachment(row),
    isSupport: uid ? profiles.get(uid)?.isSupport === true : false,
    quickReplyOptions: quickReplyOptions?.length ? quickReplyOptions : undefined,
    quickRepliesClosedAt: row.quick_replies_closed_at ?? null,
    quickReplySelected: row.quick_reply_selected ?? null,
    responseMethod,
    onboardingStep: row.onboarding_step ?? null,
  };
}
