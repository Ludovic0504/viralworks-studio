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
    // #region agent log
    fetch('http://127.0.0.1:7405/ingest/84f2a250-0990-480e-ba92-160ff926a4b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'770227'},body:JSON.stringify({sessionId:'770227',runId:'run5',hypothesisId:'H14',location:'src/composants/auth/RouteProtegee.jsx:11',message:'protected_route_redirect_unauthenticated',data:{pathname:location.pathname},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return children;
}
