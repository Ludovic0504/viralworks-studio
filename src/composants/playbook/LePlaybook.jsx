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
import rawGuides from "./playbookGuides.json";
import "./LePlaybook.css";

const HERO_ID = 6;

const HERO_KICKER = "Retour d'expérience";

const HERO_STATS = [
  { value: "1M+", label: "vues / vidéo" },
  { value: "600k", label: "avant le million" },
  { value: "3", label: "formats testés" },
];

const SECTIONS = [
  { cat: "social", label: "Réseaux sociaux" },
  { cat: "creation", label: "Création IA" },
  { cat: "avatar", label: "Avatar & Produit" },
  { cat: "montage", label: "Montage & Voix" },
];

const CREATION_IDS_ORDER = [7, 8, 9, 12];

const SOCIAL_ICONS = [Users, Zap, List, MessageCircle, Link2, Search];
const CREATION_ICONS = [Monitor, Sparkles, Terminal, Video];
const AVATAR_ICONS = [UserCircle2, ImageIcon];
const MONTAGE_ICONS = [Film, Mic];

const GUIDE_VIEW_LABELS = {
  social: "RÉSEAUX SOCIAUX",
  creation: "CRÉATION IA",
  avatar: "AVATAR & PRODUIT",
  montage: "MONTAGE & VOIX",
};

function normalizeGuide(g) {
  return {
    ...g,
    featured: Boolean(g.featured),
    type: g.type ?? "ext",
  };
}

const PLAYBOOK_GUIDES = rawGuides.map(normalizeGuide);

function guideViewCategoryClass(g) {
  if (g.id === HERO_ID) return "lp-guide-cat--hero";
  return `lp-guide-cat--${g.cat}`;
}

function guideViewCategoryText(g) {
  if (g.id === HERO_ID) return HERO_KICKER;
  return GUIDE_VIEW_LABELS[g.cat] ?? g.label.toUpperCase();
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
  const [view, setView] = useState("list");
  const [activeId, setActiveId] = useState(null);

  const heroGuide = useMemo(
    () => PLAYBOOK_GUIDES.find((g) => g.id === HERO_ID) ?? null,
    []
  );

  const guidesBySection = useMemo(() => {
    const map = { social: [], creation: [], avatar: [], montage: [] };
    for (const g of PLAYBOOK_GUIDES) {
      if (g.id === HERO_ID) continue;
      if (map[g.cat]) map[g.cat].push(g);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.id - b.id);
    }
    return map;
  }, []);

  const activeGuide = useMemo(
    () => (activeId == null ? null : PLAYBOOK_GUIDES.find((g) => g.id === activeId) ?? null),
    [activeId]
  );

  const nextGuide = useMemo(() => {
    if (activeId == null) return null;
    return PLAYBOOK_GUIDES.find((g) => g.id === activeId + 1) ?? null;
  }, [activeId]);

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

  if (view === "guide" && activeGuide) {
    return (
      <div className="le-playbook w-full max-w-[860px] mx-auto playbook-root-padding">
        <button type="button" className="playbook-back-btn" onClick={handleGuideBack}>
          ← Le Playbook
        </button>

        <p className={`lp-guide-cat-label ${guideViewCategoryClass(activeGuide)}`}>
          {guideViewCategoryText(activeGuide)}
        </p>

        <h1 className="lp-guide-h1">{activeGuide.title}</h1>
        <p className="lp-guide-meta">{activeGuide.read} de lecture</p>

        <div className="playbook-sep playbook-sep--guide-top" aria-hidden />

        <div
          className="playbook-guide-body overflow-y-auto max-h-[min(72vh,640px)] sm:max-h-none sm:overflow-visible pr-1 sm:pr-0"
          dangerouslySetInnerHTML={{ __html: activeGuide.contentHtml }}
        />

        <div className="playbook-sep" aria-hidden />

        <p className="playbook-next-link">
          Guide suivant →{" "}
          {nextGuide ? (
            <button type="button" onClick={() => openGuide(nextGuide.id)}>
              {nextGuide.title} →
            </button>
          ) : (
            <button type="button" onClick={handleGuideBack}>
              ← Retour au Playbook
            </button>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="le-playbook w-full max-w-[860px] mx-auto playbook-root-padding">
      <h1 className="lp-page-title">Le Playbook</h1>
      <p className="lp-intro">
        Ce que j&apos;ai appris en créant du contenu IA — condensé en guides courts, directs, utilisables tout de suite.
      </p>

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
              <p className="playbook-hero-kicker">{HERO_KICKER}</p>
              <p className="playbook-hero-title">{heroGuide.title}</p>
              <p className="playbook-hero-desc">{heroGuide.desc}</p>
              <span className="playbook-hero-read">{heroGuide.read} de lecture</span>
            </div>
          </div>
          <div className="playbook-hero-stats-col">
            {HERO_STATS.map((s) => (
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
        return SECTIONS.map((section) => {
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
                <span className="playbook-section-count">
                  {items.length} guide{items.length > 1 ? "s" : ""}
                </span>
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
