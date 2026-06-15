import { createPortal } from "react-dom";
import { BookOpen, Crop, SlidersHorizontal, Wand2, X } from "lucide-react";

export default function SheetReglagesImageStudio({
  open,
  onClose,
  model,
  onModelChange,
  modelOptions,
  modelsAvailability,
  modelsLoading,
  aspectRatio,
  onAspectRatioChange,
  aspectRatios,
  onOpenPrompts,
  disabled,
}) {
  if (!open) return null;

  const openPrompts = () => {
    onClose();
    onOpenPrompts();
  };

  return createPortal(
    <div
      className="image-studio-settings-sheet-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="image-studio-settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-studio-settings-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="image-studio-settings-sheet-handle" aria-hidden />

        <div className="image-studio-settings-sheet-header">
          <h2 id="image-studio-settings-sheet-title" className="image-studio-settings-sheet-title">
            Réglages
          </h2>
          <button
            type="button"
            className="image-studio-settings-sheet-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="image-studio-settings-sheet-body">
          <section className="image-studio-settings-sheet-section">
            <p className="image-studio-settings-sheet-label">
              <Wand2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Modèle
            </p>
            <div className="image-studio-settings-sheet-options" role="listbox" aria-label="Modèle">
              {modelOptions.map((opt) => {
                const available = modelsAvailability[opt.id];
                const selected = model === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={disabled || modelsLoading || !available}
                    className={`image-studio-settings-sheet-option${selected ? " is-selected" : ""}`}
                    onClick={() => {
                      if (!available) return;
                      onModelChange(opt.id);
                    }}
                  >
                    <span>{modelsLoading && selected ? "…" : opt.label}</span>
                    {!available ? (
                      <span className="image-studio-settings-sheet-soon">Bientôt</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="image-studio-settings-sheet-section">
            <p className="image-studio-settings-sheet-label">
              <Crop className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Format
            </p>
            <div className="image-studio-settings-sheet-options" role="listbox" aria-label="Format">
              {aspectRatios.map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  role="option"
                  aria-selected={aspectRatio === ratio}
                  disabled={disabled}
                  className={`image-studio-settings-sheet-option${
                    aspectRatio === ratio ? " is-selected" : ""
                  }`}
                  onClick={() => onAspectRatioChange(ratio)}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </section>

          <button
            type="button"
            className="image-studio-settings-sheet-prompts"
            disabled={disabled}
            onClick={openPrompts}
          >
            <BookOpen className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Idées de prompts
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
