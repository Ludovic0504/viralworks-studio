import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, MailCheck, ShieldCheck, XCircle, RefreshCw } from "lucide-react";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import { track } from "@/bibliotheque/meta/pixel";
import FondApp from "@/composants/disposition/FondApp";
import { useT } from "@/contexte/FournisseurLocale";

/**
 * Page de confirmation d'email basée sur le flux `verifyOtp` Supabase.
 *
 * Pourquoi un bouton explicite plutôt qu'un appel automatique au montage :
 * - Beaucoup de filtres anti-phishing (SFR/Neuf, Orange, Outlook Safe Links, antivirus
 *   d'entreprise) font une requête HTTP GET sur les liens des emails entrants pour
 *   vérifier qu'ils ne sont pas malveillants. Si on consomme le token au montage,
 *   ces scanners brûlent le token avant que l'humain ne clique → l'utilisateur ne
 *   peut jamais confirmer son compte. L'interaction explicite (clic) verrouille ce cas.
 */
export default function ConfirmerEmail() {
  const t = useT();
  const navigate = useNavigate();

  const { tokenHash, type } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      tokenHash: params.get("token_hash") || "",
      type: params.get("type") || "signup",
    };
  }, []);

  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState("idle");
  const [resendError, setResendError] = useState("");

  useEffect(() => {
    if (!tokenHash) {
      setStatus("error");
      setErrorMsg(t("auth.invalidConfirmLink"));
    }
  }, [tokenHash, t]);

  const handleConfirm = async () => {
    if (!tokenHash || status === "verifying") return;
    setStatus("verifying");
    setErrorMsg("");

    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (error) {
        setStatus("error");
        const raw = (error.message || "").toLowerCase();
        if (raw.includes("expired") || raw.includes("invalid") || raw.includes("not found")) {
          setErrorMsg(t("auth.confirmLinkExpired"));
        } else {
          setErrorMsg(error.message || t("auth.confirmError"));
        }
        return;
      }

      setStatus("success");
      track("CompleteRegistration");
      setTimeout(() => {
        navigate("/login?confirmed=1", { replace: true });
      }, 1500);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err?.message || t("auth.unexpectedError"));
    }
  };

  const handleResend = async (e) => {
    e?.preventDefault?.();
    if (!resendEmail || !resendEmail.includes("@")) {
      setResendError(t("auth.invalidEmail"));
      return;
    }
    setResendStatus("sending");
    setResendError("");
    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: resendEmail.trim().toLowerCase(),
      });
      if (error) {
        setResendStatus("error");
        setResendError(error.message || t("auth.resendFailed"));
        return;
      }
      setResendStatus("sent");
    } catch (err) {
      setResendStatus("error");
      setResendError(err?.message || t("auth.resendFailed"));
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#07090f] px-4 py-12">
      <FondApp fixed />
      <div className="relative z-[1] w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black mb-2">
            <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-yellow-300 bg-clip-text text-transparent">
              {t("auth.confirmEmail")}
            </span>
          </h1>
          <p className="text-sm text-gray-400">
            Dernière étape pour activer ton compte ViralWorks Studio
          </p>
        </div>

        {status === "idle" && tokenHash ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center space-y-5">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-emerald-300" />
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Pour des raisons de sécurité, clique sur le bouton ci-dessous pour finaliser
              la confirmation de ton adresse.
            </p>
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full rounded-lg font-semibold py-3 transition-all duration-300 flex items-center justify-center gap-2 btn-vws-primary"
            >
              <MailCheck className="w-4 h-4" />
              <span>{t("auth.confirmAccount")}</span>
            </button>
            <p className="text-xs text-gray-500">
              Ce clic n'est demandé qu'une seule fois.
            </p>
          </div>
        ) : null}

        {status === "verifying" ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin" />
            </div>
            <p className="text-sm text-gray-300">{t("auth.confirming")}</p>
          </div>
        ) : null}

        {status === "success" ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-300" />
            </div>
            <p className="text-emerald-200 font-semibold">{t("auth.emailConfirmed")}</p>
            <p className="text-sm text-emerald-200/80">
              Tu vas être redirigé vers la page de connexion…
            </p>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center space-y-3">
              <div className="mx-auto w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                <XCircle className="w-7 h-7 text-red-300" />
              </div>
              <p className="text-red-200 font-semibold">{t("auth.confirmFailed")}</p>
              <p className="text-sm text-red-200/80 whitespace-pre-wrap">{errorMsg}</p>
            </div>

            <form
              onSubmit={handleResend}
              className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3"
            >
              <p className="text-sm text-gray-300 font-medium">
                Recevoir un nouveau lien de confirmation
              </p>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="ton@email.com"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                required
                aria-label={t("auth.email")}
              />
              <button
                type="submit"
                disabled={resendStatus === "sending" || resendStatus === "sent"}
                className="w-full rounded-lg font-semibold py-3 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 btn-vws-primary"
              >
                {resendStatus === "sending" ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{t("auth.sending")}</span>
                  </>
                ) : resendStatus === "sent" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t("auth.emailSent")}</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>{t("auth.resendEmail")}</span>
                  </>
                )}
              </button>
              {resendStatus === "sent" ? (
                <p className="text-xs text-emerald-300/90">
                  Vérifie ta boîte mail (et tes spams). Le nouveau lien remplacera
                  l'ancien.
                </p>
              ) : null}
              {resendStatus === "error" && resendError ? (
                <p className="text-xs text-red-300">{resendError}</p>
              ) : null}
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors underline"
              >
                Retour à la connexion
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
