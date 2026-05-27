import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Images, User } from "lucide-react";
import StudioAvatarLibrary from "@/composants/studio/avatar/StudioAvatarLibrary";
import { getAvatarUrlFromHistory } from "@/bibliotheque/studio/studioAvatars";

function LoadingSpinner({ label = "Génération en cours…" }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

export default function StudioAvatarPreview({
  previewUrl,
  generating,
  libraryItems = [],
  libraryLoading = false,
  libraryExpandSignal = 0,
  onSelectAvatar,
  onDeleteAvatar,
}) {
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);

  const avatarCount = useMemo(
    () => libraryItems.filter((item) => getAvatarUrlFromHistory(item)).length,
    [libraryItems]
  );

  useEffect(() => {
    if (libraryExpandSignal > 0) {
      setMobileLibraryOpen(true);
    }
  }, [libraryExpandSignal]);

  const libraryProps = {
    items: libraryItems,
    activeUrl: previewUrl,
    onSelect: (url) => onSelectAvatar?.(url),
    onDelete: onDeleteAvatar,
    loading: libraryLoading,
  };

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-3 max-lg:flex-none lg:min-h-0 lg:flex-1 lg:gap-4">
      <div className="studio-panel flex w-full min-w-0 max-w-full flex-col overflow-hidden max-lg:h-[clamp(200px,35dvh,320px)] max-lg:shrink-0 max-lg:rounded-2xl max-lg:border-white/10 max-lg:bg-[#1a1a2e] max-lg:p-4 lg:min-h-0 lg:flex-1 lg:p-6">
        <div className="flex h-full w-full items-center justify-center">
          {generating && !previewUrl ? (
            <LoadingSpinner />
          ) : !previewUrl && !generating ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center max-lg:gap-2">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/5 lg:h-24 lg:w-24">
                <User className="h-10 w-10 text-white/20 lg:h-12 lg:w-12" strokeWidth={1.25} />
              </div>
              <p className="max-w-xs text-sm text-gray-400">
                Votre avatar apparaîtra ici après génération
              </p>
            </div>
          ) : previewUrl ? (
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl">
              <img
                src={previewUrl}
                alt="Avatar (character sheet)"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <LoadingSpinner label="Génération en cours…" />
            </div>
          )}
        </div>
      </div>

      <div className="studio-panel flex shrink-0 flex-col max-lg:overflow-visible p-4 lg:overflow-hidden lg:p-5">
        <button
          type="button"
          className="mb-0 flex w-full items-center gap-2.5 text-left lg:hidden"
          onClick={() => setMobileLibraryOpen((open) => !open)}
          aria-expanded={mobileLibraryOpen}
          aria-controls="studio-mobile-avatar-library"
        >
          <Images className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1 text-sm font-medium text-gray-200">Mes avatars</span>
          {avatarCount > 0 ? (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                mobileLibraryOpen
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-white/10 text-gray-300"
              }`}
            >
              {avatarCount}
            </span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${
              mobileLibraryOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>

        <h3 className="mb-3 hidden shrink-0 text-sm font-medium text-gray-200 lg:block">
          Mes avatars
        </h3>

        <div
          id="studio-mobile-avatar-library"
          className={`lg:block ${mobileLibraryOpen ? "max-lg:block" : "max-lg:hidden"}`}
        >
          <StudioAvatarLibrary {...libraryProps} className="max-lg:mt-3 lg:mt-0" />
        </div>
      </div>
    </div>
  );
}
