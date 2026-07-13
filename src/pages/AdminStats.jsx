import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, MousePointerClick, ArrowLeft, RefreshCw, Percent } from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { isAdmin } from "@/bibliotheque/supabase/credits";
import { fetchLinkClickStats, formatParisDateKeyLabel } from "@/bibliotheque/supabase/linkClicks";
import PageTitle from "../composants/interface/TitrePage";

const SOURCE_COLORS = {
  facebook: "#3b82f6",
  instagram: "#ec4899",
  tiktok: "#2af598",
};

const SOURCE_LABELS = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

const STATS_POLL_INTERVAL_MS = 30_000;

function formatDayLabel(dateStr) {
  return formatParisDateKeyLabel(dateStr);
}

function formatRate(ratePercent) {
  if (ratePercent == null) return "—";
  return `${ratePercent} %`;
}

function StackedChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const displayLabel =
    payload[0]?.payload?.weekLabel ??
    (typeof label === "string" && /^\d{4}-\d{2}-\d{2}$/.test(label) ? formatDayLabel(label) : label);
  return (
    <div className="glass-strong rounded-lg border border-white/10 px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium text-gray-200">{displayLabel}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="text-xs">
          {SOURCE_LABELS[entry.dataKey] ?? entry.dataKey} : {entry.value}
        </p>
      ))}
    </div>
  );
}

function HourlyChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-lg border border-white/10 px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium text-gray-200">{label}</p>
      <p className="text-xs text-[#2af598]">{payload[0]?.value ?? 0} clics</p>
    </div>
  );
}

function ConversionLine({ period, label }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">{label}</p>
      <p className="text-lg font-bold text-[#2af598]">{formatRate(period.ratePercent)}</p>
      <p className="text-xs text-gray-500">
        {period.signups} inscr. / {period.clicks} clics
      </p>
    </div>
  );
}

