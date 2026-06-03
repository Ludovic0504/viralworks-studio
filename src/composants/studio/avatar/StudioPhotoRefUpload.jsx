import { useRef } from "react";
import { Upload, X } from "lucide-react";

export default function StudioPhotoRefUpload({
  photoDataUrl,
  onPhotoChange,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const hasPhoto = Boolean(photoDataUrl);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    const rd = new FileReader();
    rd.onload = () => onPhotoChange?.(String(rd.result || "") || null);
    rd.readAsDataURL(f);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-medium text-gray-300">Votre photo de référence</p>
      {hasPhoto ? (
        <div className="flex items-center gap-3">
          <img
            src={photoDataUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-lg border border-white/10 object-cover"
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="text-left text-xs text-cyan-400/90 underline-offset-2 hover:underline disabled:opacity-50"
            >
              Changer la photo
            </button>
            <button
              type="button"
              onClick={() => onPhotoChange?.(null)}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-50"
            >
              <X className="h-3 w-3" aria-hidden />
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-6 text-xs text-gray-400 transition hover:border-cyan-500/30 hover:text-gray-300 disabled:opacity-50"
        >
          <Upload className="h-5 w-5" aria-hidden />
          Importer une photo (JPG, PNG, WebP)
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
}
