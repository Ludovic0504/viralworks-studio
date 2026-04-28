import { useState } from "react";
import Header from "@/composants/disposition/EnTete";
import SidebarShell from "@/composants/disposition/Navbar";
import Footer from "@/composants/disposition/PiedDePage";
import { Outlet, useLocation } from "react-router-dom";

export default function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // #region agent log
  fetch('http://127.0.0.1:7405/ingest/84f2a250-0990-480e-ba92-160ff926a4b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'770227'},body:JSON.stringify({sessionId:'770227',runId:'run1',hypothesisId:'H3',location:'src/dispositions/DispositionTableauDeBord.jsx:11',message:'dashboard_layout_render',data:{pathname:location.pathname,menuOpen},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const main = (
    <div className="flex-1 min-h-0 flex flex-col min-h-0">
      <Outlet />
    </div>
  );

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
