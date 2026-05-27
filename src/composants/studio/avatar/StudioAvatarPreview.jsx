import { User } from "lucide-react";
import StudioAvatarLibrary from "@/composants/studio/avatar/StudioAvatarLibrary";

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
  onSelectAvatar,
  onDeleteAvatar,
}) {
  return (
    <div className="flex min-h-0 w-full min-w-0 max-w-full max-lg:shrink-0 max-lg:flex-none flex-1 flex-col gap-3 lg:gap-4">
      <div className="studio-panel flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden max-lg:min-h-[min(38vh,280px)] max-lg:shrink-0 max-lg:rounded-2xl max-lg:border-white/10 max-lg:bg-[#1a1a2e] max-lg:p-4 lg:p-6">
        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
          {generating && !previewUrl ? (
            <LoadingSpinner />
          ) : !previewUrl && !generating ? (
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-24 w-24 max-lg:h-28 max-lg:w-28 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <User className="h-12 w-12 max-lg:h-14 max-lg:w-14 text-white/20" strokeWidth={1.25} />
              </div>
              <p className="max-w-xs text-sm text-gray-400">
                Votre avatar apparaîtra ici après génération
              </p>
            </div>
          ) : previewUrl ? (
            <div className="flex min-h-0 w-full flex-1 overflow-hidden rounded-xl">
              <img
                src={previewUrl}
                alt="Avatar (character sheet)"
                className="block h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <LoadingSpinner label="Génération en cours…" />
            </div>
          )}
        </div>
      </div>

      <div className="studio-panel flex shrink-0 flex-col overflow-hidden p-4 lg:p-5">
        <h3 className="mb-3 shrink-0 text-sm font-medium text-gray-200">Mes avatars</h3>
        <StudioAvatarLibrary
          items={libraryItems}
          activeUrl={previewUrl}
          onSelect={(url) => onSelectAvatar?.(url)}
          onDelete={onDeleteAvatar}
          loading={libraryLoading}
        />
      </div>
    </div>
  );
}
