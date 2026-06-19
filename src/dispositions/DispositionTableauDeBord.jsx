import { useState, useEffect, useCallback } from "react";
import Header from "@/composants/disposition/EnTete";
import SidebarShell from "@/composants/disposition/Navbar";
import Footer from "@/composants/disposition/PiedDePage";
import { Outlet, useLocation } from "react-router-dom";
import { StudioLayoutOptionsProvider } from "@/contexte/StudioLayoutOptionsContext";
import { FournisseurProfilStudio } from "@/contexte/FournisseurProfilStudio";
import { PwaNavigationProvider } from "@/contexte/PwaNavigationContext";
import { usePwaMobileDrawerSwipe } from "@/bibliotheque/pwa/usePwaMobileDrawerSwipe";
import { clearMobileNavDrawerScrollLock } from "@/bibliotheque/pwa/mobileNavDrawerScrollLock";
import { getDashboardShellLayout } from "@/bibliotheque/disposition/dashboardShellLayout";

function DashboardShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const layout = getDashboardShellLayout(location.pathname);
  const isAccueilPage = location.pathname === "/";

  const handlePwaBackOpensMenu = useCallback(() => {
    if (!isAccueilPage) setMenuOpen(true);
  }, [isAccueilPage]);

  usePwaMobileDrawerSwipe({
    open: menuOpen,
    onOpen: () => setMenuOpen(true),
    onClose: () => setMenuOpen(false),
    openFromEdgeEnabled: !isAccueilPage,
  });

  useEffect(() => {
    clearMobileNavDrawerScrollLock();
    setMenuOpen(false);
  }, [location.pathname]);

  const main = (
    <div className={`flex flex-col ${layout.mainWrapperClass}`}>
      <Outlet />
    </div>
  );

  return (
    <PwaNavigationProvider onBackGesture={handlePwaBackOpensMenu}>
      <div
        data-dashboard-profile={layout.profile}
        className={`flex flex-col bg-gradient-to-br from-[#050810] via-[#0C1116] to-[#080b10] text-white relative ${layout.shellLayoutClass}`}
      >
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <div className={`flex flex-col ${layout.contentAreaFlexClass} ${layout.mainShellTopPadding}`}>
          <SidebarShell
            open={menuOpen}
            onCloseMenu={() => setMenuOpen(false)}
            mainClassName={layout.sidebarMainClassName}
          >
            <div className={`flex flex-col ${layout.contentAreaFlexClass}`}>
              {main}
            </div>
          </SidebarShell>
        </div>
        <Footer compact={layout.compactFooter} />
      </div>
    </PwaNavigationProvider>
  );
}

export default function DashboardLayout() {
  return (
    <FournisseurProfilStudio>
      <StudioLayoutOptionsProvider>
        <DashboardShell />
      </StudioLayoutOptionsProvider>
    </FournisseurProfilStudio>
  );
}
