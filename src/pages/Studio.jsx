import { useCallback, useEffect, useState } from "react";
import { useStudioLayoutOptions } from "@/contexte/StudioLayoutOptionsContext";
import PageTitle from "@/composants/interface/TitrePage";
import StudioCategorySidebar from "@/composants/studio/avatar/StudioCategorySidebar";
import StudioCategoryTabs from "@/composants/studio/avatar/StudioCategoryTabs";
import StudioGenerateBar from "@/composants/studio/avatar/StudioGenerateBar";
import StudioAvatarPreview from "@/composants/studio/avatar/StudioAvatarPreview";
import StudioOptionsPanel from "@/composants/studio/avatar/StudioOptionsPanel";
import StudioCategoryPanel from "@/composants/studio/avatar/StudioCategoryPanel";
import ModalAbonnementRequis from "@/composants/studio/avatar/ModalAbonnementRequis";
import StudioPhotoRefUpload from "@/composants/studio/avatar/StudioPhotoRefUpload";
import { DEFAULT_AVATAR_CONFIG } from "@/bibliotheque/studio/avatarOptions";
import { generateAvatar } from "@/bibliotheque/studio/generateAvatar";
import {
  getAvatarUrlFromHistory,
  listStudioAvatars,
} from "@/bibliotheque/studio/studioAvatars";
import { deleteHistory } from "@/bibliotheque/supabase/historique";
import { useAuth } from "@/contexte/FournisseurAuth";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { hasAvatarPlan } from "@/bibliotheque/supabase/premiumAccess";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { capturePostHog, trackPostHogError } from "@/bibliotheque/posthog/client";
import { useT } from "@/contexte/FournisseurLocale";

const AVATAR_MODES = [
  { id: "from_scratch", labelKey: "studio.createFromScratch" },
  { id: "from_photo", label: "À partir de ma photo" },
];

export default function Studio() {
  const t = useT();
  const { session } = useAuth();
  const { runWithAuth } = useRequireAuthAction();
  const { setStudioLayout } = useStudioLayoutOptions();
  const [config, setConfig] = useState(DEFAULT_AVATAR_CONFIG);
  const [error, setError] = useState(null);
  const { plan, loading: subscriptionLoading } = usePremiumAccess();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [avatarLibrary, setAvatarLibrary] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [libraryExpandSignal, setLibraryExpandSignal] = useState(0);
  const [avatarMode, setAvatarMode] = useState("from_scratch");
  const [photoDataUrl, setPhotoDataUrl] = useState(null);

  useEffect(() => {
    capturePostHog("avatar_creator_opened");
  }, []);

  useEffect(() => {
    setStudioLayout({ hideGlobalFooterOnMobile: true });
    return () => setStudioLayout(null);
  }, [setStudioLayout]);

  const update = (patch) => setConfig((prev) => ({ ...prev, ...patch }));

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
    if (!hasAvatarPlan(plan)) {
      setShowSubscriptionModal(true);
      return false;
    }
    return true;
  }, [plan, subscriptionLoading]);

  const canGenerate =
    Boolean(config.metier) &&
    !config.generating &&
    (avatarMode !== "from_photo" || Boolean(photoDataUrl));

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setError(null);
    update({ generating: true });
    try {
      const result = await generateAvatar({
        config,
        ...(avatarMode === "from_photo" && photoDataUrl
          ? { photoDataUrl }
          : {}),
      });
      update({
        previewUrl: result.avatarUrl,
        generating: false,
      });
      setLibraryRefreshKey((k) => k + 1);
      setLibraryExpandSignal((s) => s + 1);
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
    <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-4 max-lg:h-auto max-lg:min-h-0 max-lg:overflow-x-hidden max-lg:gap-3 max-lg:pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 lg:h-full lg:min-h-0 lg:flex-1 lg:px-8 lg:py-6">
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

      <div className="flex w-full min-w-0 max-w-full flex-col gap-3 max-lg:flex-none max-lg:overflow-x-hidden lg:min-h-0 lg:flex-1 lg:flex-row lg:items-stretch lg:gap-4">
        <StudioCategorySidebar
          activeCategory={config.activeCategory}
          onCategoryChange={(id) => update({ activeCategory: id })}
        />

        <div className="max-lg:order-2 w-full min-w-0 max-w-full lg:contents">
          <StudioAvatarPreview
            previewUrl={config.previewUrl}
            generating={config.generating}
            libraryItems={avatarLibrary}
            libraryLoading={libraryLoading}
            libraryExpandSignal={libraryExpandSignal}
            onSelectAvatar={(url) => update({ previewUrl: url })}
            onDeleteAvatar={handleDeleteAvatar}
          />
        </div>

        <div className="max-lg:order-1 w-full min-w-0 max-w-full lg:contents">
          <StudioOptionsPanel
            activeCategory={config.activeCategory}
            onGenerate={requestGenerate}
            onSubscriptionRequired={() => setShowSubscriptionModal(true)}
            hasAccess={hasAvatarPlan(plan)}
            subscriptionLoading={subscriptionLoading}
            canGenerate={canGenerate}
            generating={config.generating}
          >
            <div
              className="flex w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-1"
              role="tablist"
              aria-label="Mode de création d'avatar"
            >
              {AVATAR_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={avatarMode === mode.id}
                  onClick={() => {
                    setAvatarMode(mode.id);
                    if (mode.id === "from_scratch") setPhotoDataUrl(null);
                  }}
                  disabled={config.generating}
                  className={`flex-1 rounded-lg px-2 py-2 text-center text-[11px] font-medium transition sm:text-xs ${
                    avatarMode === mode.id
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "text-gray-400 hover:text-gray-200"
                  } disabled:opacity-50`}
                >
                  {mode.labelKey ? t(mode.labelKey) : mode.label}
                </button>
              ))}
            </div>
            {avatarMode === "from_photo" ? (
              <StudioPhotoRefUpload
                photoDataUrl={photoDataUrl}
                onPhotoChange={setPhotoDataUrl}
                disabled={config.generating}
              />
            ) : null}
            <StudioCategoryPanel
              activeCategory={config.activeCategory}
              config={config}
              onChange={update}
            />
          </StudioOptionsPanel>
        </div>
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
