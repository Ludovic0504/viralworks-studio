import { useState } from "react";
import Header from "@/composants/disposition/EnTete";
import SidebarShell from "@/composants/disposition/Navbar";
import Footer from "@/composants/disposition/PiedDePage";
import { Outlet } from "react-router-dom";
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
  const { session } = useAuth();
  const { secteur, loading: profilStudioLoading, updateSecteur, isAdmin } = useProfilStudio();

  const needsSectorModal =
    Boolean(session?.user?.id) &&
    !profilStudioLoading &&
    !isAdmin &&
    secteur == null;

  const main = (
    <div className="flex-1 min-h-0 flex flex-col min-h-0">
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
      <div className="min-h-dvh flex flex-col bg-gradient-to-br from-[#050810] via-[#0C1116] to-[#080b10] text-white relative">
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <div className="flex-1 flex flex-col pt-16">
          <SidebarShell open={menuOpen} onCloseMenu={() => setMenuOpen(false)}>
            <div className="flex-1 min-h-0 flex flex-col">{main}</div>
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
