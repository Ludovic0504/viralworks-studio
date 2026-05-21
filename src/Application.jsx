import { createBrowserRouter, RouterProvider, Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, Component } from "react";
import DashboardLayout from "./dispositions/DispositionTableauDeBord.jsx";
import RappelAuth from "./pages/RappelAuth.jsx";
import ConfirmerEmail from "./pages/ConfirmerEmail.jsx";
import Accueil from "./pages/Accueil.jsx";
import Lab from "./pages/Lab.jsx";
import Connexion from "./pages/Connexion.jsx";
import RouteDeconnexion from "./pages/RouteDeconnexion.jsx";
import ReinitialiserMotDePasse from "./pages/ReinitialiserMotDePasse.jsx";
import Profil from "./pages/Profil.jsx";
import Galerie from "./pages/Galerie.jsx";
import Boutique from "./pages/Boutique.jsx";
import CommunauteVWS from "./pages/CommunauteVWS.jsx";
import Admin from "./pages/Admin.jsx";
import MentionsLegales from "./pages/MentionsLegales.jsx";
import ViralWorks from "./pages/ViralWorks.jsx";
import Studio from "./pages/Studio.jsx";
import ProtectedRoute from "./composants/auth/RouteProtegee.jsx";
import { AuthProvider } from "./contexte/FournisseurAuth";
import { AuthActionProvider } from "./contexte/ActionAuthModalContext";
import { FournisseurCommunauteVWSNotif } from "./contexte/FournisseurCommunauteVWSNotif.jsx";
import { initMetaPixel, trackPageView } from "./bibliotheque/meta/pixel";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";

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

function MetaPixelRouteListener() {
  const location = useLocation();

  useEffect(() => {
    initMetaPixel();
  }, []);

  useEffect(() => {
    trackPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return null;
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { openAuthModal } = useRequireAuthAction();

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const wantsLogin = sp.get("login") === "1";
    if (!wantsLogin) return;

    // Nettoyer l'URL immédiatement pour éviter la réouverture au refresh.
    sp.delete("login");
    const nextSearch = sp.toString();
    navigate(
      { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" },
      { replace: true }
    );

    // Si déjà connecté, rien à ouvrir.
    if (session?.user?.id) return;
    // Évite un flash si la session est en cours d'init.
    if (loading) return;

    openAuthModal();
  }, [location.pathname, location.search, navigate, openAuthModal, session?.user?.id, loading]);

  // Intro supprimée : on affiche toujours l'app directement.
  return <Outlet />;
}

function LoginRedirect() {
  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  sp.set("login", "1");
  const search = sp.toString();
  return <Navigate to={`/${search ? `?${search}` : ""}`} replace />;
}

const router = createBrowserRouter([
  {
    element: (
      <AuthProvider>
        <AuthActionProvider>
          <FournisseurCommunauteVWSNotif>
            <MetaPixelRouteListener />
            <AppShell />
          </FournisseurCommunauteVWSNotif>
        </AuthActionProvider>
      </AuthProvider>
    ),
    children: [
      { path: "/login", element: <LoginRedirect /> },
      { path: "/logout", element: <RouteDeconnexion /> },
      { path: "/auth/callback", element: <RappelAuth /> },
      { path: "/auth/confirm", element: <ConfirmerEmail /> },
      { path: "/reset-password", element: <ReinitialiserMotDePasse /> },
      {
        element: <DashboardLayout />,
        children: [
          { path: "/", element: <Accueil /> },
          { path: "/lab", element: <Lab /> },
          // Backward compatibility: ancienne route supprimée → retour accueil.
          { path: "/a-savoir", element: <Navigate to="/" replace /> },
          { path: "/mentions-legales", element: <MentionsLegales /> },
          { path: "/dashboard", element: <Navigate to="/" replace /> },
          { path: "/prompt", element: <Navigate to="/viralworks" replace /> },
          { path: "/viralworks", element: <ViralWorks /> },
          { path: "/image", element: <Navigate to="/viralworks" replace /> },
          { path: "/video", element: <Navigate to="/viralworks" replace /> },
          { path: "/studio", element: <Studio /> },
          {
            path: "/profil",
            element: (
              <ProtectedRoute>
                <Profil />
              </ProtectedRoute>
            ),
          },
          {
            path: "/galerie",
            element: (
              <ProtectedRoute>
                <RouteErrorBoundary>
                  <Galerie />
                </RouteErrorBoundary>
              </ProtectedRoute>
            ),
          },
          { path: "/communaute-vws", element: <CommunauteVWS /> },
          { path: "/boutique", element: <Boutique /> },
          {
            path: "/admin",
            element: (
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            ),
          },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
