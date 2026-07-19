import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageUp, SendHorizontal, X } from "lucide-react";
import {
  IMAGE_STUDIO_PROMPT_TEMPLATES,
} from "@/bibliotheque/imageStudio/promptTemplates";
import { readGuideProductImageFile } from "@/bibliotheque/imageStudio/guideProductImage";
import {
  addClothingTextRef,
  analyzeClothingRef,
  analyzePersonFromImage,
  applyClothingPieceType,
  applyFullOutfitScope,
  applyPersonFallbackDetails,
  applyPersonFallbackGender,
  applyPersonTraits,
  beginClothingImageRef,
  buildClothingDecision,
  buildPersonTraitsFromFallback,
  canAddMoreClothingRefs,
  chooseAddMoreClothing,
  chooseChangeOutfit,
  chooseKeepOutfit,
  chooseRestRandom,
  clothingRefsRemaining,
  createInitialClothingInterviewState,
  pieceTypeLabel,
  requestPieceTypeFallback,
} from "@/bibliotheque/imageStudio/promptFromImage";
import { useImageStudioChatbotTr } from "@/bibliotheque/i18n/useImageStudioChatbotTr";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";

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
            <img src={imageUrl} alt="" />
          </div>
        ) : null}
        {children ? <p className="image-studio-prompt-assist-message-text">{children}</p> : null}
      </div>
    </div>
  );
}

function OptionRow({ children }) {
  return <div className="image-studio-prompt-ugc-option-row">{children}</div>;
}

