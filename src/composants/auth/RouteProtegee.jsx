import { useAuth } from "../../contexte/FournisseurAuth";
import FullScreenLoader from "../interface/ChargeurPleinEcran";
import { Navigate, useLocation } from "react-router-dom";
import { isAccountEmailVerified } from "@/bibliotheque/auth/emailVerified";

export default function ProtectedRoute({ children }) {
  const { loading, session } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader label="Vérification de la session…" />;
  }

  if (!session) {
    const sp = new URLSearchParams();
    sp.set("login", "1");
    sp.set("next", location.pathname);
    return <Navigate to={{ pathname: location.pathname, search: `?${sp.toString()}` }} replace />;
  }

  if (!isAccountEmailVerified(session.user)) {
    const email = encodeURIComponent(session.user.email || "");
    return (
      <Navigate
        to={`/auth/en-attente-confirmation${email ? `?email=${email}` : ""}`}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}
