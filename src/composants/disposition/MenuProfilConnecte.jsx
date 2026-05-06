import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexte/FournisseurAuth";
import LienNavSync from "@/composants/disposition/LienNavSync";
import { getUserCredits, USER_CREDITS_UPDATED_EVENT } from "@/bibliotheque/supabase/credits";
import { getUserProfile } from "@/bibliotheque/supabase/profil";
import { getUserSubscription } from "@/bibliotheque/supabase/stripe";

const RING_R = 17;
const RING_C = 2 * Math.PI * RING_R;

/** Quota mensuel affiché pour l’anneau et la barre (vidéos / mois). */
const MONTHLY_VIDEO_QUOTA = 30;

const TALLY_COACHING_URL = "https://tally.so/r/jaGPrQ";

function initialsFromNameOrEmail(displayName, email) {
  const dn = displayName?.trim();
  if (dn) {
    const parts = dn.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return dn.slice(0, 2).toUpperCase();
  }
  if (email) {
    const local = email.split("@")[0] || "";
    if (local.length >= 2) return local.slice(0, 2).toUpperCase();
    if (local.length === 1) return `${local[0]}${local[0]}`.toUpperCase();
  }
  return "?";
}

function resolveDisplayName(profile, session) {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  const meta = session?.user?.user_metadata?.full_name;
  if (typeof meta === "string" && meta.trim()) return meta.trim();
  const first = profile?.first_name?.trim();
  const last = profile?.last_name?.trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  const email = session?.user?.email;
  if (email) return email.split("@")[0];
  return "Utilisateur";
}

