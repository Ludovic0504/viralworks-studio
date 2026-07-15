import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageUp, SendHorizontal, X } from "lucide-react";
import { promptAssistChatCompletion } from "@/bibliotheque/imageStudio/catalog/glossary/promptAssistChat";
import { buildPromptAssistSystemPrompt } from "@/bibliotheque/imageStudio/catalog/glossary";
import { buildLocalPromptAssistReply } from "@/bibliotheque/imageStudio/catalog/glossary/assembleLocalPrompt";
import {
  PROMPT_ASSIST_MISSING_IMAGE_REPLY,
  shouldAskForMissingReferenceImage,
} from "@/bibliotheque/imageStudio/catalog/glossary/detectMissingReferenceImage";
import { extractPromptFromAssistantText } from "@/bibliotheque/imageStudio/catalog/glossary/parsePromptAssistMessage";
import { readGuideProductImageFile } from "@/bibliotheque/imageStudio/guideProductImage";
import { IMAGE_STUDIO_PRODUCT_MENTION_TOKEN } from "@/bibliotheque/imageStudio/imageStudioGuideApply";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import PromptAssistAssistantContent from "@/composants/image/PromptAssistAssistantContent";
import { useImageStudioChatbotTr } from "@/bibliotheque/i18n/useImageStudioChatbotTr";

function nextMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ConversationBubble({ role, children, imageUrl }) {
  if (role === "bot") {
    return (
      <div className="image-studio-prompt-guide-turn image-studio-prompt-guide-turn--bot">
        <span className="image-studio-prompt-guide-bot-avatar" aria-hidden="true">
          🤖
        </span>
        <div className="image-studio-prompt-guide-bubble image-studio-prompt-guide-bubble--bot image-studio-prompt-guide-bubble--enter">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="image-studio-prompt-guide-turn image-studio-prompt-guide-turn--user">
      <div className="image-studio-prompt-guide-bubble image-studio-prompt-guide-bubble--user image-studio-prompt-guide-bubble--enter">
        {imageUrl ? (
          <div className="image-studio-prompt-assist-message-image">
            <img src={imageUrl} alt="Image jointe" />
          </div>
        ) : null}
        {children ? <p className="image-studio-prompt-assist-message-text">{children}</p> : null}
      </div>
    </div>
  );
}

function TypingIndicator({ typingLabel = "PromptAssist écrit…" }) {
  return (
    <div className="image-studio-prompt-guide-turn image-studio-prompt-guide-turn--bot">
      <span className="image-studio-prompt-guide-bot-avatar" aria-hidden="true">
        🤖
      </span>
      <div
        className="image-studio-prompt-guide-typing image-studio-prompt-guide-bubble--enter"
        aria-label={typingLabel}
        role="status"
      >
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function ensureProductMentionInPrompt(prompt, hasReferenceImage) {
  if (!hasReferenceImage) return prompt;
  const token = IMAGE_STUDIO_PRODUCT_MENTION_TOKEN;
  if (prompt.includes(token)) return prompt;
  return `${prompt} ${token}`;
}

function formatPromptAssistError(error, ui) {
  const message = error instanceof Error ? error.message : "";
  if (/connecté|connecter|authentification|autorisé|401/i.test(message)) {
    return ui("promptAssistLoginRequired", "Connectez-vous pour utiliser le Prompt Assistant.");
  }
  if (/OPENAI|Configuration OpenAI|OPENAI_API_KEY/i.test(message)) {
    return ui(
      "promptAssistUnavailable",
      "Le service IA n'est pas disponible pour le moment. Réessayez plus tard.",
    );
  }
  if (message) {
    return `${ui("promptAssistErrorPrefix", "Une erreur est survenue :")} ${message}`;
  }
  return ui(
    "promptAssistGenericError",
    "Une erreur est survenue. Vérifie ta connexion ou reconnecte-toi.",
  );
}

export default function ModalPromptAssistImageStudio({ open, onClose, onApplyPrompt }) {
  const { ui } = useImageStudioChatbotTr();
  const { runWithAuth } = useRequireAuthAction();
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const imageInputRef = useRef(null);
  const loadingRef = useRef(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attachedImageUrl, setAttachedImageUrl] = useState(null);
  const [imageError, setImageError] = useState(null);

  const systemPrompt = useMemo(() => buildPromptAssistSystemPrompt(), []);

  const latestPrompt = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== "assistant") continue;
      const extracted = extractPromptFromAssistantText(message.content);
      if (extracted) return extracted;
    }
    return null;
  }, [messages]);

  const clearAttachedImage = useCallback(() => {
    setAttachedImageUrl(null);
    setImageError(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (!open) {
      setDraft("");
      setMessages([]);
      setLoading(false);
      loadingRef.current = false;
      clearAttachedImage();
      return;
    }

    setMessages([
      {
        id: nextMessageId(),
        role: "assistant",
        content: ui(
          "promptAssistWelcome",
          "Bonjour ! Décrivez l'image que vous voulez — vous pouvez joindre une photo et utiliser des termes comme croquis, vue plongeante, packshot, UGC, lumière douce… Je traduirai votre demande en prompt précis.",
        ),
      },
    ]);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, clearAttachedImage, ui]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleImagePick = useCallback(async (file) => {
    if (!file) return;
    setImageError(null);
    const result = await readGuideProductImageFile(file);
    if (!result.ok) {
      setImageError(result.error);
      return;
    }
    setAttachedImageUrl(result.dataUrl);
  }, []);

  const handleSend = useCallback(async () => {
    if (loadingRef.current) return;
    const text = draft.trim();
    if (!text && !attachedImageUrl) return;

    const sentImageUrl = attachedImageUrl;
    const userMessage = {
      id: nextMessageId(),
      role: "user",
      content: text || ui("promptAssistImageContext", "Image jointe pour contexte."),
      imageUrl: sentImageUrl ?? undefined,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    clearAttachedImage();

    if (shouldAskForMissingReferenceImage(text, nextMessages, { currentMessageHasImage: Boolean(sentImageUrl) })) {
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId(),
          role: "assistant",
          content: PROMPT_ASSIST_MISSING_IMAGE_REPLY,
        },
      ]);
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    setLoading(true);
    loadingRef.current = true;

    try {
      const reply = await promptAssistChatCompletion(nextMessages, systemPrompt);
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId(),
          role: "assistant",
          content: reply || ui("promptAssistRephrase", "Peux-tu reformuler ta demande ?"),
        },
      ]);
    } catch (error) {
      const localReply = buildLocalPromptAssistReply(text, {
        hasReferenceImage: Boolean(sentImageUrl),
      });
      if (localReply) {
        setMessages((current) => [
          ...current,
          {
            id: nextMessageId(),
            role: "assistant",
            content: localReply,
          },
        ]);
      } else {
        setMessages((current) => [
          ...current,
          {
            id: nextMessageId(),
            role: "assistant",
            content: formatPromptAssistError(error, ui),
          },
        ]);
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [attachedImageUrl, clearAttachedImage, draft, messages, systemPrompt, ui]);

  const send = useCallback(() => {
    void runWithAuth(handleSend);
  }, [runWithAuth, handleSend]);

  const handleApply = useCallback(() => {
    if (!latestPrompt) return;

    const hasReferenceImage = messages.some((message) => Boolean(message.imageUrl));
    const prompt = ensureProductMentionInPrompt(latestPrompt, hasReferenceImage);
    const productImageUrl =
      [...messages].reverse().find((message) => message.imageUrl)?.imageUrl ?? null;

    if (productImageUrl) {
      onApplyPrompt?.({ prompt, productImageUrl });
    } else {
      onApplyPrompt?.(prompt);
    }
    onClose?.();
  }, [latestPrompt, messages, onApplyPrompt, onClose]);

  if (!open) return null;

  const handleBackdropClose = (event) => {
    if (event.target !== event.currentTarget) return;
    event.stopPropagation();
    window.setTimeout(onClose, 0);
  };

  const canSend = Boolean(draft.trim() || attachedImageUrl);

  return createPortal(
    <div
      className="image-studio-prompts-modal-backdrop"
      role="presentation"
      onClick={handleBackdropClose}
    >
      <div
        className="image-studio-prompts-modal image-studio-prompts-modal--chat image-studio-prompts-modal--prompt-assist"
        role="dialog"
        aria-modal="true"
        aria-label="PromptAssist"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          ref={messagesRef}
          className="image-studio-prompt-guide-messages image-studio-prompt-guide-messages--conversation studio-subtle-scrollbar"
        >
          {messages.map((message) => (
            <ConversationBubble
              key={message.id}
              role={message.role === "user" ? "user" : "bot"}
              imageUrl={message.imageUrl}
            >
              {message.role === "assistant" ? (
                <PromptAssistAssistantContent content={message.content} />
              ) : (
                message.content
              )}
            </ConversationBubble>
          ))}
          {loading ? <TypingIndicator typingLabel={ui("promptAssistTyping", "PromptAssist écrit…")} /> : null}
        </div>

        {latestPrompt ? (
          <div className="image-studio-prompt-assist-apply-row">
            <button
              type="button"
              className="image-studio-prompt-guide-apply"
              onClick={handleApply}
            >
              {ui("promptAssistUsePrompt", "Utiliser ce prompt")}
            </button>
          </div>
        ) : null}

        <div className="image-studio-prompt-assist-compose-wrap">
          {attachedImageUrl ? (
            <div className="image-studio-prompt-assist-attach-preview">
              <div className="image-studio-prompt-assist-attach-thumb">
                <img src={attachedImageUrl} alt={ui("promptAssistAttachedPreview", "Aperçu de l'image jointe")} />
              </div>
              <span className="image-studio-prompt-assist-attach-label">
                {ui("promptAssistAttachLabel", "Image jointe")}
              </span>
              <button
                type="button"
                className="image-studio-prompt-assist-attach-remove"
                onClick={clearAttachedImage}
                aria-label={ui("promptAssistRemoveImage", "Retirer l'image")}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            </div>
          ) : null}

          {imageError ? (
            <p className="image-studio-prompt-assist-attach-error" role="alert">
              {imageError}
            </p>
          ) : null}

          <form
            className="image-studio-prompt-guide-compose image-studio-prompt-assist-compose"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="hidden"
              aria-hidden
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void handleImagePick(file);
              }}
            />
            <button
              type="button"
              className="image-studio-prompt-assist-attach-btn"
              onClick={() => imageInputRef.current?.click()}
              disabled={loading}
              aria-label={ui("promptAssistAttachAria", "Joindre une image")}
              title={ui("promptAssistAttachTitle", "Joindre une image")}
            >
              <ImageUp className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={ui("promptAssistPlaceholder", "Décrivez ce que vous voulez créer…")}
              className="image-studio-prompt-guide-input"
              aria-label={ui("yourMessage", "Votre message")}
              disabled={loading}
            />
            <button
              type="submit"
              className="image-studio-prompt-guide-send"
              disabled={loading || !canSend}
              aria-label={ui("send", "Envoyer")}
            >
              <SendHorizontal className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
