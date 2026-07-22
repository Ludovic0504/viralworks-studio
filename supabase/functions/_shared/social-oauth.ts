/** OAuth linking helpers — Instagram / Facebook / TikTok / YouTube */

export type SocialProvider = "instagram" | "facebook" | "tiktok" | "youtube";

export const SOCIAL_PROVIDERS: SocialProvider[] = [
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
];

export function isSocialProvider(value: unknown): value is SocialProvider {
  return typeof value === "string" && SOCIAL_PROVIDERS.includes(value as SocialProvider);
}

export type OAuthStatePayload = {
  uid: string;
  provider: SocialProvider;
  nonce: string;
  exp: number;
  return_origin: string;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textToBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, textToBytes(message));
  return bytesToBase64Url(new Uint8Array(sig));
}

async function hmacVerify(secret: string, message: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(secret, message);
  if (expected.length !== signature.length) return false;
  let ok = 0;
  for (let i = 0; i < expected.length; i++) {
    ok |= expected.charCodeAt(i)! ^ signature.charCodeAt(i)!;
  }
  return ok === 0;
}

export function getStateSecret(): string {
  return (
    Deno.env.get("SOCIAL_OAUTH_STATE_SECRET")?.trim() ||
    Deno.env.get("SERVICE_ROLE_KEY")?.trim() ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
    ""
  );
}

export async function signOAuthState(payload: OAuthStatePayload, secret: string): Promise<string> {
  const body = bytesToBase64Url(textToBytes(JSON.stringify(payload)));
  const sig = await hmacSign(secret, body);
  return `${body}.${sig}`;
}

export async function verifyOAuthState(
  state: string,
  secret: string,
): Promise<OAuthStatePayload | null> {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const valid = await hmacVerify(secret, body, sig);
  if (!valid) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as OAuthStatePayload;
    if (!json?.uid || !isSocialProvider(json.provider) || !json.exp || !json.return_origin) {
      return null;
    }
    if (Date.now() > json.exp) return null;
    return json;
  } catch {
    return null;
  }
}

export function getCallbackRedirectUri(): string {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  if (!supabaseUrl) throw new Error("SUPABASE_URL manquant");
  return `${supabaseUrl}/functions/v1/social-oauth-callback`;
}

export function providerConfigured(provider: SocialProvider): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (provider === "facebook") {
    if (!Deno.env.get("META_APP_ID")?.trim()) missing.push("META_APP_ID");
    if (!Deno.env.get("META_APP_SECRET")?.trim()) missing.push("META_APP_SECRET");
  } else if (provider === "instagram") {
    // Instagram Login uses Instagram App ID/Secret (fallback Meta app credentials).
    const igId = Deno.env.get("INSTAGRAM_APP_ID")?.trim() || Deno.env.get("META_APP_ID")?.trim();
    const igSecret =
      Deno.env.get("INSTAGRAM_APP_SECRET")?.trim() || Deno.env.get("META_APP_SECRET")?.trim();
    if (!igId) missing.push("INSTAGRAM_APP_ID");
    if (!igSecret) missing.push("INSTAGRAM_APP_SECRET");
  } else if (provider === "tiktok") {
    if (!Deno.env.get("TIKTOK_CLIENT_KEY")?.trim()) missing.push("TIKTOK_CLIENT_KEY");
    if (!Deno.env.get("TIKTOK_CLIENT_SECRET")?.trim()) missing.push("TIKTOK_CLIENT_SECRET");
  } else if (provider === "youtube") {
    if (!Deno.env.get("YOUTUBE_CLIENT_ID")?.trim()) missing.push("YOUTUBE_CLIENT_ID");
    if (!Deno.env.get("YOUTUBE_CLIENT_SECRET")?.trim()) missing.push("YOUTUBE_CLIENT_SECRET");
  }
  return { ok: missing.length === 0, missing };
}

function getInstagramAppCredentials(): { clientId: string; clientSecret: string } {
  const clientId =
    Deno.env.get("INSTAGRAM_APP_ID")?.trim() || Deno.env.get("META_APP_ID")?.trim() || "";
  const clientSecret =
    Deno.env.get("INSTAGRAM_APP_SECRET")?.trim() || Deno.env.get("META_APP_SECRET")?.trim() || "";
  return { clientId, clientSecret };
}

