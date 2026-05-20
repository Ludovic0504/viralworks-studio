import { Info, User } from "lucide-react";
import Button from "@/composants/interface/Bouton";

function LoadingSpinner({ label = "Génération en cours…" }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

export default function StudioAvatarPreview({
  previewFaceUrl,
  previewTriptyqueUrl,
  generatingFace,
  generatingTriptyque,
  onGenerateTriptyque,
  canGenerateTriptyque,
}) {
  const showStep2Block = Boolean(previewFaceUrl) && !generatingFace;

  return (
    <div className="flex h-[560px] min-w-0 flex-1 flex-col gap-4">
      <div className="studio-panel flex min-h-0 flex-1 flex-col p-6">
        {generatingFace && !previewFaceUrl ? (
          <LoadingSpinner />
        ) : !previewFaceUrl && !previewTriptyqueUrl && !generatingTriptyque ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <User className="h-12 w-12 text-white/20" strokeWidth={1.25} />
            </div>
            <p className="max-w-xs text-sm text-gray-400">
              Votre avatar apparaîtra ici après génération
            </p>
          </div>
        ) : previewTriptyqueUrl ? (
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="mx-auto max-h-full max-w-full overflow-hidden rounded-[10px]">
                <img
                  src={previewTriptyqueUrl}
                  alt="Avatar triptyque"
                  className="block max-h-full max-w-full rounded-[10px] object-contain"
                />
              </div>
            </div>
            {previewFaceUrl ? (
              <div className="absolute bottom-3 left-3 z-[2] w-[70px] overflow-hidden rounded-[10px] border-[1.5px] border-white/[0.15] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                <img
                  src={previewFaceUrl}
                  alt="Avatar de face"
                  className="h-auto w-full rounded-[10px] object-contain"
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            {previewFaceUrl ? (
              <div className="flex w-full flex-col items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                  Vue de face
                </p>
                <div className="mx-auto w-fit max-w-full overflow-hidden rounded-[10px]">
                  <img
                    src={previewFaceUrl}
                    alt="Avatar de face"
                    className="block max-h-[320px] max-w-sm rounded-[10px] object-contain"
                  />
                </div>
              </div>
            ) : null}

            {generatingFace && previewFaceUrl ? <LoadingSpinner label="Regénération…" /> : null}

            {generatingTriptyque ? (
              <LoadingSpinner label="Génération des 3 angles…" />
            ) : null}
          </div>
        )}
      </div>

      {showStep2Block ? (
        <div className="studio-panel flex flex-col gap-4 p-4">
          <div className="flex items-start gap-3 text-sm text-gray-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" aria-hidden />
            <p>Pour une meilleure cohérence dans vos vidéos</p>
          </div>
          <Button
            variant="secondary"
            onClick={onGenerateTriptyque}
            disabled={!canGenerateTriptyque}
            loading={generatingTriptyque}
            className="w-full sm:w-auto"
          >
            Générer les 3 angles de prise de vue
          </Button>
        </div>
      ) : null}
    </div>
  );
}
