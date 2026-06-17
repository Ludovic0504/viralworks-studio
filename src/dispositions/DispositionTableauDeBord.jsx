import { useState } from "react";
import Header from "@/composants/disposition/EnTete";
import SidebarShell from "@/composants/disposition/Navbar";
import Footer from "@/composants/disposition/PiedDePage";
import { Outlet, useLocation } from "react-router-dom";
import { StudioLayoutOptionsProvider } from "@/contexte/StudioLayoutOptionsContext";
import { FournisseurProfilStudio } from "@/contexte/FournisseurProfilStudio";

function DashboardShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const isAvatarStudioPage =
    location.pathname === "/studio" || location.pathname.startsWith("/studio/");

  const isAccueilPage = location.pathname === "/";

  const mainShellTopPadding = isAccueilPage
    ? "max-md:pt-[calc(4rem+var(--pwa-install-banner-height,0px))] md:pt-16"
    : "pt-[calc(4rem+var(--promo-images-banner-height,0px))] max-md:pt-[calc(4rem+var(--promo-images-banner-height,0px)+var(--pwa-install-banner-height,0px))]";

  const main = (
    <div
      className={`flex flex-col ${
        isAvatarStudioPage
          ? "max-lg:flex-none max-lg:min-h-0 lg:min-h-0 lg:flex-1"
          : "min-h-0 flex-1"
      }`}
    >
      <Outlet />
    </div>
  );

  return (
    <>
      <div
        className={`flex flex-col bg-gradient-to-br from-[#050810] via-[#0C1116] to-[#080b10] text-white relative ${
          isAvatarStudioPage
            ? "min-h-dvh max-lg:overflow-y-auto lg:h-dvh lg:overflow-hidden"
            : "min-h-dvh"
        }`}
      >
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <div className={`flex min-h-0 flex-1 flex-col ${mainShellTopPadding}`}>
          <SidebarShell
            open={menuOpen}
            onCloseMenu={() => setMenuOpen(false)}
            mainClassName={
              isAvatarStudioPage
                ? "min-h-0 max-lg:overflow-y-auto lg:overflow-hidden"
                : "overflow-y-auto"
            }
          >
            <div
              className={`flex flex-col ${
                isAvatarStudioPage
                  ? "max-lg:flex-none max-lg:min-h-0 lg:min-h-0 lg:flex-1"
                  : "min-h-0 flex-1"
              }`}
            >
              {main}
            </div>
          </SidebarShell>
        </div>
        <Footer />
      </div>
    </>
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