export function buildAuthorizeUrl(provider: SocialProvider, state: string): string {
  const redirectUri = getCallbackRedirectUri();

  if (provider === "instagram") {
    // Business Login for Instagram (no Facebook Page required)
    const { clientId } = getInstagramAppCredentials();
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "instagram_business_basic");
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (provider === "facebook") {
    const clientId = Deno.env.get("META_APP_ID")!.trim();
    const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "public_profile");
    return url.toString();
  }

  if (provider === "tiktok") {
    const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY")!.trim();
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", clientKey);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "user.info.basic");
    url.searchParams.set("state", state);
    return url.toString();
  }

  // youtube
  const clientId = Deno.env.get("YOUTUBE_CLIENT_ID")!.trim();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    [
      "openid",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" "),
  );
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export type UpsertConnection = {
  user_id: string;
  provider: SocialProvider;
  provider_user_id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  scopes?: string[] | null;
  metadata?: Record<string, unknown>;
};

export async function exchangeCodeForConnection(
  provider: SocialProvider,
  code: string,
): Promise<UpsertConnection> {
  const redirectUri = getCallbackRedirectUri();

  if (provider === "instagram") {
    return exchangeInstagramLogin(code, redirectUri);
  }
  if (provider === "facebook") {
    return exchangeMeta("facebook", code, redirectUri);
  }
  if (provider === "tiktok") {
    return exchangeTikTok(code, redirectUri);
  }
  return exchangeYouTube(code, redirectUri);
}

async function exchangeInstagramLogin(
  code: string,
  redirectUri: string,
): Promise<Omit<UpsertConnection, "user_id">> {
  const { clientId, clientSecret } = getInstagramAppCredentials();
  if (!clientId || !clientSecret) {
    throw new Error("INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET manquants");
  }

  // Strip trailing #_ that Instagram sometimes appends to the code
  const cleanCode = code.replace(/#_$/, "").trim();

  const body = new FormData();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", redirectUri);
  body.set("code", cleanCode);

  const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body,
  });
  const tokenJson = await tokenRes.json();
  const shortLived =
    tokenJson?.access_token ||
    (Array.isArray(tokenJson?.data) ? tokenJson.data[0]?.access_token : null);
  const userId =
    tokenJson?.user_id ||
    (Array.isArray(tokenJson?.data) ? tokenJson.data[0]?.user_id : null);

  if (!tokenRes.ok || !shortLived) {
    throw new Error(
      tokenJson?.error_message ||
        tokenJson?.error?.message ||
        "Échec échange token Instagram",
    );
  }

  let accessToken = String(shortLived);
  let expiresAt: string | null = null;

  const llUrl = new URL("https://graph.instagram.com/access_token");
  llUrl.searchParams.set("grant_type", "ig_exchange_token");
  llUrl.searchParams.set("client_secret", clientSecret);
  llUrl.searchParams.set("access_token", accessToken);
  const llRes = await fetch(llUrl.toString());
  const llJson = await llRes.json();
  if (llRes.ok && llJson.access_token) {
    accessToken = String(llJson.access_token);
    if (typeof llJson.expires_in === "number") {
      expiresAt = new Date(Date.now() + llJson.expires_in * 1000).toISOString();
    }
  }

  const meRes = await fetch(
    `https://graph.instagram.com/v21.0/me?fields=user_id,username,name,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`,
  );
  const me = await meRes.json();
  if (!meRes.ok || !(me.user_id || me.id || userId)) {
    throw new Error(me.error?.message || "Impossible de lire le profil Instagram");
  }

  const igUserId = String(me.user_id || me.id || userId);

  return {
    provider: "instagram",
    provider_user_id: igUserId,
    username: typeof me.username === "string" ? me.username : null,
    display_name: typeof me.name === "string" ? me.name : me.username ?? null,
    avatar_url: typeof me.profile_picture_url === "string" ? me.profile_picture_url : null,
    access_token: accessToken,
    refresh_token: null,
    token_expires_at: expiresAt,
    scopes: ["instagram_business_basic"],
    metadata: { auth: "instagram_login", instagram_user_id: igUserId },
  };
}

