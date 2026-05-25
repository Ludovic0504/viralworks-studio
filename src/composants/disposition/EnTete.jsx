import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Menu, Bell, UserPlus, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useCommunauteVWSNotif } from "@/contexte/FournisseurCommunauteVWSNotif.jsx";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import LienNavSync from "@/composants/disposition/LienNavSync";
import MenuProfilConnecte from "@/composants/disposition/MenuProfilConnecte";
import { MenuNavViralWorksDesktop } from "@/composants/disposition/MenuNavViralWorks";
import { isAdmin } from "@/bibliotheque/supabase/credits";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";

const navLinks = [
  { path: "/", label: "Accueil" },
  { path: "/lab", label: "Nouveautés" },
  { path: "/communaute-vws", label: "Communauté VWS" },
  { path: "/boutique", label: "Boutique" },
];

function MessageBubbleIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
    </svg>
  );
}

export default function Header({ onOpenMenu }) {
  const { session, signOut, loading } = useAuth();
  const { openAuthModal } = useRequireAuthAction();
  const hasSession = Boolean(session?.user?.id);
  const { unreadPrivateCount } = useCommunauteVWSNotif();
  const location = useLocation();

  const [adminBar, setAdminBar] = useState({
    isAdmin: false,
    unreadAdminNotifications: 0,
    signups24h: 0,
  });

  const [signingOut, setSigningOut] = useState(false);
  const wasConnectedRef = useRef(hasSession);

  useEffect(() => {
    let cancelled = false;

    async function refreshAdminBar() {
      if (!hasSession) {
        if (!cancelled) setAdminBar({ isAdmin: false, unreadAdminNotifications: 0, signups24h: 0 });
        return;
      }

      let admin = false;
      try {
        admin = await isAdmin();
      } catch {
        admin = false;
      }

      if (!admin) {
        if (!cancelled) setAdminBar({ isAdmin: false, unreadAdminNotifications: 0, signups24h: 0 });
        return;
      }

      try {
        const supabase = getBrowserSupabase();
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();
        if (!currentSession?.access_token) return;

        const { data, error } = await supabase.functions.invoke("admin-adminbar", {
          headers: { Authorization: `Bearer ${currentSession.access_token}` },
        });
        if (error) return;

        if (!cancelled) {
          setAdminBar({
            isAdmin: true,
            unreadAdminNotifications: Number(data?.unreadAdminNotifications || 0),
            signups24h: Number(data?.signups24h || 0),
          });
        }
      } catch {
        // ignore
      }
    }

    refreshAdminBar();
    const id = window.setInterval(refreshAdminBar, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hasSession, session?.user?.id]);

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

  const logoTitle = (
    <img
      src="/Logo_VWS_sans_bordure.png"
      alt="ViralWorks Studio"
      className="h-10 w-auto block"
      height={40}
      decoding="async"
    />
  );

  const navLinkItem = (link) => {
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
  };

  const navItems = (
    <>
      {navLinks.slice(0, 2).map(navLinkItem)}
      <MenuNavViralWorksDesktop />
      {navLinks.slice(2).map(navLinkItem)}
    </>
  );

  const authSlot = showConnectedBranch ? (
    <MenuProfilConnecte onLogout={handleLogout} signingOut={signingOut} />
  ) : (
    <button
      type="button"
      onClick={() => openAuthModal?.()}
      className="inline-flex items-center justify-center rounded-lg btn-vws-primary px-4 py-2 text-sm font-semibold whitespace-nowrap md:px-6 md:py-2.5"
    >
      Connexion
    </button>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="absolute inset-0 bg-[#0C1116]/30 backdrop-blur-xl" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 w-full items-center gap-2 md:justify-between">
          <button
            type="button"
            aria-label="Ouvrir le menu"
            onClick={() => onOpenMenu?.()}
            className="md:hidden inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-white/5 transition-colors z-10"
          >
            <Menu size={18} className="text-gray-300" />
          </button>

          <LienNavSync
            to="/"
            className="z-10 flex min-w-0 flex-1 justify-center md:mr-4 md:flex-none md:justify-start md:shrink-0"
          >
            {logoTitle}
          </LienNavSync>

          <nav className="hidden flex-1 items-center justify-center gap-6 md:flex lg:gap-8">{navItems}</nav>

          <div className="nav-right flex shrink-0 items-center justify-end gap-2">
            {adminBar.isAdmin ? (
              <>
              <LienNavSync
                to="/admin/stats"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Analytics réseaux sociaux"
                title="Analytics réseaux"
              >
                <BarChart3 size={18} className="text-gray-300" />
              </LienNavSync>
              <LienNavSync
                to="/admin?tab=notifications"
                className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Admin: inscriptions et notifications"
                title="Admin: inscriptions & notifications"
              >
                <div className="relative">
                  <Bell size={18} className="text-gray-300" />
                  {adminBar.signups24h > 0 ? (
                    <UserPlus
                      size={12}
                      className="absolute -right-2 -bottom-2 text-emerald-300"
                      aria-hidden
                    />
                  ) : null}
                </div>
                {adminBar.unreadAdminNotifications > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold leading-none text-white">
                    {adminBar.unreadAdminNotifications > 99 ? "99+" : adminBar.unreadAdminNotifications}
                  </span>
                ) : null}
              </LienNavSync>
              </>
            ) : null}
            {hasSession ? (
              <LienNavSync
                to="/communaute-vws?tab=private"
                className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={
                  unreadPrivateCount > 0
                    ? `Messages privés, ${unreadPrivateCount} non lus`
                    : "Messages privés"
                }
              >
                <MessageBubbleIcon className="text-gray-300" />
                {unreadPrivateCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
                    {unreadPrivateCount > 99 ? "99+" : unreadPrivateCount}
                  </span>
                ) : null}
              </LienNavSync>
            ) : null}
            {authSlot}
          </div>
        </div>
      </div>
    </header>
  );
}
