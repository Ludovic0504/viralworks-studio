import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";

export type LinkClickSource = "facebook" | "instagram" | "tiktok";

export type LinkClickRow = {
  source: string;
  clicked_at: string;
};

export type ProfileSignupRow = {
  created_at: string;
};

export type DailyClickPoint = {
  date: string;
  facebook: number;
  instagram: number;
  tiktok: number;
};

export type WeeklyClickPoint = DailyClickPoint & {
  weekKey: string;
  weekLabel: string;
};

export type HourlyClickPoint = {
  hour: number;
  label: string;
  total: number;
};

export type LinkClickTotals = {
  last7Days: number;
  last30Days: number;
};

export type SourceBreakdown = Record<LinkClickSource, number> & {
  total: number;
  percentages: Record<LinkClickSource, number>;
};

export type ConversionPeriod = {
  clicks: number;
  signups: number;
  ratePercent: number | null;
};

export type ConversionRates = {
  last7Days: ConversionPeriod;
  last30Days: ConversionPeriod;
};

const SOURCES: LinkClickSource[] = ["facebook", "instagram", "tiktok"];
const PARIS_TZ = "Europe/Paris";

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function isLinkClickSource(value: string): value is LinkClickSource {
  return SOURCES.includes(value as LinkClickSource);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymdKey(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Date calendaire YYYY-MM-DD en Europe/Paris pour un instant ISO. */
function clickedAtToParisDateKey(iso: string): string {
  return toParisDateString(iso);
}

/** Premier jour inclus d'une fenêtre glissante de `sinceDays` jours (calendrier Paris). */
function getParisCutoffDateKey(sinceDays: number): string {
  const today = getTodayParisYmd();
  const cutoff = addCalendarDays(today.y, today.m, today.d, -(sinceDays - 1));
  return ymdKey(cutoff.y, cutoff.m, cutoff.d);
}

/** Instant UTC du début du jour civil `y-m-d` à Paris (00:00). */
function parisMidnightUtcIso(y: number, m: number, d: number): string {
  const target = ymdKey(y, m, d);
  const probeStart = Date.UTC(y, m - 1, d - 1, 0, 0, 0);
  const probeEnd = Date.UTC(y, m - 1, d + 2, 0, 0, 0);

  for (let t = probeStart; t <= probeEnd; t += 60 * 60 * 1000) {
    const iso = new Date(t).toISOString();
    if (toParisDateString(iso) === target && getHourInParis(iso) === 0) {
      return iso;
    }
  }

  return new Date(Date.UTC(y, m - 1, d - 1, 23, 0, 0)).toISOString();
}

function parisMidnightUtcIsoFromDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return parisMidnightUtcIso(y, m, d);
}

function filterRowsSince(rows: LinkClickRow[], sinceDays: number): LinkClickRow[] {
  const cutoffKey = getParisCutoffDateKey(sinceDays);
  return rows.filter((row) => {
    if (Number.isNaN(new Date(row.clicked_at).getTime())) return false;
    return clickedAtToParisDateKey(row.clicked_at) >= cutoffKey;
  });
}

function filterProfilesSince(rows: ProfileSignupRow[], sinceDays: number): ProfileSignupRow[] {
  const cutoffKey = getParisCutoffDateKey(sinceDays);
  return rows.filter((row) => {
    if (Number.isNaN(new Date(row.created_at).getTime())) return false;
    return toParisDateString(row.created_at) >= cutoffKey;
  });
}

/** Libellé axe graphique pour une clé date Paris (YYYY-MM-DD). */
export function formatParisDateKeyLabel(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: PARIS_TZ,
  }).format(new Date(parisMidnightUtcIso(y, m, d)));
}

export function getHourInParis(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS_TZ,
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hourPart = parts.find((p) => p.type === "hour");
  return parseInt(hourPart?.value ?? "0", 10);
}

function toParisDateString(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function getParisWeekday(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS_TZ,
    weekday: "short",
  }).formatToParts(new Date(iso));
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  return WEEKDAY_MAP[wd] ?? 1;
}

function getTodayParisYmd(): { y: number; m: number; d: number } {
  const s = toParisDateString(new Date().toISOString());
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

function addCalendarDays(y: number, m: number, d: number, delta: number): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function getMondayYmdFromParisDate(y: number, m: number, d: number, weekday: number): { y: number; m: number; d: number } {
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return addCalendarDays(y, m, d, -daysFromMonday);
}

function getMondayWeekKeyParis(iso: string): string {
  const dateStr = toParisDateString(iso);
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = getParisWeekday(iso);
  const monday = getMondayYmdFromParisDate(y, m, d, weekday);
  return ymdKey(monday.y, monday.m, monday.d);
}

function formatWeekLabel(mondayY: number, mondayM: number, mondayD: number): string {
  const sunday = addCalendarDays(mondayY, mondayM, mondayD, 6);
  const month = new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    timeZone: PARIS_TZ,
  }).format(new Date(parisMidnightUtcIso(sunday.y, sunday.m, sunday.d)));
  return `${mondayD}–${sunday.d} ${month}`;
}

export function buildDailySeries(rows: LinkClickRow[], days = 30): DailyClickPoint[] {
  const filtered = filterRowsSince(rows, days);
  const series: DailyClickPoint[] = [];
  const today = getTodayParisYmd();

  for (let i = days - 1; i >= 0; i--) {
    const d = addCalendarDays(today.y, today.m, today.d, -i);
    series.push({
      date: ymdKey(d.y, d.m, d.d),
      facebook: 0,
      instagram: 0,
      tiktok: 0,
    });
  }

  const indexByDate = new Map(series.map((p, i) => [p.date, i]));

  for (const row of filtered) {
    if (!isLinkClickSource(row.source)) continue;
    const key = clickedAtToParisDateKey(row.clicked_at);
    const idx = indexByDate.get(key);
    if (idx === undefined) continue;
    series[idx][row.source] += 1;
  }

  return series;
}

