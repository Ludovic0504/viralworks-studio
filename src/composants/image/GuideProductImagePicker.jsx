import { useRef } from "react";
import { ImageUp } from "lucide-react";

export default function GuideProductImagePicker({
  disabled = false,
  previewUrl,
  errorMessage,
  onPickFile,
}) {
  const inputRef = useRef(null);

  return (
    <div className="image-studio-prompt-ugc-product-image-picker">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          onPickFile(file);
        }}
      />
      <button
        type="button"
        className="studio-toolbar-btn image-studio-prompt-guide-elements-btn image-studio-prompt-ugc-product-image-btn"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <ImageUp className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span>{previewUrl ? "Changer l'image" : "Ajouter une image (optionnel)"}</span>
      </button>
      {previewUrl ? (
        <div className="image-studio-prompt-ugc-product-image-preview" aria-hidden="true">
          <img src={previewUrl} alt="" />
        </div>
      ) : null}
      {errorMessage ? (
        <p className="image-studio-prompt-ugc-product-image-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
