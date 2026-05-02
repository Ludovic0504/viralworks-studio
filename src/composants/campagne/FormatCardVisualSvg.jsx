import { useId } from "react";

const ACCENT = "#2ecc9a";

/** viewBox commun — toutes les illustrations ont la même échelle dans le cadre 80×80 */
const VB = "0 0 80 80";

function strokePrimary(rest = {}) {
  return {
    fill: "none",
    stroke: ACCENT,
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...rest,
  };
}

function strokeSecondary(rest = {}) {
  return {
    fill: "none",
    stroke: ACCENT,
    strokeWidth: 1.5,
    strokeOpacity: 0.36,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...rest,
  };
}

/**
 * Dégradés subtils par catégorie — un seul par carte, id unique (useId).
 */
function CategoryGradients({ uid, categoryId }) {
  const id = `${uid}-bg`;
  const configs = {
    produit: {
      x1: "0%",
      y1: "0%",
      x2: "100%",
      y2: "100%",
      stops: [
        { off: "0%", c: "#2ecc9a", o: 0.07 },
        { off: "55%", c: "#1c1c1e", o: 1 },
        { off: "100%", c: "#141414", o: 1 },
      ],
    },
    storytelling: {
      x1: "100%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { off: "0%", c: "#38bdf8", o: 0.06 },
        { off: "50%", c: "#1a1d24", o: 1 },
        { off: "100%", c: "#141414", o: 1 },
      ],
    },
    humain: {
      x1: "0%",
      y1: "100%",
      x2: "100%",
      y2: "0%",
      stops: [
        { off: "0%", c: "#f472b6", o: 0.05 },
        { off: "45%", c: "#1e1a1c", o: 1 },
        { off: "100%", c: "#141414", o: 1 },
      ],
    },
    process: {
      x1: "0%",
      y1: "0%",
      x2: "100%",
      y2: "100%",
      stops: [
        { off: "0%", c: "#a8a29e", o: 0.06 },
        { off: "60%", c: "#1c1b18", o: 1 },
        { off: "100%", c: "#141414", o: 1 },
      ],
    },
    social: {
      x1: "50%",
      y1: "0%",
      x2: "50%",
      y2: "100%",
      stops: [
        { off: "0%", c: "#22d3ee", o: 0.06 },
        { off: "55%", c: "#161e22", o: 1 },
        { off: "100%", c: "#141414", o: 1 },
      ],
    },
  };
  const cfg = configs[categoryId] ?? configs.produit;
  return (
    <linearGradient id={id} x1={cfg.x1} y1={cfg.y1} x2={cfg.x2} y2={cfg.y2}>
      {cfg.stops.map((s, i) => (
        <stop key={i} offset={s.off} stopColor={s.c} stopOpacity={s.o} />
      ))}
    </linearGradient>
  );
}

