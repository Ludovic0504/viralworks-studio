import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import { IMAGE_STUDIO_PROMPT_IDEAS } from "@/bibliotheque/imageStudio/promptIdeas";

export default function ModalPromptsImageStudio({ open, onClose }) {
  const [copiedId, setCopiedId] = useState(null);

  const copyPrompt = useCallback(async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
    } catch {
      setCopiedId(null);
    }
  }, []);

  if (!open) return null;

  const handleBackdropClose = (event) => {
    if (event.target !== event.currentTarget) return;
    event.stopPropagation();
    window.setTimeout(onClose, 0);
  };

  return createPortal(
    <div
      className="image-studio-quota-modal-backdrop"
      role="presentation"
      onClick={handleBackdropClose}
    >
      <div
        className="image-studio-prompts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-studio-prompts-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="image-studio-quota-modal-close"
          onClick={onClose}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 id="image-studio-prompts-title" className="image-studio-quota-title">
          Idées de prompts
        </h2>

        <div className="image-studio-prompts-list">
          {IMAGE_STUDIO_PROMPT_IDEAS.map((idea) => {
            const isCopied = copiedId === idea.id;
            return (
              <article key={idea.id} className="image-studio-prompt-card">
                <div className="image-studio-prompt-card-head image-studio-prompt-card-head--copy-only">
                  <button
                    type="button"
                    className={`image-studio-prompt-copy-btn${isCopied ? " is-copied" : ""}`}
                    onClick={() => void copyPrompt(idea.id, idea.content)}
                  >
                    {isCopied ? (
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
                <pre className="image-studio-prompt-card-body">{idea.content}</pre>
              </article>
            );
          })}
        </div>

        <p className="image-studio-prompts-modal-foot">
          À copier dans ChatGPT, Claude ou Gemini — complétez Idea, Style, Camera… pour vos
          créations vidéo.
        </p>
      </div>
    </div>,
    document.body,
  );
}
