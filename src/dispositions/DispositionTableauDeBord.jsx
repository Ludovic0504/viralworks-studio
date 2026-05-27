import { useState } from "react";
import Header from "@/composants/disposition/EnTete";
import SidebarShell from "@/composants/disposition/Navbar";
import Footer from "@/composants/disposition/PiedDePage";
import { Outlet, useLocation } from "react-router-dom";
import { StudioLayoutOptionsProvider } from "@/contexte/StudioLayoutOptionsContext";
import { FournisseurProfilStudio, useProfilStudio } from "@/contexte/FournisseurProfilStudio";
import { useAuth } from "@/contexte/FournisseurAuth";
import SectorModal from "@/composants/studio/SectorModal";

/**
 * Contenu du shell dashboard + modale secteur (bloque toute l’UI tant que le profil n’a pas de secteur).
 * Doit rester à l’intérieur de `FournisseurProfilStudio` pour `useProfilStudio`.
 */
function DashboardShellWithSectorGate() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { session } = useAuth();
  const { secteur, loading: profilStudioLoading, updateSecteur, isAdmin } = useProfilStudio();

  const isAvatarStudioPage =
    location.pathname === "/studio" || location.pathname.startsWith("/studio/");

  const needsSectorModal =
    Boolean(session?.user?.id) &&
    !profilStudioLoading &&
    !isAdmin &&
    secteur == null;

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
      <SectorModal
        open={needsSectorModal}
        onComplete={async (value) => {
          const r = await updateSecteur(value);
          if (!r.ok) throw new Error(r.error || "Impossible d'enregistrer le secteur.");
        }}
      />
      <div
        className={`flex flex-col bg-gradient-to-br from-[#050810] via-[#0C1116] to-[#080b10] text-white relative ${
          isAvatarStudioPage
            ? "min-h-dvh max-lg:overflow-y-auto lg:h-dvh lg:overflow-hidden"
            : "min-h-dvh"
        }`}
      >
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <div className="flex min-h-0 flex-1 flex-col pt-16">
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
        <DashboardShellWithSectorGate />
      </StudioLayoutOptionsProvider>
    </FournisseurProfilStudio>
  );
}
