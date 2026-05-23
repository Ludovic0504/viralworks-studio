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

  const requireSubscription = useCallback(() => {
    if (subscriptionLoading) return false;
    if (!hasActiveSubscription) {
      setShowSubscriptionModal(true);
      return false;
    }
    return true;
  }, [hasActiveSubscription, subscriptionLoading]);

  const canGenerateFace =
    Boolean(config.metier) && !config.generatingFace && !config.generatingTriptyque;

  const canGenerateTriptyque =
    Boolean(config.previewFaceUrl) &&
    !config.generatingTriptyque &&
    !config.generatingFace;

  const handleGenerateFace = async () => {
    if (!canGenerateFace) return;
    setError(null);
    update({ generatingFace: true, previewTriptyqueUrl: null });
    try {
      const result = await generateAvatar({
        config,
        format: "face",
      });
      update({
        previewFaceUrl: result.avatarUrl,
        previewTriptyqueUrl: null,
        generatingFace: false,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de la génération.";
      if (message.includes("Abonnement requis")) {
        setShowSubscriptionModal(true);
      } else {
        setError(message);
        trackPostHogError(message, "/studio", "generation");
      }
      update({ generatingFace: false });
    }
  };

  const handleGenerateTriptyque = async () => {
    if (!canGenerateTriptyque || !config.previewFaceUrl) return;
    setError(null);
    update({ generatingTriptyque: true });
    try {
      const result = await generateAvatar({
        config,
        format: "triptyque",
        referenceImageUrl: config.previewFaceUrl,
      });
      update({
        previewTriptyqueUrl: result.avatarUrl,
        generatingTriptyque: false,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de la génération.";
      if (message.includes("Abonnement requis")) {
        setShowSubscriptionModal(true);
      } else {
        setError(message);
        trackPostHogError(message, "/studio", "generation");
      }
      update({ generatingTriptyque: false });
    }
  };

  const requestGenerateFace = () => {
    void runWithAuth(async () => {
      if (!requireSubscription()) return;
      await handleGenerateFace();
    });
  };

  const requestGenerateTriptyque = () => {
    void runWithAuth(async () => {
      if (!requireSubscription()) return;
      await handleGenerateTriptyque();
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 max-md:gap-3 max-md:pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
      <PageTitle
        green="Avatar"
        white="IA"
        subtitle="Créez un avatar professionnel personnalisé pour vos contenus"
        titleClassName="max-md:text-[28px]"
        className="max-md:mb-4"
      />

      <StudioCategoryTabs
        activeCategory={config.activeCategory}
        onCategoryChange={(id) => update({ activeCategory: id })}
      />

      <div className="flex w-full min-w-0 max-w-full max-md:overflow-x-hidden max-md:h-auto max-md:min-h-0 flex-col gap-3 md:h-[560px] md:flex-row md:items-stretch md:gap-4">
        <StudioCategorySidebar
          activeCategory={config.activeCategory}
          onCategoryChange={(id) => update({ activeCategory: id })}
        />

        <StudioAvatarPreview
          previewFaceUrl={config.previewFaceUrl}
          previewTriptyqueUrl={config.previewTriptyqueUrl}
          generatingFace={config.generatingFace}
          generatingTriptyque={config.generatingTriptyque}
          onGenerateTriptyque={requestGenerateTriptyque}
          canGenerateTriptyque={canGenerateTriptyque}
        />

        <StudioOptionsPanel
          activeCategory={config.activeCategory}
          onGenerateFace={requestGenerateFace}
          onSubscriptionRequired={() => setShowSubscriptionModal(true)}
          hasActiveSubscription={hasActiveSubscription}
          subscriptionLoading={subscriptionLoading}
          canGenerateFace={canGenerateFace}
          generatingFace={config.generatingFace}
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
        onClick={requestGenerateFace}
        disabled={!canGenerateFace || subscriptionLoading}
        loading={config.generatingFace}
      />

      <ModalAbonnementRequis
        open={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />
    </div>
  );
}
