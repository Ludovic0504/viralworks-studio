import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SOCIAL_PROVIDERS, type SocialProvider } from "../_shared/social-oauth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INSIGHTS_TTL_MS = 20 * 60 * 1000;
/** Soft cap to stay within Edge Function time/size budgets */
const MAX_CATALOG_VIDEOS = 400;
const YT_PAGE_SIZE = 50;
const IG_PAGE_SIZE = 50;
/** Fetch views for every catalog item (was 80 — undercounted totals) */
const IG_VIEWS_CONCURRENCY = 12;
const TT_PAGE_SIZE = 20;
const IG_API = "https://graph.instagram.com/v22.0";

type InsightStatus = "ok" | "not_connected" | "scope_missing" | "expired" | "error";

type InsightPost = {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  retention: number | null;
};

type VideoCatalog = {
  videoCount: number;
  truncated: boolean;
  viewsSum: number | null;
  likesSum: number | null;
  avgViews: number | null;
  medianViews: number | null;
  /** Full sample used for R&D (may omit some thumbnails to keep payload light) */
  videos: InsightPost[];
};

type ProviderInsights = {
  provider: SocialProvider;
  status: InsightStatus;
  message?: string;
  profile: { views: number | null; likes: number | null };
  lastPost: InsightPost | null;
  topVideos: InsightPost[];
  catalog?: VideoCatalog | null;
  fetchedAt?: string;
  fromCache?: boolean;
};

type ConnectionRow = {
  id: string;
  provider: SocialProvider;
  status: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  metadata: Record<string, unknown> | null;
  provider_user_id?: string | null;
};

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key =
    Deno.env.get("SERVICE_ROLE_KEY")?.trim() ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
    "";
  return createClient(url, key);
}

function emptyInsights(
  provider: SocialProvider,
  status: InsightStatus,
  message?: string,
): ProviderInsights {
  return {
    provider,
    status,
    message,
    profile: { views: null, likes: null },
    lastPost: null,
    topVideos: [],
    catalog: null,
  };
}

function parseNum(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function buildCatalog(posts: InsightPost[]): VideoCatalog {
  const capped = posts.slice(0, MAX_CATALOG_VIDEOS);
  const truncated = posts.length > capped.length;
  const viewVals = capped.map((p) => p.views).filter((v): v is number => v != null);
  const likeVals = capped.map((p) => p.likes).filter((v): v is number => v != null);
  const viewsSum = viewVals.length ? viewVals.reduce((s, v) => s + v, 0) : null;
  const likesSum = likeVals.length ? likeVals.reduce((s, v) => s + v, 0) : null;
  const avgViews = viewVals.length ? viewsSum! / viewVals.length : null;

  // Keep thumbnails for newest + top by views; slim the rest
  const topByViews = new Set(
    [...capped]
      .filter((p) => p.views != null)
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5)
      .map((p) => p.id),
  );
  const newest = new Set(capped.slice(0, 5).map((p) => p.id));
  const videos = capped.map((p, i) => {
    const keepThumb = i < 8 || topByViews.has(p.id) || newest.has(p.id);
    return keepThumb ? p : { ...p, thumbnailUrl: null };
  });

  return {
    videoCount: capped.length,
    truncated,
    viewsSum,
    likesSum,
    avgViews,
    medianViews: median(viewVals),
    videos,
  };
}

function summarizePosts(posts: InsightPost[]): {
  lastPost: InsightPost | null;
  topVideos: InsightPost[];
  catalog: VideoCatalog;
  profile: { views: number | null; likes: number | null };
} {
  const catalog = buildCatalog(posts);
  const lastPost = posts[0] || null;
  const topVideos = [...posts]
    .filter((v) => v.views != null || v.likes != null)
    .sort((a, b) => {
      const av = a.views ?? -1;
      const bv = b.views ?? -1;
      if (bv !== av) return bv - av;
      return (b.likes || 0) - (a.likes || 0);
    })
    .slice(0, 3);

  return {
    lastPost,
    topVideos,
    catalog,
    profile: {
      views: catalog.viewsSum,
      likes: catalog.likesSum,
    },
  };
}

function isCacheFresh(fetchedAt: unknown): boolean {
  if (typeof fetchedAt !== "string") return false;
  const t = Date.parse(fetchedAt);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < INSIGHTS_TTL_MS;
}

function readCachedInsights(row: ConnectionRow, opts?: { allowStale?: boolean }): ProviderInsights | null {
  const meta = row.metadata || {};
  const cached = meta.insights as ProviderInsights | undefined;
  if (!cached || cached.status !== "ok") return null;
  if (!opts?.allowStale && !isCacheFresh(cached.fetchedAt)) return null;
  if (!cached.catalog || !Array.isArray(cached.catalog.videos)) return null;
  // Ancien message technique / cache incomplet → refetch
  if (row.provider === "instagram" && !opts?.allowStale) {
    const oldMsg = typeof cached.message === "string" ? cached.message : "";
    if (/Compteur API|sous-compt|organiques|totaux identiques|manage_insights/i.test(oldMsg)) {
      return null;
    }
    const cat = cached.catalog;
    const withViews = (cat.videos || []).filter((v) => v.views != null).length;
    if ((cat.videoCount || 0) >= 10 && withViews < cat.videoCount * 0.9) return null;
  }
  return { ...cached, provider: row.provider, fromCache: true };
}

async function refreshYouTubeToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_at: string | null } | null> {
  const clientId = Deno.env.get("YOUTUBE_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("YOUTUBE_CLIENT_SECRET")?.trim();
  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    console.warn("[social-insights] YouTube refresh failed", json?.error || res.status);
    return null;
  }

  return {
    access_token: String(json.access_token),
    expires_at:
      typeof json.expires_in === "number"
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : null,
  };
}

