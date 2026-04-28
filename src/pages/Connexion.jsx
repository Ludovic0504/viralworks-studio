
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/composants/disposition/EnTete";
import SidebarShell from "@/composants/disposition/Navbar";
import AuthFormCard from "@/composants/auth/AuthFormCard";
import { useAuth } from "@/contexte/FournisseurAuth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const { session } = useAuth();

  const next = useMemo(() => {
    const raw = new URLSearchParams(location.search).get("next") || "/";
    return raw.startsWith("/") ? raw : "/";
  }, [location.search]);

  const confirmedBanner = useMemo(
    () => params.get("confirmed") === "1",
    [params]
  );

  const passwordResetSuccess = useMemo(
    () => params.get("password_reset") === "success",
    [params]
  );

  const [initialError, setInitialError] = useState("");
  const errorParam = useMemo(() => params.get("error"), [params]);

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7405/ingest/84f2a250-0990-480e-ba92-160ff926a4b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'770227'},body:JSON.stringify({sessionId:'770227',runId:'run2',hypothesisId:'H9',location:'src/pages/Connexion.jsx:34',message:'login_page_session_guard_check',data:{pathname:location.pathname,next,hasSession:Boolean(session?.user?.id)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (session?.user?.id && next !== location.pathname) {
      navigate(next, { replace: true });
    }
  }, [session?.user?.id, next, navigate, location.pathname]);

  useEffect(() => {
    if (errorParam === "session_missing") {
      setInitialError("");
      const sp = new URLSearchParams(location.search);
      sp.delete("error");
      const search = sp.toString();
      navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
      return;
    }

    if (errorParam) {
      switch (errorParam) {
        case "callback":
          setInitialError("Erreur lors de la validation de la connexion. Veuillez réessayer.");
          break;
        case "config":
          setInitialError("Configuration Supabase manquante. Veuillez contacter l'administrateur.");
          break;
        case "exchange":
          setInitialError("Erreur lors de l'échange du code d'authentification. Veuillez réessayer.");
          break;
        default:
          setInitialError("Une erreur est survenue lors de la connexion.");
      }
    }
  }, [confirmedBanner, passwordResetSuccess, errorParam, location.pathname, location.search, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Header onOpenMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />
      <SidebarShell open={menuOpen} onCloseMenu={() => setMenuOpen(false)}>
        <div className="min-h-screen pt-16">
          {useMemo(() => {
            return Array.from({ length: 20 }, (_, i) => {
              const colors = ['rgba(65, 209, 255, 0.4)', 'rgba(189, 52, 254, 0.4)', 'rgba(255, 234, 131, 0.4)'];
              const color = colors[i % 3];
              const left = (i * 17.3) % 95;
              const top = (i * 23.7) % 90;
              const duration = 6 + (i % 4) * 1.5;
              const delay = (i * 0.15) % 3;
              return { i, color, left, top, duration, delay };
            });
          }, []).map(({ i, color, left, top, duration, delay }) => (
            <div
              key={`particle-${i}`}
              className="absolute w-1 h-1 rounded-full"
              style={{
                background: color,
                left: `${left}%`,
                top: `${top}%`,
                animation: `float ${duration}s ease-in-out infinite`,
                animationDelay: `${delay}s`,
                boxShadow: `0 0 6px ${color}`,
                opacity: 0.6
              }}
            />
          ))}

          <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-24">
            <AuthFormCard
              next={next}
              showConfirmedBanner={confirmedBanner}
              showPasswordResetSuccess={passwordResetSuccess}
              initialError={initialError}
            />
          </div>
        </div>
      </SidebarShell>
    </div>
  );
}
