
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getBrowserSupabase, getRedirectTo } from "@/bibliotheque/supabase/client-navigateur";
import { Eye, EyeOff, Mail, Lock, LogIn, UserPlus } from "lucide-react";
import Header from "@/composants/disposition/EnTete";
import SidebarShell from "@/composants/disposition/Navbar";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);

  const next = useMemo(() => {
    const raw = new URLSearchParams(location.search).get("next") || "/";
    return raw.startsWith("/") ? raw : "/";
  }, [location.search]);

  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [infoMsg, setInfoMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(false);

  const redirectTo = useMemo(() => getRedirectTo(), []);

  const confirmedBanner = useMemo(
    () => (params.get("confirmed") === "1" ? "Adresse confirmée ✅ Vous pouvez vous connecter." : null),
    [params]
  );

  const passwordResetSuccess = useMemo(
    () => params.get("password_reset") === "success",
    [params]
  );

  const errorParam = useMemo(() => params.get("error"), [params]);

  useEffect(() => {
    if (confirmedBanner) setInfoMsg(confirmedBanner);
    if (passwordResetSuccess) setInfoMsg("Mot de passe réinitialisé avec succès ✅ Vous pouvez maintenant vous connecter.");

    if (errorParam === "session_missing") {
      setErrorMsg("");
      const sp = new URLSearchParams(location.search);
      sp.delete("error");
      const search = sp.toString();
      navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
      return;
    }

    if (errorParam) {
      switch (errorParam) {
        case "callback":
          setErrorMsg("Erreur lors de la validation de la connexion. Veuillez réessayer.");
          break;
        case "config":
          setErrorMsg("Configuration Supabase manquante. Veuillez contacter l'administrateur.");
          break;
        case "exchange":
          setErrorMsg("Erreur lors de l'échange du code d'authentification. Veuillez réessayer.");
          break;
        default:
          setErrorMsg("Une erreur est survenue lors de la connexion.");
      }
    }
  }, [confirmedBanner, passwordResetSuccess, errorParam, location.pathname, location.search, navigate]);

  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMsg("Veuillez entrer votre email pour réinitialiser le mot de passe.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setInfoMsg(null);

    try {
      const supabase = getBrowserSupabase({ remember });
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setInfoMsg("Un email de réinitialisation a été envoyé. Vérifiez votre boîte mail.");
      setLoading(false);
    } catch (err) {
      setErrorMsg(err?.message || "Erreur lors de l'envoi de l'email de réinitialisation.");
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setErrorMsg("");
    setOauthLoading(true);
    try {
      localStorage.setItem("onetool_oauth_remember", remember ? "1" : "0");
      localStorage.setItem("onetool_oauth_next", next);
    } catch (err) {
      console.warn("Impossible de mémoriser les préférences OAuth:", err);
    }

    try {
      const supabase = getBrowserSupabase({ remember });
      
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!url || !key || url === 'https://placeholder.supabase.co' || key === 'placeholder-key') {
        setErrorMsg('Configuration Supabase manquante. Veuillez contacter l\'administrateur.');
        return;
      }
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (error) setErrorMsg(error.message);
    } catch (err) {
      setErrorMsg(err?.message || 'Erreur lors de la connexion avec Google');
    } finally {
      setOauthLoading(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setInfoMsg(null);

    if (!email || !email.includes('@')) {
      setErrorMsg("Veuillez entrer une adresse email valide.");
      setLoading(false);
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg("Le mot de passe doit contenir au moins 6 caractères.");
      setLoading(false);
      return;
    }

    try {
      const supabase = getBrowserSupabase({ remember });
      
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!url || !key || url === 'https://placeholder.supabase.co' || key === 'placeholder-key') {
        setErrorMsg('Configuration Supabase manquante. Veuillez contacter l\'administrateur.');
        setLoading(false);
        return;
      }

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          if (error.message?.toLowerCase().includes("email not confirmed")) {
            setErrorMsg("Ton email n'est pas confirmé. Clique sur le lien reçu lors de l'inscription.");
          } else if (error.message?.toLowerCase().includes("invalid login") || error.message?.toLowerCase().includes("invalid credentials")) {
            setErrorMsg("Email ou mot de passe incorrect. Si vous êtes admin, utilisez 'Mot de passe oublié' pour réinitialiser votre mot de passe.");
          } else {
            setErrorMsg(error.message);
          }
          setLoading(false);
          return;
        }

        let hasSession = false;
        for (let i = 0; i < 6; i += 1) {
          const { data: retryData } = await supabase.auth.getSession();
          if (retryData?.session) {
            hasSession = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }

        if (!hasSession) {
          setErrorMsg("Connexion refusée: session non créée côté navigateur. Réessaie après avoir rafraîchi la page.");
          setLoading(false);
          return;
        }

        console.log("✅ [SignIn] Session créée avec succès, redirection...");
        navigate(next, { replace: true });
      } else {
        let signUpResult = null;
        let signUpError = null;
        
        try {
          const redirectUrl = redirectTo;
          console.log("🔵 [SignUp] Tentative d'inscription avec redirectTo:", redirectUrl);
          console.log("🔵 [SignUp] Email:", email.trim().toLowerCase());
          console.log("🔵 [SignUp] Password length:", password.length);
          
          signUpResult = await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password: password,
            options: { emailRedirectTo: redirectUrl },
          });
          
          console.log("🔵 [SignUp] Résultat signUp:", {
            user: signUpResult.data?.user ? "✅ Utilisateur créé" : "❌ Pas d'utilisateur",
            session: signUpResult.data?.session ? "✅ Session créée" : "❌ Pas de session",
            error: signUpResult.error ? "❌ Erreur" : "✅ Pas d'erreur",
            userEmail: signUpResult.data?.user?.email,
            userConfirmed: signUpResult.data?.user?.email_confirmed_at ? "✅ Confirmé" : "❌ Non confirmé"
          });
          
          signUpError = signUpResult.error;
          
          if (signUpError && signUpError.status === 400 && signUpError.message?.includes("redirect")) {
            console.warn("⚠️ [SignUp] redirectTo refusé par Supabase (URL non autorisée).");
            setErrorMsg(
              `Configuration d'authentification incomplète: l'URL de redirection email n'est pas autorisée dans Supabase. Ajoute ${getRedirectTo()} dans Authentication > URL Configuration.`
            );
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error("❌ [SignUp] Erreur lors de l'inscription:", err);
          signUpError = { message: err.message || "Erreur inconnue", status: 500 };
        }

        if (signUpError) {
          let errorMessage = signUpError.message;
          
          if (signUpError.message?.includes("User already registered") || signUpError.message?.includes("already registered")) {
            errorMessage = "Cet email est déjà utilisé. Essayez de vous connecter ou utilisez 'Mot de passe oublié'.";
          } else if (signUpError.message?.includes("Password") || signUpError.message?.includes("password")) {
            errorMessage = "Le mot de passe ne respecte pas les critères requis (minimum 6 caractères).";
          } else if (signUpError.message?.includes("Email") || signUpError.message?.includes("email")) {
            errorMessage = "Format d'email invalide.";
          } else if (signUpError.status === 400) {
            errorMessage = `Erreur de validation : ${signUpError.message || "Vérifiez que votre email est valide et que le mot de passe contient au moins 6 caractères."}`;
          }
          
          console.error("❌ [SignUp] Erreur inscription Supabase:", {
            message: signUpError.message,
            status: signUpError.status,
            name: signUpError.name,
            fullError: signUpError
          });
          
          setErrorMsg(errorMessage);
          setLoading(false);
          return;
        }

        const { data } = signUpResult;

        console.log("✅ [SignUp] Données retournées:", {
          hasUser: !!data?.user,
          hasSession: !!data?.session,
          userEmail: data?.user?.email,
          userConfirmed: !!data?.user?.email_confirmed_at
        });

        if (data?.user && data?.session) {
          console.log("✅ [SignUp] Compte créé et connecté directement (confirmations désactivées)");
          await new Promise(resolve => setTimeout(resolve, 100));
          navigate(next, { replace: true });
        } 
        else if (data?.user && !data?.session) {
          console.log("📧 [SignUp] Compte créé, email de confirmation requis");
          setInfoMsg("Compte créé ! Vérifie ta boîte mail (et tes spams) et clique sur le lien de confirmation. Si tu ne reçois pas l'email, vérifie la console du navigateur pour plus de détails.");
        }
        else {
          console.warn("⚠️ [SignUp] Cas inattendu - pas d'utilisateur ni d'erreur");
          setErrorMsg("Une erreur est survenue lors de la création du compte. Vérifiez votre email ou essayez de vous connecter. Consultez la console du navigateur pour plus de détails.");
        }
      }
    } catch (err) {
      console.error("Erreur inattendue lors de l'inscription:", err);
      setErrorMsg(err?.message || "Erreur inconnue. Vérifiez votre connexion internet et réessayez.");
    } finally {
      setLoading(false);
    }
  };

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
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black mb-2">
                <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-yellow-300 bg-clip-text text-transparent">
                  {mode === "signin" ? "Connexion" : "Créer un compte"}
                </span>
        </h1>
            <p className="text-sm text-gray-400">
              {mode === "signin" 
                ? "Accède à toutes les fonctionnalités" 
                : "Rejoins ViralWorks Studio et commence à créer"}
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
              {infoMsg}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
          <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  Email
                </label>
            <input
              id="email"
              type="email"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  placeholder="ton@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-400" />
              {mode === "signin" ? "Mot de passe" : "Choisis un mot de passe"}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPwd ? "text" : "password"}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
              >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-gray-400 cursor-not-allowed opacity-80">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500/50"
            />
                  <span>Session sécurisée active</span>
          </label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={loading}
                    className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors underline disabled:opacity-50"
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </div>

          <button
            type="submit"
            disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-400 text-white font-semibold py-3 hover:from-emerald-400 hover:to-emerald-300 transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Connexion...</span>
                  </>
                ) : (
                  <>
                    {mode === "signin" ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    <span>{mode === "signin" ? "Se connecter" : "Créer le compte"}</span>
                  </>
                )}
          </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-500">ou</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={oauthLoading}
            className="w-full rounded-lg bg-white/5 border border-white/10 text-white font-medium py-3 hover:bg-white/10 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {oauthLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Connexion Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continuer avec Google</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setErrorMsg("");
                setInfoMsg(null);
              }}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors underline"
            >
              {mode === "signin" ? "Créer un compte" : "Se connecter"}
            </button>
          </div>

          <p className="mt-6 text-xs text-gray-500 text-center leading-relaxed">
            Tes données sont protégées — aucune utilisation commerciale
          </p>
        </div>
          </div>
        </div>
      </SidebarShell>
    </div>
  );
}
