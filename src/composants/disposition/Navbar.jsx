
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, Link } from "react-router-dom";
import { Home, Sparkles, Info, X, User, LogOut, ShoppingBag, Users } from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";

const links = [
  { path: "/", label: "Accueil", icon: Home },
  { path: "/lab", label: "Nouveautés", icon: Sparkles },
  { path: "/viralworks", label: "ViralWorks", icon: Sparkles },
  { path: "/communaute-vws", label: "Communauté VWS", icon: Users },
  { path: "/boutique", label: "Boutique", icon: ShoppingBag },
  { path: "/a-savoir", label: "Informations utiles", icon: Info },
];

export default function SidebarShell({ children, open, onCloseMenu }) {
  const panelRef = useRef(null);
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);
  const { session, signOut } = useAuth();
  const email = session?.user?.email;
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    try {
      setSigningOut(true);
      await signOut?.();
      onCloseMenu?.(); // Fermer le menu après déconnexion
    } catch (err) {
      console.error("Erreur déconnexion:", err);
    } finally {
      setSigningOut(false);
    }
  };


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
      <NavLink
        to={path}
        className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200
         ${isActive
           ? "bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 text-emerald-300 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
           : "text-slate-300 hover:bg-white/5 hover:text-white border border-transparent"}`}
      >
        <IconComponent className={`w-5 h-5 transition-transform ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
        <span>{label}</span>
      </NavLink>
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
          
          {/* Section authentification en bas du menu */}
          <div className="border-t border-white/10 p-4 space-y-2">
            {session ? (
              <>
                {email && (
                  <Link
                    to="/profil"
                    onClick={() => onCloseMenu?.()}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 text-slate-300 hover:bg-white/5 hover:text-white border border-transparent"
                  >
                    <User className="w-5 h-5" />
                    <span className="flex-1 truncate">{email.split('@')[0]}</span>
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  disabled={signingOut}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-transparent disabled:opacity-50"
                >
                  <LogOut className="w-5 h-5" />
                  <span>{signingOut ? "Déconnexion…" : "Se déconnecter"}</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => onCloseMenu?.()}
                className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
              >
                <span>Se connecter</span>
              </Link>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 w-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