async function exchangeMeta(
  provider: SocialProvider,
  code: string,
  redirectUri: string,
): Promise<Omit<UpsertConnection, "user_id">> {
  const clientId = Deno.env.get("META_APP_ID")!.trim();
  const clientSecret = Deno.env.get("META_APP_SECRET")!.trim();

  const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error?.message || "Échec échange token Meta");
  }

  let accessToken = String(tokenJson.access_token);
  let expiresAt: string | null =
    typeof tokenJson.expires_in === "number"
      ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
      : null;

  // Long-lived user token
  const llUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  llUrl.searchParams.set("grant_type", "fb_exchange_token");
  llUrl.searchParams.set("client_id", clientId);
  llUrl.searchParams.set("client_secret", clientSecret);
  llUrl.searchParams.set("fb_exchange_token", accessToken);
  const llRes = await fetch(llUrl.toString());
  const llJson = await llRes.json();
  if (llRes.ok && llJson.access_token) {
    accessToken = String(llJson.access_token);
    if (typeof llJson.expires_in === "number") {
      expiresAt = new Date(Date.now() + llJson.expires_in * 1000).toISOString();
    }
  }

  const meRes = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`,
  );
  const me = await meRes.json();
  if (!meRes.ok || !me.id) {
    throw new Error(me.error?.message || "Impossible de lire le profil Meta");
  }

  const metadata: Record<string, unknown> = { meta_user_id: me.id };

  if (provider === "facebook") {
    return {
      provider,
      provider_user_id: String(me.id),
      username: null,
      display_name: typeof me.name === "string" ? me.name : null,
      avatar_url: me.picture?.data?.url ?? null,
      access_token: accessToken,
      refresh_token: null,
      token_expires_at: expiresAt,
      scopes: ["public_profile"],
      metadata,
    };
  }

  // Instagram : trouver le compte Business / Creator (Page ou Business Manager)
  const ig = await resolveInstagramFromMeta(accessToken, metadata);
  if (!ig?.id) {
    throw new Error(
      "Aucun compte Instagram professionnel trouvé. Vérifie que @ton_compte est lié à ta Page Facebook (Connected assets), puis réessaie.",
    );
  }

  return {
    provider: "instagram",
    provider_user_id: String(ig.id),
    username: ig.username ?? null,
    display_name: ig.name ?? ig.username ?? null,
    avatar_url: ig.profile_picture_url ?? null,
    access_token: accessToken,
    refresh_token: null,
    token_expires_at: expiresAt,
    scopes: [
      "instagram_basic",
      "pages_show_list",
      "pages_read_engagement",
      "business_management",
    ],
    metadata,
  };
}

type IgAccount = {
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
};

async function resolveInstagramFromMeta(
  accessToken: string,
  metadata: Record<string, unknown>,
): Promise<IgAccount | null> {
  const pageFields = [
    "id",
    "name",
    "access_token",
    "instagram_business_account{id,username,name,profile_picture_url}",
    "connected_instagram_account{id,username,name,profile_picture_url}",
  ].join(",");

  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=${pageFields}&limit=100&access_token=${encodeURIComponent(accessToken)}`,
  );
  const pagesJson = await pagesRes.json();
  const pages = Array.isArray(pagesJson.data) ? pagesJson.data : [];

  for (const page of pages) {
    const igNode = page?.instagram_business_account || page?.connected_instagram_account;
    if (igNode?.id) {
      metadata.facebook_page_id = page.id;
      metadata.facebook_page_name = page.name;
      metadata.discovery = "page";
      if (typeof page.access_token === "string" && page.access_token) {
        metadata.page_access_token_present = true;
      }
      return igNode as IgAccount;
    }

    // Retry with page token (sometimes IG only appears there)
    if (typeof page?.access_token === "string" && page.access_token && page.id) {
      const pageDetailRes = await fetch(
        `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id,username,name,profile_picture_url},connected_instagram_account{id,username,name,profile_picture_url}&access_token=${encodeURIComponent(page.access_token)}`,
      );
      const pageDetail = await pageDetailRes.json();
      const fromPage =
        pageDetail?.instagram_business_account || pageDetail?.connected_instagram_account;
      if (fromPage?.id) {
        metadata.facebook_page_id = page.id;
        metadata.facebook_page_name = page.name;
        metadata.discovery = "page_token";
        return fromPage as IgAccount;
      }
    }
  }

  // Fallback Business Manager assets
  const bizRes = await fetch(
    `https://graph.facebook.com/v21.0/me/businesses?fields=id,name&limit=50&access_token=${encodeURIComponent(accessToken)}`,
  );
  const bizJson = await bizRes.json();
  const businesses = Array.isArray(bizJson.data) ? bizJson.data : [];

  for (const biz of businesses) {
    if (!biz?.id) continue;
    for (const edge of ["owned_instagram_accounts", "client_instagram_accounts"] as const) {
      const igRes = await fetch(
        `https://graph.facebook.com/v21.0/${biz.id}/${edge}?fields=id,username,name,profile_picture_url&limit=50&access_token=${encodeURIComponent(accessToken)}`,
      );
      const igJson = await igRes.json();
      const accounts = Array.isArray(igJson.data) ? igJson.data : [];
      const first = accounts.find((a: { id?: string }) => a?.id);
      if (first?.id) {
        metadata.business_id = biz.id;
        metadata.business_name = biz.name;
        metadata.discovery = edge;
        return first as IgAccount;
      }
    }
  }

  return null;
}

