import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Package,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import {
  assemblePromptFromTemplate,
  extractSlotsFromMessage,
  fillTemplateSlotDefaults,
  isWeakRequiredSlot,
  mergeTemplateSlots,
  summarizeFilledSlots,
} from "@/bibliotheque/imageStudio/promptTemplateEngine";
import { IMAGE_STUDIO_PROMPT_TEMPLATES } from "@/bibliotheque/imageStudio/promptTemplates";

const PREVIEW_PREF_KEY = "image_studio_prompt_guide_preview";

/** @typedef {{ id: string, role: 'bot' | 'user', text: string }} ChatMessage */

function readPreviewPreference() {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(PREVIEW_PREF_KEY);
    if (raw === "0") return false;
    return true;
  } catch {
    return true;
  }
}

function writePreviewPreference(show) {
  try {
    window.localStorage.setItem(PREVIEW_PREF_KEY, show ? "1" : "0");
  } catch {
    // ignore
  }
}

function nextMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function TemplateIcon({ icon, className = "" }) {
  if (icon === "product") {
    return <Package className={className} strokeWidth={2} aria-hidden />;
  }
  return <Sparkles className={className} strokeWidth={2} aria-hidden />;
}

function PromptTemplateChat({
  template,
  onBack,
  onApplyPrompt,
  onClose,
}) {
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [messages, setMessages] = useState(() => [
    { id: nextMessageId(), role: "bot", text: template.botIntro },
  ]);
  const [slots, setSlots] = useState({});
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(() => readPreviewPreference());
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [showPreviewPref, setShowPreviewPref] = useState(() => readPreviewPreference());

  const filledSlots = useMemo(
    () => fillTemplateSlotDefaults(template, slots),
    [template, slots],
  );

  const assembledPrompt = useMemo(
    () => (ready ? assemblePromptFromTemplate(template, slots) : ""),
    [ready, template, slots],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, ready, previewOpen, adjustOpen]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const pushMessage = useCallback((role, text) => {
    setMessages((prev) => [...prev, { id: nextMessageId(), role, text }]);
  }, []);

  const processUserMessage = useCallback(
    (rawMessage) => {
      const text = rawMessage.trim();
      if (!text) return;

      pushMessage("user", text);
      setDraft("");

      const extracted = extractSlotsFromMessage(text, template);
      const merged = mergeTemplateSlots(slots, extracted);
      setSlots(merged);

      if (isWeakRequiredSlot(template, merged)) {
        setReady(false);
        pushMessage("bot", template.botAskRequired);
        return;
      }

      setReady(true);
      const summary = summarizeFilledSlots(template, merged);
      pushMessage("bot", `${template.botReady}\n\n${summary}`);
    },
    [pushMessage, slots, template],
  );

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      processUserMessage(draft);
    },
    [draft, processUserMessage],
  );

  const handleSlotChange = useCallback((key, value) => {
    setSlots((prev) => {
      const next = { ...prev, [key]: value };
      setReady(!isWeakRequiredSlot(template, next));
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    if (!assembledPrompt) return;
    onApplyPrompt(assembledPrompt);
    onClose();
  }, [assembledPrompt, onApplyPrompt, onClose]);

  const togglePreviewPref = useCallback(() => {
    setShowPreviewPref((current) => {
      const next = !current;
      writePreviewPreference(next);
      setPreviewOpen(next);
      return next;
    });
  }, []);

  return (
    <div className="image-studio-prompt-guide-chat">
      <div className="image-studio-prompt-guide-chat-head">
        <button
          type="button"
          className="image-studio-prompt-guide-back"
          onClick={onBack}
          aria-label="Retour aux modèles"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <div className="image-studio-prompt-guide-chat-title-wrap">
          <TemplateIcon icon={template.icon} className="image-studio-prompt-guide-chat-icon" />
          <div>
            <p className="image-studio-prompt-guide-chat-title">{template.label}</p>
            <p className="image-studio-prompt-guide-chat-sub">Guide sans IA — remplissage automatique</p>
          </div>
        </div>
        <button
          type="button"
          className="image-studio-quota-modal-close"
          onClick={onClose}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="image-studio-prompt-guide-messages studio-subtle-scrollbar" role="log" aria-live="polite">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`image-studio-prompt-guide-bubble image-studio-prompt-guide-bubble--${message.role}`}
          >
            {message.role === "bot" ? (
              <span className="image-studio-prompt-guide-bubble-label">
                <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden />
                Guide
              </span>
            ) : null}
            <p className="image-studio-prompt-guide-bubble-text">{message.text}</p>
          </div>
        ))}

        {ready ? (
          <div className="image-studio-prompt-guide-result">
            <button
              type="button"
              className="image-studio-prompt-guide-preview-toggle"
              onClick={() => setPreviewOpen((open) => !open)}
              aria-expanded={previewOpen}
            >
              <span>Aperçu du prompt complet</span>
              {previewOpen ? (
                <ChevronUp className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              )}
            </button>
            {previewOpen ? (
              <pre className="image-studio-prompt-card-body image-studio-prompt-guide-preview-body">
                {assembledPrompt}
              </pre>
            ) : null}

            <button
              type="button"
              className="image-studio-prompt-guide-adjust-toggle"
              onClick={() => setAdjustOpen((open) => !open)}
              aria-expanded={adjustOpen}
            >
              Ajuster les champs
              {adjustOpen ? (
                <ChevronUp className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              )}
            </button>

            {adjustOpen ? (
              <div className="image-studio-prompt-guide-fields">
                {template.variables.map((variable) => (
                  <label key={variable.key} className="image-studio-prompt-guide-field">
                    <span>{variable.label}</span>
                    <input
                      type="text"
                      value={filledSlots[variable.key] ?? ""}
                      placeholder={variable.placeholder}
                      onChange={(event) => handleSlotChange(variable.key, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <div className="image-studio-prompt-guide-footer">
        <label className="image-studio-prompt-guide-pref">
          <input
            type="checkbox"
            checked={showPreviewPref}
            onChange={togglePreviewPref}
          />
          Toujours montrer l&apos;aperçu avant application
        </label>

        {ready ? (
          <button
            type="button"
            className="image-studio-prompt-guide-apply btn-vws-primary"
            onClick={handleApply}
          >
            Appliquer au prompt
          </button>
        ) : null}

        <form className="image-studio-prompt-guide-compose" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Décrivez la boisson…"
            className="image-studio-prompt-guide-input"
            aria-label="Votre message"
          />
          <button
            type="submit"
            className="image-studio-prompt-guide-send"
            disabled={!draft.trim()}
            aria-label="Envoyer"
          >
            <SendHorizontal className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ModalPromptsImageStudio({ open, onClose, onApplyPrompt }) {
  const [view, setView] = useState("hub");
  const [activeTemplate, setActiveTemplate] = useState(null);

  useEffect(() => {
    if (!open) {
      setView("hub");
      setActiveTemplate(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const openTemplate = useCallback((template) => {
    setActiveTemplate(template);
    setView("chat");
  }, []);

  const handleBack = useCallback(() => {
    setView("hub");
    setActiveTemplate(null);
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
        className={`image-studio-prompts-modal${view === "chat" ? " image-studio-prompts-modal--chat" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-studio-prompts-title"
        onClick={(e) => e.stopPropagation()}
      >
        {view === "hub" ? (
          <>
            <button
              type="button"
              className="image-studio-quota-modal-close"
              onClick={onClose}
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 id="image-studio-prompts-title" className="image-studio-quota-title">
              Guides prompt
            </h2>

            <div className="image-studio-prompts-list image-studio-prompt-templates-grid">
              {IMAGE_STUDIO_PROMPT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="image-studio-prompt-template-tile"
                  onClick={() => openTemplate(template)}
                  aria-label={`Ouvrir le guide ${template.label}`}
                >
                  {template.heroImage ? (
                    <img
                      src={template.heroImage}
                      alt=""
                      className="image-studio-prompt-template-tile-img"
                    />
                  ) : null}
                  <span className="image-studio-prompt-template-tile-label">{template.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : activeTemplate ? (
          <PromptTemplateChat
            template={activeTemplate}
            onBack={handleBack}
            onApplyPrompt={onApplyPrompt}
            onClose={onClose}
          />
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
