import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  useEffect(() => {
    const checkAndProcessHash = async () => {
      try {
        const supabase = getBrowserSupabase();
        const url = window.location.href;
        
        const urlObj = new URL(url);
        const hasHash = urlObj.hash && urlObj.hash.includes('access_token');
        
        if (hasHash) {
          await new Promise(resolve => setTimeout(resolve, 500));

          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error("[ResetPassword] Session error:", sessionError);
            setError("Erreur lors du traitement du lien. Veuillez demander un nouveau lien de réinitialisation.");
            setCheckingSession(false);
            return;
          }
          
          if (!session) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const { data: retryData, error: retryError } = await supabase.auth.getSession();
            
            if (retryError || !retryData?.session) {
              setError("Le lien de réinitialisation est invalide ou a expiré. Veuillez demander un nouveau lien.");
              setCheckingSession(false);
              return;
            }
          }
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            setError("Aucun lien de réinitialisation trouvé. Veuillez demander un nouveau lien depuis la page de connexion.");
            setCheckingSession(false);
            return;
          }
        }
        
        setCheckingSession(false);
      } catch (err) {
        console.error("[ResetPassword] Error checking hash:", err);
        setError("Une erreur est survenue. Veuillez réessayer.");
        setCheckingSession(false);
      }
    };
    
    checkAndProcessHash();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      const supabase = getBrowserSupabase();
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("[ResetPassword] Session error:", sessionError);
        setError("Erreur lors de la vérification de la session. Veuillez demander un nouveau lien de réinitialisation.");
        setLoading(false);
        return;
      }
      
      if (!session) {
        const url = window.location.href;
        const urlObj = new URL(url);
        const hasHash = urlObj.hash && urlObj.hash.includes('access_token');
        
        if (hasHash) {
          await new Promise(resolve => setTimeout(resolve, 800));
          const { data: retryData, error: retryError } = await supabase.auth.getSession();
          
          if (retryError || !retryData?.session) {
            setError("Le lien de réinitialisation est invalide ou a expiré. Le lien peut être utilisé une seule fois. Veuillez demander un nouveau lien.");
            setLoading(false);
            return;
          }
        } else {
          setError("Aucune session de réinitialisation trouvée. Veuillez demander un nouveau lien de réinitialisation.");
          setLoading(false);
          return;
        }
      }
      
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        console.error("[ResetPassword] Update error:", updateError);
        const errorMsg = updateError.message?.toLowerCase() || "";
        
        if (errorMsg.includes("session") || errorMsg.includes("token") || errorMsg.includes("expired") || errorMsg.includes("invalid")) {
          setError("Le lien de réinitialisation est invalide ou a expiré. Le lien peut être utilisé une seule fois. Veuillez demander un nouveau lien de réinitialisation.");
        } else {
          setError(updateError.message || "Erreur lors de la mise à jour du mot de passe.");
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      setTimeout(() => {
        navigate("/login?password_reset=success", { replace: true });
      }, 2000);

    } catch (err) {
      setError(err?.message || "Erreur lors de la réinitialisation du mot de passe.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0C1116" }}>
        <div className="max-w-md w-full mx-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Mot de passe réinitialisé !</h2>
            <p className="text-gray-400 mb-6">Votre mot de passe a été mis à jour avec succès.</p>
            <p className="text-sm text-gray-500">Redirection vers la page de connexion...</p>
          </div>
        </div>
      </div>
    );
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ background: "#0C1116" }}>
        <div className="max-w-md w-full">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Vérification du lien...</h2>
            <p className="text-gray-400">Veuillez patienter pendant que nous vérifions votre lien de réinitialisation.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ background: "#0C1116" }}>
      <div className="max-w-md w-full">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Réinitialiser le mot de passe</h2>
            <p className="text-gray-400">Entrez votre nouveau mot de passe</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4 text-gray-400" />
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  placeholder="Au moins 6 caractères"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4 text-gray-400" />
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  placeholder="Répétez le mot de passe"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-400 text-white font-semibold py-3 hover:from-emerald-400 hover:to-emerald-300 transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Réinitialisation...
                </>
              ) : (
                "Réinitialiser le mot de passe"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate("/login")}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors underline"
            >
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

