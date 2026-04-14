import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";

export default function LogoutButton({ className }) {
  const [busy, setBusy] = useState(false);
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      setBusy(true);
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className={className || `
        inline-flex items-center gap-2
        rounded-md px-3 py-1.5 text-xs font-medium
        border border-white/10 text-gray-300
        hover:bg-white/5 active:bg-white/10
        disabled:opacity-50 disabled:cursor-not-allowed
        transition
      `}
    >
      <LogOut className="w-4 h-4" />
      <span className="hidden sm:inline">
        {busy ? "Déconnexion…" : "Se déconnecter"}
      </span>
    </button>
  );
}
