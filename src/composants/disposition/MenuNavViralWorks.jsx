import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import LienNavSync from "@/composants/disposition/LienNavSync";
import { FEATURE_DECORS } from "@/bibliotheque/featureFlags";

const STUDIO_ITEMS = [
  { to: "/studio", label: "Avatar IA", matchDecors: false },
  ...(FEATURE_DECORS
    ? [{ to: "/studio?mode=decors", label: "Décors & Lieux", matchDecors: true }]
    : []),
];

function useViralWorksNavState() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isDecorsMode = searchParams.get("mode") === "decors";

  const isCreatorActive =
    location.pathname === "/viralworks" || location.pathname.startsWith("/viralworks/");

  const isStudioItemActive = (matchDecors) => {
    if (location.pathname !== "/studio" && !location.pathname.startsWith("/studio/")) {
      return false;
    }
    return matchDecors ? isDecorsMode : !isDecorsMode;
  };

  const isTriggerActive =
    isCreatorActive ||
    location.pathname === "/studio" ||
    location.pathname.startsWith("/studio/");

  return { isCreatorActive, isStudioItemActive, isTriggerActive };
}

function itemClass(active) {
  return active
    ? "bg-emerald-500/10 text-emerald-300"
    : "text-white/70 hover:bg-white/[0.06] hover:text-white";
}

function MenuLink({ to, label, active, onNavigate }) {
  return (
    <LienNavSync
      to={to}
      role="menuitem"
      className={`flex cursor-pointer items-center rounded-lg px-2.5 py-[9px] text-[13px] transition-colors ${itemClass(active)}`}
      onClick={onNavigate}
    >
      {label}
    </LienNavSync>
  );
}

function DropdownPanel({ onClose, isCreatorActive, isStudioItemActive }) {
  return (
    <div
      className="absolute left-1/2 top-full z-[60] mt-2 w-[220px] -translate-x-1/2 rounded-xl border border-white/[0.12] bg-[#181b26] p-1.5 shadow-xl"
      role="menu"
    >
      <MenuLink
        to="/viralworks"
        label="Créateur vidéo"
        active={isCreatorActive}
        onNavigate={onClose}
      />

      <div className="my-1.5 px-2.5">
        <div className="h-px bg-white/[0.07]" />
        <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
          Studio
        </div>
      </div>

      {STUDIO_ITEMS.map((item) => (
        <MenuLink
          key={item.to}
          to={item.to}
          label={item.label}
          active={isStudioItemActive(item.matchDecors)}
          onNavigate={onClose}
        />
      ))}
    </div>
  );
}

/** Dropdown desktop : trigger "ViralWorks" au clic. */
export function MenuNavViralWorksDesktop() {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const { isCreatorActive, isStudioItemActive, isTriggerActive } = useViralWorksNavState();

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        className={`relative inline-flex items-center gap-1 text-sm font-medium transition-all duration-300 whitespace-nowrap ${
          isTriggerActive ? "text-emerald-300" : "text-gray-400 hover:text-gray-200"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="relative z-10">ViralWorks</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={2.25}
        />
        {isTriggerActive && (
          <>
            <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400" />
          </>
        )}
      </button>

      {open ? (
        <DropdownPanel
          onClose={close}
          isCreatorActive={isCreatorActive}
          isStudioItemActive={isStudioItemActive}
        />
      ) : null}
    </div>
  );
}

/** Section mobile : accordion ViralWorks dans la sidebar. */
export function MenuNavViralWorksMobile({ onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const { isCreatorActive, isStudioItemActive, isTriggerActive } = useViralWorksNavState();

  const close = () => {
    setExpanded(false);
    onNavigate?.();
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={expanded}
        className={`group flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
          isTriggerActive
            ? "card-vws-active text-emerald-300"
            : "text-slate-300 hover:bg-white/5 hover:text-white border border-transparent"
        }`}
        onClick={() => setExpanded((v) => !v)}
      >
        <span>ViralWorks</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          strokeWidth={2.25}
        />
      </button>

      {expanded ? (
        <div className="ml-2 flex flex-col gap-1 border-l border-white/10 pl-3">
          <LienNavSync
            to="/viralworks"
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${itemClass(isCreatorActive)}`}
            onClick={close}
          >
            Créateur vidéo
          </LienNavSync>

          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Studio
          </div>

          {STUDIO_ITEMS.map((item) => (
            <LienNavSync
              key={item.to}
              to={item.to}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${itemClass(isStudioItemActive(item.matchDecors))}`}
              onClick={close}
            >
              {item.label}
            </LienNavSync>
          ))}
        </div>
      ) : null}
    </div>
  );
}