function SplitSideGradients({ uid }) {
  return (
    <>
      <linearGradient id={`${uid}-split-l`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#0a0a0a" stopOpacity="0.88" />
        <stop offset="100%" stopColor="#2a2a2a" stopOpacity="0.45" />
      </linearGradient>
      <linearGradient id={`${uid}-split-r`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#2ecc9a" stopOpacity="0.1" />
        <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0.22" />
      </linearGradient>
    </>
  );
}

function Glyph({ formatId, uid }) {
  const p = strokePrimary;
  const s = strokeSecondary;

  switch (formatId) {
    case "produit_pub_esthetique":
      return (
        <g>
          <rect x="28" y="44" width="24" height="18" rx="2" {...p()} />
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1="40"
              y1="44"
              x2={40 + (i - 2) * 9}
              y2="18"
              {...s()}
            />
          ))}
          <circle cx="40" cy="28" r="6" {...p()} />
        </g>
      );

    case "produit_demo":
      return (
        <g>
          <path d="M18 52 Q26 38 34 44 L46 36 Q54 32 58 40" {...p()} />
          <line x1="46" y1="36" x2="56" y2="28" {...p()} />
          <circle cx="58" cy="28" r="5" {...s()} />
          <path d="M44 48 L52 52 L48 56" {...s()} />
        </g>
      );

    case "produit_unboxing":
      return (
        <g>
          <path d="M22 48 L40 38 L58 48 L58 58 L22 58 Z" {...p()} />
          <path d="M22 48 L40 56 L58 48" {...p()} />
          <path d="M30 36 L40 28 L50 36" {...p()} />
          {[0, 1, 2].map((i) => (
            <line key={i} x1={34 + i * 6} y1="40" x2={38 + i * 5} y2="24" {...s()} />
          ))}
        </g>
      );

    case "produit_test_review":
      return (
        <g>
          <circle cx="40" cy="30" r="11" {...p()} />
          <path d="M32 46 Q40 40 48 46" {...p()} />
          <rect x="34" y="38" width="18" height="14" rx="2" {...p()} />
          <line x1="38" y1="42" x2="48" y2="42" {...s()} />
        </g>
      );

    case "produit_comparatif":
      return (
        <g>
          <rect x="14" y="22" width="22" height="36" rx="3" {...p()} />
          <rect x="44" y="22" width="22" height="36" rx="3" {...p()} />
          <line x1="40" y1="16" x2="40" y2="64" {...p()} />
          <circle cx="25" cy="32" r="4" {...s()} />
          <circle cx="55" cy="32" r="4" {...s()} />
        </g>
      );

    case "produit_focus_detail":
      return (
        <g>
          <path
            d="M18 44 Q22 36 30 34 Q38 32 44 38 Q48 44 42 50 Q36 54 28 50 Q20 46 18 44"
            {...s()}
          />
          <circle cx="52" cy="34" r="12" {...p()} />
          <line x1="60" y1="42" x2="68" y2="50" {...p()} />
          <circle cx="52" cy="34" r="7" {...s()} />
        </g>
      );

    case "produit_preuve_performance":
      return (
        <g>
          <rect x="32" y="36" width="16" height="20" rx="2" {...p()} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const a = (i / 8) * Math.PI * 2;
            const x2 = 40 + Math.cos(a) * 22;
            const y2 = 42 + Math.sin(a) * 22;
            return <line key={i} x1="40" y1="42" x2={x2} y2={y2} {...s()} />;
          })}
          <path d="M36 32 L44 28 L44 36 L36 36 Z" {...p()} />
        </g>
      );

    case "produit_reveal":
      return (
        <g>
          <ellipse cx="40" cy="46" rx="14" ry="10" {...p()} />
          <path d="M18 28 Q40 18 62 28 L58 36 Q40 30 22 36 Z" {...s()} />
          <path d="M22 32 Q40 22 58 32" {...p()} />
          <line x1="26" y1="26" x2="54" y2="26" {...s()} />
        </g>
      );

    case "story_tv_spot":
      return (
        <g>
          <rect x="22" y="28" width="36" height="8" rx="1" {...p()} />
          <path d="M22 36 L40 22 L58 36" {...p()} />
          <line x1="28" y1="36" x2="52" y2="36" {...p()} />
          <path d="M34 14 L40 10 L46 14" {...s()} />
        </g>
      );

    case "story_probleme_solution":
      return (
        <g>
          <circle cx="26" cy="34" r="12" {...p()} />
          <path d="M20 28 L32 40 M32 28 L20 40" {...p()} />
          <path d="M46 34 L54 42 M50 38 L58 30" {...s()} />
          <circle cx="56" cy="34" r="12" {...p()} />
          <path d="M50 34 L54 38 L62 28" {...p()} />
          <path d="M38 34 H44" {...s()} />
          <polygon points="44,34 48,31 48,37" {...p()} />
        </g>
      );

    case "story_lifestyle":
      return (
        <g>
          <path d="M16 52 H64 V28 L52 20 H28 L16 28 Z" {...s()} />
          <circle cx="40" cy="38" r="8" {...p()} />
          <path d="M32 46 Q40 40 48 46" {...p()} />
          <ellipse cx="46" cy="48" rx="6" ry="4" {...s()} />
          <path d="M24 48 Q28 44 32 48" {...p()} />
        </g>
      );

    case "story_histoire_client":
      return (
        <g>
          <path d="M22 28 Q22 22 30 22 H52 Q58 22 58 28 V40 Q58 46 52 46 H34 L28 52 V46 H30 Q22 46 22 40 Z" {...p()} />
          <path d="M30 32 Q28 30 26 32" {...s()} />
          <path d="M48 32 Q50 30 52 32" {...s()} />
          <circle cx="40" cy="58" r="6" {...p()} />
        </g>
      );

    case "story_origine":
      return (
        <g>
          <line x1="18" y1="56" x2="62" y2="56" {...s()} />
          <ellipse cx="40" cy="52" rx="4" ry="3" {...p()} />
          <path d="M40 48 L40 36 Q36 32 40 28 Q44 32 40 36" {...p()} />
          <path d="M34 30 Q40 24 46 30" {...s()} />
          <circle cx="40" cy="28" r="3" {...p()} />
        </g>
      );

    case "story_projection_futur":
      return (
        <g>
          <path d="M14 52 Q38 28 58 20" {...s()} />
          <path d="M18 50 Q40 32 56 24" {...p()} />
          <polygon points="56,18 58,22 62,22 59,25 60,30 56,27 52,30 53,25 50,22 54,22" {...p()} />
          <line x1="14" y1="52" x2="62" y2="52" {...s()} strokeDasharray="3 3" />
        </g>
      );

    case "humain_face_expert":
      return (
        <g>
          <circle cx="34" cy="36" r="12" {...p()} />
          <path d="M26 44 Q34 48 42 44" {...p()} />
          <rect x="46" y="28" width="18" height="18" rx="4" {...p()} />
          <circle cx="55" cy="37" r="6" {...p()} />
          <circle cx="55" cy="37" r="3" {...s()} />
        </g>
      );

    case "humain_temoignage":
      return (
        <g>
          <circle cx="28" cy="38" r="9" {...p()} />
          <circle cx="54" cy="38" r="9" {...p()} />
          <path d="M28 32 Q34 28 40 32 V38 H34 Q28 38 28 44" {...s()} />
          <path d="M38 34 H48 Q52 34 52 38 V42" {...p()} />
        </g>
      );

    case "humain_interview":
      return (
        <g>
          <circle cx="26" cy="36" r="9" {...p()} />
          <circle cx="54" cy="36" r="9" {...p()} />
          <ellipse cx="40" cy="40" rx="5" ry="8" {...p()} />
          <line x1="40" y1="32" x2="40" y2="22" {...s()} />
          <circle cx="40" cy="20" r="3" {...p()} />
        </g>
      );

    case "humain_faq":
      return (
        <g>
          <circle cx="52" cy="38" r="14" {...p()} />
          <path d="M46 32 Q52 28 56 32 Q56 36 52 36" {...p()} />
          <line x1="52" y1="40" x2="52" y2="44" {...p()} />
          <circle cx="52" cy="46" r="1.5" {...p()} />
          <path d="M28 44 Q22 38 26 30 Q30 22 38 26" {...s()} />
        </g>
      );

    case "humain_mythe_vs_realite":
      return (
        <g>
          <path d="M22 28 L30 44 M26 32 L34 28 L30 44" {...p()} />
          <line x1="18" y1="34" x2="34" y2="46" {...s()} />
          <line x1="40" y1="22" x2="40" y2="58" {...s()} />
          <path d="M48 38 L54 44 L62 32" {...p()} />
          <circle cx="56" cy="38" r="12" {...s()} />
        </g>
      );

    case "humain_reaction":
      return (
        <g>
          <circle cx="40" cy="34" r="14" {...p()} />
          <circle cx="34" cy="32" r="3" {...p()} />
          <circle cx="46" cy="32" r="3" {...p()} />
          <ellipse cx="40" cy="42" rx="6" ry="4" {...p()} />
          <path d="M22 48 Q26 36 30 44 M50 44 Q54 36 58 48" {...s()} />
        </g>
      );

    case "process_demo_geste":
      return (
        <g>
          <path d="M18 52 Q14 44 20 38 Q24 34 28 38" {...p()} />
          <path d="M62 52 Q66 44 60 38 Q56 34 52 38" {...p()} />
          <circle cx="40" cy="36" r="8" {...p()} />
          <path d="M36 32 L44 40 M44 32 L36 40" {...s()} />
        </g>
      );

    case "process_timelapse":
      return (
        <g>
          <circle cx="40" cy="40" r="18" {...p()} />
          <line x1="40" y1="40" x2="40" y2="26" {...p()} />
          <line x1="40" y1="40" x2="52" y2="44" {...s()} />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 1.2 - 0.8;
            return (
              <line
                key={i}
                x1={40 + Math.cos(a) * 22}
                y1={40 + Math.sin(a) * 22}
                x2={40 + Math.cos(a) * 26}
                y2={40 + Math.sin(a) * 26}
                {...s()}
              />
            );
          })}
        </g>
      );

    case "process_avant_apres":
      return (
        <g>
          <rect
            x="14"
            y="22"
            width="24"
            height="36"
            rx="2"
            fill={`url(#${uid}-split-l)`}
            stroke={ACCENT}
            strokeWidth="1.5"
          />
          <rect
            x="42"
            y="22"
            width="24"
            height="36"
            rx="2"
            fill={`url(#${uid}-split-r)`}
            stroke={ACCENT}
            strokeWidth="1.5"
          />
          <line x1="40" y1="18" x2="40" y2="62" {...strokePrimary({ strokeOpacity: 0.95 })} />
        </g>
      );

    case "process_coulisses":
      return (
        <g>
          <line x1="34" y1="58" x2="34" y2="44" {...p()} />
          <line x1="46" y1="58" x2="46" y2="44" {...p()} />
          <line x1="40" y1="58" x2="40" y2="48" {...s()} />
          <rect x="30" y="30" width="20" height="16" rx="2" {...p()} />
          <path d="M24 34 H18 M56 34 H62 M30 26 L26 22 M50 26 L54 22" {...s()} />
        </g>
      );

    case "process_step_by_step":
      return (
        <g>
          <circle cx="24" cy="44" r="8" {...p()} />
          <circle cx="40" cy="32" r="8" {...p()} />
          <circle cx="56" cy="24" r="8" {...p()} />
          <path d="M30 40 L34 36" {...s()} />
          <path d="M46 30 L50 26" {...s()} />
        </g>
      );

    case "process_erreur_correction":
      return (
        <g>
          <circle cx="26" cy="38" r="11" {...p()} />
          <path d="M20 32 L32 44 M32 32 L20 44" {...p()} />
          <path d="M38 38 H46" {...s()} />
          <polygon points="46,38 50,35 50,41" {...p()} />
          <circle cx="58" cy="38" r="11" {...p()} />
          <path d="M52 38 L56 42 L64 32" {...p()} />
        </g>
      );

    case "process_accel_zoom":
      return (
        <g>
          <line x1="14" y1="52" x2="66" y2="52" {...s()} />
          <circle cx="22" cy="52" r="2" {...p()} />
          <circle cx="40" cy="52" r="2" {...p()} />
          <circle cx="58" cy="52" r="2" {...p()} />
          <circle cx="40" cy="52" r="10" {...p()} />
          <line x1="47" y1="59" x2="54" y2="66" {...p()} />
          <path d="M32 24 Q40 20 48 24" {...s()} />
        </g>
      );

    case "social_vlog_pov":
      return (
        <g>
          <rect x="22" y="18" width="36" height="48" rx="4" {...p()} />
          <rect x="28" y="26" width="24" height="28" rx="2" {...s()} />
          <path d="M30 38 Q40 32 50 38" {...s()} />
          <circle cx="58" cy="30" r="4" {...p()} />
          <rect x="34" y="14" width="12" height="4" rx="1" {...s()} />
        </g>
      );

    case "social_hook_educatif":
      return (
        <g>
          <circle cx="36" cy="40" r="16" {...p()} />
          <path d="M36 28 V40 L46 46" {...p()} />
          <path d="M36 40 L44 36" {...s()} />
          <path d="M48 22 Q56 18 58 26 Q60 32 52 36" {...s()} />
          <circle cx="54" cy="24" r="6" {...p()} />
        </g>
      );

    case "social_challenge":
      return (
        <g>
          <path d="M22 48 Q18 40 24 34 Q28 30 32 34" {...p()} />
          <path d="M58 48 Q62 40 56 34 Q52 30 48 34" {...p()} />
          <line x1="36" y1="42" x2="44" y2="42" {...s()} />
          <path d="M38 38 L42 46" {...s()} />
        </g>
      );

    case "social_trend":
      return (
        <g>
          <path d="M26 28 Q34 20 42 28 Q46 34 40 40 Q34 44 30 38 Q26 34 26 28" {...s()} />
          <path d="M38 22 Q44 16 50 22 Q52 28 46 32" {...p()} />
          <path d="M48 24 L58 16 M52 30 L62 22 M56 26 L64 18" {...s()} />
          <path d="M22 52 L30 44 L34 54 L44 46 L48 56" {...p()} />
        </g>
      );

    case "social_reponse_commentaire":
      return (
        <g>
          <path d="M20 26 H52 Q58 26 58 32 V42 Q58 48 52 48 H28 L22 54 V48 H20 Q14 48 14 42 V32 Q14 26 20 26 Z" {...p()} />
          <path d="M26 56 Q30 52 34 56 H48 Q52 56 52 60" {...s()} />
          <path d="M38 58 L34 62 M38 58 L42 62" {...p()} />
        </g>
      );

    case "social_duet_stitch":
      return (
        <g>
          <line x1="40" y1="16" x2="40" y2="64" {...p()} />
          <circle cx="28" cy="36" r="10" {...p()} />
          <circle cx="52" cy="36" r="10" {...p()} />
          <path d="M22 44 Q28 48 34 44" {...s()} />
          <path d="M46 44 Q52 48 58 44" {...s()} />
        </g>
      );

    case "social_liste_rapide":
      return (
        <g>
          <line x1="28" y1="26" x2="62" y2="26" {...p()} />
          <line x1="28" y1="40" x2="62" y2="40" {...p()} />
          <path d="M28 54 H56 M58 54 H62" {...p()} />
          <circle cx="20" cy="26" r="2" {...s()} />
          <circle cx="20" cy="40" r="2" {...s()} />
          <circle cx="20" cy="54" r="2" {...s()} />
          <path d="M30 52 Q34 56 38 52 Q42 48 46 54" {...s()} />
        </g>
      );

    case "social_avant_apres_explicatif":
      return (
        <g>
          <rect x="14" y="22" width="22" height="36" rx="2" {...s()} />
          <rect x="44" y="22" width="22" height="36" rx="2" {...s()} />
          <line x1="40" y1="18" x2="40" y2="62" {...p()} />
          <circle cx="62" cy="28" r="8" {...p()} />
          <path d="M58 44 Q62 40 66 44" {...s()} />
        </g>
      );

    default:
      return (
        <g>
          <rect x="24" y="28" width="32" height="28" rx="3" {...p()} />
          <circle cx="40" cy="42" r="8" {...s()} />
        </g>
      );
  }
}

export function FormatCardVisualSvg({ formatId, categoryId }) {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const uid = rawId || "g";

  return (
    <div className="relative aspect-square h-full w-full overflow-hidden rounded-lg border border-[#1e1e1e]">
      <svg className="h-full w-full" viewBox={VB} preserveAspectRatio="xMidYMid meet" aria-hidden>
        <defs>
          <CategoryGradients uid={uid} categoryId={categoryId} />
          <SplitSideGradients uid={uid} />
        </defs>
        <rect width="80" height="80" fill={`url(#${uid}-bg)`} />
        <Glyph formatId={formatId} uid={uid} />
      </svg>
    </div>
  );
}
