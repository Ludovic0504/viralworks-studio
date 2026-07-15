import { useCallback, useMemo, useState } from "react";
import {
  Users,
  Zap,
  List,
  MessageCircle,
  Link2,
  Search,
  Monitor,
  Sparkles,
  Terminal,
  Video,
  UserCircle2,
  Image as ImageIcon,
  Film,
  Mic,
  TrendingUp,
} from "lucide-react";
import {
  pwaNestedBackViaHistory,
  usePwaNestedBack,
} from "@/contexte/PwaNavigationContext";
import { isStandalonePwa } from "@/bibliotheque/pwa/isStandalonePwa";
import { useLocale, useT } from "@/contexte/FournisseurLocale";
import { getPlaybookGuides } from "./getPlaybookGuides";
import "./LePlaybook.css";

const HERO_ID = 6;

const CREATION_IDS_ORDER = [7, 8, 9, 12];

const SOCIAL_ICONS = [Users, Zap, List, MessageCircle, Link2, Search];
const CREATION_ICONS = [Monitor, Sparkles, Terminal, Video];
const AVATAR_ICONS = [UserCircle2, ImageIcon];
const MONTAGE_ICONS = [Film, Mic];

function guideViewCategoryClass(g) {
  if (g.id === HERO_ID) return "lp-guide-cat--hero";
  return `lp-guide-cat--${g.cat}`;
}

function PlaybookCardIcon({ cat, id }) {
  let Icon = Users;
  if (cat === "social" && id >= 0 && id <= 5) {
    Icon = SOCIAL_ICONS[id];
  } else if (cat === "creation") {
    const ix = CREATION_IDS_ORDER.indexOf(id);
    Icon = ix >= 0 ? CREATION_ICONS[ix] : Sparkles;
  } else if (cat === "avatar") {
    Icon = id === 10 ? AVATAR_ICONS[0] : id === 11 ? AVATAR_ICONS[1] : UserCircle2;
  } else if (cat === "montage") {
    Icon = id === 13 ? MONTAGE_ICONS[0] : id === 14 ? MONTAGE_ICONS[1] : Film;
  }

  return (
    <div className={`playbook-icon-wrap playbook-icon-wrap--${cat}`}>
      <Icon
        className="playbook-card-lucide"
        strokeWidth={1.5}
        size={18}
        aria-hidden
      />
    </div>
  );
}