async function ensureYouTubeAccessToken(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  row: ConnectionRow,
): Promise<{ token: string; row: ConnectionRow } | { error: ProviderInsights }> {
  let accessToken = row.access_token;
  const expiresAt = row.token_expires_at ? Date.parse(row.token_expires_at) : NaN;
  const expired =
    !accessToken ||
    (Number.isFinite(expiresAt) && expiresAt < Date.now() + 60_000);

  if (expired) {
    if (!row.refresh_token) {
      return {
        error: emptyInsights(
          "youtube",
          "expired",
          "Session YouTube expirée. Reconnecte ton compte.",
        ),
      };
    }
    const refreshed = await refreshYouTubeToken(row.refresh_token);
    if (!refreshed) {
      await supabase
        .from("social_connections")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("user_id", userId);
      return {
        error: emptyInsights(
          "youtube",
          "expired",
          "Session YouTube expirée. Reconnecte ton compte.",
        ),
      };
    }
    accessToken = refreshed.access_token;
    const updatedMeta = { ...(row.metadata || {}) };
    await supabase
      .from("social_connections")
      .update({
        access_token: refreshed.access_token,
        token_expires_at: refreshed.expires_at,
        status: "connected",
        updated_at: new Date().toISOString(),
        metadata: updatedMeta,
      })
      .eq("id", row.id)
      .eq("user_id", userId);
    row = {
      ...row,
      access_token: refreshed.access_token,
      token_expires_at: refreshed.expires_at,
      status: "connected",
    };
  }

  if (!accessToken) {
    return {
      error: emptyInsights("youtube", "error", "Token YouTube manquant."),
    };
  }

  return { token: accessToken, row };
}

async function refreshInstagramToken(
  accessToken: string,
): Promise<{ access_token: string; expires_at: string | null } | null> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    console.warn("[social-insights] Instagram refresh failed", json?.error || res.status);
    return null;
  }
  return {
    access_token: String(json.access_token),
    expires_at:
      typeof json.expires_in === "number"
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : null,
  };
}

async function ensureInstagramAccessToken(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  row: ConnectionRow,
): Promise<{ token: string; row: ConnectionRow } | { error: ProviderInsights }> {
  let accessToken = row.access_token;
  if (!accessToken) {
    return { error: emptyInsights("instagram", "error", "Token Instagram manquant.") };
  }

  const auth =
    typeof row.metadata?.auth === "string" ? String(row.metadata.auth) : "instagram_login";

  // Facebook Login = token Page (long-lived) — pas de refresh IG
  if (auth === "facebook_login") {
    return { token: accessToken, row };
  }

  const expiresAt = row.token_expires_at ? Date.parse(row.token_expires_at) : NaN;
  const nearExpiry =
    Number.isFinite(expiresAt) && expiresAt < Date.now() + 24 * 60 * 60 * 1000;

  // Long-lived IG tokens last ~60d; refresh when < 24h left (or already expired).
  if (nearExpiry || (Number.isFinite(expiresAt) && expiresAt < Date.now())) {
    const refreshed = await refreshInstagramToken(accessToken);
    if (!refreshed) {
      if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
        await supabase
          .from("social_connections")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .eq("user_id", userId);
        return {
          error: emptyInsights(
            "instagram",
            "expired",
            "Session Instagram expirée. Reconnecte ton compte.",
          ),
        };
      }
      // Keep using current token if refresh failed but not expired yet
    } else {
      accessToken = refreshed.access_token;
      await supabase
        .from("social_connections")
        .update({
          access_token: refreshed.access_token,
          token_expires_at: refreshed.expires_at,
          status: "connected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("user_id", userId);
      row = {
        ...row,
        access_token: refreshed.access_token,
        token_expires_at: refreshed.expires_at,
        status: "connected",
      };
    }
  }

  return { token: accessToken, row };
}

function insightMetricValue(
  data: Array<Record<string, unknown>> | undefined,
  name: string,
): number | null {
  if (!Array.isArray(data)) return null;
  const row = data.find((m) => m?.name === name);
  if (!row) return null;
  const fromValues = Array.isArray(row.values)
    ? parseNum((row.values as Array<{ value?: unknown }>)[0]?.value)
    : null;
  if (fromValues != null) return fromValues;
  const total = row.total_value as { value?: unknown } | undefined;
  return parseNum(total?.value);
}

function parseIgInsightsPayload(
  payload: unknown,
): { views: number | null; likes: number | null } {
  const data = (payload as { data?: Array<Record<string, unknown>> } | null)?.data;
  return {
    // Prefer true view/play counts — never treat unique reach as "vues" for totals
    views:
      insightMetricValue(data, "views") ??
      insightMetricValue(data, "ig_reels_aggregated_all_plays_count") ??
      insightMetricValue(data, "plays") ??
      insightMetricValue(data, "impressions"),
    likes: insightMetricValue(data, "likes"),
  };
}

async function fetchIgMediaViews(
  mediaId: string,
  token: string,
  mediaType: string | null,
  mediaProductType: string | null,
): Promise<{ views: number | null; scopeError: boolean; errorMsg?: string }> {
  const product = (mediaProductType || "").toUpperCase();
  const type = (mediaType || "").toUpperCase();

  // L'app IG affiche souvent un total plus large que `views` seul
  // (replays, surfaces, crosspost). On prend le MAX des métriques dispo.
  const metrics: string[] =
    product === "REELS" || type === "VIDEO"
      ? ["views", "crossposted_views", "ig_reels_aggregated_all_plays_count", "impressions"]
      : ["views", "impressions"];

  let scopeError = false;
  let errorMsg: string | undefined;
  let best: number | null = null;

  for (const metric of metrics) {
    const url = new URL(`${IG_API}/${mediaId}/insights`);
    url.searchParams.set("metric", metric);
    url.searchParams.set("period", "lifetime");
    url.searchParams.set("access_token", token);
    const res = await fetch(url.toString());
    const json = await res.json();
    if (!res.ok) {
      const msg = String(json?.error?.message || "");
      const code = json?.error?.code;
      if (
        code === 10 ||
        code === 190 ||
        /permission|oauth|scope|not authorized|manage_insights/i.test(msg)
      ) {
        scopeError = true;
        errorMsg = msg || "Permissions insights manquantes";
        break;
      }
      errorMsg = msg || errorMsg;
      continue;
    }
    const direct =
      insightMetricValue(
        (json?.data as Array<Record<string, unknown>> | undefined) || undefined,
        metric,
      ) ?? parseIgInsightsPayload(json).views;
    if (direct != null && (best == null || direct > best)) best = direct;
  }

  return { views: best, scopeError, errorMsg };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i]!, i);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function mapIgMediaItem(
  item: Record<string, unknown>,
  views: number | null,
): InsightPost | null {
  const id = String(item?.id || "");
  if (!id) return null;
  const mediaType = typeof item.media_type === "string" ? item.media_type : null;
  const productType =
    typeof item.media_product_type === "string" ? item.media_product_type : null;
  const likes = parseNum(item.like_count) ?? parseNum(item.likes) ?? null;

  const caption = typeof item.caption === "string" ? item.caption.trim() : "";
  const label = productType || mediaType;
  const title = caption
    ? caption.length > 80
      ? `${caption.slice(0, 77)}…`
      : caption
    : label
      ? `Post ${String(label).toLowerCase()}`
      : "Publication Instagram";

  return {
    id,
    title,
    thumbnailUrl:
      (typeof item.thumbnail_url === "string" && item.thumbnail_url) ||
      (typeof item.media_url === "string" && item.media_url) ||
      null,
    publishedAt: typeof item.timestamp === "string" ? item.timestamp : null,
    views,
    likes,
    retention: null,
  };
}

