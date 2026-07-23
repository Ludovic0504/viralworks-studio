import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";

export type SocialProvider = "instagram" | "facebook" | "tiktok" | "youtube";

export type SocialConnectionPublic = {
  id: string;
  user_id: string;
  provider: SocialProvider;
  provider_user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  status: "connected" | "expired" | "revoked";
  metadata: Record<string, unknown> | null;
  connected_at: string;
  updated_at: string;
  token_expires_at: string | null;
};

export type SocialInsightStatus =
  | "ok"
  | "not_connected"
  | "scope_missing"
  | "expired"
  | "error";

export type SocialInsightPost = {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  retention: number | null;
};

export type SocialVideoCatalog = {
  videoCount: number;
  truncated: boolean;
  viewsSum: number | null;
  likesSum: number | null;
  avgViews: number | null;
  medianViews: number | null;
  videos: SocialInsightPost[];
};

export type SocialProviderInsights = {
  provider: SocialProvider;
  status: SocialInsightStatus;
  message?: string;
  profile: { views: number | null; likes: number | null };
  lastPost: SocialInsightPost | null;
  topVideos: SocialInsightPost[];
  catalog?: SocialVideoCatalog | null;
  fetchedAt?: string;
  fromCache?: boolean;
};

export type SocialInsightsResponse = {
  providers: SocialProviderInsights[];
};

const PUBLIC_COLUMNS =
  "id,user_id,provider,provider_user_id,username,display_name,avatar_url,status,metadata,connected_at,updated_at,token_expires_at";

export async function listSocialConnections(): Promise<SocialConnectionPublic[]> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("social_connections")
    .select(PUBLIC_COLUMNS)
    .order("connected_at", { ascending: false });

  if (error) {
    console.error("[listSocialConnections]", error);
    return [];
  }
  return (data || []) as SocialConnectionPublic[];
}

export async function startSocialOAuth(
  provider: SocialProvider,
): Promise<{ url?: string; error?: string }> {
  const supabase = getBrowserSupabase();
  const returnOrigin = window.location.origin;

  const { data, error } = await supabase.functions.invoke("social-oauth-start", {
    body: { provider, returnOrigin },
  });

  if (error) {
    let detail = error.message || "Impossible de démarrer la connexion";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) detail = String(body.error);
      }
    } catch {
      /* ignore */
    }
    if ((data as { error?: string } | null)?.error) {
      detail = String((data as { error: string }).error);
    }
    return { error: detail };
  }

  const url = (data as { url?: string } | null)?.url;
  if (!url) {
    return {
      error: (data as { error?: string } | null)?.error || "URL OAuth manquante",
    };
  }
  return { url };
}

export async function disconnectSocialProvider(
  provider: SocialProvider,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase.functions.invoke("social-oauth-disconnect", {
    body: { provider },
  });

  if (error) {
    return {
      success: false,
      error: (data as { error?: string } | null)?.error || error.message,
    };
  }
  if ((data as { error?: string } | null)?.error) {
    return { success: false, error: (data as { error: string }).error };
  }
  return { success: true };
}

export async function fetchSocialInsights(options?: {
  forceRefresh?: boolean;
}): Promise<{ data?: SocialInsightsResponse; error?: string }> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase.functions.invoke("social-insights", {
    body: { forceRefresh: Boolean(options?.forceRefresh) },
  });

  if (error) {
    let detail = error.message || "Impossible de charger les stats";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) detail = String(body.error);
      }
    } catch {
      /* ignore */
    }
    if ((data as { error?: string } | null)?.error) {
      detail = String((data as { error: string }).error);
    }
    return { error: detail };
  }

  if ((data as { error?: string } | null)?.error) {
    return { error: String((data as { error: string }).error) };
  }

  const providers = (data as SocialInsightsResponse | null)?.providers;
  if (!Array.isArray(providers)) {
    return { error: "Réponse insights invalide" };
  }

  return { data: { providers } };
}

export function connectionLabel(conn: SocialConnectionPublic | undefined): string {
  if (!conn) return "";
  return conn.username || conn.display_name || conn.provider_user_id || "Compte connecté";
}