export default function LePlaybook() {
  const { locale } = useLocale();
  const t = useT();
  const [view, setView] = useState("list");
  const [activeId, setActiveId] = useState(null);

  const playbookGuides = useMemo(() => getPlaybookGuides(locale), [locale]);

  const sections = useMemo(
    () => [
      { cat: "social", label: t("playbook.sections.social") },
      { cat: "creation", label: t("playbook.sections.creation") },
      { cat: "avatar", label: t("playbook.sections.avatar") },
      { cat: "montage", label: t("playbook.sections.montage") },
    ],
    [t],
  );

  const heroStats = useMemo(
    () => [
      { value: "1M+", label: t("playbook.heroStats.views") },
      { value: "600k", label: t("playbook.heroStats.beforeMillion") },
      { value: "3", label: t("playbook.heroStats.formats") },
    ],
    [t],
  );

  const guideViewLabels = useMemo(
    () => ({
      social: t("playbook.viewLabels.social"),
      creation: t("playbook.viewLabels.creation"),
      avatar: t("playbook.viewLabels.avatar"),
      montage: t("playbook.viewLabels.montage"),
    }),
    [t],
  );

  const guideViewCategoryText = useCallback(
    (g) => {
      if (g.id === HERO_ID) return t("playbook.heroKicker");
      return guideViewLabels[g.cat] ?? g.label.toUpperCase();
    },
    [guideViewLabels, t],
  );

  const heroGuide = useMemo(
    () => playbookGuides.find((g) => g.id === HERO_ID) ?? null,
    [playbookGuides],
  );

  const guidesBySection = useMemo(() => {
    const map = { social: [], creation: [], avatar: [], montage: [] };
    for (const g of playbookGuides) {
      if (g.id === HERO_ID) continue;
      if (map[g.cat]) map[g.cat].push(g);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.id - b.id);
    }
    return map;
  }, [playbookGuides]);

  const activeGuide = useMemo(
    () => (activeId == null ? null : playbookGuides.find((g) => g.id === activeId) ?? null),
    [activeId, playbookGuides],
  );

  const nextGuide = useMemo(() => {
    if (activeId == null) return null;
    return playbookGuides.find((g) => g.id === activeId + 1) ?? null;
  }, [activeId, playbookGuides]);

  const backToList = useCallback(() => {
    setView("list");
    setActiveId(null);
  }, []);

  usePwaNestedBack(view === "guide", backToList);

  const handleGuideBack = useCallback(() => {
    if (isStandalonePwa() && view === "guide") {
      if (pwaNestedBackViaHistory()) return;
    }
    backToList();
  }, [backToList, view]);

  const openGuide = (id) => {
    setActiveId(id);
    setView("guide");
  };

  const guideCountLabel = (count) =>
    count > 1
      ? t("playbook.guideCountPlural", { count })
      : t("playbook.guideCount", { count });

  if (view === "guide" && activeGuide) {
    return (
      <div className="le-playbook w-full max-w-[860px] mx-auto playbook-root-padding">
        <button type="button" className="playbook-back-btn" onClick={handleGuideBack}>
          {t("playbook.back")}
        </button>

        <p className={`lp-guide-cat-label ${guideViewCategoryClass(activeGuide)}`}>
          {guideViewCategoryText(activeGuide)}
        </p>

        <h1 className="lp-guide-h1">{activeGuide.title}</h1>
        <p className="lp-guide-meta">
          {activeGuide.read} {t("playbook.readSuffix")}
        </p>

        <div className="playbook-sep playbook-sep--guide-top" aria-hidden />

        <div
          className="playbook-guide-body overflow-y-auto max-h-[min(72vh,640px)] sm:max-h-none sm:overflow-visible pr-1 sm:pr-0"
          dangerouslySetInnerHTML={{ __html: activeGuide.contentHtml }}
        />

        <div className="playbook-sep" aria-hidden />

        <p className="playbook-next-link">
          {t("playbook.nextGuide")}{" "}
          {nextGuide ? (
            <button type="button" onClick={() => openGuide(nextGuide.id)}>
              {nextGuide.title} →
            </button>
          ) : (
            <button type="button" onClick={handleGuideBack}>
              {t("playbook.backToPlaybook")}
            </button>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="le-playbook w-full max-w-[860px] mx-auto playbook-root-padding">
      <h1 className="lp-page-title">{t("playbook.pageTitle")}</h1>
      <p className="lp-intro">{t("playbook.intro")}</p>

      {heroGuide && (
        <button
          type="button"
          className="playbook-hero"
          onClick={() => openGuide(heroGuide.id)}
        >
          <div className="playbook-hero-text-row">
            <div className="playbook-hero-icon-wrap">
              <TrendingUp
                className="playbook-hero-lucide"
                strokeWidth={1.5}
                size={22}
                aria-hidden
              />
            </div>
            <div className="playbook-hero-copy">
              <p className="playbook-hero-kicker">{t("playbook.heroKicker")}</p>
              <p className="playbook-hero-title">{heroGuide.title}</p>
              <p className="playbook-hero-desc">{heroGuide.desc}</p>
              <span className="playbook-hero-read">
                {heroGuide.read} {t("playbook.readSuffix")}
              </span>
            </div>
          </div>
          <div className="playbook-hero-stats-col">
            {heroStats.map((s) => (
              <div key={s.label} className="playbook-hero-stat">
                <span className="playbook-hero-stat-value">{s.value}</span>
                <span className="playbook-hero-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </button>
      )}

      {(() => {
        let firstRendered = true;
        return sections.map((section) => {
          const items = guidesBySection[section.cat];
          if (!items?.length) return null;

          const showRule = !firstRendered;
          firstRendered = false;

          return (
            <section key={section.cat} className="playbook-section">
              {showRule ? <div className="playbook-section-rule" aria-hidden /> : null}

              <div className="playbook-section-head">
                <span className={`playbook-dot playbook-dot--${section.cat}`} aria-hidden />
                <span className="playbook-section-title">{section.label}</span>
                <span className="playbook-section-count">{guideCountLabel(items.length)}</span>
              </div>

              <div className="playbook-grid">
                {items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`playbook-card playbook-card--${c.cat}`}
                    onClick={() => openGuide(c.id)}
                  >
                    <PlaybookCardIcon cat={c.cat} id={c.id} />
                    <div className="playbook-card-inner">
                      <p className="lp-card-title">{c.title}</p>
                      <p className="lp-card-desc">{c.desc}</p>
                      <div className="playbook-card-foot">
                        <span className="lp-muted-xs">{c.read}</span>
                        <span className="lp-muted-xs playbook-card-arrow" aria-hidden>
                          →
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        });
      })()}
    </div>
  );
}
