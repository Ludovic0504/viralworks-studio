import { Link } from "react-router-dom";
import {
  Lightbulb,
  Video,
  Image as ImageIcon,
  BarChart3,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Shield,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState } from "react";

const SOCIAL_NETWORKS = [
  {
    id: "instagram",
    label: "Instagram",
    iconSrc: "/assets/social/instagram.png",
  },
  {
    id: "tiktok",
    label: "TikTok",
    iconSrc: "/assets/social/tiktok.png",
  },
  {
    id: "youtube",
    label: "YouTube",
    iconSrc: "/assets/social/youtube.png",
  },
];

const AGENTS = [
  {
    id: "marketing",
    title: "Assistant marketing",
    description: "Idées de campagne et angles de contenus",
    to: "/viralworks",
    Icon: Lightbulb,
  },
  {
    id: "video-prompts",
    title: "Prompts vidéo",
    description: "Prépare un brief vidéo complet",
    to: "/viralworks",
    Icon: Video,
  },
  {
    id: "ugc-check",
    title: "Analyse image",
    description: "Vérifie le rendu UGC d’une photo",
    to: "/image-studio",
    Icon: ImageIcon,
  },
  {
    id: "quota-coach",
    title: "Coach quotas",
    description: "Priorise tes crédits restants",
    action: "quotas",
    Icon: BarChart3,
  },
];

const numberFmt = new Intl.NumberFormat("fr-FR");

function formatMetric(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return numberFmt.format(Number(value));
}

function formatRetention(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const pct = n <= 1 ? n * 100 : n;
  return `${Math.round(pct)} %`;
}

function formatEngagement(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const pct = Number(value) * 100;
  if (pct < 0.1) return `${pct.toFixed(2)} %`;
  if (pct < 10) return `${pct.toFixed(1)} %`;
  return `${Math.round(pct)} %`;
}

function formatShortDate(iso) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

function insightStatusLabel(status, connected) {
  if (!connected) return "Non connecté";
  switch (status) {
    case "ok":
      return "Stats actives";
    case "scope_missing":
      return "Stats indisponibles";
    case "expired":
      return "Session expirée";
    case "error":
      return "Erreur";
    case "loading":
      return "Chargement…";
    case "connected":
      return "Connecté";
    case "not_connected":
      return "Non connecté";
    default:
      return connected ? "Connecté" : "Non connecté";
  }
}

function MetricRow({ label, value }) {
  return (
    <div className="dash-insight-metric">
      <span className="dash-insight-metric-label">{label}</span>
      <span className="dash-insight-metric-value">{value}</span>
    </div>
  );
}

function VideoInsightRow({ video, showProvider }) {
  if (!video) return null;
  return (
    <div className="dash-insight-video">
      {video.thumbnailUrl ? (
        <img
          src={video.thumbnailUrl}
          alt=""
          className="dash-insight-thumb"
          width={64}
          height={36}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="dash-insight-thumb dash-insight-thumb--empty" aria-hidden />
      )}
      <div className="dash-insight-video-body min-w-0">
        <p className="dash-insight-video-title" title={video.title || undefined}>
          {video.title || "Sans titre"}
        </p>
        <p className="dash-insight-video-meta">
          {showProvider ? `${showProvider} · ` : ""}
          {formatMetric(video.views)} vues · {formatMetric(video.likes)} likes · rétention{" "}
          {formatRetention(video.retention)}
        </p>
      </div>
    </div>
  );
}

function activityMeta(item) {
  const kind = String(item?.kind || "").toLowerCase();
  if (kind === "video") {
    return { label: "Génération de vidéo", delta: "−1" };
  }
  if (kind === "image") {
    const urls = Array.isArray(item?.metadata?.urls)
      ? item.metadata.urls
      : Array.isArray(item?.urls)
        ? item.urls
        : item?.output || item?.url
          ? [1]
          : [];
    const n = Math.max(1, urls.length);
    return {
      label: n > 1 ? `${n} images générées` : "Image générée",
      delta: null,
    };
  }
  if (kind === "prompt" || kind === "text") {
    return { label: "Génération de prompt", delta: null };
  }
  return { label: "Création", delta: null };
}

/**
 * Vue principale du tableau de bord (aperçu, réseaux, agents, activité).
 */
