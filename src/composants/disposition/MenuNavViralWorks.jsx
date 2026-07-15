import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, Image, Video } from "lucide-react";
import LienNavSync from "@/composants/disposition/LienNavSync";
import { useAuth } from "@/contexte/FournisseurAuth";
import { prefetchPremiumAccess } from "@/hooks/usePremiumAccess";
import { prefetchImageStudioHistory } from "@/bibliotheque/imageStudio/imageStudioHistoryCache";
import { useT } from "@/contexte/FournisseurLocale";

function useVideoItems() {
  const t = useT();
  return useMemo(
    () => [
      { to: "/viralworks", label: t("nav.createVideo"), matchCreator: true },
      { to: "/edit-video", label: t("nav.editVideo"), matchEditVideo: true },
    ],
    [t],
  );
}

function useImageItems() {
  const t = useT();
  return useMemo(
    () => [
      { to: "/studio", label: t("nav.avatarIa"), matchAvatar: true },
      { to: "/image-studio", label: t("nav.imageStudio"), matchImageStudio: true },
    ],
    [t],
  );
}

function useViralWorksNavState() {
  const location = useLocation();

  const isCreatorActive =
    location.pathname === "/viralworks" || location.pathname.startsWith("/viralworks/");

  const isEditVideoActive = location.pathname === "/edit-video";

  const isImageStudioActive = location.pathname === "/image-studio";

  const isNavItemActive = (item) => {
    if (item.matchCreator) return isCreatorActive;
    if (item.matchEditVideo) return isEditVideoActive;
    if (item.matchImageStudio) return isImageStudioActive;
    if (item.matchAvatar) {
      return (
        location.pathname === "/studio" || location.pathname.startsWith("/studio/")
      );
    }
    return false;
  };

  const isVideoTriggerActive = isCreatorActive || isEditVideoActive;
  const isImageTriggerActive =
    location.pathname === "/studio" ||
    location.pathname.startsWith("/studio/") ||
    isImageStudioActive;

  return { isNavItemActive, isVideoTriggerActive, isImageTriggerActive };
}

function itemClass(active) {
  return active
    ? "bg-emerald-500/10 text-emerald-300"
    : "text-white/70 hover:bg-white/[0.06] hover:text-white";
}

function NewBadge() {
  return (
    <span className="shrink-0 rounded-[20px] bg-emerald-400 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-[#0d1117]">
      NEW
    </span>
  );
}

function prefetchNavTarget(to, userId) {
  if (to === "/image-studio") {
    prefetchPremiumAccess(userId);
    prefetchImageStudioHistory(userId);
  }
  if (to === "/edit-video") prefetchPremiumAccess(userId);
}

