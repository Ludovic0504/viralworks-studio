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
} from "lucide-react";
import { useState } from "react";

const SOCIAL_NETWORKS = [
  {
    id: "instagram",
    label: "Instagram",
    Icon: InstagramGlyph,
  },
  {
    id: "tiktok",
    label: "TikTok",
    Icon: TikTokGlyph,
  },
  {
    id: "youtube",
    label: "YouTube",
    Icon: YouTubeGlyph,
  },
  {
    id: "facebook",
    label: "Facebook",
    Icon: FacebookGlyph,
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

function InstagramGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function TikTokGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 4v9.2a3.8 3.8 0 1 1-2.6-3.6V7.2c1.4.9 2.7 1.4 4.2 1.5V4H14Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function YouTubeGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 9.5v5l4.5-2.5L11 9.5Z" fill="currentColor" />
    </svg>
  );
}

function FacebookGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 8h2V5h-2c-2.2 0-4 1.8-4 4v2H8v3h2v6h3v-6h2.2l.8-3H13V9c0-.6.4-1 1-1Z"
        fill="currentColor"
      />
    </svg>
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
  networksConnected = 0,
  socialConnections = [],
  socialBusyProvider = null,
  socialFlash = null,
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

  const greetingName = displayName?.trim() || "là";
  const activityItems = showAllActivity ? recentActivity : recentActivity.slice(0, 6);

  const connectionByProvider = Object.fromEntries(
    (socialConnections || []).map((c) => [c.provider, c]),
  );

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
          <p className="dash-kpi-value">{networksConnected}</p>
        </div>
      </div>

      <section className="profil-section">
        <div className="profil-section-head">
          <div className="profil-section-head-main">
            <h3 className="profil-section-title">Réseaux sociaux</h3>
          </div>
        </div>
        <div className="dash-social-grid">
          {SOCIAL_NETWORKS.map((network) => {
            const NetworkIcon = network.Icon;
            const conn = connectionByProvider[network.id];
            const connected = conn?.status === "connected";
            const busy = socialBusyProvider === network.id;
            const accountLabel =
              conn?.username || conn?.display_name || (connected ? "Compte relié" : null);
            const statsBits = [];
            if (network.id === "youtube" && conn?.metadata) {
              if (conn.metadata.subscriber_count != null) {
                statsBits.push(`${conn.metadata.subscriber_count} abonnés`);
              }
              if (conn.metadata.video_count != null) {
                statsBits.push(`${conn.metadata.video_count} vidéos`);
              }
              if (conn.metadata.view_count != null) {
                statsBits.push(`${conn.metadata.view_count} vues`);
              }
            }

            return (
              <div
                key={network.id}
                className={`dash-social-card${connected ? " is-connected" : ""}`}
              >
                <div className="dash-social-card-main">
                  <NetworkIcon className="dash-social-icon" />
                  <div className="min-w-0">
                    <span className="dash-social-label">{network.label}</span>
                    {connected && accountLabel ? (
                      <p className="dash-social-account" title={accountLabel}>
                        @{String(accountLabel).replace(/^@/, "")}
                      </p>
                    ) : null}
                    {statsBits.length > 0 ? (
                      <p className="dash-social-stats">{statsBits.join(" · ")}</p>
                    ) : null}
                  </div>
                </div>
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
              </div>
            );
          })}
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
