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
  buildCustomFlavorElements,
  extractBeverageSlotsFromFirstMessage,
  extractDrinkSlotsFromMessage,
  extractSlotsFromMessage,
  fillTemplateSlotDefaults,
  isBeverageGuideReady,
  isWeakRequiredSlot,
  mergeTemplateSlots,
  parseElementsModeChoice,
  resolveReferenceFlavorElements,
} from "@/bibliotheque/imageStudio/promptTemplateEngine";
import {
  ALL_PRODUCT_PHOTOGRAPHY_SHOT_STYLES,
  IMAGE_STUDIO_PROMPT_TEMPLATES,
  PRODUCT_PHOTOGRAPHY_SHOT_STYLES,
  PRODUCT_PHOTOGRAPHY_SHOT_STYLES_EXTENDED,
} from "@/bibliotheque/imageStudio/promptTemplates";

/** @typedef {'drink' | 'elements_mode' | 'custom_elements' | 'ready'} BeverageGuideStep */

/** @typedef {{ id: string, role: 'bot' | 'user', text: string }} ChatMessage */

function nextMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function TemplateIcon({ icon, className = "" }) {
  if (icon === "product") {
    return <Package className={className} strokeWidth={2} aria-hidden />;
  }
  return <Sparkles className={className} strokeWidth={2} aria-hidden />;
}

