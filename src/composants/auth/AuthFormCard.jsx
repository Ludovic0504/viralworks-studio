import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, LogIn, Mail, User, UserPlus } from "lucide-react";
import {
  getBrowserSupabase,
  getRedirectTo,
  getSupabaseDashboardAuthUrls,
} from "@/bibliotheque/supabase/client-navigateur";
import { syncSignupProfileNamesFromMetadata, updateUserProfile } from "@/bibliotheque/supabase/profil";
import { validateDisplayNamesRemote, isBlockedDisplayNameError, BLOCKED_DISPLAY_NAME_MESSAGE, inferBlockedNameFieldFromMessage, blockedDisplayNameMessage } from "@/bibliotheque/moderation/displayName";
import { validateSignupFieldsClient } from "@/bibliotheque/moderation/signupGuard";
import { isAccountEmailVerified } from "@/bibliotheque/auth/emailVerified";
import { signInWithEmailPassword } from "@/bibliotheque/supabase/authSession";
import TurnstileWidget, { isTurnstileEnabled } from "@/composants/auth/TurnstileWidget.jsx";
import { track } from "@/bibliotheque/meta/pixel";
import { capturePostHog, trackPostHogError } from "@/bibliotheque/posthog/client";

/**
 * Erreurs côté projet Supabase (SMTP, restriction SMTP intégré, redirect URL).
 * @returns {{ showDashboardHelp: boolean, message: string }}
 */
