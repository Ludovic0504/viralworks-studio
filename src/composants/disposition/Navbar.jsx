
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Home, Sparkles, Info, X, ShoppingBag, Users, FileText } from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import LienNavSync from "@/composants/disposition/LienNavSync";

const links = [
  { path: "/", label: "Accueil", icon: Home },
  { path: "/lab", label: "Nouveautés", icon: Sparkles },
  { path: "/viralworks", label: "ViralWorks", icon: Sparkles },
  { path: "/communaute-vws", label: "Communauté VWS", icon: Users },
  { path: "/boutique", label: "Boutique", icon: ShoppingBag },
  { path: "/a-savoir", label: "Playbook", icon: Info },
];

export default function SidebarShell({ children, open, onCloseMenu }) {
  const panelRef = useRef(null);
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);
  const { session } = useAuth();

  useEffect(() => {
    // Close only after a real route change (not when `open` flips to true).
    if (previousPathRef.current !== location.pathname && open) {
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
    if (open) {
      const html = document.documentElement;
      const prev = html.style.overflow;
      html.style.overflow = "hidden";
      return () => { html.style.overflow = prev; };
    }
  }, [open]);

  const Item = ({ path, label, icon }) => {
    const location = useLocation();
    const IconComponent = icon;
    const isActive = path === "/" 
      ? location.pathname === "/"
      : location.pathname === path || (path !== "/lab" && location.pathname.startsWith(path));
    
    return (
      <LienNavSync
        to={path}
        className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200
         ${isActive
           ? "card-vws-active text-emerald-300"
           : "text-slate-300 hover:bg-white/5 hover:text-white border border-transparent"}`}
      >
        <IconComponent className={`w-5 h-5 transition-transform ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
        <span>{label}</span>
      </LienNavSync>
    );
  };

  return (
    <div className="w-full h-full flex flex-col">
      <aside
        ref={panelRef}
        className={`fixed inset-y-0 left-0 w-72 bg-gradient-to-b from-[#0C1116] via-[#0a0f14] to-[#0C1116] border-r border-white/10 transform transform-gpu will-change-transform transition-transform duration-300 z-50 md:hidden shadow-2xl ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="h-full text-white overflow-y-auto flex flex-col">
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#0C1116]/80 backdrop-blur-sm sticky top-0 z-10">
            <span className="font-semibold text-lg">Navigation</span>
            <button
              onClick={() => onCloseMenu?.()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 hover:bg-white/5 active:bg-white/10 transition-all duration-200 hover:scale-105"
              aria-label="Fermer"
            >
              <X size={18} className="text-slate-300" />
            </button>
          </div>
          <nav className="flex flex-col gap-2 px-4 py-4 flex-1">
            {links.map((link) => (
              <Item key={link.path} {...link} />
            ))}
          </nav>

          <div className="border-t border-white/10 px-4 py-3">
            <LienNavSync
              to="/mentions-legales"
              onClick={() => onCloseMenu?.()}
              className="group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-white/5 hover:text-white border border-transparent"
            >
              <FileText className="w-5 h-5 opacity-80" />
              <span>Mentions légales</span>
            </LienNavSync>
          </div>

          {!session && (
            <div className="border-t border-white/10 p-4">
              <LienNavSync
                to="/login"
                onClick={() => onCloseMenu?.()}
                className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold btn-vws-primary"
              >
                <span>Se connecter</span>
              </LienNavSync>
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 w-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