function ProductShotStyleGrid({ styles, selectedId, onSelect, locked = false }) {
  return (
    <div
      className={`image-studio-prompt-shot-grid${locked ? " image-studio-prompt-shot-grid--locked" : ""}`}
      role="radiogroup"
      aria-label="Style de shot"
    >
      {styles.map((style) => {
        const selected = selectedId === style.id;
        return (
          <button
            key={style.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={locked}
            className={`image-studio-prompt-shot-tile${selected ? " is-selected" : ""}${
              locked ? " is-locked" : ""
            }`}
            onClick={() => onSelect(style.id)}
          >
            <img
              src={style.image}
              alt=""
              className="image-studio-prompt-shot-tile-img"
            />
            <span className="image-studio-prompt-shot-tile-label">{style.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ConversationBubble({ role, children, wide = false, visible = true }) {
  if (!visible) return null;

  if (role === "bot") {
    return (
      <div className="image-studio-prompt-guide-turn image-studio-prompt-guide-turn--bot">
        <span className="image-studio-prompt-guide-bot-avatar" aria-hidden="true">
          🤖
        </span>
        <div
          className={`image-studio-prompt-guide-bubble image-studio-prompt-guide-bubble--${role} image-studio-prompt-guide-bubble--enter${
            wide ? " image-studio-prompt-guide-bubble--wide" : ""
          }`}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="image-studio-prompt-guide-turn image-studio-prompt-guide-turn--user">
      <div
        className={`image-studio-prompt-guide-bubble image-studio-prompt-guide-bubble--${role} image-studio-prompt-guide-bubble--enter${
          wide ? " image-studio-prompt-guide-bubble--wide" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function TypingIndicator({ visible = true }) {
  if (!visible) return null;

  return (
    <div className="image-studio-prompt-guide-turn image-studio-prompt-guide-turn--bot">
      <span className="image-studio-prompt-guide-bot-avatar" aria-hidden="true">
        🤖
      </span>
      <div
        className="image-studio-prompt-guide-typing image-studio-prompt-guide-bubble--enter"
        aria-label="Le guide écrit…"
        role="status"
      >
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

const BOT_TYPING_DELAY_MS = 520;

function useConversationBotVisibility(botTurnKeys) {
  const keysSignature = botTurnKeys.join("\0");
  const [visibleKeys, setVisibleKeys] = useState(() => new Set());
  const [isTyping, setIsTyping] = useState(false);
  const shownRef = useRef(new Set());
  const timerRef = useRef(null);

  useEffect(() => {
    const pending = botTurnKeys.find((key) => !shownRef.current.has(key));
    if (!pending) {
      setIsTyping(false);
      return undefined;
    }

    setIsTyping(true);
    timerRef.current = window.setTimeout(() => {
      shownRef.current.add(pending);
      setVisibleKeys(new Set(shownRef.current));
    }, BOT_TYPING_DELAY_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [botTurnKeys, keysSignature, visibleKeys]);

  const isBotVisible = useCallback((key) => visibleKeys.has(key), [visibleKeys]);

  return { isBotVisible, isTyping };
}

function PromptTemplateChat({
  template,
  onBack,
  onApplyPrompt,
  onClose,
}) {
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const isBeverageGuide = template.extractorId === "beverage-hero";
  const showShotStylePicker = template.id === "product-photography";

  const [messages, setMessages] = useState(() =>
    template.id === "product-photography"
      ? []
      : [{ id: nextMessageId(), role: "bot", text: template.botIntro }],
  );
  const [slots, setSlots] = useState({});
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(
    /** @type {BeverageGuideStep} */ ("drink"),
  );
  const [selectedShotId, setSelectedShotId] = useState(null);
  const [selectedFromExtended, setSelectedFromExtended] = useState(false);
  const [moreStylesExpanded, setMoreStylesExpanded] = useState(false);
  const [moreStylesDismissed, setMoreStylesDismissed] = useState(false);
  const [shotStyleError, setShotStyleError] = useState(false);

  const selectedShot = useMemo(
    () => ALL_PRODUCT_PHOTOGRAPHY_SHOT_STYLES.find((style) => style.id === selectedShotId) ?? null,
    [selectedShotId],
  );

  const showPrimaryShotGrid =
    !selectedShotId || selectedFromExtended;
  const showExtendedShotGrid = moreStylesExpanded && (!selectedShotId || selectedFromExtended);
  const showMoreStylesPrompt = !selectedShotId && !moreStylesDismissed;
  const shotGridsLocked = Boolean(selectedShotId && selectedFromExtended);

  const filledSlots = useMemo(
    () => fillTemplateSlotDefaults(template, slots),
    [template, slots],
  );

  const assembledPrompt = useMemo(
    () => {
      if (!ready) return "";
      if (showShotStylePicker) {
        return assemblePromptFromTemplate(
          template,
          { drink: slots.drink ?? "" },
          {
            shotType: selectedShot?.promptValue,
            drinkName: slots.drink ?? "",
          },
        );
      }
      return assemblePromptFromTemplate(template, slots, {
        shotType: selectedShot?.promptValue,
      });
    },
    [ready, showShotStylePicker, template, slots, selectedShot],
  );

  const inputPlaceholder = useMemo(() => {
    if (!isBeverageGuide) return "Décrivez le produit…";
    if (guideStep === "drink") return "Ex. Monster Energy ou Monster Energy avec des citrons verts…";
    if (guideStep === "elements_mode") return "Ou choisissez une option ci-dessus…";
    if (guideStep === "custom_elements") return "Décrivez les éléments autour et la saveur…";
    return "Décrivez la boisson…";
  }, [guideStep, isBeverageGuide]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [guideStep, selectedShotId]);

  const pushMessage = useCallback((role, text) => {
    setMessages((prev) => [...prev, { id: nextMessageId(), role, text }]);
  }, []);

  const finalizeGuide = useCallback(
    (nextSlots) => {
      setSlots(nextSlots);
      setReady(true);
      setGuideStep("ready");
      pushMessage("bot", template.botReady);
    },
    [pushMessage, template.botReady],
  );

  const processBeverageMessage = useCallback(
    (text) => {
      if (guideStep === "drink") {
        const merged = mergeTemplateSlots(slots, extractBeverageSlotsFromFirstMessage(text, template));

        if (isWeakRequiredSlot(template, merged)) {
          setReady(false);
          pushMessage("bot", template.botAskRequired);
          return;
        }

        if (isBeverageGuideReady(template, merged)) {
          finalizeGuide(merged);
          return;
        }

        setSlots(merged);
        setGuideStep("elements_mode");
        pushMessage("bot", template.botAskElementsMode ?? "");
        return;
      }

      if (guideStep === "elements_mode") {
        const mode = parseElementsModeChoice(text);
        if (!mode) {
          pushMessage(
            "bot",
            "Choisissez une option : « Éléments de référence » ou « Choisir moi-même », ou utilisez les boutons ci-dessus.",
          );
          return;
        }

        if (mode === "reference") {
          const flavorElements = resolveReferenceFlavorElements(slots, template);
          const merged = mergeTemplateSlots(slots, { flavorElements });
          finalizeGuide(merged);
          return;
        }

        setGuideStep("custom_elements");
        pushMessage("bot", template.botAskCustomElements ?? "");
        return;
      }

      if (guideStep === "custom_elements") {
        const flavorElements = buildCustomFlavorElements(text);
        if (!flavorElements) {
          pushMessage("bot", template.botAskCustomElements ?? "");
          return;
        }

        const merged = mergeTemplateSlots(slots, { flavorElements });
        finalizeGuide(merged);
      }
    },
    [finalizeGuide, guideStep, pushMessage, slots, template],
  );

  const processGenericMessage = useCallback(
    (text) => {
      const extracted = extractSlotsFromMessage(text, template);
      const merged = mergeTemplateSlots(slots, extracted);
      setSlots(merged);

      if (isWeakRequiredSlot(template, merged)) {
        setReady(false);
        pushMessage("bot", template.botAskRequired);
        return;
      }

      finalizeGuide(merged);
    },
    [finalizeGuide, pushMessage, slots, template],
  );

  const processUserMessage = useCallback(
    (rawMessage) => {
      const text = rawMessage.trim();
      if (!text) return;

      pushMessage("user", text);
      setDraft("");

      if (isBeverageGuide) {
        processBeverageMessage(text);
        return;
      }

      processGenericMessage(text);
    },
    [isBeverageGuide, processBeverageMessage, processGenericMessage, pushMessage],
  );

  const handleElementsModeChoice = useCallback(
    (mode) => {
      const label =
        mode === "reference"
          ? "Éléments de référence de la marque"
          : "Choisir moi-même les éléments";
      processUserMessage(label);
    },
    [processUserMessage],
  );

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      processUserMessage(draft);
    },
    [draft, processUserMessage],
  );

  const handleSlotChange = useCallback(
    (key, value) => {
      setSlots((prev) => {
        const next = { ...prev, [key]: value };
        setReady(isBeverageGuideReady(template, next));
        return next;
      });
    },
    [template],
  );

  const handleShotSelect = useCallback((shotId, fromExtended = false) => {
    setSelectedShotId(shotId);
    setSelectedFromExtended(fromExtended);
    setMoreStylesDismissed(true);
    setShotStyleError(false);
  }, []);

  const handleMoreStylesYes = useCallback(() => {
    setMoreStylesExpanded(true);
    setMoreStylesDismissed(true);
  }, []);

  const handleMoreStylesNo = useCallback(() => {
    setMoreStylesDismissed(true);
  }, []);

  const handleApply = useCallback(() => {
    if (showShotStylePicker && !selectedShotId) {
      setShotStyleError(true);
      return;
    }
    if (!assembledPrompt) return;
    onApplyPrompt(assembledPrompt);
    onClose();
  }, [assembledPrompt, onApplyPrompt, onClose, selectedShotId, showShotStylePicker]);

  const composeForm =
    guideStep !== "ready" && !ready ? (
      <form className="image-studio-prompt-guide-compose" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={inputPlaceholder}
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
    ) : null;

  const userMessages = useMemo(
    () => messages.filter((message) => message.role === "user"),
    [messages],
  );

  const showElementsBot =
    selectedShotId &&
    userMessages.length >= 1 &&
    (guideStep === "elements_mode" ||
      guideStep === "custom_elements" ||
      (ready && userMessages.length >= 2));

  const drinkValidationBotMessage = useMemo(
    () =>
      messages.find(
        (message) =>
          message.role === "bot" &&
          message.text === template.botAskRequired &&
          guideStep === "drink",
      ) ?? null,
    [guideStep, messages, template.botAskRequired],
  );

  const elementsValidationBotMessage = useMemo(
    () =>
      messages.find(
        (message) =>
          message.role === "bot" &&
          message.text.startsWith("Choisissez une option") &&
          guideStep === "elements_mode",
      ) ?? null,
    [guideStep, messages],
  );

  const customValidationBotMessages = useMemo(
    () =>
      messages
        .filter(
          (message) =>
            message.role === "bot" &&
            message.text === template.botAskCustomElements,
        )
        .slice(1),
    [messages, template.botAskCustomElements],
  );

  const botTurnKeys = useMemo(() => {
    if (!showShotStylePicker) return [];

    const keys = ["shot"];
    if (showMoreStylesPrompt) keys.push("more-styles");
    if (selectedShotId) keys.push("drink");
    if (drinkValidationBotMessage) keys.push("drink-validation");
    if (showElementsBot) keys.push("elements");
    if (elementsValidationBotMessage) keys.push("elements-validation");
    if (guideStep === "custom_elements" || userMessages[2]) keys.push("custom");
    customValidationBotMessages.forEach((message) => {
      keys.push(`custom-validation-${message.id}`);
    });
    if (ready) keys.push("result");
    return keys;
  }, [
    customValidationBotMessages,
    drinkValidationBotMessage,
    elementsValidationBotMessage,
    guideStep,
    ready,
    selectedShotId,
    showElementsBot,
    showMoreStylesPrompt,
    showShotStylePicker,
    userMessages,
  ]);

  const { isBotVisible, isTyping } = useConversationBotVisibility(botTurnKeys);

  useEffect(() => {
    if (!showShotStylePicker) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [
    adjustOpen,
    botTurnKeys.length,
    guideStep,
    isTyping,
    messages,
    ready,
    selectedShotId,
    showShotStylePicker,
    moreStylesExpanded,
    moreStylesDismissed,
  ]);

  const elementsChoiceButtons = (
    <div
      className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
      role="group"
      aria-label="Mode des éléments"
    >
      <button
        type="button"
        className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
        disabled={guideStep !== "elements_mode"}
        onClick={() => handleElementsModeChoice("reference")}
      >
        Éléments de référence de la marque
      </button>
      <button
        type="button"
        className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
        disabled={guideStep !== "elements_mode"}
        onClick={() => handleElementsModeChoice("custom")}
      >
        Choisir moi-même les éléments
      </button>
    </div>
  );

  const promptResultBlock = ready ? (
    <div className="image-studio-prompt-guide-result image-studio-prompt-guide-result--inline">
      <pre className="image-studio-prompt-card-body image-studio-prompt-guide-preview-body image-studio-prompt-guide-preview-body--full">
        {assembledPrompt}
      </pre>

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

      <button
        type="button"
        className="image-studio-prompt-guide-apply btn-vws-primary"
        onClick={handleApply}
      >
        Appliquer au prompt
      </button>
    </div>
  ) : null;

  return (
    <div
      className={`image-studio-prompt-guide-chat${
        showShotStylePicker ? " image-studio-prompt-guide-chat--conversation" : ""
      }`}
    >
      <div
        className={`image-studio-prompt-guide-chat-head${
          showShotStylePicker ? " image-studio-prompt-guide-chat-head--minimal" : ""
        }`}
      >
        <button
          type="button"
          className="image-studio-prompt-guide-back"
          onClick={onBack}
          aria-label="Retour aux modèles"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
        </button>
        {showShotStylePicker ? (
          <div className="image-studio-prompt-guide-chat-title-row">
            <p className="image-studio-prompt-guide-chat-title">{template.label}</p>
            <span className="pulse-dot pulse-dot--online shrink-0" aria-hidden="true" />
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {showShotStylePicker ? (
        <div
          className="image-studio-prompt-guide-messages image-studio-prompt-guide-messages--conversation studio-subtle-scrollbar"
          role="log"
          aria-live="polite"
        >
          <ConversationBubble role="bot" wide visible={isBotVisible("shot")}>
            <p className="image-studio-prompt-guide-bubble-text">Quel style de shot ?</p>
            {showPrimaryShotGrid ? (
              <ProductShotStyleGrid
                styles={PRODUCT_PHOTOGRAPHY_SHOT_STYLES}
                selectedId={selectedShotId}
                locked={shotGridsLocked}
                onSelect={(shotId) => handleShotSelect(shotId, false)}
              />
            ) : null}
            {showExtendedShotGrid ? (
              <ProductShotStyleGrid
                styles={PRODUCT_PHOTOGRAPHY_SHOT_STYLES_EXTENDED}
                selectedId={selectedShotId}
                locked={shotGridsLocked}
                onSelect={(shotId) => handleShotSelect(shotId, true)}
              />
            ) : null}
            {!selectedShotId && shotStyleError ? (
              <p className="image-studio-prompt-shot-error" role="alert">
                Choisissez un style de shot pour continuer.
              </p>
            ) : null}
          </ConversationBubble>

          {showMoreStylesPrompt ? (
            <ConversationBubble role="bot" visible={isBotVisible("more-styles")}>
              <p className="image-studio-prompt-guide-bubble-text">Voir plus de styles ?</p>
              <div
                className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions image-studio-prompt-guide-more-styles-actions"
                role="group"
                aria-label="Voir plus de styles"
              >
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={handleMoreStylesYes}
                >
                  Oui
                </button>
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={handleMoreStylesNo}
                >
                  Non
                </button>
              </div>
            </ConversationBubble>
          ) : null}

          {selectedShot ? (
            <ConversationBubble role="user">
              <p className="image-studio-prompt-guide-bubble-text">{selectedShot.label}</p>
            </ConversationBubble>
          ) : null}

          {selectedShotId ? (
            <ConversationBubble role="bot" visible={isBotVisible("drink")}>
              <p className="image-studio-prompt-guide-bubble-text">Quelle boisson ?</p>
              {guideStep === "drink" ? (
                <div className="image-studio-prompt-guide-bubble-compose">{composeForm}</div>
              ) : null}
            </ConversationBubble>
          ) : null}

          {userMessages[0] ? (
            <ConversationBubble role="user">
              <p className="image-studio-prompt-guide-bubble-text">{userMessages[0].text}</p>
            </ConversationBubble>
          ) : null}

          {drinkValidationBotMessage ? (
            <ConversationBubble role="bot" visible={isBotVisible("drink-validation")}>
              <p className="image-studio-prompt-guide-bubble-text">
                {drinkValidationBotMessage.text}
              </p>
            </ConversationBubble>
          ) : null}

          {showElementsBot ? (
            <ConversationBubble role="bot" visible={isBotVisible("elements")}>
              {elementsChoiceButtons}
            </ConversationBubble>
          ) : null}

          {elementsValidationBotMessage ? (
            <ConversationBubble role="bot" visible={isBotVisible("elements-validation")}>
              <p className="image-studio-prompt-guide-bubble-text">
                {elementsValidationBotMessage.text}
              </p>
            </ConversationBubble>
          ) : null}

          {userMessages[1] ? (
            <ConversationBubble role="user">
              <p className="image-studio-prompt-guide-bubble-text">{userMessages[1].text}</p>
            </ConversationBubble>
          ) : null}

          {guideStep === "custom_elements" || userMessages[2] ? (
            <ConversationBubble role="bot" visible={isBotVisible("custom")}>
              <p className="image-studio-prompt-guide-bubble-text">
                {template.botAskCustomElements}
              </p>
              {guideStep === "custom_elements" ? (
                <div className="image-studio-prompt-guide-bubble-compose">{composeForm}</div>
              ) : null}
            </ConversationBubble>
          ) : null}

          {userMessages[2] ? (
            <ConversationBubble role="user">
              <p className="image-studio-prompt-guide-bubble-text">{userMessages[2].text}</p>
            </ConversationBubble>
          ) : null}

          {customValidationBotMessages.map((message) => (
            <ConversationBubble
              key={message.id}
              role="bot"
              visible={isBotVisible(`custom-validation-${message.id}`)}
            >
              <p className="image-studio-prompt-guide-bubble-text">{message.text}</p>
            </ConversationBubble>
          ))}

          {ready ? (
            <ConversationBubble role="bot" wide visible={isBotVisible("result")}>
              {promptResultBlock}
            </ConversationBubble>
          ) : null}

          <TypingIndicator visible={isTyping} />

          <div ref={messagesEndRef} />
        </div>
      ) : (
        <>
      <div className="image-studio-prompt-guide-messages studio-subtle-scrollbar" role="log" aria-live="polite">
        {messages.map((message) => {
          return (
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
          );
        })}

        {guideStep === "elements_mode" ? (
          <div className="image-studio-prompt-guide-choices" role="group" aria-label="Mode des éléments">
            <button
              type="button"
              className="image-studio-prompt-guide-choice"
              onClick={() => handleElementsModeChoice("reference")}
            >
              Éléments de référence de la marque
            </button>
            <button
              type="button"
              className="image-studio-prompt-guide-choice"
              onClick={() => handleElementsModeChoice("custom")}
            >
              Choisir moi-même les éléments
            </button>
          </div>
        ) : null}

        {ready ? (
          <div className="image-studio-prompt-guide-result">
            <pre className="image-studio-prompt-card-body image-studio-prompt-guide-preview-body image-studio-prompt-guide-preview-body--full">
              {assembledPrompt}
            </pre>

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
        {ready ? (
          <button
            type="button"
            className="image-studio-prompt-guide-apply btn-vws-primary"
            onClick={handleApply}
          >
            Appliquer au prompt
          </button>
        ) : null}

        {composeForm}
      </div>
        </>
      )}
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
