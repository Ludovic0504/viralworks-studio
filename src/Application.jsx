import { Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect, Component } from "react";
import DashboardLayout from "./dispositions/DispositionTableauDeBord.jsx";
import RappelAuth from "./pages/RappelAuth.jsx";
import Accueil from "./pages/Accueil.jsx";
import Lab from "./pages/Lab.jsx";
import Asavoir from "./pages/Asavoir.jsx";
import Connexion from "./pages/Connexion.jsx";
import RouteDeconnexion from "./pages/RouteDeconnexion.jsx";
import ReinitialiserMotDePasse from "./pages/ReinitialiserMotDePasse.jsx";
import Profil from "./pages/Profil.jsx";
import Galerie from "./pages/Galerie.jsx";
import Boutique from "./pages/Boutique.jsx";
import CommunauteVWS from "./pages/CommunauteVWS.jsx";
import Admin from "./pages/Admin.jsx";
import MentionsLegales from "./pages/MentionsLegales.jsx";
import ChargeurInitial from "./composants/interface/ChargeurInitial.jsx";
import ProtectedRoute from "./composants/auth/RouteProtegee.jsx";

const LOADER_STORAGE_KEY = "onetool_initial_loader_seen";
const LOADER_COOLDOWN_HOURS = 1;

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Erreur route capturée:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="glass-strong rounded-xl p-8 border border-red-500/30 text-center">
          <h2 className="text-xl font-semibold text-gray-200 mb-2">Erreur d'affichage de la galerie</h2>
          <p className="text-gray-400 mb-6">
            La page galerie a rencontré un problème. Recharge la page ou retourne sur ton profil.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-all"
            >
              Recharger
            </button>
            <a
              href="/profil"
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
            >
              Retour profil
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default function App() {
  const [showInitialLoader, setShowInitialLoader] = useState(false);

  useEffect(() => {
    try {
      const lastSeen = localStorage.getItem(LOADER_STORAGE_KEY);
      
      if (!lastSeen) {
        setShowInitialLoader(true);
      } else {
        const lastSeenTime = parseInt(lastSeen, 10);
        const now = Date.now();
        const hoursSinceLastSeen = (now - lastSeenTime) / (1000 * 60 * 60);
        
        if (hoursSinceLastSeen >= LOADER_COOLDOWN_HOURS) {
          setShowInitialLoader(true);
        } else {
          setShowInitialLoader(false);
        }
      }
    } catch (error) {
      console.warn("Erreur lors de la vérification du loader:", error);
      setShowInitialLoader(false);
    }
  }, []);

  const handleEnter = () => {
    try {
      localStorage.setItem(LOADER_STORAGE_KEY, Date.now().toString());
    } catch (error) {
      console.warn("Erreur lors de l'enregistrement du loader:", error);
    }
    setShowInitialLoader(false);
  };


  if (showInitialLoader) {
    return <ChargeurInitial onEnter={handleEnter} />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Connexion />} />
      <Route path="/logout" element={<RouteDeconnexion />} />
      <Route path="/auth/callback" element={<RappelAuth />} />
      <Route path="/reset-password" element={<ReinitialiserMotDePasse />} />
      <Route path="/" element={<Accueil />} />

      <Route element={<DashboardLayout />}>
        <Route path="/lab" element={<Lab />} />
        <Route path="/a-savoir" element={<Asavoir />} />
        <Route path="/mentions-legales" element={<MentionsLegales />} />
        
        <Route path="/dashboard" element={<Navigate to="/" replace />} />

        <Route path="/prompt" element={<Navigate to="/viralworks" replace />} />
        {/* ViralWorks est rendu dans DashboardLayout (persistant, masqué hors /viralworks). */}
        <Route path="/viralworks" element={null} />
        <Route path="/image" element={<Navigate to="/viralworks" replace />} />
        <Route path="/video" element={<Navigate to="/viralworks" replace />} />
        <Route
          path="/profil"
          element={
            <ProtectedRoute>
              <Profil />
            </ProtectedRoute>
          }
        />
        <Route
          path="/galerie"
          element={
            <ProtectedRoute>
              <RouteErrorBoundary>
                <Galerie />
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/communaute-vws"
          element={<CommunauteVWS />}
        />
        <Route
          path="/boutique"
          element={<Boutique />}
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