export default function MenuProfilConnecte({ onLogout, signingOut }) {
  const { session } = useAuth();
  const rootRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [coachingOpen, setCoachingOpen] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [profile, setProfile] = useState(null);

  const loadWallet = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const [bal, sub, prof] = await Promise.all([
        getUserCredits(),
        getUserSubscription(),
        getUserProfile(),
      ]);
      setCreditsRemaining(typeof bal === "number" ? bal : Number(bal) || 0);
      setHasSubscription(Boolean(sub));
      setProfile(prof);
    } catch {
      setCreditsRemaining(0);
      setHasSubscription(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  useEffect(() => {
    const onCreditsUpdated = () => {
      void loadWallet();
    };
    window.addEventListener(USER_CREDITS_UPDATED_EVENT, onCreditsUpdated);
    return () => window.removeEventListener(USER_CREDITS_UPDATED_EVENT, onCreditsUpdated);
  }, [loadWallet]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [menuOpen]);

  useEffect(() => {
    if (!coachingOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setCoachingOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [coachingOpen]);

  const displayName = useMemo(
    () => resolveDisplayName(profile, session),
    [profile, session]
  );

  const initials = useMemo(
    () => initialsFromNameOrEmail(displayName, session?.user?.email),
    [displayName, session?.user?.email]
  );

  const planLabel = hasSubscription ? "Premium" : "Free Plan";

  const remaining = creditsRemaining ?? 0;
  const total = MONTHLY_VIDEO_QUOTA;
  const ratio =
    total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
  const strokeDashoffset = RING_C * (1 - ratio);

  const exhausted = remaining <= 0;
  const accentColor = exhausted ? "#f0605a" : "#3ef5c0";

  const closeMenu = () => setMenuOpen(false);

  const modal =
    coachingOpen &&
    createPortal(
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setCoachingOpen(false);
        }}
      >
        <div
          className="relative w-[300px] max-w-full rounded-[14px] border border-white/[0.12] bg-[#181b26] p-6 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="coaching-modal-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mb-3.5 flex items-start justify-between gap-3">
            <h2
              id="coaching-modal-title"
              className="text-base font-semibold leading-snug bg-gradient-to-r from-cyan-300 via-violet-300 to-yellow-300 bg-clip-text [-webkit-background-clip:text] text-transparent"
            >
              Coaching personnalisé
            </h2>
            <button
              type="button"
              aria-label="Fermer"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/[0.12] text-sm text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70"
              onClick={() => setCoachingOpen(false)}
            >
              ✕
            </button>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-white/35">
          Tu publies, ou tu veux te lancer — mais tu avances à l'aveugle. Je regarde ta stratégie, tes hooks, ton positionnement, et je te dis exactement quoi changer. Pas de théorie : des actions concrètes, adaptées à ta niche, semaine après semaine.
          </p>
          <ul className="mb-[18px] flex flex-col gap-2.5 list-none">
            {[
              "Suivi personnalisé sur Telegram",
              "Analyse complète de ta stratégie et de tes vidéos",
              "Stratégie adaptée à ta niche",
              "Accès aux ressources exclusives",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 text-[13px] leading-snug text-white/65">
                <span className="mt-px shrink-0 text-[13px] text-[#3ef5c0]">✓</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="mb-3.5 text-center text-[11px] text-white/30">
            Accompagnement 3 mois ·{" "}
            <span className="font-bold text-[#FFFFFF]">800€</span> · 3 places disponibles
          </p>
          <button
            type="button"
            className="mb-2.5 w-full rounded-lg border-0 bg-[#3ef5c0] py-2.5 text-sm font-semibold text-[#0d0f17] transition-opacity hover:opacity-[0.88]"
            onClick={() => {
              window.open(TALLY_COACHING_URL, "_blank", "noopener,noreferrer");
            }}
          >
            Faire une demande →
          </button>
          <p className="text-center text-[11px] text-white/20">Candidature gratuite · Réponse sous 48h</p>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <div ref={rootRef} className="relative block">
        {/* Conteneur 40×40 : même centre géométrique pour l’SVG et le disque jaune (mockup). */}
        <button
          type="button"
          className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3ef5c0]/50"
          aria-expanded={menuOpen}
          aria-haspopup="true"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
        >
          <svg
            className="pointer-events-none absolute left-0 top-0 h-10 w-10"
            viewBox="0 0 40 40"
            aria-hidden
          >
            <circle
              cx="20"
              cy="20"
              r={RING_R}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="2.5"
            />
            <circle
              cx="20"
              cy="20"
              r={RING_R}
              fill="none"
              stroke={accentColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 20 20)"
            />
          </svg>
          <span
            className="relative z-[1] flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-white/[0.15] bg-[#f5d84e] text-[13px] font-semibold text-[#0d0f17]"
          >
            {initials}
          </span>
        </button>

        <div
          className={`absolute right-0 top-[44px] z-[60] w-[230px] rounded-xl border border-white/[0.12] bg-[#181b26] p-1.5 shadow-xl ${menuOpen ? "block" : "hidden"}`}
          role="menu"
        >
          <div className="px-2.5 pb-2 pt-2.5">
            <div className="text-[13px] font-medium text-white/[0.9]">{displayName}</div>
            <div className="mt-0.5 text-[11px] text-white/35">{planLabel}</div>
          </div>

          <div className="mx-2.5 my-2">
            <div
              className={`mb-[5px] flex justify-between text-[11px] ${exhausted ? "text-[#f0605a]" : "text-white/50"}`}
            >
              <span>{exhausted ? "Crédits épuisés" : "Crédits"}</span>
              <span>
                {remaining} / {total}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${ratio * 100}%`,
                  backgroundColor: accentColor,
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-2.5 py-2">
            <div className="flex items-center gap-[7px] text-[13px] text-white/70">
              <span className="text-sm" aria-hidden>
                👑
              </span>
              <span>Go Premium</span>
            </div>
            <LienNavSync
              to="/boutique?section=subscription"
              className="rounded-md bg-[#f5d84e] px-2.5 py-1 text-[11px] font-semibold text-[#0d0f17] transition-opacity hover:opacity-90"
              onClick={closeMenu}
            >
              Upgrade
            </LienNavSync>
          </div>

          <div className="my-[5px] h-px bg-white/[0.07]" />

          <LienNavSync
            to="/profil"
            role="menuitem"
            className="flex cursor-pointer items-center gap-[9px] rounded-lg px-2.5 py-[9px] text-[13px] text-white/70 transition-colors hover:bg-white/[0.06]"
            onClick={closeMenu}
          >
            <svg className="h-4 w-4 shrink-0 opacity-50" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="8" cy="5" r="3" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
              <path
                d="M2 13c0-2.5 2.5-4 6-4s6 1.5 6 4"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            <span>Voir mon profil</span>
          </LienNavSync>

          <LienNavSync
            to="/boutique?section=packs-videos"
            role="menuitem"
            className="flex cursor-pointer items-center gap-[9px] rounded-lg px-2.5 py-[9px] text-[13px] text-white/70 transition-colors hover:bg-white/[0.06]"
            onClick={closeMenu}
          >
            <svg className="h-4 w-4 shrink-0 opacity-50" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="8" cy="8" r="5.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
              <circle cx="8" cy="8" r="2" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
            </svg>
            <span>Acheter des crédits</span>
          </LienNavSync>

          <button
            type="button"
            role="menuitem"
            className="my-[3px] flex w-full cursor-pointer items-center gap-[9px] rounded-lg border border-[#3ef5c0]/[0.18] bg-[#3ef5c0]/[0.06] px-2.5 py-[9px] text-left text-[13px] font-medium text-[#3ef5c0] transition-colors hover:bg-[#3ef5c0]/[0.11]"
            onClick={() => {
              closeMenu();
              setCoachingOpen(true);
            }}
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M3 4h10M3 8h7M3 12h5"
                stroke="#3ef5c0"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <circle cx="13" cy="11" r="2.5" stroke="#3ef5c0" strokeWidth="1.2" />
              <path d="M13 13.5v1.5" stroke="#3ef5c0" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span>Coaching personnalisé</span>
          </button>

          <div className="my-[5px] h-px bg-white/[0.07]" />

          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            className="flex w-full cursor-pointer items-center gap-[9px] rounded-lg px-2.5 py-[9px] text-left text-xs text-white/40 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            onClick={() => {
              closeMenu();
              void onLogout?.();
            }}
          >
            <svg className="h-4 w-4 shrink-0 opacity-80" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M6 8h7M10 5l3 3-3 3"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 3H3v10h5"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            <span>{signingOut ? "Déconnexion…" : "Déconnexion"}</span>
          </button>
        </div>
      </div>
      {modal}
    </>
  );
}
