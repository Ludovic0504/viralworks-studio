import { Link } from "react-router-dom";
import { useAuth } from "@/contexte/FournisseurAuth";
import LogoutButton from "./BoutonDeconnexion";

export default function AuthCta() {
  const { session, loading } = useAuth();


  return (
    <div className="w-32 flex justify-end">
      {loading ? (
        <span className="text-sm text-gray-400">…</span>
      ) : session ? (

        <LogoutButton className="text-sm underline" />
      ) : (
        <Link to="/login" className="text-sm underline">Se connecter</Link>
      )}
    </div>
  );
}
