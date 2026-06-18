import { Link, useLocation } from "react-router-dom";
import { FileText } from "lucide-react";
import { useStudioLayoutOptions } from "@/contexte/StudioLayoutOptionsContext";

export default function Footer({ compact = false }) {
  const currentYear = new Date().getFullYear();
  const { hideGlobalFooterOnMobile } = useStudioLayoutOptions();
  const location = useLocation();
  const isAccueilCompact = compact || location.pathname === "/";
  const hideFooterOnMobile =
    hideGlobalFooterOnMobile || location.pathname === "/image-studio";

  return (
    <footer
      className={`shrink-0 border-t border-white/10 bg-[#0C1116]/50 backdrop-blur-sm ${
        hideFooterOnMobile ? "max-[640px]:hidden" : ""
      }`}
    >
      <div
        className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${
          isAccueilCompact ? "py-2.5 sm:py-3" : "py-6"
        }`}
      >
        <div
          className={`flex items-center justify-between gap-3 ${
            isAccueilCompact ? "flex-row text-xs" : "flex-col gap-4 md:flex-row"
          }`}
        >
          <div className="flex items-center gap-6">
            <Link
              to="/mentions-legales"
              className={`text-gray-400 transition-colors hover:text-gray-200 flex items-center gap-1.5 ${
                isAccueilCompact ? "text-xs" : "text-sm"
              }`}
            >
              <FileText className={isAccueilCompact ? "w-3 h-3" : "w-3.5 h-3.5"} />
              <span>Mentions légales</span>
            </Link>
          </div>
          <div className={`text-gray-400 ${isAccueilCompact ? "text-[11px] sm:text-xs" : "text-sm"}`}>
            © {currentYear} ViralWorks Studio. Tous droits réservés.
          </div>
        </div>
      </div>
    </footer>
  );
}

