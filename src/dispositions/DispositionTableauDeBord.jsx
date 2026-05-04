import { useState } from "react";
import Header from "@/composants/disposition/EnTete";
import SidebarShell from "@/composants/disposition/Navbar";
import Footer from "@/composants/disposition/PiedDePage";
import { Outlet } from "react-router-dom";
import { StudioLayoutOptionsProvider } from "@/contexte/StudioLayoutOptionsContext";

export default function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  const main = (
    <div className="flex-1 min-h-0 flex flex-col min-h-0">
      <Outlet />
    </div>
  );

  return (
    <StudioLayoutOptionsProvider>
      <div className="min-h-dvh flex flex-col bg-gradient-to-br from-[#050810] via-[#0C1116] to-[#080b10] text-white relative">
        <Header onOpenMenu={() => setMenuOpen(true)} />
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
    </StudioLayoutOptionsProvider>
  );
}
