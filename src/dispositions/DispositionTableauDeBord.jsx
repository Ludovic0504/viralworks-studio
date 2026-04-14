import { useState } from "react";
import Header from "@/composants/disposition/EnTete";
import SidebarShell from "@/composants/disposition/Navbar";
import Footer from "@/composants/disposition/PiedDePage";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import ViralWorks from "@/pages/ViralWorks.jsx";
import { useAuth } from "@/contexte/FournisseurAuth";
import FullScreenLoader from "@/composants/interface/ChargeurPleinEcran";

export default function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { session, loading } = useAuth();
  const isViralWorks = location.pathname === "/viralworks";

  const main = (() => {
    if (loading && isViralWorks) {
      return (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <FullScreenLoader label="Vérification de la session…" />
        </div>
      );
    }
    if (!loading && !session && isViralWorks) {
      const next = encodeURIComponent(location.pathname + location.search);
      return <Navigate to={`/login?next=${next}`} replace />;
    }
    return (
      <>
        {/* Studio : monté dès que la session existe, masqué hors /viralworks (état conservé). */}
        {session ? (
          <div
            className={
              isViralWorks
                ? "flex-1 min-h-0 flex flex-col"
                : "hidden"
            }
            aria-hidden={!isViralWorks}
          >
            <ViralWorks />
          </div>
        ) : null}
        <div
          className={
            isViralWorks && session
              ? "hidden"
              : "flex-1 min-h-0 flex flex-col min-h-0"
          }
          aria-hidden={Boolean(isViralWorks && session)}
        >
          <Outlet />
        </div>
      </>
    );
  })();

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-br from-[#050810] via-[#0C1116] to-[#080b10] text-white relative">
      <Header onOpenMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />
      <div className="flex-1 flex flex-col pt-16">
        <SidebarShell 
          open={menuOpen} 
          onCloseMenu={() => setMenuOpen(false)}
        >
          <div className="flex-1 min-h-0 flex flex-col">
            {main}
          </div>
        </SidebarShell>
      </div>
      <Footer />
    </div>
  );
}