export function buildHourlySeries(rows: LinkClickRow[], sinceDays = 30): HourlyClickPoint[] {
  const filtered = filterRowsSince(rows, sinceDays);
  const series: HourlyClickPoint[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${hour}h`,
    total: 0,
  }));

  for (const row of filtered) {
    const hour = getHourInParis(row.clicked_at);
    if (hour >= 0 && hour <= 23) {
      series[hour].total += 1;
    }
  }

  return series;
}

export function buildWeeklySeries(rows: LinkClickRow[], weeks = 12): WeeklyClickPoint[] {
  const filtered = filterRowsSince(rows, weeks * 7);
  const today = getTodayParisYmd();
  const todayIso = `${ymdKey(today.y, today.m, today.d)}T12:00:00Z`;
  const currentMonday = getMondayYmdFromParisDate(today.y, today.m, today.d, getParisWeekday(todayIso));

  const series: WeeklyClickPoint[] = [];
  const oldestMonday = addCalendarDays(currentMonday.y, currentMonday.m, currentMonday.d, -(weeks - 1) * 7);
  let my = oldestMonday.y;
  let mm = oldestMonday.m;
  let md = oldestMonday.d;

  for (let i = 0; i < weeks; i++) {
    const weekKey = ymdKey(my, mm, md);
    series.push({
      weekKey,
      weekLabel: formatWeekLabel(my, mm, md),
      date: weekKey,
      facebook: 0,
      instagram: 0,
      tiktok: 0,
    });
    const next = addCalendarDays(my, mm, md, 7);
    my = next.y;
    mm = next.m;
    md = next.d;
  }

  const indexByWeek = new Map(series.map((p, i) => [p.weekKey, i]));

  for (const row of filtered) {
    if (!isLinkClickSource(row.source)) continue;
    const key = getMondayWeekKeyParis(row.clicked_at);
    const idx = indexByWeek.get(key);
    if (idx === undefined) continue;
    series[idx][row.source] += 1;
  }

  return series;
}

export function computeTotals(rows: LinkClickRow[]): LinkClickTotals {
  return {
    last7Days: filterRowsSince(rows, 7).length,
    last30Days: filterRowsSince(rows, 30).length,
  };
}

export function countSignupsSince(rows: ProfileSignupRow[], sinceDays: number): number {
  return filterProfilesSince(rows, sinceDays).length;
}

export function computeConversionRates(
  clicksTotals: LinkClickTotals,
  signupCounts: { last7Days: number; last30Days: number },
): ConversionRates {
  const toPeriod = (clicks: number, signups: number): ConversionPeriod => ({
    clicks,
    signups,
    ratePercent: clicks > 0 ? Math.round((signups / clicks) * 1000) / 10 : null,
  });

  return {
    last7Days: toPeriod(clicksTotals.last7Days, signupCounts.last7Days),
    last30Days: toPeriod(clicksTotals.last30Days, signupCounts.last30Days),
  };
}

export function computeSourceBreakdown(rows: LinkClickRow[], sinceDays = 30): SourceBreakdown {
  const filtered = filterRowsSince(rows, sinceDays);
  const counts: Record<LinkClickSource, number> = {
    facebook: 0,
    instagram: 0,
    tiktok: 0,
  };

  for (const row of filtered) {
    if (!isLinkClickSource(row.source)) continue;
    counts[row.source] += 1;
  }

  const total = counts.facebook + counts.instagram + counts.tiktok;
  const percentages: Record<LinkClickSource, number> = {
    facebook: total ? Math.round((counts.facebook / total) * 100) : 0,
    instagram: total ? Math.round((counts.instagram / total) * 100) : 0,
    tiktok: total ? Math.round((counts.tiktok / total) * 100) : 0,
  };

  return { ...counts, total, percentages };
}

export async function fetchLinkClicksSince(days: number): Promise<LinkClickRow[]> {
  const supabase = getBrowserSupabase();
  const since = parisMidnightUtcIsoFromDateKey(getParisCutoffDateKey(days));

  const { data, error } = await supabase
    .from("link_clicks")
    .select("source, clicked_at")
    .gte("clicked_at", since)
    .order("clicked_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Erreur chargement des clics bio");
  }

  return (data ?? []) as LinkClickRow[];
}

export async function fetchProfileSignupsSince(days: number): Promise<ProfileSignupRow[]> {
  const supabase = getBrowserSupabase();
  const since = parisMidnightUtcIsoFromDateKey(getParisCutoffDateKey(days));

  const { data, error } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Erreur chargement des inscriptions");
  }

  return (data ?? []) as ProfileSignupRow[];
}

export async function fetchLinkClickStats() {
  const [rows, profileRows] = await Promise.all([
    fetchLinkClicksSince(84),
    fetchProfileSignupsSince(30),
  ]);

  const signupCounts = {
    last7Days: countSignupsSince(profileRows, 7),
    last30Days: countSignupsSince(profileRows, 30),
  };

  const totals = computeTotals(rows);

  return {
    rows,
    dailySeries: buildDailySeries(rows, 30),
    totals,
    breakdown: computeSourceBreakdown(rows, 30),
    hourlySeries: buildHourlySeries(rows, 30),
    weeklySeries: buildWeeklySeries(rows, 12),
    conversionRates: computeConversionRates(totals, signupCounts),
  };
}
