import { useAuth } from "../../contexte/FournisseurAuth";
import FullScreenLoader from "../interface/ChargeurPleinEcran";

export default function ProtectedRoute({ children }) {
  const { loading } = useAuth();
  if (loading) {
    return <FullScreenLoader label="Vérification de la session…" />;
  }
  return children;
}