async function exchangeTikTok(
  code: string,
  redirectUri: string,
): Promise<Omit<UpsertConnection, "user_id">> {
  const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY")!.trim();
  const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET")!.trim();

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenJson = await tokenRes.json();
  const data = tokenJson.data ?? tokenJson;
  if (!tokenRes.ok || !data.access_token) {
    throw new Error(
      tokenJson.error_description ||
        tokenJson.message ||
        data.error_description ||
        "Échec échange token TikTok",
    );
  }

  const accessToken = String(data.access_token);
  const refreshToken = data.refresh_token ? String(data.refresh_token) : null;
  const expiresAt =
    typeof data.expires_in === "number"
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;

  const userRes = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const userJson = await userRes.json();
  const user = userJson.data?.user ?? userJson.data ?? {};
  if (!userRes.ok || !user.open_id) {
    throw new Error(userJson.error?.message || "Impossible de lire le profil TikTok");
  }

  return {
    provider: "tiktok",
    provider_user_id: String(user.open_id),
    username: user.username ?? null,
    display_name: user.display_name ?? null,
    avatar_url: user.avatar_url ?? null,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expires_at: expiresAt,
    scopes: String(data.scope || "user.info.basic").split(/[,\s]+/).filter(Boolean),
    metadata: { union_id: user.union_id ?? null },
  };
}

async function exchangeYouTube(
  code: string,
  redirectUri: string,
): Promise<Omit<UpsertConnection, "user_id">> {
  const clientId = Deno.env.get("YOUTUBE_CLIENT_ID")!.trim();
  const clientSecret = Deno.env.get("YOUTUBE_CLIENT_SECRET")!.trim();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error_description || tokenJson.error || "Échec échange token YouTube");
  }

  const accessToken = String(tokenJson.access_token);
  const refreshToken = tokenJson.refresh_token ? String(tokenJson.refresh_token) : null;
  const expiresAt =
    typeof tokenJson.expires_in === "number"
      ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
      : null;

  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const channelJson = await channelRes.json();
  const channel = Array.isArray(channelJson.items) ? channelJson.items[0] : null;
  if (!channelRes.ok || !channel?.id) {
    throw new Error(
      channelJson.error?.message ||
        "Aucune chaîne YouTube trouvée sur ce compte Google.",
    );
  }

  const snippet = channel.snippet || {};
  return {
    provider: "youtube",
    provider_user_id: String(channel.id),
    username: snippet.customUrl ?? null,
    display_name: snippet.title ?? null,
    avatar_url: snippet.thumbnails?.default?.url ?? snippet.thumbnails?.medium?.url ?? null,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expires_at: expiresAt,
    scopes: String(tokenJson.scope || "").split(/\s+/).filter(Boolean),
    metadata: {
      subscriber_count: channel.statistics?.subscriberCount ?? null,
      video_count: channel.statistics?.videoCount ?? null,
      view_count: channel.statistics?.viewCount ?? null,
    },
  };
}

export function safeReturnPath(origin: string): string {
  return `${origin.replace(/\/$/, "")}/profil?social=connected`;
}

export function errorReturnPath(origin: string, message: string): string {
  const url = new URL(`${origin.replace(/\/$/, "")}/profil`);
  url.searchParams.set("social", "error");
  url.searchParams.set("message", message.slice(0, 180));
  return url.toString();
}
