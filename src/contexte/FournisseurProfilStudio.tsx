import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/contexte/FournisseurAuth";
import {
  getUserProfile,
  updateUserProfile,
  type UserProfile,
} from "@/bibliotheque/supabase/profil";
import {
  getDecorPriorityIdsForSecteur,
  getIntentFromSecteur,
  getProductPromessePlaceholderForSecteur,
} from "@/bibliotheque/sectorDefaults";

type ProfilStudioCtx = {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  secteur: string | null;
  productPromessePlaceholder: string;
  decorPriorityIds: string[];
  refreshProfile: () => Promise<void>;
  updateSecteur: (value: string) => Promise<{ ok: boolean; error?: string }>;
};

const Ctx = createContext<ProfilStudioCtx | null>(null);

export const FournisseurProfilStudio: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, supabase } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const p = await getUserProfile();
      setProfile(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur profil");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  /** Recharge le profil à chaque connexion (nouveau compte ou reconnexion). */
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && s?.user?.id) {
        void refreshProfile();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, refreshProfile]);

  /**
   * Enregistre le secteur côté API : table `profiles`, colonne `secteur`, filtre `user_id` = utilisateur courant.
   * Ordre d’exécution côté UI (voir `updateSecteur` dans ce fichier) :
   * 1. `setProfile` immédiat → la modale se ferme (secteur dérivé du state local).
   * 2. `updateUserProfile({ secteur })` en arrière-plan → pas d’attente bloquante, pas de refetch tout de suite.
   */
  const updateSecteur = useCallback(async (value: string) => {
    const v = String(value ?? "").trim();
    if (!v) return { ok: false, error: "Secteur vide" };

    const userIntent = getIntentFromSecteur(v);

    setProfile((prev) => (prev ? { ...prev, secteur: v, user_intent: userIntent } : prev));

    void updateUserProfile({ secteur: v, user_intent: userIntent }).then((res) => {
      if (res.success) return;
      setProfile((prev) => (prev ? { ...prev, secteur: null, user_intent: null } : prev));
      console.error("[ProfilStudio] secteur:", res.error);
      alert(res.error || "Impossible d’enregistrer le secteur. Réessaie depuis ton profil.");
    });

    return { ok: true };
  }, []);

  const secteur = profile?.secteur != null && String(profile.secteur).trim() ? String(profile.secteur).trim() : null;

  const isAdmin = profile?.role === "admin";

  const productPromessePlaceholder = useMemo(
    () => getProductPromessePlaceholderForSecteur(secteur),
    [secteur]
  );

  const decorPriorityIds = useMemo(() => getDecorPriorityIdsForSecteur(secteur), [secteur]);

  const value = useMemo(
    () => ({
      profile,
      loading,
      error,
      isAdmin,
      secteur,
      productPromessePlaceholder,
      decorPriorityIds,
      refreshProfile,
      updateSecteur,
    }),
    [profile, loading, error, isAdmin, secteur, productPromessePlaceholder, decorPriorityIds, refreshProfile, updateSecteur]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useProfilStudio() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useProfilStudio doit être utilisé dans FournisseurProfilStudio");
  return c;
}
