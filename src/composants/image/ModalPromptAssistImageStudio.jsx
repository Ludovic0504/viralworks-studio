import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SendHorizontal } from "lucide-react";
import { anthropicMessages } from "@/bibliotheque/anthropic/anthropicMessages";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";

function nextMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ConversationBubble({ role, children }) {
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
        {children}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="image-studio-prompt-guide-turn image-studio-prompt-guide-turn--bot">
      <span className="image-studio-prompt-guide-bot-avatar" aria-hidden="true">
        🤖
      </span>
      <div
        className="image-studio-prompt-guide-typing image-studio-prompt-guide-bubble--enter"
        aria-label="PromptAssist écrit…"
        role="status"
      >
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function extractPromptFromAssistantText(text) {
  const tagged = text.match(/<prompt>([\s\S]*?)<\/prompt>/i);
  if (tagged?.[1]?.trim()) return tagged[1].trim();
  return null;
}

export default function ModalPromptAssistImageStudio({ open, onClose, onApplyPrompt }) {
  const { runWithAuth } = useRequireAuthAction();
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const loadingRef = useRef(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const systemPrompt = useMemo(
    () => `Tu es PromptAssist, l'assistant Image Studio de ViralWorks Studio.
L'utilisateur décrit l'image qu'il souhaite générer. Pose des questions courtes et utiles (style, cadrage, lumière, ambiance, produit) pour affiner sa demande.
Quand tu as assez d'informations, propose un prompt final en anglais, optimisé pour la génération d'image IA.
Réponds en français, sauf le prompt final qui doit être en anglais.
Entoure le prompt final de balises <prompt>...</prompt>.
Reste concis : 2-3 phrases max par message.`,
    [],
  );

  const latestPrompt = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== "assistant") continue;
      const extracted = extractPromptFromAssistantText(message.content);
      if (extracted) return extracted;
    }
    return null;
  }, [messages]);

  useEffect(() => {
    if (!open) {
      setDraft("");
      setMessages([]);
      setLoading(false);
      loadingRef.current = false;
      return;
    }

    setMessages([
      {
        id: nextMessageId(),
        role: "assistant",
        content:
          "Bonjour ! Que souhaitez-vous créer aujourd'hui ? Décrivez votre idée en quelques mots.",
      },
    ]);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

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

  const handleSend = useCallback(async () => {
    if (loadingRef.current) return;
    const text = draft.trim();
    if (!text) return;

    const userMessage = { id: nextMessageId(), role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setLoading(true);
    loadingRef.current = true;

    try {
      const reply = await anthropicMessages({
        system: systemPrompt,
        messages: nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        max_tokens: 900,
        model: "claude-sonnet-4-20250514",
      });
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId(),
          role: "assistant",
          content: reply || "Peux-tu reformuler ta demande ?",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId(),
          role: "assistant",
          content: "Une erreur est survenue. Vérifie ta connexion ou reconnecte-toi.",
        },
      ]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [draft, messages, systemPrompt]);

  const send = useCallback(() => {
    void runWithAuth(handleSend);
  }, [runWithAuth, handleSend]);

  const handleApply = useCallback(() => {
    if (!latestPrompt) return;
    onApplyPrompt?.(latestPrompt);
    onClose?.();
  }, [latestPrompt, onApplyPrompt, onClose]);

  if (!open) return null;

  const handleBackdropClose = (event) => {
    if (event.target !== event.currentTarget) return;
    event.stopPropagation();
    window.setTimeout(onClose, 0);
  };

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
            <ConversationBubble key={message.id} role={message.role === "user" ? "user" : "bot"}>
              {message.content}
            </ConversationBubble>
          ))}
          {loading ? <TypingIndicator /> : null}
        </div>

        {latestPrompt ? (
          <div className="image-studio-prompt-assist-apply-row">
            <button
              type="button"
              className="image-studio-prompt-guide-apply"
              onClick={handleApply}
            >
              Utiliser ce prompt
            </button>
          </div>
        ) : null}

        <form
          className="image-studio-prompt-guide-compose"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Décrivez ce que vous voulez créer…"
            className="image-studio-prompt-guide-input"
            aria-label="Votre message"
            disabled={loading}
          />
          <button
            type="submit"
            className="image-studio-prompt-guide-send"
            disabled={loading || !draft.trim()}
            aria-label="Envoyer"
          >
            <SendHorizontal className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
