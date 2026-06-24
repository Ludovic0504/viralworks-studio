import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, SlidersHorizontal, Video } from "lucide-react";
import EditVideoReferenceSlot from "./EditVideoReferenceSlot.jsx";

const RESOLUTION_OPTIONS = ["480p", "720p"];

function ResolutionDropdown({ value, onChange, disabled = false }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  return (
    <div ref={rootRef} className={`image-studio-dropdown shrink-0${open ? " is-open" : ""}`}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="image-studio-setting-pill"
        onClick={() => setOpen((prev) => !prev)}
        title={`Résolution : ${value}`}
        aria-label={`Résolution : ${value}`}
      >
        <Video className="image-studio-setting-pill-icon" strokeWidth={2} aria-hidden />
        <span className="image-studio-setting-pill-label">{value}</span>
        <ChevronDown
          className={`image-studio-setting-pill-chevron h-3.5 w-3.5 shrink-0 opacity-50 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={2.25}
        />
      </button>

      {open ? (
        <div className="image-studio-dropdown-menu" role="listbox">
          {RESOLUTION_OPTIONS.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                className={`image-studio-dropdown-option ${selected ? "is-selected" : ""}`}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <span>{option}</span>
                <Check
                  className={`image-studio-dropdown-option-check${selected ? " is-visible" : ""}`}
                  strokeWidth={2.5}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function EditVideoCommandBar({
  editPrompt,
  onEditPromptChange,
  onSubmit,
  disabled = false,
  canGenerate,
  generating,
  trimming,
  trimStatusMessage,
  videoPreview,
  onVideoPick,
  avatarPreview,
  onAvatarPick,
  onAvatarClear,
  refPreview,
  onRefPick,
  onRefClear,
  resolution,
  onResolutionChange,
  onOpenSettings,
  busy = false,
}) {
  const isBusy = disabled || busy || generating || trimming;
  const submitDisabled = !canGenerate || isBusy;

  const handleTextareaKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!submitDisabled) onSubmit?.();
    }
  };

  return (
    <div className="image-studio-command-bar z-30 shrink-0 px-3 sm:sticky sm:bottom-0 sm:px-6 lg:px-8">
      <div className="image-studio-command-bar-inner mx-auto max-w-[1400px]">
        <div className="image-studio-command-layout">
          <div className="image-studio-prompt-row">
            <div className="image-studio-prompt-import shrink-0">
              <button
                type="button"
                disabled={isBusy}
                onClick={onVideoPick}
                className={`image-studio-add-btn ${videoPreview ? "has-ref" : ""}`}
                title={
                  videoPreview
                    ? "Vidéo source sélectionnée — cliquer pour remplacer"
                    : "Importer une vidéo"
                }
                aria-label={
                  videoPreview
                    ? "Vidéo source sélectionnée — cliquer pour remplacer"
                    : "Importer une vidéo"
                }
              >
                {videoPreview ? (
                  <img src={videoPreview} alt="" className="image-studio-add-btn-img" />
                ) : (
                  <Video className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                )}
              </button>
            </div>

            <div className="image-studio-prompt-input-wrap min-w-0 flex-1">
              <textarea
                value={editPrompt}
                onChange={(event) => onEditPromptChange(event.target.value)}
                onKeyDown={handleTextareaKeyDown}
                disabled={isBusy}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                placeholder="Décris ce que tu veux changer… ex: ajouter un canapé beige au centre du salon"
                aria-label="Prompt d'édition vidéo"
                rows={1}
                className="image-studio-prompt-input min-w-0 flex-1 resize-none py-1 leading-relaxed disabled:opacity-50"
              />
            </div>
          </div>

          <div className="image-studio-settings-row">
            <div className="image-studio-settings-desktop">
              <ResolutionDropdown
                value={resolution}
                onChange={onResolutionChange}
                disabled={isBusy}
              />
            </div>

            <button
              type="button"
              className="image-studio-settings-mobile-btn"
              onClick={onOpenSettings}
              disabled={isBusy}
              aria-label="Ouvrir les réglages d'édition vidéo"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span>Réglages</span>
            </button>
          </div>

          <div className="image-studio-command-aside shrink-0">
            <div className="image-studio-ref-slots">
              <EditVideoReferenceSlot
                label="Avatar"
                preview={avatarPreview}
                disabled={isBusy}
                onPick={onAvatarPick}
                onClear={onAvatarClear}
                imageClassName="[object-position:16%_center]"
              />
              <EditVideoReferenceSlot
                label="Référence"
                preview={refPreview}
                disabled={isBusy}
                onPick={onRefPick}
                onClear={onRefClear}
              />
            </div>

            <button
              type="button"
              onClick={onSubmit}
              disabled={submitDisabled}
              className="image-studio-generate-btn btn-vws-primary"
            >
              {trimming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {trimStatusMessage || "Préparation..."}
                </>
              ) : generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Génération...
                </>
              ) : (
                "Générer"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
