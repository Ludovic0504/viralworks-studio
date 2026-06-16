import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronLeft,
  Copy,
  Download,
  ImagePlus,
  Sparkles,
} from "lucide-react";
import ImageStudioModelIcon from "@/composants/image/ImageStudioModelIcon";
import { downloadImageAsPng } from "@/bibliotheque/imageStudio/downloadImagePng";
import { getGenerationRefsFromHistory } from "@/bibliotheque/imageStudio/imageStudioHistory";
import { getImageStudioModelLabel } from "@/bibliotheque/imageStudio/imageStudioModels";

function countGenerationRefs(refs) {
  return [refs.avatarUrl, refs.productUrl, refs.importedRefUrl].filter(Boolean).length;
}

export default function ModalImageStudioPreview({
  open,
  item,
  imageUrl,
  onClose,
  onRecreateContext,
  onUseAsReference,
}) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const promptText = item?.input?.trim() || "";
  const modelId = item?.metadata?.imageStudioModel;
  const aspectRatio = item?.metadata?.aspectRatio;
  const generationRefs = getGenerationRefsFromHistory(item);
  const refCount = countGenerationRefs(generationRefs);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const copyPrompt = useCallback(async () => {
    if (!promptText) return;
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [promptText]);

  const handleDownload = useCallback(async () => {
    if (!imageUrl || downloading) return;
    setDownloading(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadImageAsPng(imageUrl, `viralworks-image-${stamp}.png`);
    } catch (err) {
      console.error("Téléchargement image:", err);
      alert("Impossible de télécharger l'image. Réessaie dans un instant.");
    } finally {
      setDownloading(false);
    }
  }, [imageUrl, downloading]);

  if (!open || !imageUrl) return null;

  return createPortal(
    <div
      className="image-studio-preview-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="image-studio-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-studio-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="image-studio-preview-layout">
          <div className="image-studio-preview-media">
            <button
              type="button"
              className="image-studio-preview-back"
              onClick={onClose}
              aria-label="Retour"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <img
              src={imageUrl}
              alt=""
              className="image-studio-preview-image"
            />
          </div>

          <aside className="image-studio-preview-sidebar">
            <div className="image-studio-preview-prompt-head">
              <h2 id="image-studio-preview-title" className="image-studio-preview-prompt-title">
                Prompt
              </h2>
              <button
                type="button"
                className={`image-studio-preview-copy-btn${copied ? " is-copied" : ""}`}
                onClick={() => void copyPrompt()}
                disabled={!promptText}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    Copier
                  </>
                )}
              </button>
            </div>

            <div className="image-studio-preview-prompt-body studio-subtle-scrollbar">
              <pre className="image-studio-preview-prompt-text">
                {promptText || "Sans description"}
              </pre>
            </div>

            <div className="image-studio-preview-tags">
              {refCount > 0 ? (
                <span className="image-studio-preview-tag">
                  Références {refCount}
                </span>
              ) : null}
              {modelId ? (
                <span className="image-studio-preview-tag image-studio-preview-tag--model">
                  <ImageStudioModelIcon modelId={modelId} className="h-3.5 w-3.5" />
                  {getImageStudioModelLabel(modelId)}
                </span>
              ) : null}
              {aspectRatio ? (
                <span className="image-studio-preview-tag">{aspectRatio}</span>
              ) : null}
              <span className="image-studio-preview-tag">2K</span>
            </div>

            <div className="image-studio-preview-use-as">
              <p className="image-studio-preview-use-as-label">Utiliser comme</p>
              <div className="image-studio-preview-use-as-row">
                <button
                  type="button"
                  className="image-studio-preview-use-btn"
                  onClick={() => onUseAsReference?.(imageUrl)}
                >
                  <ImagePlus className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Référence
                </button>
                <button
                  type="button"
                  className="image-studio-preview-use-btn"
                  onClick={() => void handleDownload()}
                  disabled={downloading}
                >
                  <Download className="h-4 w-4" strokeWidth={2} aria-hidden />
                  {downloading ? "Téléchargement…" : "Télécharger"}
                </button>
              </div>
            </div>

            <div className="image-studio-preview-actions">
              <button
                type="button"
                className="image-studio-preview-recreate-btn"
                onClick={() => onRecreateContext?.(item)}
              >
                <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
                Recréer
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