function MenuLink({ to, label, active, onNavigate, showNew = false }) {
  const { session } = useAuth();
  const prefetch = () => prefetchNavTarget(to, session?.user?.id);

  return (
    <LienNavSync
      to={to}
      role="menuitem"
      className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-[9px] text-[13px] transition-colors ${itemClass(active)}`}
      onClick={onNavigate}
      onMouseEnter={prefetch}
      onFocus={prefetch}
    >
      <span>{label}</span>
      {showNew ? <NewBadge /> : null}
    </LienNavSync>
  );
}

function NavDropdownDesktop({ label, items, isTriggerActive, isNavItemActive, onPrefetch }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

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
        onMouseEnter={onPrefetch}
        onFocus={onPrefetch}
      >
        <span className="relative z-10">{label}</span>
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
        <div
          className="absolute left-1/2 top-full z-[60] mt-2 w-[240px] -translate-x-1/2 rounded-xl border border-white/[0.12] bg-[#181b26] p-1.5 shadow-xl"
          role="menu"
        >
          {items.map((item) => (
            <MenuLink
              key={item.to}
              to={item.to}
              label={item.label}
              active={isNavItemActive(item)}
              onNavigate={close}
              showNew={Boolean(item.showNew)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Dropdowns desktop : "ViralWorks Vidéo" puis "ViralWorks Image". */
export function MenuNavViralWorksDesktop() {
  const { session } = useAuth();
  const t = useT();
  const videoItems = useVideoItems();
  const imageItems = useImageItems();
  const { isNavItemActive, isVideoTriggerActive, isImageTriggerActive } =
    useViralWorksNavState();
  const prefetchEditVideo = () => {
    prefetchPremiumAccess(session?.user?.id);
  };
  const prefetchImageStudio = () => {
    prefetchPremiumAccess(session?.user?.id);
    prefetchImageStudioHistory(session?.user?.id);
  };

  return (
    <>
      <NavDropdownDesktop
        label={t("nav.video")}
        items={videoItems}
        isTriggerActive={isVideoTriggerActive}
        isNavItemActive={isNavItemActive}
        onPrefetch={prefetchEditVideo}
      />
      <NavDropdownDesktop
        label={t("nav.image")}
        items={imageItems}
        isTriggerActive={isImageTriggerActive}
        isNavItemActive={isNavItemActive}
        onPrefetch={prefetchImageStudio}
      />
    </>
  );
}

function NavAccordionMobile({
  label,
  items,
  icon: Icon,
  isTriggerActive,
  isNavItemActive,
  onNavigate,
  onPrefetch,
  compact = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const { session } = useAuth();

  const close = () => {
    setExpanded(false);
    onNavigate?.();
  };

  const triggerClass = compact
    ? isTriggerActive
      ? "bg-white/14 text-white"
      : "text-white/80 hover:bg-white/[0.08] hover:text-white"
    : isTriggerActive
      ? "card-vws-active text-emerald-300"
      : "text-slate-300 hover:bg-white/5 hover:text-white border border-transparent";

  const subItemClass = (active) =>
    compact
      ? active
        ? "bg-white/14 text-white"
        : "text-white/75 hover:bg-white/[0.08] hover:text-white"
      : itemClass(active);

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={expanded}
        className={`group flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150 ${triggerClass}`}
        onClick={() => setExpanded((v) => !v)}
        onMouseEnter={onPrefetch}
        onFocus={onPrefetch}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Icon
            className="h-4 w-4 shrink-0 opacity-80"
            strokeWidth={2}
            aria-hidden
          />
          <span>{label}</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          strokeWidth={2.25}
        />
      </button>

      {expanded ? (
        <div className={`ml-2 flex flex-col gap-0.5 pl-2.5 ${compact ? "border-l border-white/[0.1]" : "border-l border-white/10"}`}>
          {items.map((item) => (
            <LienNavSync
              key={item.to}
              to={item.to}
              className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${subItemClass(isNavItemActive(item))}`}
              onClick={close}
              onMouseEnter={() => prefetchNavTarget(item.to, session?.user?.id)}
              onFocus={() => prefetchNavTarget(item.to, session?.user?.id)}
            >
              <span>{item.label}</span>
              {item.showNew ? <NewBadge /> : null}
            </LienNavSync>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Sections mobile : accordéons "ViralWorks Vidéo" puis "ViralWorks Image". */
export function MenuNavViralWorksMobile({ onNavigate, compact = false }) {
  const { session } = useAuth();
  const t = useT();
  const videoItems = useVideoItems();
  const imageItems = useImageItems();
  const { isNavItemActive, isVideoTriggerActive, isImageTriggerActive } =
    useViralWorksNavState();
  const prefetchEditVideo = () => {
    prefetchPremiumAccess(session?.user?.id);
  };
  const prefetchImageStudio = () => {
    prefetchPremiumAccess(session?.user?.id);
    prefetchImageStudioHistory(session?.user?.id);
  };

  return (
    <div className="flex flex-col gap-1">
      <NavAccordionMobile
        label={t("nav.video")}
        icon={Video}
        items={videoItems}
        isTriggerActive={isVideoTriggerActive}
        isNavItemActive={isNavItemActive}
        onNavigate={onNavigate}
        onPrefetch={prefetchEditVideo}
        compact={compact}
      />
      <NavAccordionMobile
        label={t("nav.image")}
        icon={Image}
        items={imageItems}
        isTriggerActive={isImageTriggerActive}
        isNavItemActive={isNavItemActive}
        onNavigate={onNavigate}
        onPrefetch={prefetchImageStudio}
        compact={compact}
      />
    </div>
  );
}