async function fetchInstagramInsightsViaFacebook(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  row: ConnectionRow,
): Promise<ProviderInsights> {
  const ensured = await ensureInstagramAccessToken(supabase, userId, row);
  if ("error" in ensured) return ensured.error;
  const { token } = ensured;

  const igUserId =
    (typeof row.metadata?.instagram_user_id === "string" && row.metadata.instagram_user_id) ||
    row.provider_user_id ||
    null;
  if (!igUserId) {
    return emptyInsights(
      "instagram",
      "error",
      "ID Instagram manquant. Reconnecte Instagram via Facebook.",
    );
  }

  const FB = "https://graph.facebook.com/v22.0";

  try {
    // total_views_count / total_like_count = totaux app (organique + boosts + crosspost)
    const mediaFields = [
      "id",
      "caption",
      "media_type",
      "media_product_type",
      "media_url",
      "thumbnail_url",
      "timestamp",
      "like_count",
      "total_like_count",
      "total_views_count",
      "permalink",
    ].join(",");

    const items: Array<Record<string, unknown>> = [];
    let moreMediaAvailable = false;
    let nextUrl: string | null =
      `${FB}/${encodeURIComponent(igUserId)}/media?fields=${encodeURIComponent(mediaFields)}&limit=${IG_PAGE_SIZE}&access_token=${encodeURIComponent(token)}`;

    while (nextUrl && items.length < MAX_CATALOG_VIDEOS) {
      const mediaRes = await fetch(nextUrl);
      const mediaJson = await mediaRes.json();
      if (!mediaRes.ok) {
        const code = mediaJson?.error?.code;
        const msg = mediaJson?.error?.message || `Instagram media error (${mediaRes.status})`;
        if (items.length === 0) {
          if (code === 10 || code === 190 || /permission|oauth|scope/i.test(String(msg))) {
            return emptyInsights(
              "instagram",
              "scope_missing",
              "Permissions insuffisantes. Reconnecte Instagram (Facebook Login + insights).",
            );
          }
          return emptyInsights("instagram", "error", msg);
        }
        break;
      }

      const page = Array.isArray(mediaJson?.data) ? mediaJson.data : [];
      for (const item of page) {
        items.push(item);
        if (items.length >= MAX_CATALOG_VIDEOS) break;
      }
      const hasNext = typeof mediaJson?.paging?.next === "string";
      if (hasNext && items.length >= MAX_CATALOG_VIDEOS) {
        moreMediaAvailable = true;
        nextUrl = null;
      } else {
        nextUrl = hasNext ? mediaJson.paging.next : null;
      }
    }

    const catalogItems = items
      .filter((item) => String(item.media_product_type || "").toUpperCase() !== "STORY")
      .slice(0, MAX_CATALOG_VIDEOS);

    // Fill gaps: posts without total_views_count (ex: images) via insights.total_views
    const missingViews = catalogItems.filter((item) => {
      const id = String(item?.id || "");
      if (!id) return false;
      return parseNum(item.total_views_count) == null;
    });

    const insightViews = new Map<string, number>();
    await mapWithConcurrency(missingViews, IG_VIEWS_CONCURRENCY, async (item) => {
      const id = String(item?.id || "");
      if (!id) return;
      const url = new URL(`${FB}/${id}/insights`);
      url.searchParams.set("metric", "total_views");
      url.searchParams.set("period", "lifetime");
      url.searchParams.set("access_token", token);
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok) {
        // fallback organic views
        const url2 = new URL(`${FB}/${id}/insights`);
        url2.searchParams.set("metric", "views");
        url2.searchParams.set("period", "lifetime");
        url2.searchParams.set("access_token", token);
        const res2 = await fetch(url2.toString());
        const json2 = await res2.json();
        if (!res2.ok) return;
        const v = parseIgInsightsPayload(json2).views;
        if (v != null) insightViews.set(id, v);
        return;
      }
      const v =
        insightMetricValue(
          (json?.data as Array<Record<string, unknown>> | undefined) || undefined,
          "total_views",
        ) ?? parseIgInsightsPayload(json).views;
      if (v != null) insightViews.set(id, v);
    });

    const posts: InsightPost[] = catalogItems
      .map((item) => {
        const id = String(item?.id || "");
        if (!id) return null;
        const views =
          parseNum(item.total_views_count) ?? insightViews.get(id) ?? null;
        const likes =
          parseNum(item.total_like_count) ?? parseNum(item.like_count) ?? null;
        const mediaType = typeof item.media_type === "string" ? item.media_type : null;
        const productType =
          typeof item.media_product_type === "string" ? item.media_product_type : null;
        const caption = typeof item.caption === "string" ? item.caption.trim() : "";
        const label = productType || mediaType;
        const title = caption
          ? caption.length > 80
            ? `${caption.slice(0, 77)}…`
            : caption
          : label
            ? `Post ${String(label).toLowerCase()}`
            : "Publication Instagram";

        return {
          id,
          title,
          thumbnailUrl:
            (typeof item.thumbnail_url === "string" && item.thumbnail_url) ||
            (typeof item.media_url === "string" && item.media_url) ||
            null,
          publishedAt: typeof item.timestamp === "string" ? item.timestamp : null,
          views,
          likes,
          retention: null,
        } satisfies InsightPost;
      })
      .filter((p): p is InsightPost => Boolean(p));

    if (posts.length === 0) {
      return emptyInsights("instagram", "error", "Aucune publication Instagram trouvée.");
    }

    const summary = summarizePosts(posts);
    if (moreMediaAvailable && summary.catalog) summary.catalog.truncated = true;

    const viewsCovered = posts.filter((p) => p.views != null).length;
    const result: ProviderInsights = {
      provider: "instagram",
      status: "ok",
      message:
        viewsCovered < posts.length
          ? `IG: ${viewsCovered}/${posts.length} posts avec vues (totaux type app Instagram)`
          : "IG: vues alignées sur l’app Instagram (toutes surfaces)",
      profile: summary.profile,
      lastPost: summary.lastPost,
      topVideos: summary.topVideos,
      catalog: summary.catalog,
      fetchedAt: new Date().toISOString(),
      fromCache: false,
    };

    const nextMeta = {
      ...(row.metadata || {}),
      insights: {
        provider: result.provider,
        status: result.status,
        message: result.message,
        profile: result.profile,
        lastPost: result.lastPost,
        topVideos: result.topVideos,
        catalog: result.catalog,
        fetchedAt: result.fetchedAt,
      },
    };

    await supabase
      .from("social_connections")
      .update({
        metadata: nextMeta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("user_id", userId);

    return result;
  } catch (err) {
    console.error("[social-insights] Instagram FB", err);
    return emptyInsights(
      "instagram",
      "error",
      err instanceof Error ? err.message : "Erreur Instagram",
    );
  }
}

async function fetchInstagramInsights(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  row: ConnectionRow,
): Promise<ProviderInsights> {
  const auth =
    typeof row.metadata?.auth === "string" ? String(row.metadata.auth) : "instagram_login";

  // Chemin Facebook Login → total_views (aligné sur l'app, boosts inclus)
  if (auth === "facebook_login") {
    return fetchInstagramInsightsViaFacebook(supabase, userId, row);
  }

  const ensured = await ensureInstagramAccessToken(supabase, userId, row);
  if ("error" in ensured) return ensured.error;
  const { token } = ensured;

  try {
    // Ancien chemin Instagram Login — organique seulement
    const mediaFields =
      "id,caption,media_type,media_product_type,media_url,thumbnail_url,timestamp,like_count,permalink";

    const items: Array<Record<string, unknown>> = [];
    let moreMediaAvailable = false;
    let nextUrl: string | null = (() => {
      const mediaUrl = new URL(`${IG_API}/me/media`);
      mediaUrl.searchParams.set("fields", mediaFields);
      mediaUrl.searchParams.set("limit", String(IG_PAGE_SIZE));
      mediaUrl.searchParams.set("access_token", token);
      return mediaUrl.toString();
    })();

    while (nextUrl && items.length < MAX_CATALOG_VIDEOS) {
      const mediaRes = await fetch(nextUrl);
      const mediaJson = await mediaRes.json();

      if (!mediaRes.ok) {
        const code = mediaJson?.error?.code;
        const msg = mediaJson?.error?.message || `Instagram media error (${mediaRes.status})`;
        if (items.length === 0) {
          if (code === 10 || code === 190 || /permission|oauth|scope/i.test(String(msg))) {
            return emptyInsights(
              "instagram",
              "scope_missing",
              "Permissions Instagram insuffisantes. Reconnecte ton compte pour activer les stats.",
            );
          }
          return emptyInsights("instagram", "error", msg);
        }
        break;
      }

      const page = Array.isArray(mediaJson?.data) ? mediaJson.data : [];
      for (const item of page) {
        items.push(item);
        if (items.length >= MAX_CATALOG_VIDEOS) break;
      }
      const hasNext = typeof mediaJson?.paging?.next === "string";
      if (hasNext && items.length >= MAX_CATALOG_VIDEOS) {
        moreMediaAvailable = true;
        nextUrl = null;
      } else {
        nextUrl = hasNext ? mediaJson.paging.next : null;
      }
    }

    const catalogItems = items
      .filter((item) => String(item.media_product_type || "").toUpperCase() !== "STORY")
      .slice(0, MAX_CATALOG_VIDEOS);

    const mediaTruncated = moreMediaAvailable;

    // Views pour TOUS les posts du catalogue (plus de plafond à 80)
    const viewsById = new Map<string, number>();
    let viewsScopeError = false;
    let viewsErrorMsg: string | undefined;

    if (catalogItems.length > 0) {
      const probe = catalogItems[0]!;
      const probeId = String(probe.id || "");
      if (probeId) {
        const probeResult = await fetchIgMediaViews(
          probeId,
          token,
          typeof probe.media_type === "string" ? probe.media_type : null,
          typeof probe.media_product_type === "string" ? probe.media_product_type : null,
        );
        if (probeResult.views != null) viewsById.set(probeId, probeResult.views);
        if (probeResult.scopeError) {
          viewsScopeError = true;
          viewsErrorMsg = probeResult.errorMsg;
        }
      }
    }

    if (!viewsScopeError) {
      // Prioritize VIDEO/REELS then IMAGE then carousel — but cover everything
      const ordered = [...catalogItems].sort((a, b) => {
        const score = (it: Record<string, unknown>) => {
          const p = String(it.media_product_type || "").toUpperCase();
          const t = String(it.media_type || "").toUpperCase();
          if (p === "REELS" || t === "VIDEO") return 0;
          if (t === "IMAGE") return 1;
          return 2;
        };
        return score(a) - score(b);
      });

      await mapWithConcurrency(ordered, IG_VIEWS_CONCURRENCY, async (item) => {
        const id = String(item?.id || "");
        if (!id || viewsById.has(id)) return;
        const result = await fetchIgMediaViews(
          id,
          token,
          typeof item.media_type === "string" ? item.media_type : null,
          typeof item.media_product_type === "string" ? item.media_product_type : null,
        );
        if (result.scopeError) {
          viewsScopeError = true;
          viewsErrorMsg = result.errorMsg || viewsErrorMsg;
          return;
        }
        if (result.views != null) viewsById.set(id, result.views);
      });
    }

    const posts: InsightPost[] = catalogItems
      .map((item) => mapIgMediaItem(item, viewsById.get(String(item.id || "")) ?? null))
      .filter((p): p is InsightPost => Boolean(p));

    if (posts.length === 0) {
      return emptyInsights("instagram", "error", "Aucune publication Instagram trouvée.");
    }

    const summary = summarizePosts(posts);
    // Mark truncated if we hit the soft media cap
    if (mediaTruncated && summary.catalog) {
      summary.catalog.truncated = true;
    }

    const viewsCovered = posts.filter((p) => p.views != null).length;
    const likesCovered = posts.filter((p) => p.likes != null).length;

    let message: string | undefined;
    if (viewsScopeError || (viewsCovered === 0 && posts.length > 0)) {
      message = "Reconnecte Instagram";
    } else {
      message = "90 derniers jours";
    }
    void likesCovered;

    const result: ProviderInsights = {
      provider: "instagram",
      status: "ok",
      message,
      profile: summary.profile,
      lastPost: summary.lastPost,
      topVideos: summary.topVideos,
      catalog: summary.catalog,
      fetchedAt: new Date().toISOString(),
      fromCache: false,
    };

    const nextMeta = {
      ...(row.metadata || {}),
      insights: {
        provider: result.provider,
        status: result.status,
        message: result.message,
        profile: result.profile,
        lastPost: result.lastPost,
        topVideos: result.topVideos,
        catalog: result.catalog,
        fetchedAt: result.fetchedAt,
      },
    };

    await supabase
      .from("social_connections")
      .update({
        metadata: nextMeta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("user_id", userId);

    return result;
  } catch (err) {
    console.error("[social-insights] Instagram", err);
    return emptyInsights(
      "instagram",
      "error",
      err instanceof Error ? err.message : "Erreur Instagram",
    );
  }
}

async function refreshTikTokToken(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string | null; expires_at: string | null } | null> {
  const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY")?.trim();
  const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET")?.trim();
  if (!clientKey || !clientSecret) return null;

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  const data = json.data ?? json;
  if (!res.ok || !data.access_token) {
    console.warn("[social-insights] TikTok refresh failed", json?.error || res.status);
    return null;
  }

  return {
    access_token: String(data.access_token),
    refresh_token: data.refresh_token ? String(data.refresh_token) : refreshToken,
    expires_at:
      typeof data.expires_in === "number"
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
  };
}

async function ensureTikTokAccessToken(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  row: ConnectionRow,
): Promise<{ token: string; row: ConnectionRow } | { error: ProviderInsights }> {
  let accessToken = row.access_token;
  const expiresAt = row.token_expires_at ? Date.parse(row.token_expires_at) : NaN;
  const expired =
    !accessToken ||
    (Number.isFinite(expiresAt) && expiresAt < Date.now() + 60_000);

  if (expired) {
    if (!row.refresh_token) {
      return {
        error: emptyInsights(
          "tiktok",
          "expired",
          "Session TikTok expirée. Reconnecte ton compte.",
        ),
      };
    }
    const refreshed = await refreshTikTokToken(row.refresh_token);
    if (!refreshed) {
      await supabase
        .from("social_connections")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("user_id", userId);
      return {
        error: emptyInsights(
          "tiktok",
          "expired",
          "Session TikTok expirée. Reconnecte ton compte.",
        ),
      };
    }
    accessToken = refreshed.access_token;
    await supabase
      .from("social_connections")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_expires_at: refreshed.expires_at,
        status: "connected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("user_id", userId);
    row = {
      ...row,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      token_expires_at: refreshed.expires_at,
      status: "connected",
    };
  }

  if (!accessToken) {
    return { error: emptyInsights("tiktok", "error", "Token TikTok manquant.") };
  }

  return { token: accessToken, row };
}

async function fetchTikTokInsights(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  row: ConnectionRow,
): Promise<ProviderInsights> {
  const ensured = await ensureTikTokAccessToken(supabase, userId, row);
  if ("error" in ensured) return ensured.error;
  const { token } = ensured;

  try {
    const userFields = [
      "open_id",
      "display_name",
      "username",
      "follower_count",
      "likes_count",
      "video_count",
    ].join(",");
    const userRes = await fetch(
      `https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(userFields)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const userJson = await userRes.json();
    const userErr = userJson?.error;
    if (userErr && userErr.code && userErr.code !== "ok") {
      const msg = userErr.message || String(userErr.code);
      if (/scope|permission|authorize/i.test(msg)) {
        return emptyInsights(
          "tiktok",
          "scope_missing",
          "Permissions TikTok insuffisantes. Reconnecte ton compte (video.list + user.info.stats).",
        );
      }
      return emptyInsights("tiktok", "error", msg);
    }
    const user = userJson?.data?.user ?? {};

    const videoFields = [
      "id",
      "title",
      "video_description",
      "cover_image_url",
      "create_time",
      "view_count",
      "like_count",
    ].join(",");

    const posts: InsightPost[] = [];
    let cursor: number | undefined;
    let hasMore = true;
    let listError: string | null = null;

    while (hasMore && posts.length < MAX_CATALOG_VIDEOS) {
      const body: Record<string, unknown> = {
        max_count: Math.min(TT_PAGE_SIZE, MAX_CATALOG_VIDEOS - posts.length),
      };
      if (cursor != null) body.cursor = cursor;

      const videoRes = await fetch(
        `https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(videoFields)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      const videoJson = await videoRes.json();
      const videoErr = videoJson?.error;
      if (videoErr && videoErr.code && videoErr.code !== "ok") {
        const msg = videoErr.message || String(videoErr.code);
        if (posts.length === 0) {
          if (/scope|permission|authorize/i.test(msg)) {
            return emptyInsights(
              "tiktok",
              "scope_missing",
              "Permissions TikTok insuffisantes. Reconnecte ton compte pour autoriser video.list.",
            );
          }
          listError = msg;
        }
        break;
      }

      const videos = Array.isArray(videoJson?.data?.videos) ? videoJson.data.videos : [];
      for (const v of videos as Record<string, unknown>[]) {
        const titleRaw =
          (typeof v.title === "string" && v.title) ||
          (typeof v.video_description === "string" && v.video_description) ||
          "";
        const title = titleRaw
          ? titleRaw.length > 80
            ? `${titleRaw.slice(0, 77)}…`
            : titleRaw
          : "Vidéo TikTok";
        const createTime = parseNum(v.create_time);
        const id = String(v.id || "");
        if (!id) continue;
        posts.push({
          id,
          title,
          thumbnailUrl: typeof v.cover_image_url === "string" ? v.cover_image_url : null,
          publishedAt:
            createTime != null ? new Date(createTime * 1000).toISOString() : null,
          views: parseNum(v.view_count),
          likes: parseNum(v.like_count),
          retention: null,
        });
        if (posts.length >= MAX_CATALOG_VIDEOS) break;
      }

      hasMore = Boolean(videoJson?.data?.has_more) && posts.length < MAX_CATALOG_VIDEOS;
      const nextCursor = parseNum(videoJson?.data?.cursor);
      cursor = nextCursor != null ? nextCursor : undefined;
      if (!videos.length || cursor == null) hasMore = false;
    }

    const profileLikes = parseNum(user.likes_count);

    if (posts.length === 0) {
      if (profileLikes != null) {
        return {
          provider: "tiktok",
          status: "ok",
          message: listError || undefined,
          profile: { views: null, likes: profileLikes },
          lastPost: null,
          topVideos: [],
          catalog: null,
          fetchedAt: new Date().toISOString(),
          fromCache: false,
        };
      }
      return emptyInsights("tiktok", "error", listError || "Aucune vidéo TikTok.");
    }

    const summary = summarizePosts(posts);
    const result: ProviderInsights = {
      provider: "tiktok",
      status: "ok",
      profile: {
        // TikTok n'expose pas un total de vues profil ; on agrège le catalogue
        views: summary.profile.views,
        likes: profileLikes ?? summary.profile.likes,
      },
      lastPost: summary.lastPost,
      topVideos: summary.topVideos,
      catalog: summary.catalog,
      fetchedAt: new Date().toISOString(),
      fromCache: false,
    };

    const nextMeta = {
      ...(row.metadata || {}),
      follower_count: user.follower_count ?? row.metadata?.follower_count ?? null,
      likes_count: user.likes_count ?? row.metadata?.likes_count ?? null,
      video_count: user.video_count ?? row.metadata?.video_count ?? null,
      insights: {
        provider: result.provider,
        status: result.status,
        profile: result.profile,
        lastPost: result.lastPost,
        topVideos: result.topVideos,
        catalog: result.catalog,
        fetchedAt: result.fetchedAt,
      },
    };

    await supabase
      .from("social_connections")
      .update({
        metadata: nextMeta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("user_id", userId);

    return result;
  } catch (err) {
    console.error("[social-insights] TikTok", err);
    return emptyInsights(
      "tiktok",
      "error",
      err instanceof Error ? err.message : "Erreur TikTok",
    );
  }
}

const FB_API = "https://graph.facebook.com/v21.0";

async function fetchFbVideoViews(
  videoId: string,
  pageToken: string,
): Promise<number | null> {
  // Prefer video_insights; fall back to Video.views field handled by caller
  const url = new URL(`${FB_API}/${videoId}/video_insights`);
  url.searchParams.set("metric", "total_video_views");
  url.searchParams.set("access_token", pageToken);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) return null;
  const row = Array.isArray(json?.data) ? json.data[0] : null;
  const value = row?.values?.[0]?.value;
  return parseNum(value);
}

async function fetchFacebookInsights(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  row: ConnectionRow,
): Promise<ProviderInsights> {
  const pageToken = row.access_token;
  const pageId =
    (typeof row.metadata?.facebook_page_id === "string" && row.metadata.facebook_page_id) ||
    row.provider_user_id ||
    null;

  if (!pageToken || !pageId) {
    return emptyInsights(
      "facebook",
      "scope_missing",
      "Page Facebook manquante. Reconnecte Facebook en autorisant l’accès à ta Page.",
    );
  }

  try {
    // Profil Page
    const pageRes = await fetch(
      `${FB_API}/${encodeURIComponent(pageId)}?fields=id,name,fan_count,followers_count,picture.type(large){url}&access_token=${encodeURIComponent(pageToken)}`,
    );
    const pageJson = await pageRes.json();
    if (!pageRes.ok) {
      const msg = pageJson?.error?.message || `Facebook Page error (${pageRes.status})`;
      if (/permission|oauth|#10|#200/i.test(String(msg)) || pageJson?.error?.code === 190) {
        return emptyInsights(
          "facebook",
          "scope_missing",
          "Permissions Page insuffisantes. Reconnecte Facebook (pages_show_list, pages_read_engagement, read_insights).",
        );
      }
      return emptyInsights("facebook", "error", msg);
    }

    // Vidéos Page (meilleure source pour vues / likes)
    const videosUrl = new URL(`${FB_API}/${encodeURIComponent(pageId)}/videos`);
    videosUrl.searchParams.set(
      "fields",
      "id,title,description,created_time,picture,permalink_url,views,likes.summary(true)",
    );
    videosUrl.searchParams.set("limit", "25");
    videosUrl.searchParams.set("access_token", pageToken);

    const videosRes = await fetch(videosUrl.toString());
    const videosJson = await videosRes.json();

    let posts: InsightPost[] = [];

    if (videosRes.ok && Array.isArray(videosJson?.data) && videosJson.data.length > 0) {
      for (const v of videosJson.data) {
        const id = String(v?.id || "");
        if (!id) continue;
        let views = parseNum(v.views);
        const likes =
          parseNum(v?.likes?.summary?.total_count) ?? parseNum(v?.likes?.count);

        if (views == null) {
          views = await fetchFbVideoViews(id, pageToken);
        }

        const titleRaw =
          (typeof v.title === "string" && v.title) ||
          (typeof v.description === "string" && v.description) ||
          "";
        posts.push({
          id,
          title: titleRaw
            ? titleRaw.length > 80
              ? `${titleRaw.slice(0, 77)}…`
              : titleRaw
            : "Vidéo Facebook",
          thumbnailUrl: typeof v.picture === "string" ? v.picture : null,
          publishedAt: typeof v.created_time === "string" ? v.created_time : null,
          views,
          likes,
          retention: null,
        });
      }
    } else {
      // Fallback : posts Page (réactionsctions = likes approx ; impressions si insights OK)
      const postsUrl = new URL(`${FB_API}/${encodeURIComponent(pageId)}/posts`);
      postsUrl.searchParams.set(
        "fields",
        "id,message,created_time,full_picture,reactions.summary(true),shares",
      );
      postsUrl.searchParams.set("limit", "25");
      postsUrl.searchParams.set("access_token", pageToken);
      const postsRes = await fetch(postsUrl.toString());
      const postsJson = await postsRes.json();
      if (!postsRes.ok) {
        const msg = postsJson?.error?.message || videosJson?.error?.message || "Erreur posts Facebook";
        if (/permission|oauth|#10|#200/i.test(String(msg))) {
          return emptyInsights(
            "facebook",
            "scope_missing",
            "Permissions Page insuffisantes. Reconnecte Facebook avec accès Page.",
          );
        }
        return emptyInsights("facebook", "error", msg);
      }

      posts = (Array.isArray(postsJson?.data) ? postsJson.data : []).map(
        (p: Record<string, unknown>) => {
          const message = typeof p.message === "string" ? p.message.trim() : "";
          const reactions = p.reactions as { summary?: { total_count?: number } } | undefined;
          return {
            id: String(p.id || ""),
            title: message
              ? message.length > 80
                ? `${message.slice(0, 77)}…`
                : message
              : "Publication Facebook",
            thumbnailUrl: typeof p.full_picture === "string" ? p.full_picture : null,
            publishedAt: typeof p.created_time === "string" ? p.created_time : null,
            views: null,
            likes: parseNum(reactions?.summary?.total_count),
            retention: null,
          } satisfies InsightPost;
        },
      ).filter((p: InsightPost) => p.id);
    }

    const lastPost = posts[0] || null;
    const topVideos = [...posts]
      .sort((a, b) => {
        const av = a.views ?? -1;
        const bv = b.views ?? -1;
        if (bv !== av) return bv - av;
        return (b.likes || 0) - (a.likes || 0);
      })
      .slice(0, 3);

    let viewsSum = 0;
    let likesSum = 0;
    let hasViews = false;
    let hasLikes = false;
    for (const p of posts) {
      if (p.views != null) {
        viewsSum += p.views;
        hasViews = true;
      }
      if (p.likes != null) {
        likesSum += p.likes;
        hasLikes = true;
      }
    }

    const result: ProviderInsights = {
      provider: "facebook",
      status: "ok",
      profile: {
        views: hasViews ? viewsSum : null,
        likes: hasLikes ? likesSum : null,
      },
      lastPost,
      topVideos,
      fetchedAt: new Date().toISOString(),
      fromCache: false,
    };

    const nextMeta = {
      ...(row.metadata || {}),
      facebook_page_id: pageJson.id || pageId,
      facebook_page_name: pageJson.name ?? row.metadata?.facebook_page_name ?? null,
      fan_count: pageJson.fan_count ?? row.metadata?.fan_count ?? null,
      followers_count: pageJson.followers_count ?? row.metadata?.followers_count ?? null,
      insights: {
        provider: result.provider,
        status: result.status,
        profile: result.profile,
        lastPost: result.lastPost,
        topVideos: result.topVideos,
        fetchedAt: result.fetchedAt,
      },
    };

    await supabase
      .from("social_connections")
      .update({
        metadata: nextMeta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("user_id", userId);

    return result;
  } catch (err) {
    console.error("[social-insights] Facebook", err);
    return emptyInsights(
      "facebook",
      "error",
      err instanceof Error ? err.message : "Erreur Facebook",
    );
  }
}

function mapYtVideo(item: Record<string, unknown>): InsightPost {
  const snippet = (item.snippet || {}) as Record<string, unknown>;
  const stats = (item.statistics || {}) as Record<string, unknown>;
  const thumbs = (snippet.thumbnails || {}) as Record<string, { url?: string }>;
  const thumb =
    thumbs.medium?.url || thumbs.high?.url || thumbs.default?.url || null;
  return {
    id: String(item.id || ""),
    title: typeof snippet.title === "string" ? snippet.title : null,
    thumbnailUrl: thumb,
    publishedAt: typeof snippet.publishedAt === "string" ? snippet.publishedAt : null,
    views: parseNum(stats.viewCount),
    likes: parseNum(stats.likeCount),
    retention: null,
  };
}

async function fetchYouTubeInsights(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  row: ConnectionRow,
): Promise<ProviderInsights> {
  const ensured = await ensureYouTubeAccessToken(supabase, userId, row);
  if ("error" in ensured) return ensured.error;
  const { token } = ensured;

  try {
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics&mine=true",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const channelJson = await channelRes.json();
    if (!channelRes.ok) {
      const msg =
        channelJson?.error?.message ||
        `YouTube channels error (${channelRes.status})`;
      return emptyInsights("youtube", "error", msg);
    }

    const channel = Array.isArray(channelJson.items) ? channelJson.items[0] : null;
    if (!channel?.id) {
      return emptyInsights("youtube", "error", "Aucune chaîne YouTube trouvée.");
    }

    const profileViews = parseNum(channel.statistics?.viewCount);
    const uploadsPlaylistId =
      channel.contentDetails?.relatedPlaylists?.uploads || null;

    const videoIds: string[] = [];
    if (uploadsPlaylistId) {
      let pageToken: string | undefined;
      do {
        const plUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
        plUrl.searchParams.set("part", "contentDetails");
        plUrl.searchParams.set("playlistId", uploadsPlaylistId);
        plUrl.searchParams.set("maxResults", String(YT_PAGE_SIZE));
        if (pageToken) plUrl.searchParams.set("pageToken", pageToken);
        const plRes = await fetch(plUrl.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const plJson = await plRes.json();
        if (!plRes.ok || !Array.isArray(plJson.items)) break;
        for (const it of plJson.items as Array<{ contentDetails?: { videoId?: string } }>) {
          const id = it?.contentDetails?.videoId;
          if (typeof id === "string" && id.length > 0) {
            videoIds.push(id);
            if (videoIds.length >= MAX_CATALOG_VIDEOS) break;
          }
        }
        pageToken =
          typeof plJson.nextPageToken === "string" && videoIds.length < MAX_CATALOG_VIDEOS
            ? plJson.nextPageToken
            : undefined;
      } while (pageToken);
    }

    const byId = new Map<string, InsightPost>();
    for (let i = 0; i < videoIds.length; i += YT_PAGE_SIZE) {
      const batch = videoIds.slice(i, i + YT_PAGE_SIZE);
      const vUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      vUrl.searchParams.set("part", "snippet,statistics");
      vUrl.searchParams.set("id", batch.join(","));
      const vRes = await fetch(vUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const vJson = await vRes.json();
      if (!vRes.ok || !Array.isArray(vJson.items)) continue;
      for (const it of vJson.items as Record<string, unknown>[]) {
        const mapped = mapYtVideo(it);
        if (mapped.id) byId.set(mapped.id, mapped);
      }
    }

    // Keep playlist order (newest first) for lastPost
    const videos = videoIds
      .map((id) => byId.get(id))
      .filter((v): v is InsightPost => Boolean(v));

    const summary = summarizePosts(videos);
    const result: ProviderInsights = {
      provider: "youtube",
      status: "ok",
      // Lifetime channel views for profile card; catalog for R&D compare
      profile: { views: profileViews ?? summary.profile.views, likes: summary.profile.likes },
      lastPost: summary.lastPost,
      topVideos: summary.topVideos,
      catalog: summary.catalog,
      fetchedAt: new Date().toISOString(),
      fromCache: false,
    };

    const nextMeta = {
      ...(row.metadata || {}),
      subscriber_count: channel.statistics?.subscriberCount ?? row.metadata?.subscriber_count ?? null,
      video_count: channel.statistics?.videoCount ?? row.metadata?.video_count ?? null,
      view_count: channel.statistics?.viewCount ?? row.metadata?.view_count ?? null,
      insights: {
        provider: result.provider,
        status: result.status,
        profile: result.profile,
        lastPost: result.lastPost,
        topVideos: result.topVideos,
        catalog: result.catalog,
        fetchedAt: result.fetchedAt,
      },
    };

    await supabase
      .from("social_connections")
      .update({
        metadata: nextMeta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("user_id", userId);

    return result;
  } catch (err) {
    console.error("[social-insights] YouTube", err);
    return emptyInsights(
      "youtube",
      "error",
      err instanceof Error ? err.message : "Erreur YouTube",
    );
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization requis" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const forceRefresh = Boolean(body?.forceRefresh);

    const supabase = adminClient();
    const { data: rows, error } = await supabase
      .from("social_connections")
      .select(
        "id,provider,provider_user_id,status,access_token,refresh_token,token_expires_at,scopes,metadata",
      )
      .eq("user_id", user.id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const byProvider = new Map<SocialProvider, ConnectionRow>();
    for (const row of (rows || []) as ConnectionRow[]) {
      if (SOCIAL_PROVIDERS.includes(row.provider)) {
        byProvider.set(row.provider, row);
      }
    }

    const providers: ProviderInsights[] = await Promise.all(
      SOCIAL_PROVIDERS.map(async (provider) => {
        const row = byProvider.get(provider);
        if (!row || row.status !== "connected") {
          if (
            (provider === "youtube" ||
              provider === "instagram" ||
              provider === "tiktok" ||
              provider === "facebook") &&
            row?.status === "expired"
          ) {
            const labels: Record<string, string> = {
              youtube: "YouTube",
              instagram: "Instagram",
              tiktok: "TikTok",
              facebook: "Facebook",
            };
            return emptyInsights(
              provider,
              "expired",
              `Session ${labels[provider] || provider} expirée. Reconnecte ton compte.`,
            );
          }
          return emptyInsights(provider, "not_connected");
        }

        if (
          provider === "youtube" ||
          provider === "instagram" ||
          provider === "tiktok" ||
          provider === "facebook"
        ) {
          if (!forceRefresh) {
            const cached = readCachedInsights(row);
            if (cached) return cached;
          }

          let fresh: ProviderInsights;
          if (provider === "youtube") {
            fresh = await fetchYouTubeInsights(supabase, user.id, row);
          } else if (provider === "instagram") {
            fresh = await fetchInstagramInsights(supabase, user.id, row);
          } else if (provider === "tiktok") {
            fresh = await fetchTikTokInsights(supabase, user.id, row);
          } else {
            fresh = await fetchFacebookInsights(supabase, user.id, row);
          }

          // Si le fetch échoue, garder le dernier catalogue plutôt que griser la plateforme
          if (fresh.status !== "ok") {
            const stale = readCachedInsights(row, { allowStale: true });
            if (stale) {
              return {
                ...stale,
                message: fresh.message
                  ? `${fresh.message} (données en cache)`
                  : "Données en cache — actualisation incomplete",
              };
            }
          }
          return fresh;
        }

        return emptyInsights(provider, "not_connected");
      }),
    );

    return new Response(JSON.stringify({ providers }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[social-insights]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erreur serveur" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
