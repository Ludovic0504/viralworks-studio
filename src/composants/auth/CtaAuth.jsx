import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import LogoutButton from "./BoutonDeconnexion";

export default function AuthCta() {
  const { session, loading } = useAuth();
  const { openAuthModal } = useRequireAuthAction();


  return (
    <div className="w-32 flex justify-end">
      {loading ? (
        <span className="text-sm text-gray-400">…</span>
      ) : session ? (

        <LogoutButton className="text-sm underline" />
      ) : (
        <button type="button" onClick={() => openAuthModal?.()} className="text-sm underline">
          Se connecter
        </button>
      )}
    </div>
  );
}