export default function TableauDeBordProfil({
  displayName,
  planSubtitle,
  avatarUrl,
  accountCreatedLabel,
  isAdmin = false,
  videosRemaining,
  creationsThisMonth,
  networksConnected: _networksConnected = 0,
  socialConnections = [],
  socialBusyProvider = null,
  socialFlash = null,
  socialInsights = [],
  socialInsightsLoading = false,
  socialInsightsError = null,
  onRefreshSocialInsights,
  onConnectSocial,
  onDisconnectSocial,
  onDismissSocialFlash,
  recentActivity = [],
  historyLoading = false,
  onOpenQuotaCoach,
  formatDate,
  getKindPath,
}) {
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [openProviderId, setOpenProviderId] = useState(null);
  const [top3Open, setTop3Open] = useState(true);

  const greetingName = displayName?.trim() || "là";
  const activityItems = showAllActivity ? recentActivity : recentActivity.slice(0, 6);

  const connectionByProvider = Object.fromEntries(
    (socialConnections || []).map((c) => [c.provider, c]),
  );

  const insightByProvider = useMemo(() => {
    const map = {};
    for (const row of socialInsights || []) {
      if (row?.provider) map[row.provider] = row;
    }
    return map;
  }, [socialInsights]);

  const hasConnected = SOCIAL_NETWORKS.some(
    (n) => connectionByProvider[n.id]?.status === "connected",
  );
  const networksConnectedCount = SOCIAL_NETWORKS.filter(
    (n) => connectionByProvider[n.id]?.status === "connected",
  ).length;

  const globalReport = useMemo(() => {
    const byProvider = new Map((socialInsights || []).map((p) => [p.provider, p]));

    const platforms = SOCIAL_NETWORKS.map((network) => {
      const p = byProvider.get(network.id);
      const connected = Boolean(
        (socialConnections || []).find(
          (c) => c.provider === network.id && c.status === "connected",
        ),
      );

      if (!p || p.status !== "ok") {
        return {
          id: network.id,
          label: network.label,
          iconSrc: network.iconSrc,
          connected,
          ready: false,
          status: p?.status || (connected ? "error" : "not_connected"),
          statusMessage: p?.message || null,
          viewsSum: null,
          likesSum: null,
          viewsAvg: null,
          likesAvg: null,
          engagement: null,
          sampleSize: 0,
          truncated: false,
        };
      }

      const catalog = p.catalog;
      const videos =
        Array.isArray(catalog?.videos) && catalog.videos.length > 0
          ? catalog.videos
          : (() => {
              const fallback = [];
              if (p.lastPost?.id) fallback.push(p.lastPost);
              for (const v of p.topVideos || []) {
                if (v?.id && !fallback.some((x) => x.id === v.id)) fallback.push(v);
              }
              return fallback;
            })();

      const withViews = videos.filter((v) => v.views != null);
      const withLikes = videos.filter((v) => v.likes != null);
      const viewsSum =
        catalog?.viewsSum != null
          ? catalog.viewsSum
          : withViews.length
            ? withViews.reduce((s, v) => s + (Number(v.views) || 0), 0)
            : null;
      const likesSum =
        catalog?.likesSum != null
          ? catalog.likesSum
          : withLikes.length
            ? withLikes.reduce((s, v) => s + (Number(v.likes) || 0), 0)
            : null;
      const viewsAvg =
        catalog?.avgViews != null
          ? catalog.avgViews
          : withViews.length && viewsSum != null
            ? viewsSum / withViews.length
            : null;
      const likesAvg = withLikes.length && likesSum != null ? likesSum / withLikes.length : null;
      const engagement =
        viewsSum != null && viewsSum > 0 && likesSum != null ? likesSum / viewsSum : null;

      return {
        id: network.id,
        label: network.label,
        iconSrc: network.iconSrc,
        connected: true,
        ready: true,
        status: "ok",
        statusMessage: p.message || null,
        viewsSum,
        likesSum,
        viewsAvg,
        likesAvg,
        engagement,
        sampleSize: catalog?.videoCount ?? videos.length,
        truncated: Boolean(catalog?.truncated),
      };
    });

    const ready = platforms.filter((p) => p.ready);
    const viewsTotal = ready.reduce((s, p) => s + (p.viewsSum || 0), 0);
    const likesTotal = ready.reduce((s, p) => s + (p.likesSum || 0), 0);
    const hasViews = ready.some((p) => p.viewsSum != null);
    const hasLikes = ready.some((p) => p.likesSum != null);

    const withShare = platforms.map((p) => ({
      ...p,
      viewsShare:
        hasViews && p.viewsSum != null && viewsTotal > 0 ? p.viewsSum / viewsTotal : null,
      likesShare:
        hasLikes && p.likesSum != null && likesTotal > 0 ? p.likesSum / likesTotal : null,
    }));

    const rankedByViews = [...withShare]
      .filter((p) => p.ready && p.viewsSum != null)
      .sort((a, b) => (b.viewsSum || 0) - (a.viewsSum || 0));
    const rankById = new Map(rankedByViews.map((p, i) => [p.id, i + 1]));

    const volumeLeader = rankedByViews[0] || null;
    const engagementLeader =
      [...withShare]
        .filter((p) => p.ready && p.engagement != null)
        .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))[0] || null;

    const ok = withShare.filter((p) => p.ready);

    const ranked = [];
    for (const p of socialInsights || []) {
      if (p.status !== "ok") continue;
      if (!SOCIAL_NETWORKS.some((n) => n.id === p.provider)) continue;
      const pool =
        Array.isArray(p.catalog?.videos) && p.catalog.videos.length > 0
          ? p.catalog.videos
          : p.topVideos || [];
      for (const v of pool) {
        if (v?.views == null) continue;
        ranked.push({
          ...v,
          provider: p.provider,
          providerLabel: SOCIAL_NETWORKS.find((n) => n.id === p.provider)?.label || p.provider,
        });
      }
    }
    ranked.sort((a, b) => (b.views || 0) - (a.views || 0));

    const sampleTotal = withShare.reduce((s, p) => s + (p.sampleSize || 0), 0);
    const anyTruncated = withShare.some((p) => p.truncated);
    const coverageNotes = (socialInsights || [])
      .filter((p) => p.status === "ok" && p.message)
      .map((p) => p.message);

    return {
      platforms: withShare.map((p) => ({ ...p, rank: rankById.get(p.id) || null })),
      viewsTotal: hasViews ? viewsTotal : null,
      likesTotal: hasLikes ? likesTotal : null,
      volumeLeader,
      engagementLeader,
      top3: ranked.slice(0, 3),
      okCount: ok.length,
      sampleTotal,
      anyTruncated,
      coverageNotes,
    };
  }, [socialInsights, socialConnections]);

  const toggleProvider = (id) => {
    setOpenProviderId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="dash-board">
      <header className="dash-board-header">
        <div className="dash-board-identity">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="dash-board-avatar dash-board-avatar--lg" />
          ) : (
            <div className="dash-board-avatar dash-board-avatar--lg dash-board-avatar--fallback" aria-hidden>
              {greetingName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="dash-board-greeting">Bonjour {greetingName}</h1>
            {planSubtitle ? <p className="dash-board-plan">{planSubtitle}</p> : null}
            <div className="dash-board-meta">
              {accountCreatedLabel ? (
                <span className="dash-board-meta-item">Compte créé le {accountCreatedLabel}</span>
              ) : null}
              {isAdmin ? (
                <span className="dash-board-meta-item dash-board-meta-item--admin">
                  <Shield className="h-3 w-3" strokeWidth={2} aria-hidden />
                  Administrateur
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="dash-kpi-grid">
        <div className="dash-kpi-card">
          <p className="dash-kpi-label">Vidéos restantes</p>
          <p className="dash-kpi-value">{videosRemaining === null ? "…" : videosRemaining}</p>
        </div>
        <div className="dash-kpi-card">
          <p className="dash-kpi-label">Créations ce mois</p>
          <p className="dash-kpi-value">{creationsThisMonth}</p>
        </div>
        <div className="dash-kpi-card">
          <p className="dash-kpi-label">Réseaux connectés</p>
          <p className="dash-kpi-value">{networksConnectedCount}</p>
        </div>
      </div>

      <section className="profil-section">
        <div className="profil-section-head">
          <div className="profil-section-head-main">
            <h3 className="profil-section-title">Réseaux sociaux</h3>
          </div>
          {hasConnected ? (
            <button
              type="button"
              className="dash-insight-refresh"
              disabled={socialInsightsLoading}
              onClick={() => onRefreshSocialInsights?.()}
              title="Actualiser"
            >
              <RefreshCw
                className={`h-3.5 w-3.5${socialInsightsLoading ? " animate-spin" : ""}`}
                aria-hidden
              />
              Actualiser
            </button>
          ) : null}
        </div>

        {socialFlash ? (
          <div
            className={`dash-social-notice${socialFlash.type === "error" ? " is-error" : ""}`}
            role="status"
          >
            <p>{socialFlash.message}</p>
            <button type="button" className="dash-social-notice-close" onClick={onDismissSocialFlash}>
              OK
            </button>
          </div>
        ) : null}

        {hasConnected ? (
          <div className="dash-insight-panel">
            {socialInsightsLoading && globalReport.okCount === 0 ? (
              <div className="dash-insight-skeleton" aria-busy="true">
                <div className="dash-insight-skeleton-bar" />
                <div className="dash-insight-skeleton-bar dash-insight-skeleton-bar--short" />
              </div>
            ) : socialInsightsError && globalReport.okCount === 0 ? (
              <p className="dash-insight-empty">{socialInsightsError}</p>
            ) : (
              <>
                <div className="dash-rd-table">
                  <div className="dash-rd-thead" aria-hidden>
                    <span className="dash-rd-th dash-rd-th--plat" />
                    <span className="dash-rd-th">Vues</span>
                    <span className="dash-rd-th">Likes</span>
                    <span className="dash-rd-th">Vidéos</span>
                    <span className="dash-rd-th">Moy. vues</span>
                    <span className="dash-rd-th">Engagement</span>
                  </div>
                  {globalReport.platforms.map((p) => {
                    const needsReconnect =
                      p.ready &&
                      p.id === "instagram" &&
                      (p.status === "scope_missing" ||
                        p.status === "expired" ||
                        (p.viewsSum == null && p.likesSum == null));
                    const statusLabel =
                      p.status === "scope_missing" || needsReconnect
                        ? "Reconnecte"
                        : p.status === "expired"
                          ? "Expiré"
                          : p.status === "error"
                            ? "Erreur"
                            : !p.ready
                              ? "En attente"
                              : null;
                    return (
                      <div
                        key={p.id}
                        className={`dash-rd-trow${!p.ready ? " is-muted" : ""}`}
                      >
                        <div className="dash-rd-plat">
                          <img
                            src={p.iconSrc}
                            alt=""
                            className="dash-social-icon"
                            width={20}
                            height={20}
                            decoding="async"
                          />
                          <span className="dash-rd-plat-name">{p.label}</span>
                          {p.ready && p.id === "instagram" ? (
                            <span className="dash-rd-plat-note">(90 derniers jours)</span>
                          ) : null}
                          {statusLabel ? (
                            <span className="dash-rd-tag">{statusLabel}</span>
                          ) : null}
                        </div>
                        {p.ready ? (
                          <>
                            <span className="dash-rd-num">
                              {p.viewsSum != null ? formatMetric(p.viewsSum) : "—"}
                            </span>
                            <span className="dash-rd-num">
                              {p.likesSum != null ? formatMetric(p.likesSum) : "—"}
                            </span>
                            <span className="dash-rd-num">
                              {p.sampleSize || 0}
                              {p.truncated ? "+" : ""}
                            </span>
                            <span className="dash-rd-num">
                              {p.viewsAvg != null
                                ? formatMetric(Math.round(p.viewsAvg))
                                : "—"}
                            </span>
                            <span className="dash-rd-num">
                              {formatEngagement(p.engagement)}
                            </span>
                          </>
                        ) : (
                          <p className="dash-rd-status-msg dash-rd-status-msg--span">
                            {p.statusMessage ||
                              (p.connected
                                ? "Stats indisponibles — Actualiser ou reconnecte."
                                : "Compte non connecté.")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="dash-insight-accordion">
                  <button
                    type="button"
                    className="dash-insight-accordion-trigger"
                    aria-expanded={top3Open}
                    onClick={() => setTop3Open((v) => !v)}
                  >
                    <span>Top 3 cross-plateforme</span>
                    {top3Open ? (
                      <ChevronUp className="h-4 w-4" aria-hidden />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                  {top3Open ? (
                    <div className="dash-insight-accordion-body">
                      {globalReport.top3.length > 0 ? (
                        <div className="dash-insight-video-list">
                          {globalReport.top3.map((video, i) => (
                            <VideoInsightRow
                              key={`${video.provider}-${video.id}-${i}`}
                              video={video}
                              showProvider={video.providerLabel}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="dash-insight-empty">
                          Pas encore de vidéos classées. Connecte un réseau pour comparer.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ) : null}

        <div className="dash-social-block">
          <div className="dash-social-grid dash-social-grid--3">
            {SOCIAL_NETWORKS.map((network) => {
              const conn = connectionByProvider[network.id];
              const connected = conn?.status === "connected";
              const insight = insightByProvider[network.id];
              const status =
                insight?.status ||
                (connected
                  ? socialInsightsLoading
                    ? "loading"
                    : "connected"
                  : "not_connected");
              const open = openProviderId === network.id;
              const busy = socialBusyProvider === network.id;
              const accountLabel =
                conn?.username || conn?.display_name || (connected ? "Compte relié" : null);

              return (
                <div
                  key={network.id}
                  className={`dash-social-card dash-social-card--stack${connected ? " is-connected" : ""}${open ? " is-open" : ""}`}
                >
                  <div className="dash-social-card-top">
                    <div className="dash-social-card-main">
                      <img
                        src={network.iconSrc}
                        alt=""
                        className="dash-social-icon"
                        width={28}
                        height={28}
                        decoding="async"
                      />
                      <div className="min-w-0">
                        <span className="dash-social-label">{network.label}</span>
                        {connected && accountLabel ? (
                          <p className="dash-social-account" title={accountLabel}>
                            @{String(accountLabel).replace(/^@/, "")}
                          </p>
                        ) : (
                          <p className="dash-social-account dash-social-account--muted">Non connecté</p>
                        )}
                      </div>
                    </div>
                    <span className={`dash-insight-badge dash-insight-badge--${status}`}>
                      {insightStatusLabel(status, connected)}
                    </span>
                  </div>

                  <div className="dash-social-card-actions">
                    {connected ? (
                      <button
                        type="button"
                        className="dash-social-connect dash-social-connect--disconnect"
                        disabled={busy}
                        onClick={() => onDisconnectSocial?.(network.id)}
                      >
                        {busy ? "…" : "Déconnecter"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="dash-social-connect"
                        disabled={busy}
                        onClick={() => onConnectSocial?.(network.id)}
                      >
                        {busy ? "…" : "Connecter"}
                      </button>
                    )}
                    <button
                      type="button"
                      className={`dash-social-stats-toggle${open ? " is-active" : ""}`}
                      aria-expanded={open}
                      onClick={() => toggleProvider(network.id)}
                    >
                      Stats
                      {open ? (
                        <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {openProviderId
            ? (() => {
                const network = SOCIAL_NETWORKS.find((n) => n.id === openProviderId);
                if (!network) return null;
                const conn = connectionByProvider[network.id];
                const connected = conn?.status === "connected";
                const insight = insightByProvider[network.id];
                const status =
                  insight?.status ||
                  (connected
                    ? socialInsightsLoading
                      ? "loading"
                      : "connected"
                    : "not_connected");
                const busy = socialBusyProvider === network.id;
                const published = formatShortDate(insight?.lastPost?.publishedAt);

                return (
                  <div className="dash-social-detail-panel" key={network.id}>
                    <div className="dash-social-detail-head">
                      <img
                        src={network.iconSrc}
                        alt=""
                        className="dash-social-icon"
                        width={28}
                        height={28}
                        decoding="async"
                      />
                      <span className="dash-insight-provider-name">{network.label}</span>
                    </div>

                    {!connected ? (
                      <p className="dash-insight-empty">
                        Connecte {network.label} pour voir les stats.
                      </p>
                    ) : status === "scope_missing" || status === "expired" ? (
                      <div className="dash-insight-cta-row">
                        <p className="dash-insight-empty">
                          {insight?.message ||
                            (network.id === "instagram"
                              ? "Reconnecte Instagram pour autoriser likes / vues."
                              : network.id === "tiktok"
                                ? "Reconnecte TikTok (video.list + user.info.stats)."
                                : "Stats indisponibles. Reconnecte le compte.")}
                        </p>
                        <button
                          type="button"
                          className="dash-social-connect"
                          disabled={busy}
                          onClick={() => onConnectSocial?.(network.id)}
                        >
                          {busy ? "…" : "Reconnecter"}
                        </button>
                      </div>
                    ) : status === "error" ? (
                      <p className="dash-insight-empty">
                        {insight?.message || "Impossible de charger les stats."}
                      </p>
                    ) : status === "ok" ? (
                      <div className="dash-social-detail-grid">
                        <div>
                          <div className="dash-insight-section-label">Profil</div>
                          <div className="dash-insight-metrics">
                            <MetricRow
                              label="Vues"
                              value={formatMetric(insight?.profile?.views)}
                            />
                            <MetricRow
                              label="Likes"
                              value={formatMetric(insight?.profile?.likes)}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="dash-insight-section-label">Dernier post</div>
                          {insight?.lastPost ? (
                            <>
                              <VideoInsightRow video={insight.lastPost} />
                              {published ? (
                                <p className="dash-insight-video-date">Publié le {published}</p>
                              ) : null}
                              <div className="dash-insight-metrics">
                                <MetricRow
                                  label="Vues"
                                  value={formatMetric(insight.lastPost.views)}
                                />
                                <MetricRow
                                  label="Likes"
                                  value={formatMetric(insight.lastPost.likes)}
                                />
                                <MetricRow
                                  label="Rétention"
                                  value={formatRetention(insight.lastPost.retention)}
                                />
                              </div>
                            </>
                          ) : (
                            <p className="dash-insight-empty">Aucun post récent trouvé.</p>
                          )}
                        </div>
                      </div>
                    ) : status === "loading" ? (
                      <p className="dash-insight-empty">Chargement des stats…</p>
                    ) : (
                      <p className="dash-insight-empty">Aucune donnée.</p>
                    )}
                  </div>
                );
              })()
            : null}
        </div>
      </section>

      <section className="profil-section">
        <div className="profil-section-head">
          <div className="profil-section-head-main">
            <h3 className="profil-section-title">Agents</h3>
          </div>
        </div>
        <div className="dash-agents-grid">
          {AGENTS.map((agent) => {
            const AgentIcon = agent.Icon;
            const body = (
              <>
                <div className="dash-agent-icon-wrap">
                  <AgentIcon className="dash-agent-icon" strokeWidth={2} aria-hidden />
                </div>
                <div className="dash-agent-body">
                  <p className="dash-agent-title">{agent.title}</p>
                  <p className="dash-agent-desc">{agent.description}</p>
                </div>
                <span className="dash-agent-cta">
                  Lancer
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </span>
              </>
            );

            if (agent.action === "quotas") {
              return (
                <button
                  key={agent.id}
                  type="button"
                  className="dash-agent-card"
                  onClick={onOpenQuotaCoach}
                >
                  {body}
                </button>
              );
            }

            return (
              <Link key={agent.id} to={agent.to} className="dash-agent-card">
                {body}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="profil-section">
        <div className="profil-section-head">
          <div className="profil-section-head-main">
            <h3 className="profil-section-title">Activité récente</h3>
          </div>
          <Link to="/galerie" className="dash-activity-gallery-link">
            Galerie
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        </div>

        {historyLoading ? (
          <div className="profil-empty">Chargement…</div>
        ) : recentActivity.length > 0 ? (
          <>
            <div className="dash-activity-list">
              {activityItems.map((item, index) => {
                const meta = activityMeta(item);
                const path = getKindPath?.(item.kind) || "/galerie";
                return (
                  <Link key={item.id || `${item.kind}-${index}`} to={path} className="dash-activity-row">
                    <span className="dash-activity-label">{meta.label}</span>
                    <span className="dash-activity-meta">
                      {formatDate?.(item.created_at || item.createdAt)}
                      {meta.delta ? ` · ${meta.delta}` : ""}
                    </span>
                  </Link>
                );
              })}
            </div>
            {recentActivity.length > 6 ? (
              <button
                type="button"
                className="profil-expand-btn"
                onClick={() => setShowAllActivity((v) => !v)}
              >
                {showAllActivity ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Voir moins
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Voir plus
                  </>
                )}
              </button>
            ) : null}
          </>
        ) : (
          <div className="profil-empty">Aucune activité récente</div>
        )}
      </section>
    </div>
  );
}
