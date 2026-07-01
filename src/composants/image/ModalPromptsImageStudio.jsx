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
  extractVerbatimSlot,
  fillTemplateSlotDefaults,
  isBeverageGuideReady,
  isLifestyleGuideReady,
  isPackagingResolved,
  isWeakRequiredSlot,
  mergeTemplateSlots,
  parseElementsModeChoice,
  parsePackagingChoice,
  resolveReferenceFlavorElements,
} from "@/bibliotheque/imageStudio/promptTemplateEngine";
import {
  ALL_LIFESTYLE_SHOT_STYLES,
  ALL_PRODUCT_PHOTOGRAPHY_SHOT_STYLES,
  IMAGE_STUDIO_PROMPT_TEMPLATES,
  isLifestyleProductGuideTemplate,
  isShotStyleGuideTemplate,
  isStudioProductGuideTemplate,
  isUgcSelfieGuideTemplate,
  LIFESTYLE_SHOT_STYLES,
  LIFESTYLE_SHOT_STYLES_EXTENDED,
  PRODUCT_PHOTOGRAPHY_SHOT_STYLES,
  PRODUCT_PHOTOGRAPHY_SHOT_STYLES_EXTENDED,
} from "@/bibliotheque/imageStudio/promptTemplates";
import UgcSelfiePromptGuideChat from "@/composants/image/UgcSelfiePromptGuideChat";

