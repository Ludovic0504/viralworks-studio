import { useCallback, useEffect, useState } from "react";
import PageTitle from "@/composants/interface/TitrePage";
import StudioCategorySidebar from "@/composants/studio/avatar/StudioCategorySidebar";
import StudioCategoryTabs from "@/composants/studio/avatar/StudioCategoryTabs";
import StudioGenerateBar from "@/composants/studio/avatar/StudioGenerateBar";
import StudioAvatarPreview from "@/composants/studio/avatar/StudioAvatarPreview";
import StudioOptionsPanel from "@/composants/studio/avatar/StudioOptionsPanel";
import StudioCategoryPanel from "@/composants/studio/avatar/StudioCategoryPanel";
import ModalAbonnementRequis from "@/composants/studio/avatar/ModalAbonnementRequis";
import { DEFAULT_AVATAR_CONFIG } from "@/bibliotheque/studio/avatarOptions";
import { generateAvatar } from "@/bibliotheque/studio/generateAvatar";
import {
  getAvatarUrlFromHistory,
  listStudioAvatars,
} from "@/bibliotheque/studio/studioAvatars";
import { deleteHistory } from "@/bibliotheque/supabase/historique";
import { getUserSubscription } from "@/bibliotheque/supabase/stripe";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { capturePostHog, trackPostHogError } from "@/bibliotheque/posthog/client";

export default function Studio() {
  const { session } = useAuth();
  const { runWithAuth } = useRequireAuthAction();
  const [config, setConfig] = useState(DEFAULT_AVATAR_CONFIG);
  const [error, setError] = useState(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [avatarLibrary, setAvatarLibrary] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);

  useEffect(() => {
    capturePostHog("avatar_creator_opened");
  }, []);

  const update = (patch) => setConfig((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    let active = true;
    const loadSubscription = async () => {
      if (!session?.user?.id) {
        if (active) {
          setHasActiveSubscription(false);
          setSubscriptionLoading(false);
        }
        return;
      }
      setSubscriptionLoading(true);
      try {
        const sub = await getUserSubscription();
        if (active) setHasActiveSubscription(Boolean(sub));
      } catch {
        if (active) setHasActiveSubscription(false);
      } finally {
        if (active) setSubscriptionLoading(false);
      }
    };
    loadSubscription();
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let active = true;
    const loadLibrary = async () => {
      if (!session?.user?.id) {
        if (active) {
          setAvatarLibrary([]);
          setLibraryLoading(false);
        }
        return;
      }
      setLibraryLoading(true);
      try {
        const rows = await listStudioAvatars(10);
        if (active) setAvatarLibrary(rows);
      } catch {
        if (active) setAvatarLibrary([]);
      } finally {
        if (active) setLibraryLoading(false);
      }
    };
    loadLibrary();
    return () => {
      active = false;
    };
  }, [session?.user?.id, libraryRefreshKey]);

  const requireSubscription = useCallback(() => {
    if (subscriptionLoading) return false;
    if (!hasActiveSubscription) {
      setShowSubscriptionModal(true);
      return false;
    }
    return true;
  }, [hasActiveSubscription, subscriptionLoading]);

  const canGenerate = Boolean(config.metier) && !config.generating;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setError(null);
    update({ generating: true });
    try {
      const result = await generateAvatar({
        config,
      });
      update({
        previewUrl: result.avatarUrl,
        generating: false,
      });
      setLibraryRefreshKey((k) => k + 1);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de la génération.";
      if (message.includes("Abonnement requis")) {
        setShowSubscriptionModal(true);
      } else {
        setError(message);
        trackPostHogError(message, "/studio", "generation");
      }
      update({ generating: false });
    }
  };

  const requestGenerate = () => {
    void runWithAuth(async () => {
      if (!requireSubscription()) return;
      await handleGenerate();
    });
  };

  const handleDeleteAvatar = useCallback(
    async (item) => {
      const id = item?.id;
      if (!id || String(id).startsWith("storage-")) return;

      const deletedUrl = getAvatarUrlFromHistory(item);
      const result = await deleteHistory(id);
      if (!result.success) {
        console.error("Suppression avatar:", result.error);
        return;
      }

      setAvatarLibrary((prev) => prev.filter((row) => row.id !== id));
      if (
        deletedUrl &&
        config.previewUrl &&
        getAvatarUrlFromHistory({ output: config.previewUrl }) === deletedUrl
      ) {
        update({ previewUrl: null });
      }
      setLibraryRefreshKey((k) => k + 1);
    },
    [config.previewUrl, update]
  );

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-4 max-lg:gap-3 max-lg:pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-6">
      <PageTitle
        green="Avatar"
        white="IA"
        subtitle="Créez un avatar professionnel personnalisé pour vos contenus"
        titleClassName="max-lg:text-[28px]"
        className="max-lg:mb-4"
      />

      <StudioCategoryTabs
        activeCategory={config.activeCategory}
        onCategoryChange={(id) => update({ activeCategory: id })}
      />

      <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col gap-3 max-lg:overflow-x-hidden lg:flex-row lg:items-stretch lg:gap-4">
        <StudioCategorySidebar
          activeCategory={config.activeCategory}
          onCategoryChange={(id) => update({ activeCategory: id })}
        />

        <StudioAvatarPreview
          previewUrl={config.previewUrl}
          generating={config.generating}
          libraryItems={avatarLibrary}
          libraryLoading={libraryLoading}
          onSelectAvatar={(url) => update({ previewUrl: url })}
          onDeleteAvatar={handleDeleteAvatar}
        />

        <StudioOptionsPanel
          activeCategory={config.activeCategory}
          onGenerate={requestGenerate}
          onSubscriptionRequired={() => setShowSubscriptionModal(true)}
          hasActiveSubscription={hasActiveSubscription}
          subscriptionLoading={subscriptionLoading}
          canGenerate={canGenerate}
          generating={config.generating}
        >
          <StudioCategoryPanel
            activeCategory={config.activeCategory}
            config={config}
            onChange={update}
          />
        </StudioOptionsPanel>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <StudioGenerateBar
        onClick={requestGenerate}
        disabled={!canGenerate || subscriptionLoading}
        loading={config.generating}
      />

      <ModalAbonnementRequis
        open={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />
    </div>
  );
}