function OptionButton({ selected, disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`studio-toolbar-btn image-studio-prompt-guide-elements-btn image-studio-prompt-ugc-option-btn${
        selected ? " is-selected" : ""
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * Parcours Assistant quand on part d’un @Avatar projet (nom interne : Prompt depuis image).
 */
export default function PromptFromImageAssistChat({
  avatarUrl,
  onComplete,
  onClose,
  preselectedTemplate = null,
  embedded = false,
}) {
  const { ui, template: localizeTemplate, locale } = useImageStudioChatbotTr();
  const { runWithAuth } = useRequireAuthAction();
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const imageInputRef = useRef(null);
  const analysisStartedRef = useRef(false);
  const completedRef = useRef(false);

  const [interview, setInterview] = useState(() => createInitialClothingInterviewState());
  const [draft, setDraft] = useState("");
  const [attachedImageUrl, setAttachedImageUrl] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);

  const templates = useMemo(
    () =>
      preselectedTemplate
        ? []
        : IMAGE_STUDIO_PROMPT_TEMPLATES.map((item) => localizeTemplate(item)),
    [localizeTemplate, locale, preselectedTemplate],
  );

  const pushBot = useCallback((text) => {
    setLog((prev) => [...prev, { id: nextMessageId(), role: "bot", text }]);
  }, []);

  const pushUser = useCallback((text, imageUrl = null) => {
    setLog((prev) => [
      ...prev,
      { id: nextMessageId(), role: "user", text, imageUrl: imageUrl || undefined },
    ]);
  }, []);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [log, interview.step, busy]);

  useEffect(() => {
    if (!avatarUrl || analysisStartedRef.current) return;
    analysisStartedRef.current = true;

    setLog([
      {
        id: nextMessageId(),
        role: "bot",
        text: ui(
          "fromImageWelcome",
          "On part de ton avatar. J’analyse la personne sur l’image…",
        ),
        avatarPreview: avatarUrl,
      },
    ]);
    setBusy(true);

    void (async () => {
      try {
        const traits = await analyzePersonFromImage(avatarUrl);
        setInterview((s) => applyPersonTraits(s, traits));
        pushBot(
          ui(
            "fromImageKeepOrChange",
            "Tu veux garder les habits de cette image, ou en changer ?",
          ),
        );
      } catch {
        setInterview((s) => ({ ...s, step: "fallback_gender" }));
        pushBot(
          ui(
            "fromImageGenderFallback",
            "Je n’ai pas pu tout lire sur l’image. C’est un homme ou une femme ?",
          ),
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [avatarUrl, pushBot, ui]);

  const clearAttached = useCallback(() => {
    setAttachedImageUrl(null);
    setImageError(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }, []);

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

  const finishToContext = useCallback(
    (state) => ({
      avatarUrl,
      source: "project",
      personTraits: state.personTraits,
      clothing: buildClothingDecision(state),
    }),
    [avatarUrl],
  );

  const completeInterview = useCallback(
    (state) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const ctx = finishToContext(state);
      onComplete?.(ctx, preselectedTemplate || null);
    },
    [finishToContext, onComplete, preselectedTemplate],
  );

  useEffect(() => {
    if (!preselectedTemplate) return;
    if (interview.step !== "pick_chatbot") return;
    if (busy) return;
    completeInterview(interview);
  }, [busy, completeInterview, interview, preselectedTemplate]);

  const handleKeep = useCallback(() => {
    if (busy) return;
    pushUser(ui("fromImageKeepLabel", "Garder les habits"));
    setInterview((s) => {
      const next = chooseKeepOutfit(s);
      if (preselectedTemplate) {
        window.setTimeout(() => completeInterview(next), 0);
      }
      return next;
    });
    if (!preselectedTemplate) {
      pushBot(ui("fromImagePickType", "Parfait. Quel type d’image veux-tu créer ?"));
    }
  }, [busy, completeInterview, preselectedTemplate, pushBot, pushUser, ui]);

  const handleChange = useCallback(() => {
    if (busy) return;
    pushUser(ui("fromImageChangeLabel", "Changer les habits"));
    setInterview((s) => chooseChangeOutfit(s));
    pushBot(
      ui(
        "fromImageDescribeClothes",
        "Décris les habits voulus, ou joins une image de référence (max 4).",
      ),
    );
  }, [busy, pushBot, pushUser, ui]);

  const processClothingImage = useCallback(
    async (imageUrl) => {
      pushUser(ui("fromImageClothingRefAttached", "Image de référence vêtement"), imageUrl);
      setInterview((s) => beginClothingImageRef(s, imageUrl));
      setBusy(true);
      clearAttached();
      try {
        const pieceType = await analyzeClothingRef(imageUrl);
        if (pieceType === "tenue_entiere") {
          setInterview((s) => applyClothingPieceType(s, pieceType));
          pushBot(
            ui(
              "fromImageFullOutfitAsk",
              "Cette image montre une tenue entière. Tu veux un vêtement précis dessus, ou toute la tenue ?",
            ),
          );
        } else {
          setInterview((s) => applyClothingPieceType(s, pieceType));
          pushBot(
            ui(
              "fromImagePieceDetected",
              `J’ai détecté ${pieceTypeLabel(pieceType)}. Pour le reste de la tenue ?`,
            ),
          );
        }
      } catch {
        setInterview((s) => requestPieceTypeFallback(s));
        pushBot(
          ui(
            "fromImagePieceFallback",
            "Je n’ai pas pu détecter le type. C’est un haut, un bas, des chaussures, ou une tenue entière ?",
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [clearAttached, pushBot, pushUser, ui],
  );

  const handleGenderFallback = useCallback(
    (gender) => {
      if (busy) return;
      pushUser(gender === "homme" ? "Homme" : "Femme");
      setInterview((s) => applyPersonFallbackGender(s, gender));
      pushBot(
        ui(
          "fromImageAgeColorsFallback",
          "Indique un âge approximatif et la couleur / apparence (ex. 25-30, cheveux bruns, teint clair).",
        ),
      );
    },
    [busy, pushBot, pushUser, ui],
  );

  const handlePieceTypeFallback = useCallback(
    (pieceType) => {
      if (busy) return;
      pushUser(pieceTypeLabel(pieceType));
      setInterview((s) => {
        const next = applyClothingPieceType(s, pieceType);
        if (pieceType === "tenue_entiere") {
          pushBot(
            ui(
              "fromImageFullOutfitAsk",
              "Tu veux un vêtement précis sur cette image, ou toute la tenue ?",
            ),
          );
        } else {
          pushBot(
            ui("fromImageRestAsk", "Pour le reste de la tenue : au hasard, ou une autre référence ?"),
          );
        }
        return next;
      });
    },
    [busy, pushBot, pushUser, ui],
  );

  const handleFullOutfitScope = useCallback(
    (scope) => {
      if (busy) return;
      pushUser(
        scope === "full_outfit"
          ? ui("fromImageFullOutfit", "Toute la tenue")
          : ui("fromImageOnePiece", "Un vêtement précis"),
      );
      setInterview((s) => applyFullOutfitScope(s, scope));
      pushBot(
        ui("fromImageRestAsk", "Pour le reste de la tenue : au hasard, ou une autre référence ?"),
      );
    },
    [busy, pushBot, pushUser, ui],
  );

  const handleRestRandom = useCallback(() => {
    if (busy) return;
    pushUser(ui("fromImageRestRandom", "Le reste au hasard"));
    setInterview((s) => {
      const next = chooseRestRandom(s);
      if (preselectedTemplate) {
        window.setTimeout(() => completeInterview(next), 0);
      }
      return next;
    });
    if (!preselectedTemplate) {
      pushBot(ui("fromImagePickType", "Parfait. Quel type d’image veux-tu créer ?"));
    }
  }, [busy, completeInterview, preselectedTemplate, pushBot, pushUser, ui]);

  const handleRestMore = useCallback(() => {
    if (busy) return;
    setInterview((s) => {
      if (!canAddMoreClothingRefs(s)) {
        pushUser(ui("fromImageRestDone", "C’est bon"));
        const next = { ...chooseRestRandom(s), restRandom: false, step: "pick_chatbot" };
        if (preselectedTemplate) {
          window.setTimeout(() => completeInterview(next), 0);
        } else {
          pushBot(ui("fromImagePickType", "Parfait. Quel type d’image veux-tu créer ?"));
        }
        return next;
      }
      pushUser(ui("fromImageRestMore", "Autre référence"));
      pushBot(
        ui(
          "fromImageDescribeClothesMore",
          `Encore ${clothingRefsRemaining(s)} référence(s) possible(s). Texte ou image.`,
        ),
      );
      return chooseAddMoreClothing(s);
    });
  }, [busy, completeInterview, preselectedTemplate, pushBot, pushUser, ui]);

  const handleSend = useCallback(async () => {
    if (busy) return;
    const text = draft.trim();
    const imageUrl = attachedImageUrl;

    if (interview.step === "fallback_age_colors") {
      if (!text) return;
      pushUser(text);
      setDraft("");
      setInterview((s) =>
        applyPersonFallbackDetails(s, text, text, buildPersonTraitsFromFallback),
      );
      pushBot(
        ui(
          "fromImageKeepOrChange",
          "Tu veux garder les habits de cette image, ou en changer ?",
        ),
      );
      return;
    }

    if (interview.step === "await_clothing_input") {
      if (imageUrl) {
        setDraft("");
        await processClothingImage(imageUrl);
        return;
      }
      if (!text) return;
      pushUser(text);
      setDraft("");
      setInterview((s) => {
        const next = addClothingTextRef(s, text);
        if (next.step === "pick_chatbot") {
          if (preselectedTemplate) {
            window.setTimeout(() => completeInterview(next), 0);
          } else {
            pushBot(ui("fromImagePickType", "Parfait. Quel type d’image veux-tu créer ?"));
          }
        } else {
          pushBot(
            ui("fromImageRestAsk", "Pour le reste de la tenue : au hasard, ou une autre référence ?"),
          );
        }
        return next;
      });
      return;
    }
  }, [
    attachedImageUrl,
    busy,
    completeInterview,
    draft,
    interview.step,
    preselectedTemplate,
    processClothingImage,
    pushBot,
    pushUser,
    ui,
  ]);

  const send = useCallback(() => {
    void runWithAuth(handleSend);
  }, [runWithAuth, handleSend]);

  const handlePickTemplate = useCallback(
    (template) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const ctx = finishToContext(interview);
      onComplete?.(ctx, template);
    },
    [finishToContext, interview, onComplete],
  );

  const showCompose =
    interview.step === "await_clothing_input" || interview.step === "fallback_age_colors";
  const canSend = Boolean(draft.trim() || (interview.step === "await_clothing_input" && attachedImageUrl));

  return (
    <div
      className={
        embedded
          ? "image-studio-prompt-from-image-embedded-chat"
          : "image-studio-prompts-modal image-studio-prompts-modal--chat image-studio-prompts-modal--prompt-assist"
      }
    >
      <div
        ref={messagesRef}
        className="image-studio-prompt-guide-messages image-studio-prompt-guide-messages--conversation studio-subtle-scrollbar"
      >
        {log.map((entry) => (
          <ConversationBubble
            key={entry.id}
            role={entry.role === "user" ? "user" : "bot"}
            imageUrl={entry.imageUrl}
          >
            {entry.avatarPreview ? (
              <div className="image-studio-prompt-from-image-avatar-row">
                <div className="image-studio-prompt-from-image-avatar-thumb">
                  <img src={entry.avatarPreview} alt="" />
                </div>
                <p className="image-studio-prompt-assist-message-text">{entry.text}</p>
              </div>
            ) : (
              <p className="image-studio-prompt-assist-message-text">{entry.text}</p>
            )}
          </ConversationBubble>
        ))}

        {busy ? (
          <div className="image-studio-prompt-guide-turn image-studio-prompt-guide-turn--bot">
            <span className="image-studio-prompt-guide-bot-avatar" aria-hidden="true">
              🤖
            </span>
            <div
              className="image-studio-prompt-guide-typing image-studio-prompt-guide-bubble--enter"
              role="status"
              aria-label={ui("promptAssistTyping", "PromptAssist écrit…")}
            >
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}

        {interview.step === "fallback_gender" && !busy ? (
          <ConversationBubble role="bot">
            <OptionRow>
              <OptionButton onClick={() => handleGenderFallback("homme")}>Homme</OptionButton>
              <OptionButton onClick={() => handleGenderFallback("femme")}>Femme</OptionButton>
            </OptionRow>
          </ConversationBubble>
        ) : null}

        {interview.step === "keep_or_change" && !busy ? (
          <ConversationBubble role="bot">
            <OptionRow>
              <OptionButton onClick={handleKeep}>
                {ui("fromImageKeepLabel", "Garder les habits")}
              </OptionButton>
              <OptionButton onClick={handleChange}>
                {ui("fromImageChangeLabel", "Changer les habits")}
              </OptionButton>
            </OptionRow>
          </ConversationBubble>
        ) : null}

        {interview.step === "fallback_piece_type" && !busy ? (
          <ConversationBubble role="bot">
            <OptionRow>
              {(
                [
                  ["haut", "Haut"],
                  ["bas", "Bas"],
                  ["chaussures", "Chaussures"],
                  ["tenue_entiere", "Tenue entière"],
                ]
              ).map(([id, label]) => (
                <OptionButton key={id} onClick={() => handlePieceTypeFallback(id)}>
                  {label}
                </OptionButton>
              ))}
            </OptionRow>
          </ConversationBubble>
        ) : null}

        {interview.step === "full_outfit_scope" && !busy ? (
          <ConversationBubble role="bot">
            <OptionRow>
              <OptionButton onClick={() => handleFullOutfitScope("piece")}>
                {ui("fromImageOnePiece", "Un vêtement précis")}
              </OptionButton>
              <OptionButton onClick={() => handleFullOutfitScope("full_outfit")}>
                {ui("fromImageFullOutfit", "Toute la tenue")}
              </OptionButton>
            </OptionRow>
          </ConversationBubble>
        ) : null}

        {interview.step === "rest_of_outfit" && !busy ? (
          <ConversationBubble role="bot">
            <OptionRow>
              <OptionButton onClick={handleRestRandom}>
                {ui("fromImageRestRandom", "Le reste au hasard")}
              </OptionButton>
              {canAddMoreClothingRefs(interview) ? (
                <OptionButton onClick={handleRestMore}>
                  {ui("fromImageRestMore", "Autre référence")}
                </OptionButton>
              ) : null}
            </OptionRow>
          </ConversationBubble>
        ) : null}

        {interview.step === "pick_chatbot" && !busy && !preselectedTemplate ? (
          <ConversationBubble role="bot">
            <div className="image-studio-prompt-from-image-template-grid" role="list">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="image-studio-prompt-from-image-template-btn"
                  onClick={() => handlePickTemplate(template)}
                >
                  {template.heroImage ? (
                    <img src={template.heroImage} alt="" className="image-studio-prompt-from-image-template-img" />
                  ) : null}
                  <span>{template.label}</span>
                </button>
              ))}
            </div>
          </ConversationBubble>
        ) : null}
      </div>

      {showCompose ? (
        <div className="image-studio-prompt-assist-compose-wrap">
          {attachedImageUrl ? (
            <div className="image-studio-prompt-assist-attach-preview">
              <div className="image-studio-prompt-assist-attach-thumb">
                <img src={attachedImageUrl} alt="" />
              </div>
              <span className="image-studio-prompt-assist-attach-label">
                {ui("promptAssistAttachLabel", "Image jointe")}
              </span>
              <button
                type="button"
                className="image-studio-prompt-assist-attach-remove"
                onClick={clearAttached}
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
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            {interview.step === "await_clothing_input" ? (
              <>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  aria-hidden
                  tabIndex={-1}
                  onChange={(e) => {
                    void handleImagePick(e.target.files?.[0] ?? null);
                  }}
                />
                <button
                  type="button"
                  className="image-studio-prompt-assist-attach-btn"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={busy}
                  aria-label={ui("promptAssistAttachAria", "Joindre une image")}
                >
                  <ImageUp className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </>
            ) : null}
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                interview.step === "fallback_age_colors"
                  ? ui("fromImageAgeColorsPlaceholder", "Ex. 25-30, cheveux bruns…")
                  : ui("fromImageClothesPlaceholder", "Décris les habits ou joins une image…")
              }
              className="image-studio-prompt-guide-input"
              disabled={busy}
            />
            <button
              type="submit"
              className="image-studio-prompt-guide-send"
              disabled={busy || !canSend}
              aria-label={ui("send", "Envoyer")}
            >
              <SendHorizontal className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </form>
        </div>
      ) : null}

      {!embedded ? (
        <button
          type="button"
          className="image-studio-prompt-from-image-close"
          onClick={onClose}
          aria-label={ui("close", "Fermer")}
        >
          <X className="h-4 w-4" strokeWidth={2.25} />
        </button>
      ) : null}
    </div>
  );
}
