import { useAuth } from "../../contexte/FournisseurAuth";
import FullScreenLoader from "../interface/ChargeurPleinEcran";
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const { loading, session } = useAuth();
  const location = useLocation();
  if (loading) {
    return <FullScreenLoader label="Vérification de la session…" />;
  }
  if (!session) {
    // Ne pas basculer de page : on déclenche l'ouverture du modal via `AppShell` en utilisant `?login=1`.
    const sp = new URLSearchParams();
    sp.set("login", "1");
    sp.set("next", location.pathname);
    return <Navigate to={{ pathname: location.pathname, search: `?${sp.toString()}` }} replace />;
  }
  return children;
}
