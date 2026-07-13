import { createBrowserRouter, RouterProvider, Outlet, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef, Component } from "react";
import { redirectToCanonicalOriginIfNeeded } from "@/bibliotheque/appOrigin";
import DashboardLayout from "./dispositions/DispositionTableauDeBord.jsx";
import RappelAuth from "./pages/RappelAuth.jsx";
import ConfirmerEmail from "./pages/ConfirmerEmail.jsx";
import AuthEnAttenteConfirmation from "./pages/AuthEnAttenteConfirmation.jsx";
import Accueil from "./pages/Accueil.jsx";
import Lab from "./pages/Lab.jsx";
import Asavoir from "@/pages/Asavoir";
import RouteDeconnexion from "./pages/RouteDeconnexion.jsx";
import ReinitialiserMotDePasse from "./pages/ReinitialiserMotDePasse.jsx";
import Profil from "./pages/Profil.jsx";
import Galerie from "./pages/Galerie.jsx";
import CommunauteVWS from "./pages/CommunauteVWS.jsx";
import Admin from "./pages/Admin.jsx";
import AdminStats from "./pages/AdminStats.jsx";
import MentionsLegales from "./pages/MentionsLegales.jsx";
import ViralWorks from "./pages/ViralWorks.jsx";
import Studio from "./pages/Studio.jsx";
import ImageStudio from "./pages/ImageStudio.jsx";
import EditVideo from "./pages/EditVideo.jsx";
import GoRedirect from "./pages/GoRedirect.jsx";
import ProtectedRoute from "./composants/auth/RouteProtegee.jsx";
import { AuthProvider, useAuth } from "./contexte/FournisseurAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { AuthActionProvider } from "./contexte/ActionAuthModalContext";
import { BoutiqueModalProvider, useBoutiqueModal } from "./contexte/ContexteModalBoutique";
import { FournisseurCommunauteVWSNotif } from "./contexte/FournisseurCommunauteVWSNotif.jsx";
import { initMetaPixel, trackPageView } from "./bibliotheque/meta/pixel";
import { initPostHog, trackPostHogPageView } from "./bibliotheque/posthog/client";
import BannerInstallPWA from "@/composants/BannerInstallPWA";
import PromoImagesModal from "@/components/PromoImagesModal";
import PromoImagesBanner from "@/components/PromoImagesBanner";
import { requestPwaUpdateCheck } from "@/bibliotheque/pwa/registerPwa";
import { invalidatePremiumAccessCache } from "@/bibliotheque/supabase/premiumAccess";

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

function AnalyticsRouteListener() {
  const location = useLocation();

  useEffect(() => {
    initMetaPixel();
    initPostHog();
  }, []);

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    trackPageView(path);
    trackPostHogPageView(path);
  }, [location.pathname, location.search]);

  return null;
}

function BoutiqueStripeReturnHandler() {
  const location = useLocation();
  const { openBoutiqueModal } = useBoutiqueModal();
  const { session, loading, supabase } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const payment = params.get("payment");
    if (payment !== "success" && payment !== "cancelled") return;
    if (loading || handledRef.current) return;

    handledRef.current = true;

    const finish = async () => {
      await requestPwaUpdateCheck();

      if (payment === "success") {
        invalidatePremiumAccessCache();
      }

      if (!session) {
        const { data: current } = await supabase.auth.getSession();
        if (!current.session) {
          try {
            await supabase.auth.refreshSession();
          } catch {
            // no-op
          }
        }
      }

      const sectionParam = params.get("section");
      const section =
        sectionParam === "packs-videos" ? "packs-videos" : "subscription";

      openBoutiqueModal(section, { paymentReturn: payment });

      params.delete("payment");
      params.delete("section");
      const query = params.toString();
      window.history.replaceState(
        {},
        "",
        `${location.pathname}${query ? `?${query}` : ""}`,
      );

      try {
        localStorage.removeItem("vw_stripe_checkout_at");
      } catch {
        // no-op
      }
    };

    void finish();
  }, [location.pathname, location.search, openBoutiqueModal, session, loading, supabase]);

  return null;
}

function RootRouteLayout() {
  useEffect(() => {
    redirectToCanonicalOriginIfNeeded();
  }, []);

  return (
    <AuthActionProvider>
      <BoutiqueModalProvider>
        <FournisseurCommunauteVWSNotif>
          <AnalyticsRouteListener />
          <BannerInstallPWA />
          <BoutiqueStripeReturnHandler />
          <PromoImagesBanner />
          <PromoImagesModal />
          <Outlet />
        </FournisseurCommunauteVWSNotif>
      </BoutiqueModalProvider>
    </AuthActionProvider>
  );
}

function LoginRedirect() {
  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  sp.set("login", "1");
  const search = sp.toString();
  return <Navigate to={`/${search ? `?${search}` : ""}`} replace />;
}

/** Même logique que AdminStats : isAdmin() sur profiles.role, sinon redirect accueil. */
function AdminOnlyRoute({ children }) {
  const { session, loading: authLoading } = useAuth();
  const { isAdmin: isAdminUser, loading } = useAdminAccess();

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (!loading && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  if (loading && !isAdminUser) {
    return (
      <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      </div>
    );
  }

  return children;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AuthProvider>
        <RootRouteLayout />
      </AuthProvider>
    ),
    children: [
      // Bio tracking — avant dashboard et avant le catch-all *
      { path: "go/:source", element: <GoRedirect /> },
      { path: "login", element: <LoginRedirect /> },
      { path: "logout", element: <RouteDeconnexion /> },
      { path: "auth/callback", element: <RappelAuth /> },
      { path: "auth/confirm", element: <ConfirmerEmail /> },
      { path: "auth/en-attente-confirmation", element: <AuthEnAttenteConfirmation /> },
      { path: "reset-password", element: <ReinitialiserMotDePasse /> },
      {
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Accueil /> },
          { path: "lab", element: <Lab /> },
          { path: "playbook", element: <Asavoir /> },
          { path: "a-savoir", element: <Navigate to="/playbook" replace /> },
          { path: "mentions-legales", element: <MentionsLegales /> },
          { path: "dashboard", element: <Navigate to="/" replace /> },
          { path: "prompt", element: <Navigate to="/viralworks" replace /> },
          { path: "viralworks", element: <ViralWorks /> },
          { path: "image", element: <Navigate to="/viralworks" replace /> },
          { path: "video", element: <Navigate to="/viralworks" replace /> },
          { path: "studio", element: <Studio /> },
          { path: "image-studio", element: <ImageStudio /> },
          { path: "edit-video", element: <EditVideo /> },
          {
            path: "profil",
            element: (
              <ProtectedRoute>
                <Profil />
              </ProtectedRoute>
            ),
          },
          {
            path: "galerie",
            element: (
              <ProtectedRoute>
                <RouteErrorBoundary>
                  <Galerie />
                </RouteErrorBoundary>
              </ProtectedRoute>
            ),
          },
          { path: "communaute-vws", element: <CommunauteVWS /> },
          {
            path: "admin",
            element: (
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            ),
          },
          {
            path: "admin/stats",
            element: (
              <ProtectedRoute>
                <AdminStats />
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