function analyzeRecoveryEmailError(error) {
  const raw = (error?.message || "").toLowerCase();
  const notAuthorized =
    raw.includes("email address not authorized") ||
    raw.includes("address not authorized") ||
    (raw.includes("not authorized") && raw.includes("email"));
  const likelyServerEmailFailure =
    notAuthorized ||
    raw.includes("error sending recovery email") ||
    Number(error?.status) === 500;

  if (!likelyServerEmailFailure) {
    return {
      showDashboardHelp: false,
      message: error?.message || "Erreur lors de l'envoi de l'email de réinitialisation.",
    };
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const callbackHint = origin ? `${origin}/auth/callback` : "/auth/callback";

  if (notAuthorized) {
    return {
      showDashboardHelp: true,
      message:
        "Cette adresse ne peut pas recevoir d'email avec le SMTP par défaut Supabase : seuls les comptes de l'équipe de l'organisation du projet sont autorisés. " +
        "Invite cet email dans l'organisation (lien « Équipe » ci-dessous) ou configure un SMTP personnalisé. " +
        `Redirect URL locale à autoriser : ${callbackHint}`,
    };
  }

  return {
    showDashboardHelp: true,
    message:
      "Supabase n'a pas pu envoyer l'email (erreur serveur : SMTP personnalisé incorrect, quota, fournisseur qui rejette, ou CAPTCHA requis). " +
      "Vérifie hôte, port, TLS et identifiants SMTP. Sans SMTP perso, seuls les emails des membres de l'équipe org reçoivent des messages. " +
      "Si Attack Protection / CAPTCHA est activé pour les emails, désactive-le pour tester ou intègre un jeton captcha (voir lien doc CAPTCHA). " +
      `Redirect URL à ajouter si besoin : ${callbackHint}`,
  };
}

/**
 * Erreurs d'envoi d'email de confirmation (signup / resend).
 * @returns {{ showDashboardHelp: boolean, message: string }}
 */
function analyzeConfirmationEmailError(error) {
  const raw = (error?.message || "").toLowerCase();
  const hookAuthFailure =
    raw.includes("hook requires authorization token") ||
    raw.includes("invalid payload sent to hook") ||
    raw.includes("invalid hook signature") ||
    (Number(error?.status) === 500 &&
      error?.code === "unexpected_failure" &&
      !raw.includes("error sending confirmation email") &&
      !raw.includes("error sending email"));

  if (hookAuthFailure) {
    return {
      showDashboardHelp: true,
      message:
        "Impossible de finaliser l'inscription : le hook Auth « before-user-created » n'a pas pu s'authentifier. " +
        "Dans Supabase → Authentication → Hooks, copie le secret du hook et définis-le comme secret Edge Function " +
        "BEFORE_USER_CREATED_HOOK_SECRET (ou AUTH_HOOK_SECRET), puis redéploie auth-before-user-created. " +
        "Le secret doit commencer par v1,whsec_ et correspondre exactement à celui du dashboard.",
    };
  }

  const notAuthorized =
    raw.includes("email address not authorized") ||
    raw.includes("address not authorized") ||
    (raw.includes("not authorized") && raw.includes("email"));

  const redirectNotAllowed =
    raw.includes("redirect url") ||
    raw.includes("redirect_to") ||
    raw.includes("not allowed") ||
    raw.includes("unauthorized") ||
    raw.includes("invalid redirect");

  const likelyServerEmailFailure =
    notAuthorized ||
    raw.includes("error sending confirmation email") ||
    raw.includes("error sending email") ||
    Number(error?.status) === 500;

  if (!likelyServerEmailFailure && !redirectNotAllowed) {
    return {
      showDashboardHelp: false,
      message: error?.message || "Erreur lors de l'envoi de l'email de confirmation.",
    };
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const callbackHint = origin ? `${origin}/auth/callback` : "/auth/callback";

  if (redirectNotAllowed) {
    return {
      showDashboardHelp: true,
      message:
        "Supabase refuse l'URL de redirection utilisée pour la confirmation. " +
        "Ajoute l'URL ci-dessous dans Auth → URL Configuration → Redirect URLs. " +
        `URL attendue : ${callbackHint}`,
    };
  }

  if (notAuthorized) {
    return {
      showDashboardHelp: true,
      message:
        "Cette adresse ne peut pas recevoir l'email de confirmation avec le SMTP intégré Supabase : seuls les comptes de l'équipe de l'organisation du projet sont autorisés. " +
        "Invite cet email dans l'organisation (lien « Équipe » ci-dessous) ou configure un SMTP personnalisé. " +
        `Redirect URL à autoriser : ${callbackHint}`,
    };
  }

  return {
    showDashboardHelp: true,
    message:
      "Supabase n'a pas pu envoyer l'email de confirmation (erreur serveur : SMTP personnalisé incorrect, quota, fournisseur qui rejette, ou CAPTCHA requis). " +
      "Vérifie hôte, port, TLS et identifiants SMTP. Sans SMTP perso, seuls les emails des membres de l'équipe org reçoivent des messages. " +
      "Si Attack Protection / CAPTCHA est activé pour les emails, désactive-le pour tester ou intègre un jeton captcha (voir lien doc CAPTCHA). " +
      `Redirect URL à ajouter si besoin : ${callbackHint}`,
  };
}

export default function AuthFormCard({
  next = "/",
  initialMode = "signin",
  onAuthSuccess,
  showConfirmedBanner = false,
  showPasswordResetSuccess = false,
  initialError = "",
  /** Évite le chevauchement avec un bouton fermer en haut à droite (ex. modal). */
  reserveHeaderSpaceForCloseButton = false,
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState(initialMode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [infoMsg, setInfoMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(initialError || "");
  /** Erreur inline prénom/nom (liste noire) — message + champ(s) concernés. */
  const [nameFieldError, setNameFieldError] = useState(null);
  /** Liens dashboard affichés seulement après échec « mot de passe oublié » côté Supabase. */
  const [recoveryDashboardUrls, setRecoveryDashboardUrls] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  const remember = false;
  /** Email du dernier signup en attente de confirmation (active le bouton « renvoyer »). */
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState("");
  const [resendStatus, setResendStatus] = useState("idle");
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileEnabled = useMemo(() => isTurnstileEnabled(), []);
  const needsSignupCaptcha = turnstileEnabled && mode === "signup";
  const redirectTo = useMemo(() => getRedirectTo(), []);

  const resetCaptcha = () => setCaptchaToken("");

  const requireSignupCaptchaOrError = () => {
    if (!needsSignupCaptcha) return true;
    if (captchaToken) return true;
    reportAuthError("Complète la vérification anti-bot avant de continuer.", "validation");
    return false;
  };

  useEffect(() => {
    if (showConfirmedBanner) {
      setInfoMsg("Adresse confirmée ✅ Vous pouvez vous connecter.");
    } else if (showPasswordResetSuccess) {
      setInfoMsg("Mot de passe réinitialisé avec succès ✅ Vous pouvez maintenant vous connecter.");
    }
  }, [showConfirmedBanner, showPasswordResetSuccess]);

  const handleSuccess = (payload) => {
    if (typeof onAuthSuccess === "function") {
      onAuthSuccess(payload);
      return;
    }
    navigate(next, { replace: true });
  };

  const reportAuthError = (message, hint) => {
    setErrorMsg(message);
    trackPostHogError(message, "/auth", hint);
  };

  const reportNameFieldError = (message = BLOCKED_DISPLAY_NAME_MESSAGE, field = "both") => {
    setNameFieldError({ message, field });
    setErrorMsg("");
    trackPostHogError(message, "/auth", "validation_name");
  };

  const clearNameFieldError = () => {
    if (nameFieldError) setNameFieldError(null);
  };

  const firstNameHasError =
    nameFieldError?.field === "firstName" || nameFieldError?.field === "both";
  const lastNameHasError =
    nameFieldError?.field === "lastName" || nameFieldError?.field === "both";

  const nameInputClassName = (hasError) =>
    hasError
      ? "w-full bg-white/5 border border-red-500 rounded-lg px-4 py-2.5 sm:py-3 text-red-300 placeholder-red-400/60 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
      : "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 sm:py-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all";

  const handleResendConfirmation = async () => {
    if (!pendingConfirmEmail || resendStatus === "sending") return;
    if (!requireSignupCaptchaOrError()) return;
    setResendStatus("sending");
    setRecoveryDashboardUrls(null);
    try {
      const supabase = getBrowserSupabase({ remember });
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingConfirmEmail,
        options: captchaToken ? { captchaToken } : undefined,
      });
      if (error) {
        const a = analyzeConfirmationEmailError(error);
        setResendStatus("error");
        setErrorMsg(a.message);
        setRecoveryDashboardUrls(a.showDashboardHelp ? getSupabaseDashboardAuthUrls() : null);
        return;
      }
      setResendStatus("sent");
    } catch (err) {
      const a = analyzeConfirmationEmailError(err);
      setResendStatus("error");
      setErrorMsg(a.message);
      setRecoveryDashboardUrls(a.showDashboardHelp ? getSupabaseDashboardAuthUrls() : null);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMsg("Veuillez entrer votre email pour réinitialiser le mot de passe.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setInfoMsg(null);
    setRecoveryDashboardUrls(null);

    try {
      const supabase = getBrowserSupabase({ remember });
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        const a = analyzeRecoveryEmailError(error);
        setErrorMsg(a.message);
        setRecoveryDashboardUrls(a.showDashboardHelp ? getSupabaseDashboardAuthUrls() : null);
        setLoading(false);
        return;
      }

      setRecoveryDashboardUrls(null);
      setInfoMsg("Un email de réinitialisation a été envoyé. Vérifiez votre boîte mail.");
    } catch (err) {
      const a = analyzeRecoveryEmailError(err);
      setErrorMsg(a.message);
      setRecoveryDashboardUrls(a.showDashboardHelp ? getSupabaseDashboardAuthUrls() : null);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setErrorMsg("");
    setRecoveryDashboardUrls(null);
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

      if (!url || !key || url === "https://placeholder.supabase.co" || key === "placeholder-key") {
        setErrorMsg("Configuration Supabase manquante. Veuillez contacter l'administrateur.");
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (error) reportAuthError(error.message, "auth");
    } catch (err) {
      reportAuthError(
        err?.message || "Erreur lors de la connexion avec Google",
        "auth"
      );
    } finally {
      setOauthLoading(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setNameFieldError(null);
    setInfoMsg(null);
    setRecoveryDashboardUrls(null);

    if (mode === "signup" && !requireSignupCaptchaOrError()) {
      setLoading(false);
      return;
    }

    if (!email || !email.includes("@")) {
      reportAuthError("Veuillez entrer une adresse email valide.", "validation");
      setLoading(false);
      return;
    }

    if (!password || password.length < 6) {
      reportAuthError("Le mot de passe doit contenir au moins 6 caractères.", "validation");
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      if (!firstName.trim()) {
        reportAuthError("Veuillez entrer votre prénom.", "validation");
        setLoading(false);
        return;
      }
      if (!lastName.trim()) {
        reportAuthError("Veuillez entrer votre nom.", "validation");
        setLoading(false);
        return;
      }
    }

    try {
      const supabase = getBrowserSupabase({ remember });
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!url || !key || url === "https://placeholder.supabase.co" || key === "placeholder-key") {
        reportAuthError(
          "Configuration Supabase manquante. Veuillez contacter l'administrateur.",
          "auth"
        );
        setLoading(false);
        return;
      }

      if (mode === "signin") {
        const result = await signInWithEmailPassword({
          email,
          password,
          remember,
        });

        if (!result.success) {
          const message = result.error || "Erreur lors de la connexion";
          if (message.toLowerCase().includes("email not confirmed")) {
            reportAuthError(
              "Ton email n'est pas confirmé. Clique sur le lien reçu lors de l'inscription.",
              "auth"
            );
          } else if (
            message.toLowerCase().includes("invalid login") ||
            message.toLowerCase().includes("invalid credentials")
          ) {
            reportAuthError(
              "Email ou mot de passe incorrect. Si vous êtes admin, utilisez 'Mot de passe oublié' pour réinitialiser votre mot de passe.",
              "auth"
            );
          } else {
            reportAuthError(message, "auth");
          }
          setLoading(false);
          return;
        }

        let hasSession = false;
        for (let i = 0; i < 6; i += 1) {
          const {
            data: { session: retrySession },
          } = await supabase.auth.getSession();
          if (retrySession) {
            hasSession = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }

        if (!hasSession) {
          reportAuthError(
            "Connexion refusée: session non créée côté navigateur. Réessaie après avoir rafraîchi la page.",
            "auth"
          );
          setLoading(false);
          return;
        }

        const {
          data: { user: signedInUser },
        } = await supabase.auth.getUser();
        if (!isAccountEmailVerified(signedInUser)) {
          await supabase.auth.signOut();
          const cleaned = email.trim().toLowerCase();
          setPendingConfirmEmail(cleaned);
          setInfoMsg("Confirme ton email avant de te connecter. Vérifie ta boîte mail.");
          setLoading(false);
          return;
        }

        void syncSignupProfileNamesFromMetadata();
        handleSuccess({ next });
        return;
      }

      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const cleanedEmail = email.trim().toLowerCase();

      const localSignupCheck = validateSignupFieldsClient({
        email: cleanedEmail,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
      });
      if (!localSignupCheck.ok) {
        if (localSignupCheck.field === "email") {
          reportAuthError(localSignupCheck.message, "validation");
        } else {
          reportNameFieldError(
            localSignupCheck.message,
            localSignupCheck.field === "email" ? "both" : localSignupCheck.field,
          );
        }
        setLoading(false);
        return;
      }

      const nameCheck = await validateDisplayNamesRemote(
        trimmedFirstName,
        trimmedLastName,
        cleanedEmail,
      );
      if (!nameCheck.ok) {
        reportNameFieldError(nameCheck.error, nameCheck.field);
        setLoading(false);
        return;
      }

      const signupFullName = `${trimmedFirstName} ${trimmedLastName}`.trim();

      capturePostHog("signup_started", { method: "email" });
      track("Lead");
      const signUpResult = await supabase.auth.signUp({
        email: cleanedEmail,
        password,
        options: {
          emailRedirectTo: redirectTo,
          captchaToken: captchaToken || undefined,
          data: {
            first_name: trimmedFirstName,
            last_name: trimmedLastName,
            full_name: signupFullName,
          },
        },
      });

      if (signUpResult.error) {
        const a = analyzeConfirmationEmailError(signUpResult.error);
        let message = a.message || "Erreur lors de la création du compte.";
        if (message.includes("User already registered")) {
          message = "Cet email est déjà utilisé. Essayez de vous connecter ou utilisez 'Mot de passe oublié'.";
        }
        if (isBlockedDisplayNameError(message) || isBlockedDisplayNameError(signUpResult.error.message)) {
          const blockedMessage = isBlockedDisplayNameError(message)
            ? message
            : signUpResult.error.message;
          const blockedField = inferBlockedNameFieldFromMessage(blockedMessage);
          reportNameFieldError(blockedDisplayNameMessage(blockedField), blockedField);
        } else {
          reportAuthError(message, "auth");
          setRecoveryDashboardUrls(a.showDashboardHelp ? getSupabaseDashboardAuthUrls() : null);
        }
        setLoading(false);
        return;
      }

      if (signUpResult.data?.session) {
        const signedUpUser = signUpResult.data.user;
        if (!isAccountEmailVerified(signedUpUser)) {
          await supabase.auth.signOut();
          setPendingConfirmEmail(cleanedEmail);
          setResendStatus("idle");
          capturePostHog("signup_completed", { method: "email", confirmed: false });
          setInfoMsg("Compte créé ! Clique sur le lien reçu par email pour confirmer ton adresse.");
          setLoading(false);
          return;
        }

        capturePostHog("signup_completed", { method: "email", confirmed: true });
        await updateUserProfile({
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          full_name: signupFullName,
        });
        handleSuccess({ next });
        return;
      }

      const cleanedEmailPending = email.trim().toLowerCase();
      setPendingConfirmEmail(cleanedEmailPending);
      setResendStatus("idle");
      capturePostHog("signup_completed", { method: "email", confirmed: false });
      setInfoMsg("Compte créé ! Clique sur le lien reçu par email.");
    } catch (err) {
      reportAuthError(
        err?.message || "Erreur inconnue. Vérifiez votre connexion internet et réessayez.",
        "network"
      );
    } finally {
      setLoading(false);
    }
  };

  const switchAuthMode = () => {
    const nextMode = mode === "signin" ? "signup" : "signin";
    if (nextMode === "signup") {
      capturePostHog("signup_started", { method: "toggle" });
    }
    setMode(nextMode);
    setFirstName("");
    setLastName("");
    setErrorMsg("");
    setNameFieldError(null);
    setInfoMsg(null);
    setRecoveryDashboardUrls(null);
    setPendingConfirmEmail("");
    setResendStatus("idle");
    resetCaptcha();
  };

  const googleSignInButton = (
    <button
      type="button"
      onClick={signInWithGoogle}
      disabled={oauthLoading}
      className="w-full rounded-lg border border-[#dadce0] bg-[#ffffff] text-[#1f1f1f] font-medium py-3 hover:bg-[#f5f5f5] transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-sm"
    >
      {oauthLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-[#1f1f1f]/20 border-t-[#1f1f1f] rounded-full animate-spin" />
          <span>Connexion Google...</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>Continuer avec Google</span>
        </>
      )}
    </button>
  );

  const authDivider = (
    <div className="my-4 flex items-center gap-4" role="separator" aria-label="ou">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-xs text-gray-500 uppercase tracking-wide">ou</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );

  return (
    <div className="w-full max-w-md">
      <div className="mb-4 sm:mb-5 w-full text-center">
        <img
          src="/Logo_VWS_sans_bordure.png"
          alt="ViralWorks Studio"
          className="mx-auto mb-2.5 h-9 w-auto block"
          height={36}
          decoding="async"
        />
      </div>

      {errorMsg ? (
        <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          <p className="whitespace-pre-wrap">{errorMsg}</p>
          {recoveryDashboardUrls ? (
            <ul className="mt-3 space-y-1.5 text-red-200/90 text-xs list-none border-t border-red-500/20 pt-3">
              <li>
                <a
                  href={recoveryDashboardUrls.smtp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-red-100"
                >
                  Ouvrir : SMTP / emails (projet {recoveryDashboardUrls.projectRef})
                </a>
              </li>
              <li>
                <a
                  href={recoveryDashboardUrls.urlConfiguration}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-red-100"
                >
                  Ouvrir : URL Configuration (Redirect URLs)
                </a>
              </li>
              <li>
                <a
                  href={recoveryDashboardUrls.orgTeam}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-red-100"
                >
                  Ouvrir : membres de l&apos;organisation (Team) — requis pour le SMTP intégré
                </a>
              </li>
              <li>
                <a
                  href={recoveryDashboardUrls.docsSmtp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-red-100"
                >
                  Documentation : SMTP Supabase Auth
                </a>
              </li>
              <li>
                <a
                  href={recoveryDashboardUrls.docsCaptcha}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-red-100"
                >
                  Documentation : CAPTCHA / Attack Protection
                </a>
              </li>
            </ul>
          ) : null}
        </div>
      ) : null}

      {infoMsg && !pendingConfirmEmail ? (
        <div className="mb-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
          <p>{infoMsg}</p>
        </div>
      ) : null}

      {googleSignInButton}

      <button
        type="button"
        onClick={switchAuthMode}
        className="mt-2.5 w-full rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 font-medium py-2.5 text-sm hover:bg-emerald-500/10 transition-colors"
      >
        {mode === "signin" ? "Créer un compte" : "Déjà inscrit ?"}
      </button>

      <p className="mt-3 text-xs text-center text-gray-400 opacity-60">
        Données protégées
      </p>

      {authDivider}

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "signup" ? (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  Prénom
                </label>
                <input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  aria-invalid={firstNameHasError ? "true" : undefined}
                  aria-describedby={nameFieldError ? "signup-name-error" : undefined}
                  className={nameInputClassName(firstNameHasError)}
                  placeholder="Jean"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    clearNameFieldError();
                  }}
                  required
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-300 mb-2">
                  Nom
                </label>
                <input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  aria-invalid={lastNameHasError ? "true" : undefined}
                  aria-describedby={nameFieldError ? "signup-name-error" : undefined}
                  className={nameInputClassName(lastNameHasError)}
                  placeholder="Dupont"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    clearNameFieldError();
                  }}
                  required
                />
              </div>
            </div>
            {nameFieldError?.message ? (
              <p id="signup-name-error" className="mt-1.5 text-sm text-red-500">
                {nameFieldError.message}
              </p>
            ) : null}
          </div>
        ) : null}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" />
            Email
          </label>
          <input
            id="email"
            type="email"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 sm:py-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
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
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 sm:py-3 pr-12 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
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

        {mode === "signin" ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="shrink-0 whitespace-nowrap text-sm text-emerald-400 hover:text-emerald-300 transition-colors underline disabled:opacity-50"
            >
              Mot de passe oublié ?
            </button>
          </div>
        ) : null}

        {needsSignupCaptcha ? (
          <TurnstileWidget
            onToken={setCaptchaToken}
            onExpire={resetCaptcha}
            onError={resetCaptcha}
          />
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg font-semibold py-3 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 btn-vws-primary"
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

        {mode === "signup" && pendingConfirmEmail && infoMsg ? (
          <div className="text-center text-sm text-emerald-400 space-y-2 pt-1">
            <p>{infoMsg}</p>
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resendStatus === "sending" || resendStatus === "sent"}
              className="underline hover:text-emerald-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {resendStatus === "sending"
                ? "Envoi en cours…"
                : resendStatus === "sent"
                  ? "Email renvoyé ✓"
                  : "Renvoyer l'email de confirmation"}
            </button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
