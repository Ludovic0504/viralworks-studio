import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexte/FournisseurAuth";
import FullScreenLoader from "../interface/ChargeurPleinEcran";
import { useEffect, useState } from "react";

export default function ProtectedRoute({ children }) {
  const { session, loading, supabase } = useAuth();
  const location = useLocation();
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    if (!loading && !session) {
      const doubleCheck = async () => {
        try {
          const { data: { session: directSession } } = await supabase.auth.getSession();
          if (directSession) {
            console.log("[ProtectedRoute] Session trouvée directement, attente de la mise à jour du contexte...");
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (err) {
          console.warn("[ProtectedRoute] Erreur lors de la double vérification:", err);
        } finally {
          setVerifying(false);
        }
      };
      doubleCheck();
    } else {
      setVerifying(false);
    }
  }, [loading, session, supabase]);

  if (loading || verifying) {
    return <FullScreenLoader label="Vérification de la session…" />;
  }

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
