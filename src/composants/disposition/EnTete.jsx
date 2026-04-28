import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import LienNavSync from "@/composants/disposition/LienNavSync";

const navLinks = [
  { path: "/", label: "Accueil" },
  { path: "/lab", label: "Nouveautés" },
  { path: "/viralworks", label: "ViralWorks" },
  { path: "/communaute-vws", label: "Communauté VWS" },
  { path: "/boutique", label: "Boutique" },
  { path: "/a-savoir", label: "Informations utiles" },
];

export default function Header({ onOpenMenu }) {
  const { session, signOut, loading } = useAuth();
  const email = session?.user?.email;
  const hasSession = Boolean(session?.user?.id);
  const location = useLocation();

  const [signingOut, setSigningOut] = useState(false);
  const wasConnectedRef = useRef(hasSession);

  useEffect(() => {
    if (hasSession) {
      wasConnectedRef.current = true;
      return;
    }
    if (!loading && !signingOut) {
      wasConnectedRef.current = false;
    }
  }, [hasSession, loading, signingOut]);
  async function handleLogout() {
    try {
      setSigningOut(true);
      await signOut?.();
    } finally {
      setSigningOut(false);
    }
  }

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || (path !== "/lab" && location.pathname.startsWith(path));
  };

  const showConnectedBranch = hasSession || (loading && wasConnectedRef.current);

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7405/ingest/84f2a250-0990-480e-ba92-160ff926a4b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'770227'},body:JSON.stringify({sessionId:'770227',runId:'run6',hypothesisId:'H16',location:'src/composants/disposition/EnTete.jsx:52',message:'header_auth_render_state_ref_mode',data:{pathname:location.pathname,loading,hasSession,hasEmail:Boolean(email),wasConnectedRef:wasConnectedRef.current,showConnectedBranch},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [location.pathname, loading, hasSession, email, showConnectedBranch]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="absolute inset-0 bg-[#0C1116]/30 backdrop-blur-xl" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <LienNavSync to="/" className="z-10 flex-shrink-0 mr-4">
            <span className="text-xl font-black bg-gradient-to-r from-cyan-300 via-violet-300 to-yellow-300 bg-clip-text text-transparent">
              ViralWorks Studio
            </span>
          </LienNavSync>
          <nav className="hidden md:flex items-center justify-center gap-6 lg:gap-8 flex-1">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <LienNavSync
                  key={link.path}
                  to={link.path}
                  className={`relative text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                    active
                      ? "text-emerald-300"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <span className="relative z-10">{link.label}</span>
                  {active && (
                    <>
                      <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400" />
                    </>
                  )}
                </LienNavSync>
              );
            })}
          </nav>

          <div className="flex items-center gap-4 z-10 flex-shrink-0">
            {showConnectedBranch ? (
              <>
                {email && (
                  <LienNavSync
                    to="/profil"
                    className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer group"
                    title="Voir mon profil"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 group-hover:bg-emerald-300 transition-colors" />
                    <span className="text-xs text-gray-300 font-medium truncate max-w-[120px] group-hover:text-gray-200 transition-colors">
                      {email.split('@')[0]}
                    </span>
                  </LienNavSync>
                )}
                <button
                  onClick={handleLogout}
                  disabled={signingOut}
                  className="hidden md:flex text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
                  title="Se déconnecter"
                >
                  {signingOut ? "Déconnexion…" : "Déconnexion"}
                </button>
              </>
            ) : (
              <LienNavSync
                to="/login"
                className="hidden md:flex px-6 py-2.5 text-sm font-semibold rounded-lg btn-vws-primary"
              >
                Connexion
              </LienNavSync>
            )}
            <button
              type="button"
              aria-label="Ouvrir le menu"
              onClick={() => onOpenMenu?.()}
              className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 transition-colors z-10"
            >
              <Menu size={18} className="text-gray-300" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