/** @typedef {'drink' | 'packaging_mode' | 'elements_mode' | 'custom_elements' | 'ready'} BeverageGuideStep */
/** @typedef {'product' | 'environment' | 'ready'} LifestyleGuideStep */

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
  const isStudioGuide = isStudioProductGuideTemplate(template);
  const isLifestyleGuide = isLifestyleProductGuideTemplate(template);
  const isBeverageGuide = template.extractorId === "beverage-hero";
  const showShotStylePicker = isShotStyleGuideTemplate(template);

  const primaryShotStyles = isLifestyleGuide
    ? LIFESTYLE_SHOT_STYLES
    : PRODUCT_PHOTOGRAPHY_SHOT_STYLES;
  const extendedShotStyles = isLifestyleGuide
    ? LIFESTYLE_SHOT_STYLES_EXTENDED
    : PRODUCT_PHOTOGRAPHY_SHOT_STYLES_EXTENDED;
  const allShotStyles = isLifestyleGuide
    ? ALL_LIFESTYLE_SHOT_STYLES
    : ALL_PRODUCT_PHOTOGRAPHY_SHOT_STYLES;

  const [messages, setMessages] = useState(() =>
    showShotStylePicker ? [] : [{ id: nextMessageId(), role: "bot", text: template.botIntro }],
  );
  const [slots, setSlots] = useState({});
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(() =>
    isLifestyleGuide ? /** @type {LifestyleGuideStep} */ ("product") : /** @type {BeverageGuideStep} */ ("drink"),
  );
  const [selectedShotId, setSelectedShotId] = useState(null);
  const [selectedFromExtended, setSelectedFromExtended] = useState(false);
  /** @type {[null | 'yes' | 'no', import('react').Dispatch<import('react').SetStateAction<null | 'yes' | 'no'>>]} */
  const [moreStylesChoice, setMoreStylesChoice] = useState(null);
  const [packagingWasAsked, setPackagingWasAsked] = useState(false);
  const [shotStyleError, setShotStyleError] = useState(false);

  const selectedShot = useMemo(
    () => allShotStyles.find((style) => style.id === selectedShotId) ?? null,
    [allShotStyles, selectedShotId],
  );

  const showPrimaryShotGrid = !selectedShotId || selectedFromExtended;
  const showExtendedShotGrid =
    moreStylesChoice === "yes" && (!selectedShotId || selectedFromExtended);
  const showMoreStylesBubble = !selectedShotId;
  const showMoreStylesButtons = moreStylesChoice === null;
  const shotGridsLocked = Boolean(selectedShotId && selectedFromExtended);

  const filledSlots = useMemo(
    () => fillTemplateSlotDefaults(template, slots),
    [template, slots],
  );

  const assembledPrompt = useMemo(
    () => {
      if (!ready) return "";
      if (isLifestyleGuide) {
        return assemblePromptFromTemplate(template, slots, {
          shotId: selectedShotId ?? undefined,
        });
      }
      if (isStudioGuide) {
        return assemblePromptFromTemplate(template, slots, {
          shotType: selectedShot?.promptValue,
          drinkName: slots.drink ?? "",
          shotId: selectedShotId ?? undefined,
        });
      }
      return assemblePromptFromTemplate(template, slots, {
        shotType: selectedShot?.promptValue,
        shotId: selectedShotId ?? undefined,
      });
    },
    [isLifestyleGuide, isStudioGuide, ready, template, slots, selectedShot, selectedShotId],
  );

  const inputPlaceholder = useMemo(() => {
    if (isLifestyleGuide) {
      if (guideStep === "product") return "Ex. HOLY Hydration Strawberry Kiwi…";
      if (guideStep === "environment") return "Ex. salle de sport moderne, terrain de tennis…";
      return "Votre réponse…";
    }
    if (!isBeverageGuide) return "Décrivez le produit…";
    if (guideStep === "drink") return "Ex. Monster Energy ou Monster Energy avec des citrons verts…";
    if (guideStep === "packaging_mode") return "Ou choisissez une option ci-dessus…";
    if (guideStep === "elements_mode") return "Ou choisissez une option ci-dessus…";
    if (guideStep === "custom_elements") return "Décrivez les éléments autour et la saveur…";
    return "Décrivez la boisson…";
  }, [guideStep, isBeverageGuide, isLifestyleGuide]);

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
        const extracted = isStudioGuide
          ? extractDrinkSlotsFromMessage(text, template)
          : extractBeverageSlotsFromFirstMessage(text, template);
        const merged = mergeTemplateSlots(slots, extracted);

        if (isWeakRequiredSlot(template, merged)) {
          setReady(false);
          pushMessage("bot", template.botAskRequired);
          return;
        }

        if (isStudioGuide && !isPackagingResolved(merged, template)) {
          setSlots(merged);
          setPackagingWasAsked(true);
          setGuideStep("packaging_mode");
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

      if (guideStep === "packaging_mode") {
        const choice = parsePackagingChoice(text);
        if (!choice) {
          pushMessage(
            "bot",
            "Choisissez « Canette » ou « Bouteille », ou utilisez les boutons ci-dessus.",
          );
          return;
        }

        const merged = mergeTemplateSlots(slots, { packaging: choice });

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
    [finalizeGuide, guideStep, isStudioGuide, pushMessage, slots, template],
  );

  const processLifestyleMessage = useCallback(
    (text) => {
      if (guideStep === "product") {
        const product = extractVerbatimSlot(text);
        if (product.length < 2) {
          setReady(false);
          pushMessage("bot", template.botAskRequired);
          return;
        }

        const merged = mergeTemplateSlots(slots, { product });
        setSlots(merged);
        setGuideStep("environment");
        return;
      }

      if (guideStep === "environment") {
        const environment = extractVerbatimSlot(text);
        if (environment.length < 2) {
          setReady(false);
          return;
        }

        finalizeGuide(mergeTemplateSlots(slots, { environment }));
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

      if (isLifestyleGuide) {
        processLifestyleMessage(text);
        return;
      }

      if (isBeverageGuide) {
        processBeverageMessage(text);
        return;
      }

      processGenericMessage(text);
    },
    [isBeverageGuide, isLifestyleGuide, processBeverageMessage, processGenericMessage, processLifestyleMessage, pushMessage],
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

  const handlePackagingChoice = useCallback(
    (choice) => {
      processUserMessage(choice === "can" ? "Canette" : "Bouteille");
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
        if (isLifestyleGuide) {
          setReady(isLifestyleGuideReady(template, next));
        } else {
          setReady(isBeverageGuideReady(template, next));
        }
        return next;
      });
    },
    [isLifestyleGuide, template],
  );

  const handleShotSelect = useCallback((shotId, fromExtended = false) => {
    setSelectedShotId(shotId);
    setSelectedFromExtended(fromExtended);
    setShotStyleError(false);
  }, []);

  const handleMoreStylesYes = useCallback(() => {
    setMoreStylesChoice("yes");
  }, []);

  const handleMoreStylesNo = useCallback(() => {
    setMoreStylesChoice("no");
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
    guideStep !== "ready" && !ready && (
      isLifestyleGuide
        ? guideStep === "product" || guideStep === "environment"
        : guideStep !== "packaging_mode" && guideStep !== "elements_mode"
    ) ? (
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

  const elementsUserMessageIndex = packagingWasAsked ? 2 : 1;
  const customUserMessageIndex = packagingWasAsked ? 3 : 2;

  const showPackagingBot = isStudioGuide && packagingWasAsked && selectedShotId;

  const showElementsBot =
    isStudioGuide &&
    selectedShotId &&
    !["drink", "packaging_mode"].includes(guideStep) &&
    userMessages.length >= (packagingWasAsked ? 2 : 1) &&
    (guideStep === "elements_mode" ||
      guideStep === "custom_elements" ||
      ready);

  const showEnvironmentBot =
    isLifestyleGuide &&
    selectedShotId &&
    userMessages.length >= 1 &&
    (guideStep === "environment" || ready);

  const productValidationBotMessage = useMemo(
    () =>
      messages.find(
        (message) =>
          message.role === "bot" &&
          message.text === template.botAskRequired &&
          guideStep === "product",
      ) ?? null,
    [guideStep, messages, template.botAskRequired],
  );

  const environmentValidationBotMessage = useMemo(
    () =>
      messages.find(
        (message) =>
          message.role === "bot" &&
          message.text === template.botAskEnvironment &&
          guideStep === "environment",
      ) ?? null,
    [guideStep, messages, template.botAskEnvironment],
  );

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

  const packagingValidationBotMessage = useMemo(
    () =>
      messages.find(
        (message) =>
          message.role === "bot" &&
          message.text.startsWith("Choisissez « Canette »") &&
          guideStep === "packaging_mode",
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

    if (isLifestyleGuide) {
      const keys = ["shot"];
      if (showMoreStylesBubble) keys.push("more-styles");
      if (moreStylesChoice === "yes") keys.push("extended-shots");
      if (selectedShotId) keys.push("product");
      if (productValidationBotMessage) keys.push("product-validation");
      if (showEnvironmentBot) keys.push("environment");
      if (environmentValidationBotMessage) keys.push("environment-validation");
      if (ready) keys.push("result");
      return keys;
    }

    const keys = ["shot"];
    if (showMoreStylesBubble) keys.push("more-styles");
    if (moreStylesChoice === "yes") keys.push("extended-shots");
    if (selectedShotId) keys.push("drink");
    if (drinkValidationBotMessage) keys.push("drink-validation");
    if (showPackagingBot) keys.push("packaging");
    if (packagingValidationBotMessage) keys.push("packaging-validation");
    if (showElementsBot) keys.push("elements");
    if (elementsValidationBotMessage) keys.push("elements-validation");
    if (guideStep === "custom_elements" || userMessages[customUserMessageIndex]) keys.push("custom");
    customValidationBotMessages.forEach((message) => {
      keys.push(`custom-validation-${message.id}`);
    });
    if (ready) keys.push("result");
    return keys;
  }, [
    customValidationBotMessages,
    customUserMessageIndex,
    drinkValidationBotMessage,
    elementsValidationBotMessage,
    environmentValidationBotMessage,
    guideStep,
    isLifestyleGuide,
    moreStylesChoice,
    packagingValidationBotMessage,
    productValidationBotMessage,
    ready,
    selectedShotId,
    showElementsBot,
    showEnvironmentBot,
    showMoreStylesBubble,
    showPackagingBot,
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
    moreStylesChoice,
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

  const packagingChoiceButtons = (
    <div
      className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
      role="group"
      aria-label="Format emballage"
    >
      <button
        type="button"
        className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
        disabled={guideStep !== "packaging_mode"}
        onClick={() => handlePackagingChoice("can")}
      >
        Canette
      </button>
      <button
        type="button"
        className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
        disabled={guideStep !== "packaging_mode"}
        onClick={() => handlePackagingChoice("bottle")}
      >
        Bouteille
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
                styles={primaryShotStyles}
                selectedId={selectedShotId}
                locked={shotGridsLocked}
                onSelect={(shotId) => handleShotSelect(shotId, false)}
              />
            ) : null}
            {!selectedShotId && shotStyleError ? (
              <p className="image-studio-prompt-shot-error" role="alert">
                Choisissez un style de shot pour continuer.
              </p>
            ) : null}
          </ConversationBubble>

          {showMoreStylesBubble ? (
            <ConversationBubble role="bot" visible={isBotVisible("more-styles")}>
              <p className="image-studio-prompt-guide-bubble-text">Voir plus de styles ?</p>
              {showMoreStylesButtons ? (
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
              ) : null}
            </ConversationBubble>
          ) : null}

          {moreStylesChoice === "yes" || moreStylesChoice === "no" ? (
            <ConversationBubble role="user">
              <p className="image-studio-prompt-guide-bubble-text">
                {moreStylesChoice === "yes" ? "Oui" : "Non"}
              </p>
            </ConversationBubble>
          ) : null}

          {showExtendedShotGrid ? (
            <ConversationBubble role="bot" wide visible={isBotVisible("extended-shots")}>
              <p className="image-studio-prompt-guide-bubble-text">Voici d&apos;autres styles :</p>
              <ProductShotStyleGrid
                styles={extendedShotStyles}
                selectedId={selectedShotId}
                locked={shotGridsLocked}
                onSelect={(shotId) => handleShotSelect(shotId, true)}
              />
            </ConversationBubble>
          ) : null}

          {selectedShot ? (
            <ConversationBubble role="user">
              <p className="image-studio-prompt-guide-bubble-text">{selectedShot.label}</p>
            </ConversationBubble>
          ) : null}

          {selectedShotId ? (
            <ConversationBubble role="bot" visible={isBotVisible("drink") || isBotVisible("product")}>
              <p className="image-studio-prompt-guide-bubble-text">
                {isLifestyleGuide ? template.botIntro : "Quelle boisson ?"}
              </p>
              {(isLifestyleGuide ? guideStep === "product" : guideStep === "drink") ? (
                <div className="image-studio-prompt-guide-bubble-compose">{composeForm}</div>
              ) : null}
            </ConversationBubble>
          ) : null}

          {userMessages[0] ? (
            <ConversationBubble role="user">
              <p className="image-studio-prompt-guide-bubble-text">{userMessages[0].text}</p>
            </ConversationBubble>
          ) : null}

          {(drinkValidationBotMessage || productValidationBotMessage) ? (
            <ConversationBubble
              role="bot"
              visible={isBotVisible("drink-validation") || isBotVisible("product-validation")}
            >
              <p className="image-studio-prompt-guide-bubble-text">
                {(drinkValidationBotMessage ?? productValidationBotMessage).text}
              </p>
            </ConversationBubble>
          ) : null}

          {showEnvironmentBot ? (
            <ConversationBubble role="bot" visible={isBotVisible("environment")}>
              <p className="image-studio-prompt-guide-bubble-text">
                {template.botAskEnvironment}
              </p>
              {guideStep === "environment" ? (
                <div className="image-studio-prompt-guide-bubble-compose">{composeForm}</div>
              ) : null}
            </ConversationBubble>
          ) : null}

          {isLifestyleGuide && userMessages[1] ? (
            <ConversationBubble role="user">
              <p className="image-studio-prompt-guide-bubble-text">{userMessages[1].text}</p>
            </ConversationBubble>
          ) : null}

          {environmentValidationBotMessage && !showEnvironmentBot ? (
            <ConversationBubble role="bot" visible={isBotVisible("environment-validation")}>
              <p className="image-studio-prompt-guide-bubble-text">
                {environmentValidationBotMessage.text}
              </p>
            </ConversationBubble>
          ) : null}

          {showPackagingBot ? (
            <ConversationBubble role="bot" visible={isBotVisible("packaging")}>
              <p className="image-studio-prompt-guide-bubble-text">
                {template.botAskPackagingMode}
              </p>
              {packagingChoiceButtons}
            </ConversationBubble>
          ) : null}

          {packagingValidationBotMessage ? (
            <ConversationBubble role="bot" visible={isBotVisible("packaging-validation")}>
              <p className="image-studio-prompt-guide-bubble-text">
                {packagingValidationBotMessage.text}
              </p>
            </ConversationBubble>
          ) : null}

          {packagingWasAsked && userMessages[1] ? (
            <ConversationBubble role="user">
              <p className="image-studio-prompt-guide-bubble-text">{userMessages[1].text}</p>
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

          {isStudioGuide && userMessages[elementsUserMessageIndex] ? (
            <ConversationBubble role="user">
              <p className="image-studio-prompt-guide-bubble-text">
                {userMessages[elementsUserMessageIndex].text}
              </p>
            </ConversationBubble>
          ) : null}

          {isStudioGuide &&
          (guideStep === "custom_elements" || userMessages[customUserMessageIndex]) ? (
            <ConversationBubble role="bot" visible={isBotVisible("custom")}>
              <p className="image-studio-prompt-guide-bubble-text">
                {template.botAskCustomElements}
              </p>
              {guideStep === "custom_elements" ? (
                <div className="image-studio-prompt-guide-bubble-compose">{composeForm}</div>
              ) : null}
            </ConversationBubble>
          ) : null}

          {isStudioGuide && userMessages[customUserMessageIndex] ? (
            <ConversationBubble role="user">
              <p className="image-studio-prompt-guide-bubble-text">
                {userMessages[customUserMessageIndex].text}
              </p>
            </ConversationBubble>
          ) : null}

          {isStudioGuide
            ? customValidationBotMessages.map((message) => (
                <ConversationBubble
                  key={message.id}
                  role="bot"
                  visible={isBotVisible(`custom-validation-${message.id}`)}
                >
                  <p className="image-studio-prompt-guide-bubble-text">{message.text}</p>
                </ConversationBubble>
              ))
            : null}

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
          isUgcSelfieGuideTemplate(activeTemplate) ? (
            <UgcSelfiePromptGuideChat
              template={activeTemplate}
              onBack={handleBack}
              onApplyPrompt={onApplyPrompt}
              onClose={onClose}
            />
          ) : (
          <PromptTemplateChat
            template={activeTemplate}
            onBack={handleBack}
            onApplyPrompt={onApplyPrompt}
            onClose={onClose}
          />
          )
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
