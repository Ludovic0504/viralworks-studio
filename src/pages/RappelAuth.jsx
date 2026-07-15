
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import { syncSignupProfileNamesFromMetadata } from "@/bibliotheque/supabase/profil";
import FondApp from "@/composants/disposition/FondApp";
import { useT } from "@/contexte/FournisseurLocale";

export default function AuthCallback() {
  const navigate = useNavigate();
  const t = useT();

  useEffect(() => {
    (async () => {
      const url = window.location.href;
      console.log("[AuthCallback] start, url =", url);


      let remember = false;
      try {
        remember = localStorage.getItem("onetool_oauth_remember") === "1";
      } catch (e) {
        console.warn("[AuthCallback] cannot read remember flag:", e);
      }

      const urlEnv = import.meta.env.VITE_SUPABASE_URL;
      const keyEnv = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!urlEnv || !keyEnv || urlEnv === 'https://placeholder.supabase.co' || keyEnv === 'placeholder-key') {
        console.error("[AuthCallback] Configuration Supabase manquante");
        navigate("/?login=1&error=config", { replace: true });
        return;
      }

      const supabase = getBrowserSupabase({ remember });

      try {
        const urlObj = new URL(url);
        const hasCode = urlObj.searchParams.has('code');
        const hasHash = urlObj.hash && (urlObj.hash.includes('access_token') || urlObj.hash.includes('type='));

        let sessionData = null;
        let error = null;

        if (hasCode) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(url);
          console.log("[AuthCallback] OAuth exchange result:", { data, error: exchangeError });
          sessionData = data;
          error = exchangeError;
        } else if (hasHash) {
          const urlObj = new URL(url);
          const hashParams = new URLSearchParams(urlObj.hash.substring(1));
          const isPasswordReset = hashParams.get('type') === 'recovery';
          
          if (isPasswordReset) {
            console.log("[AuthCallback] Password reset detected, redirecting to /reset-password");
            navigate("/reset-password" + urlObj.hash, { replace: true });
            return;
          }
          
          const { data, error: sessionError } = await supabase.auth.getSession();
          console.log("[AuthCallback] Hash-based session result:", { data, error: sessionError });
          
          if (!data?.session) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const { data: retryData, error: retryError } = await supabase.auth.getSession();
            sessionData = retryData;
            error = retryError;
          } else {
            sessionData = data;
            error = sessionError;
          }
        } else {
          const { data, error: sessionError } = await supabase.auth.getSession();
          sessionData = data;
          error = sessionError;
        }
        
        if (error) {
          console.error("[AuthCallback] error:", error);
          navigate("/?login=1&error=exchange", { replace: true });
          return;
        }

        const hasSession = !!(sessionData?.session);

        if (!hasSession) {
          console.error("[AuthCallback] no session after processing, redirecting to /login");
          navigate("/?login=1&error=callback", { replace: true });
          return;
        }


        let next = "/";
        try {
          const savedNext = localStorage.getItem("onetool_oauth_next");
          if (savedNext && savedNext.startsWith("/")) {
            next = savedNext;
          }
        } catch (e) {
          console.warn("[AuthCallback] cannot read next from storage:", e);
        }

        console.log("[AuthCallback] success, redirecting to", next);
        void syncSignupProfileNamesFromMetadata();
        navigate(next, { replace: true });
      } catch (err) {
        console.error("[AuthCallback] unexpected error:", err);
        navigate("/?login=1&error=callback", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#07090f] text-white">
      <FondApp fixed />
      {t("authCallback.validating")}
    </div>
  );
}
