
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Home, Sparkles, FileText, Info } from "lucide-react";
import LienNavSync from "@/composants/disposition/LienNavSync";
import { MenuNavViralWorksMobile } from "@/composants/disposition/MenuNavViralWorks";
import {
  clearMobileNavDrawerScrollLock,
  setMobileNavDrawerScrollLock,
} from "@/bibliotheque/pwa/mobileNavDrawerScrollLock";

const links = [
  { path: "/", label: "Accueil", icon: Home },
  { path: "/lab", label: "Nouveautés", icon: Sparkles },
  { path: "/playbook", label: "Playbook", icon: Info },
];

export default function SidebarShell({
  children,
  open,
  onCloseMenu,
  mainClassName = "overflow-y-auto",
}) {
  const panelRef = useRef(null);
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);
  useEffect(() => {
    // Close only after a real route change (not when `open` flips to true).
    const prev = previousPathRef.current;
    const cur = location.pathname;
    if (prev !== cur && open) {
      onCloseMenu?.();
    }
    previousPathRef.current = location.pathname;
  }, [location.pathname, open, onCloseMenu]);


  useEffect(() => {
    const onDown = (e) => {
      if (!open) return;
      const p = panelRef.current;
      if (p && !p.contains(e.target)) onCloseMenu?.();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, onCloseMenu]);


  useEffect(() => {
    setMobileNavDrawerScrollLock(open);
    return () => {
      if (open) clearMobileNavDrawerScrollLock();
    };
  }, [open]);

  useEffect(() => clearMobileNavDrawerScrollLock, []);

  const Item = ({ path, label, icon }) => {
    const location = useLocation();
    const IconComponent = icon;
    const isActive = path === "/" 
      ? location.pathname === "/"
      : location.pathname === path || (path !== "/lab" && location.pathname.startsWith(path));
    
    return (
      <LienNavSync
        to={path}
        className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150
         ${isActive
           ? "bg-white/14 text-white"
           : "text-white/80 hover:bg-white/[0.08] hover:text-white"}`}
      >
        <IconComponent className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} />
        <span>{label}</span>
      </LienNavSync>
    );
  };

  return (
    <div className="w-full min-h-0 flex-1 flex flex-col">
      {typeof document !== "undefined"
        ? createPortal(
            <>
              {open ? (
                <div
                  className="mobile-nav-drawer-backdrop fixed inset-0 z-[70] bg-[#07090f]/20 md:hidden"
                  role="presentation"
                  aria-hidden
                  data-pwa-block-drawer="true"
                  onClick={() => onCloseMenu?.()}
                />
              ) : null}

              <aside
                ref={panelRef}
                className={`mobile-nav-drawer-panel fixed left-4 z-[80] w-[min(14rem,72vw)] max-h-[min(26rem,calc(100dvh-5.5rem-var(--pwa-install-banner-height,0px)-var(--promo-images-banner-height,0px)))] top-[calc(4rem+var(--pwa-install-banner-height,0px)+var(--promo-images-banner-height,0px)+0.375rem)] overflow-hidden rounded-xl border border-white/12 bg-[#141a22] shadow-[0_10px_40px_rgba(0,0,0,0.45)] ring-1 ring-black/20 transform-gpu will-change-[transform,opacity] transition-[transform,opacity] duration-250 ease-out md:hidden ${
                  open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0 pointer-events-none"
                }`}
                aria-hidden={!open}
              >
                <div className="flex max-h-[inherit] flex-col overflow-y-auto text-white">
                  <nav className="flex flex-col gap-0.5 px-2 py-2">
                    <Item path={links[0].path} label={links[0].label} icon={links[0].icon} />
                    <Item path={links[1].path} label={links[1].label} icon={links[1].icon} />
                    <MenuNavViralWorksMobile
                      compact
                      onNavigate={() => onCloseMenu?.()}
                    />
                    {links.slice(2).map((link) => (
                      <Item key={link.path} {...link} />
                    ))}
                  </nav>

                  <div className="mt-auto border-t border-white/10 px-2 py-1.5">
                    <LienNavSync
                      to="/mentions-legales"
                      onClick={() => onCloseMenu?.()}
                      className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white"
                    >
                      <FileText className="h-4 w-4 shrink-0 opacity-75" strokeWidth={2} />
                      <span>Mentions légales</span>
                    </LienNavSync>
                  </div>
                </div>
              </aside>
            </>,
            document.body,
          )
        : null}

      <main className={`flex min-h-0 min-w-0 flex-col ${mainClassName}`}>
        {children}
      </main>
    </div>
  );
}