export default function AdminStats() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [error, setError] = useState(null);
  const [totals, setTotals] = useState({ last7Days: 0, last30Days: 0 });
  const [breakdown, setBreakdown] = useState(null);
  const [dailySeries, setDailySeries] = useState([]);
  const [hourlySeries, setHourlySeries] = useState([]);
  const [weeklySeries, setWeeklySeries] = useState([]);
  const [conversionRates, setConversionRates] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const pollIntervalRef = useRef(null);

  const loadStats = useCallback(async () => {
    setError(null);
    const stats = await fetchLinkClickStats();
    setTotals(stats.totals);
    setBreakdown(stats.breakdown);
    setDailySeries(stats.dailySeries);
    setHourlySeries(stats.hourlySeries);
    setWeeklySeries(stats.weeklySeries);
    setConversionRates(stats.conversionRates);
  }, []);

  const startStatsPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    pollIntervalRef.current = setInterval(() => {
      void loadStats().catch((err) => {
        setError(err?.message || "Erreur chargement des statistiques");
      });
    }, STATS_POLL_INTERVAL_MS);
  }, [loadStats]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!session) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const admin = await isAdmin();
        if (cancelled) return;
        setIsAdminUser(admin);
        if (admin) await loadStats();
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Erreur chargement des statistiques");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [session, loadStats]);

  useEffect(() => {
    if (!isAdminUser) return;

    startStatsPolling();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isAdminUser, startStatsPolling]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await loadStats();
      startStatsPolling();
    } catch (err) {
      setError(err?.message || "Erreur chargement des statistiques");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      </div>
    );
  }

  if (!isAdminUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
        <div className="max-lg:[&_h1]:text-2xl max-lg:[&_header]:mb-4 flex-1">
          <PageTitle
            green="Stats"
            white="Bio links"
            subtitle="Clics depuis les bios réseaux sociaux (30 derniers jours)"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 transition-all text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Administration
          </Link>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2af598]/30 bg-[#2af598]/10 text-[#2af598] hover:bg-[#2af598]/20 transition-all text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 glass-strong rounded-xl p-4 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-strong min-w-0 rounded-xl border border-white/10 p-4 lg:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="mb-1 text-xs text-gray-400">Total clics (7 jours)</p>
              <p className="text-2xl font-bold text-[#2af598]">{totals.last7Days}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#2af598]/30 bg-[#2af598]/20">
              <MousePointerClick className="h-5 w-5 text-[#2af598]" />
            </div>
          </div>
        </div>

        <div className="glass-strong min-w-0 rounded-xl border border-white/10 p-4 lg:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="mb-1 text-xs text-gray-400">Total clics (30 jours)</p>
              <p className="text-2xl font-bold text-accent">{totals.last30Days}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/20">
              <BarChart3 className="h-5 w-5 text-accent" />
            </div>
          </div>
        </div>

        <div className="glass-strong min-w-0 rounded-xl border border-white/10 p-4 lg:p-5">
          <p className="mb-3 text-xs text-gray-400">Répartition par source (30 jours)</p>
          {breakdown && (
            <div className="space-y-3">
              {(["facebook", "instagram", "tiktok"]).map((source) => (
                <div key={source}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-300">{SOURCE_LABELS[source]}</span>
                    <span className="text-gray-400">
                      {breakdown[source]}{" "}
                      <span className="text-gray-500">({breakdown.percentages[source]}%)</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${breakdown.percentages[source]}%`,
                        backgroundColor: SOURCE_COLORS[source],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-strong min-w-0 rounded-xl border border-white/10 p-4 lg:p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <p className="text-xs text-gray-400">Taux de conversion</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#2af598]/30 bg-[#2af598]/20">
              <Percent className="h-5 w-5 text-[#2af598]" />
            </div>
          </div>
          {conversionRates && (
            <div className="grid grid-cols-2 gap-4">
              <ConversionLine period={conversionRates.last7Days} label="7 jours" />
              <ConversionLine period={conversionRates.last30Days} label="30 jours" />
            </div>
          )}
          <p className="mt-3 text-[10px] text-gray-500 leading-snug">
            Inscriptions = nouveaux profils (profiles.created_at)
          </p>
        </div>
      </div>

      <div className="mt-8 glass-strong rounded-xl border border-white/10 p-4 lg:p-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-1">Clics par jour</h2>
        <p className="text-sm text-gray-400 mb-6">30 derniers jours, empilés par source</p>
        <div className="h-[360px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDayLabel}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
              />
              <Tooltip content={<StackedChartTooltip />} cursor={{ fill: "rgba(42,245,152,0.06)" }} />
              <Legend
                formatter={(value) => SOURCE_LABELS[value] ?? value}
                wrapperStyle={{ color: "#9ca3af", fontSize: 12 }}
              />
              <Bar dataKey="facebook" stackId="a" fill={SOURCE_COLORS.facebook} name="facebook" />
              <Bar dataKey="instagram" stackId="a" fill={SOURCE_COLORS.instagram} name="instagram" />
              <Bar dataKey="tiktok" stackId="a" fill={SOURCE_COLORS.tiktok} name="tiktok" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-strong rounded-xl border border-white/10 p-4 lg:p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-1">Clics par heure</h2>
          <p className="text-sm text-gray-400 mb-6">30 derniers jours, fuseau Europe/Paris</p>
          <div className="h-[280px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  interval={1}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <Tooltip content={<HourlyChartTooltip />} cursor={{ fill: "rgba(42,245,152,0.06)" }} />
                <Bar dataKey="total" fill="#2af598" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-strong rounded-xl border border-white/10 p-4 lg:p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-1">Clics par semaine</h2>
          <p className="text-sm text-gray-400 mb-6">12 dernières semaines, empilé par source</p>
          <div className="h-[280px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklySeries} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fill: "#9ca3af", fontSize: 9 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={56}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <Tooltip content={<StackedChartTooltip />} cursor={{ fill: "rgba(42,245,152,0.06)" }} />
                <Legend
                  formatter={(value) => SOURCE_LABELS[value] ?? value}
                  wrapperStyle={{ color: "#9ca3af", fontSize: 12 }}
                />
                <Bar dataKey="facebook" stackId="a" fill={SOURCE_COLORS.facebook} name="facebook" />
                <Bar dataKey="instagram" stackId="a" fill={SOURCE_COLORS.instagram} name="instagram" />
                <Bar dataKey="tiktok" stackId="a" fill={SOURCE_COLORS.tiktok} name="tiktok" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
