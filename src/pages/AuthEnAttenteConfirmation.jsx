import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MailCheck, RefreshCw } from "lucide-react";
import FondApp from "@/composants/disposition/FondApp";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import TurnstileWidget, { isTurnstileEnabled } from "@/composants/auth/TurnstileWidget.jsx";

export default function AuthEnAttenteConfirmation() {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [captchaToken, setCaptchaToken] = useState("");
  const [resendStatus, setResendStatus] = useState("idle");
  const [resendError, setResendError] = useState("");

  const needsCaptcha = useMemo(() => isTurnstileEnabled(), []);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setResendError("Entre une adresse email valide.");
      return;
    }
    if (needsCaptcha && !captchaToken) {
      setResendError("Complète la vérification anti-bot avant de renvoyer l'email.");
      return;
    }

    setResendStatus("sending");
    setResendError("");

    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: captchaToken ? { captchaToken } : undefined,
      });
      if (error) {
        setResendStatus("error");
        setResendError(error.message || "Impossible de renvoyer l'email.");
        return;
      }
      setResendStatus("sent");
    } catch (err) {
      setResendStatus("error");
      setResendError(err?.message || "Impossible de renvoyer l'email.");
    }
  };

  return (
    <FondApp>
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c1424]/90 p-6 shadow-xl backdrop-blur-md">
          <div className="mb-4 flex items-center gap-3 text-emerald-300">
            <MailCheck className="h-8 w-8 shrink-0" />
            <h1 className="text-xl font-semibold text-white">Confirme ton email</h1>
          </div>
          <p className="text-sm leading-relaxed text-gray-300">
            Ton compte est créé, mais tu dois confirmer ton adresse email avant d&apos;accéder à
            ViralWorks Studio. Ouvre le lien reçu par email, puis reconnecte-toi.
          </p>

          <form onSubmit={handleResend} className="mt-6 space-y-3">
            <label className="block text-xs text-gray-400" htmlFor="pending-email">
              Renvoyer l&apos;email de confirmation
            </label>
            <input
              id="pending-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="ton@email.com"
              autoComplete="email"
            />
            <TurnstileWidget
              onToken={setCaptchaToken}
              onExpire={() => setCaptchaToken("")}
              onError={() => setCaptchaToken("")}
            />
            <button
              type="submit"
              disabled={resendStatus === "sending" || resendStatus === "sent"}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendStatus === "sending" ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Envoi…
                </>
              ) : resendStatus === "sent" ? (
                "Email renvoyé"
              ) : (
                "Renvoyer l'email"
              )}
            </button>
            {resendError ? <p className="text-xs text-red-300">{resendError}</p> : null}
            {resendStatus === "sent" ? (
              <p className="text-xs text-emerald-300">Vérifie ta boîte mail (et les spams).</p>
            ) : null}
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            <Link to="/?login=1" className="text-emerald-400 hover:text-emerald-300">
              Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </FondApp>
  );
}
