import { useEffect } from "react";
import { X } from "lucide-react";
import AuthFormCard from "@/composants/auth/AuthFormCard";
import { useT } from "@/contexte/FournisseurLocale";

export default function AuthModal({
  open,
  onClose,
  onAuthSuccess,
  initialMode = "signin",
}) {
  const t = useT();

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
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm px-5 py-4 sm:p-4"
      onClick={() => onClose?.()}
      role="presentation"
    >
      <div
        className="studio-panel relative max-h-[85dvh] min-w-0 w-full max-w-md overflow-y-auto p-5 sm:p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("auth.login")}
      >
        <button
          type="button"
          onClick={() => onClose?.()}
          className="absolute right-3 top-3 p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label={t("common.close")}
        >
          <X className="w-4 h-4" />
        </button>
        <AuthFormCard
          initialMode={initialMode}
          onAuthSuccess={onAuthSuccess}
          reserveHeaderSpaceForCloseButton
        />
      </div>
    </div>
  );
}
