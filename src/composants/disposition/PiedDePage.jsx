
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-[#0C1116]/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link
              to="/mentions-legales"
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Mentions légales</span>
            </Link>
          </div>
          <div className="text-sm text-gray-400">
            © {currentYear} Mon copyright. Tous droits réservés.
          </div>
        </div>
      </div>
    </footer>
  );
}

