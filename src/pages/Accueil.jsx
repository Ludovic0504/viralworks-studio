import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { ArrowRight, Menu } from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import Footer from "@/composants/disposition/PiedDePage";
import SidebarShell from "@/composants/disposition/Navbar";
import LienNavSync from "@/composants/disposition/LienNavSync";
import MenuProfilConnecte from "@/composants/disposition/MenuProfilConnecte";

const navLinks = [
  { path: "/", label: "Accueil" },
  { path: "/lab", label: "Nouveautés" },
  { path: "/viralworks", label: "ViralWorks" },
  { path: "/communaute-vws", label: "Communauté VWS" },
  { path: "/boutique", label: "Boutique" },
  { path: "/a-savoir", label: "Playbook" },
];

export default function Accueil() {
  const { session, signOut, loading } = useAuth();
  const hasSession = Boolean(session?.user?.id);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const wasConnectedRef = useRef(hasSession);

  const demoVideoChantierUrl = (import.meta.env.VITE_DEMO_VIDEO_CHANTIER_URL || "").trim();
  const demoVideoMoteurUrl = (import.meta.env.VITE_DEMO_VIDEO_MOTEUR_URL || "").trim();
  const demoVideoYachtUrl = (import.meta.env.VITE_DEMO_VIDEO_YACHT_URL || "").trim();

  const demoVideos = useMemo(
    () => [
      { src: demoVideoChantierUrl || "/videos/chantier.mp4", label: "Chantier · Architecte" },
      { src: demoVideoMoteurUrl || "/videos/moteur.mp4", label: "Assemblage · Moteur" },
      { src: demoVideoYachtUrl || "/videos/yacht.mp4", label: "Yacht · Pub" },
    ],
    [demoVideoChantierUrl, demoVideoMoteurUrl, demoVideoYachtUrl]
  );

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || (path !== "/lab" && location.pathname.startsWith(path));
  };

  const handleLogout = async () => {
    try {
      setSigningOut(true);
      await signOut?.();
    } catch (err) {
      console.error("Erreur déconnexion:", err);
    } finally {
      setSigningOut(false);
    }
  };

  useEffect(() => {
    if (hasSession) {
      wasConnectedRef.current = true;
      return;
    }
    if (!loading && !signingOut) {
      wasConnectedRef.current = false;
    }
  }, [hasSession, loading, signingOut]);

  const showConnectedBranch = hasSession || (loading && wasConnectedRef.current);

  const logoTitle = (
    <span className="text-xl font-black bg-gradient-to-r from-cyan-300 via-violet-300 to-yellow-300 bg-clip-text text-transparent group-hover:from-cyan-200 group-hover:via-violet-200 group-hover:to-yellow-200 transition-all">
      ViralWorks Studio
    </span>
  );

  const navItems = (
    <>
      {navLinks.map((link) => {
        const active = isActive(link.path);
        return (
          <LienNavSync
            key={link.path}
            to={link.path}
            className={`relative text-sm font-medium transition-all duration-300 whitespace-nowrap ${
              active ? "text-emerald-300" : "text-gray-400 hover:text-gray-200"
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
    </>
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0C1116] via-[#0a0f14] to-[#080b10]" />
        
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-1/4 left-0 w-full h-96 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent blur-3xl animate-wave1" />
          <div className="absolute top-1/2 left-0 w-full h-96 bg-gradient-to-r from-transparent via-violet-500/20 to-transparent blur-3xl animate-wave2" />
          <div className="absolute bottom-1/4 left-0 w-full h-96 bg-gradient-to-r from-transparent via-yellow-500/20 to-transparent blur-3xl animate-wave3" />
        </div>

        {useMemo(() => {
          return Array.from({ length: 30 }, (_, i) => {
            const colors = ['rgba(65, 209, 255, 0.4)', 'rgba(189, 52, 254, 0.4)', 'rgba(255, 234, 131, 0.4)'];
            const color = colors[i % 3];
            const left = (i * 13.7) % 95;
            const top = (i * 19.3) % 90;
            const duration = 6 + (i % 4) * 1.5;
            const delay = (i * 0.1) % 3;
            return { i, color, left, top, duration, delay };
          });
        }, []).map(({ i, color, left, top, duration, delay }) => (
          <div
            key={`particle-${i}`}
            className="absolute w-1 h-1 rounded-full"
            style={{
              background: color,
              left: `${left}%`,
              top: `${top}%`,
              animation: `float ${duration}s ease-in-out infinite`,
              animationDelay: `${delay}s`,
              boxShadow: `0 0 6px ${color}`,
              opacity: 0.6
            }}
          />
        ))}
      </div>

      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="absolute inset-0 bg-[#0C1116]/30 backdrop-blur-xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 w-full items-center gap-2 md:justify-between">
            <button
              type="button"
              aria-label="Ouvrir le menu"
              onClick={() => setMenuOpen(true)}
              className="md:hidden inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-white/5 transition-colors z-10"
            >
              <Menu size={18} className="text-gray-300" />
            </button>

            <LienNavSync
              to="/"
              className="group z-10 flex min-w-0 flex-1 justify-center md:mr-4 md:flex-none md:justify-start md:shrink-0"
            >
              {logoTitle}
            </LienNavSync>

            <nav className="hidden flex-1 items-center justify-center gap-6 md:flex lg:gap-8">{navItems}</nav>

            <div className="flex shrink-0 items-center justify-end">
              {showConnectedBranch ? (
                <MenuProfilConnecte onLogout={handleLogout} signingOut={signingOut} />
              ) : (
                <LienNavSync
                  to="/login"
                  className="inline-flex items-center justify-center rounded-lg btn-vws-primary px-3 py-2 text-xs font-semibold whitespace-nowrap md:px-6 md:py-2.5 md:text-sm"
                >
                  Connexion
                </LienNavSync>
              )}
            </div>
          </div>
        </div>
      </header>

      <SidebarShell open={menuOpen} onCloseMenu={() => setMenuOpen(false)}>
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-24">
        <div className="max-w-5xl mx-auto text-center w-full">
          <div className="mb-10 sm:mb-14">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-black mb-6 leading-none tracking-tight">
              <span className="text-gray-100 block mb-2">Créez des vidéos qui attirent</span>
              <span className="relative inline-block">
                <span
                  className="inline-block bg-gradient-to-r from-cyan-400 via-violet-400 to-yellow-400 bg-clip-text text-transparent"
                  style={{
                    backgroundSize: '200% 200%',
                    animation: 'gradient 3s ease infinite'
                  }}
                >
                  l'attention
                </span>
              </span>
            </h1>
            <p className="text-xl sm:text-2xl md:text-3xl text-gray-400 font-light mt-4">
              avec l'intelligence artificielle
            </p>
          </div>

          {/* Vidéos de démonstration VWS */}
          <div className="mb-10 sm:mb-14 grid grid-cols-3 gap-3 sm:gap-5 lg:gap-7 max-w-6xl mx-auto">
            {demoVideos.map(({ src, label }) => (
              <div
                key={label}
                className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_20px_45px_rgba(0,0,0,0.45)]"
              >
                <video
                  src={src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  className="block w-full h-[clamp(220px,32vw,420px)] object-contain"
                />
              </div>
            ))}
          </div>

          <p className="text-base sm:text-lg text-gray-500 mb-10 sm:mb-12 max-w-2xl mx-auto leading-relaxed">
            L'outil IA des entrepreneurs qui veulent publier tous les jours sur TikTok, Reels et Shorts, sans y passer des heures.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <LienNavSync
              to={session ? "/viralworks" : "/login"}
              className="group inline-flex items-center gap-3 px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-300 btn-vws-primary"
            >
              <span>{session ? "Créer ma vidéo" : "Se connecter"}</span>
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-2" />
            </LienNavSync>
          </div>
        </div>
      </div>
      </SidebarShell>

      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes float {
          0%, 100% { 
            transform: translateY(0px) translateX(0px);
            opacity: 0.4;
          }
          50% { 
            transform: translateY(-15px) translateX(8px);
            opacity: 0.8;
          }
        }
        @keyframes wave1 {
          0%, 100% { transform: translateX(-30%) translateY(0); opacity: 0.15; }
          50% { transform: translateX(30%) translateY(-20px); opacity: 0.2; }
        }
        @keyframes wave2 {
          0%, 100% { transform: translateX(30%) translateY(0); opacity: 0.15; }
          50% { transform: translateX(-30%) translateY(20px); opacity: 0.2; }
        }
        @keyframes wave3 {
          0%, 100% { transform: translateX(-20%) translateY(0); opacity: 0.15; }
          50% { transform: translateX(20%) translateY(-15px); opacity: 0.2; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        .animate-blink {
          animation: blink 1s step-end infinite;
        }
        .animate-progress {
          animation: progress 2s ease-in-out infinite;
        }
        .animate-wave1 {
          animation: wave1 12s ease-in-out infinite;
        }
        .animate-wave2 {
          animation: wave2 14s ease-in-out infinite;
        }
        .animate-wave3 {
          animation: wave3 16s ease-in-out infinite;
        }
      `}</style>

      <Footer />
    </div>
  );
}
