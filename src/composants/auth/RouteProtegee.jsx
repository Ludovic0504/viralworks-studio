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
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return children;
}
