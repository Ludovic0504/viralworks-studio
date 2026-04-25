import { useEffect } from "react";
import { X } from "lucide-react";
import AuthFormCard from "@/composants/auth/AuthFormCard";

export default function AuthModal({
  open,
  onClose,
  onAuthSuccess,
  initialMode = "signin",
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={() => onClose?.()}
      role="presentation"
    >
      <div
        className="studio-panel relative max-w-md w-full p-5 sm:p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Connexion"
      >
        <button
          type="button"
          onClick={() => onClose?.()}
          className="absolute right-3 top-3 p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
        <AuthFormCard initialMode={initialMode} onAuthSuccess={onAuthSuccess} />
      </div>
    </div>
  );
}
