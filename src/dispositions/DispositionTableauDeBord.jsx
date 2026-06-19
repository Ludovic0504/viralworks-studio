import { useState } from "react";
import Header from "@/composants/disposition/EnTete";
import SidebarShell from "@/composants/disposition/Navbar";
import Footer from "@/composants/disposition/PiedDePage";
import { Outlet, useLocation } from "react-router-dom";
import { StudioLayoutOptionsProvider } from "@/contexte/StudioLayoutOptionsContext";
import { FournisseurProfilStudio } from "@/contexte/FournisseurProfilStudio";
import { PwaNavigationProvider } from "@/contexte/PwaNavigationContext";
import { usePwaMobileDrawerSwipe } from "@/bibliotheque/pwa/usePwaMobileDrawerSwipe";

function DashboardShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  usePwaMobileDrawerSwipe({
    open: menuOpen,
    onOpen: () => setMenuOpen(true),
    onClose: () => setMenuOpen(false),
  });

  const isAvatarStudioPage =
    location.pathname === "/studio" || location.pathname.startsWith("/studio/");

  const isImageStudioPage = location.pathname === "/image-studio";

  const isImmersiveStudioPage = isAvatarStudioPage || isImageStudioPage;

  const isAccueilPage = location.pathname === "/";

  const shellLayoutClass = isAccueilPage || isImageStudioPage
    ? "h-dvh overflow-hidden"
    : isImmersiveStudioPage
      ? "min-h-dvh lg:h-dvh lg:overflow-hidden"
      : "min-h-dvh";

  const contentAreaFlexClass = isAccueilPage || isImageStudioPage
    ? "min-h-0 flex-1"
    : isImmersiveStudioPage
      ? "max-lg:flex-none lg:min-h-0 lg:flex-1"
      : "flex-none";

  const mainShellTopPadding = isAccueilPage
    ? "max-md:pt-[calc(4rem+var(--pwa-install-banner-height,0px))] md:pt-16"
    : "pt-[calc(4rem+var(--promo-images-banner-height,0px))] max-md:pt-[calc(4rem+var(--promo-images-banner-height,0px)+var(--pwa-install-banner-height,0px))]";

  const sidebarMainClassName = isAccueilPage || isImageStudioPage
    ? "flex-1 min-h-0 overflow-hidden"
    : isImmersiveStudioPage
      ? "max-lg:flex-none lg:flex-1 lg:min-h-0 lg:overflow-hidden"
      : "flex-none";

  const main = (
    <div
      className={`flex flex-col ${
        isAccueilPage || isImageStudioPage
          ? "min-h-0 flex-1 overflow-hidden"
          : isImmersiveStudioPage
            ? "max-lg:flex-none max-lg:min-h-0 lg:min-h-0 lg:flex-1 lg:overflow-hidden"
            : "flex-none"
      }`}
    >
      <Outlet />
    </div>
  );

  return (
    <PwaNavigationProvider>
      <div
        className={`flex flex-col bg-gradient-to-br from-[#050810] via-[#0C1116] to-[#080b10] text-white relative ${shellLayoutClass}`}
      >
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <div className={`flex flex-col ${contentAreaFlexClass} ${mainShellTopPadding}`}>
          <SidebarShell
            open={menuOpen}
            onCloseMenu={() => setMenuOpen(false)}
            mainClassName={sidebarMainClassName}
          >
            <div className={`flex flex-col ${contentAreaFlexClass}`}>
              {main}
            </div>
          </SidebarShell>
        </div>
        <Footer compact={isAccueilPage || isImageStudioPage} />
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
