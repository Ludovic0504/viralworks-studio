import { useState } from "react";
import PageTitle from "@/composants/interface/TitrePage";
import StudioCategorySidebar from "@/composants/studio/avatar/StudioCategorySidebar";
import StudioAvatarPreview from "@/composants/studio/avatar/StudioAvatarPreview";
import StudioOptionsPanel from "@/composants/studio/avatar/StudioOptionsPanel";
import StudioCategoryPanel from "@/composants/studio/avatar/StudioCategoryPanel";
import { DEFAULT_AVATAR_CONFIG } from "@/bibliotheque/studio/avatarOptions";
import { generateAvatar } from "@/bibliotheque/studio/generateAvatar";

export default function Studio() {
  const [config, setConfig] = useState(DEFAULT_AVATAR_CONFIG);
  const [error, setError] = useState(null);

  const update = (patch) => setConfig((prev) => ({ ...prev, ...patch }));

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
      setError(err instanceof Error ? err.message : "Erreur lors de la génération.");
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
      setError(err instanceof Error ? err.message : "Erreur lors de la génération.");
      update({ generatingTriptyque: false });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
      <PageTitle
        green="Avatar"
        white="IA"
        subtitle="Créez un avatar professionnel personnalisé pour vos contenus"
      />

      <div className="flex h-[560px] flex-col gap-4 lg:flex-row lg:items-stretch">
        <StudioCategorySidebar
          activeCategory={config.activeCategory}
          onCategoryChange={(id) => update({ activeCategory: id })}
        />

        <StudioAvatarPreview
          previewFaceUrl={config.previewFaceUrl}
          previewTriptyqueUrl={config.previewTriptyqueUrl}
          generatingFace={config.generatingFace}
          generatingTriptyque={config.generatingTriptyque}
          onGenerateTriptyque={handleGenerateTriptyque}
          canGenerateTriptyque={canGenerateTriptyque}
        />

        <StudioOptionsPanel
          activeCategory={config.activeCategory}
          onGenerateFace={handleGenerateFace}
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
    </div>
  );
}
