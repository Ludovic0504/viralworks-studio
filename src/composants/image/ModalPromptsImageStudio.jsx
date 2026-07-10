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
  assemblePackshotDynamiquePromptFromSlots,
  isPackshotDynamiqueGuideReady,
} from "@/bibliotheque/imageStudio/packshotDynamiqueAssembly";
import {
  PACKSHOT_AMBIANCE_OPTIONS,
  PACKSHOT_BACKGROUND_OPTIONS,
  PACKSHOT_FORMAT_OPTIONS,
  PACKSHOT_INTERACTION_OPTIONS,
  PACKSHOT_POSITION_OPTIONS,
  PACKSHOT_STATE_OPTIONS,
} from "@/bibliotheque/imageStudio/packshotDynamiqueConfig";
import { IMAGE_STUDIO_PRODUCT_MENTION_TOKEN } from "@/bibliotheque/imageStudio/imageStudioGuideApply";
import { readGuideProductImageFile } from "@/bibliotheque/imageStudio/guideProductImage";
import GuideProductImagePicker from "@/composants/image/GuideProductImagePicker";
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
  isUgcPresentationGuideTemplate,
  isBrandCampaignShootGuideTemplate,
  isEditorialWornHeldGuideTemplate,
  isProduitEnApplicationGuideTemplate,
  isPackshotDynamiqueGuideTemplate,
  LIFESTYLE_SHOT_STYLES,
  LIFESTYLE_SHOT_STYLES_EXTENDED,
  PRODUCT_PHOTOGRAPHY_SHOT_STYLES,
  PRODUCT_PHOTOGRAPHY_SHOT_STYLES_EXTENDED,
} from "@/bibliotheque/imageStudio/promptTemplates";
import {
  getLifestyleFramingOptionLabel,
  isLifestyleFramingEligible,
  LIFESTYLE_FRAMING_OPTIONS,
} from "@/bibliotheque/imageStudio/lifestyleFramingConfig";
import UgcSelfiePromptGuideChat from "@/composants/image/UgcSelfiePromptGuideChat";
import UgcPresentationPromptGuideChat from "@/composants/image/UgcPresentationPromptGuideChat";
import BrandCampaignShootPromptGuideChat from "@/composants/image/BrandCampaignShootPromptGuideChat";
import EditorialWornHeldPromptGuideChat from "@/composants/image/EditorialWornHeldPromptGuideChat";
import ProduitEnApplicationPromptGuideChat from "@/composants/image/ProduitEnApplicationPromptGuideChat";

/** @typedef {'drink' | 'packaging_mode' | 'elements_mode' | 'custom_elements' | 'ready'} BeverageGuideStep */
/** @typedef {'framing' | 'product' | 'environment' | 'ready'} LifestyleGuideStep */
/** @typedef {'product' | 'position' | 'background' | 'ambiance' | 'customAmbiance' | 'interaction' | 'state' | 'format' | 'ready'} PackshotGuideStep */

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

function findPackshotOptionLabel(options, id) {
  return options.find((item) => item.id === id)?.label ?? null;
}

function PackshotOptionButtonRow({ options, selectedId, disabled, onSelect, ariaLabel }) {
  return (
    <div className="image-studio-prompt-ugc-option-row" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={selectedId === option.id}
          disabled={disabled}
          className={`studio-toolbar-btn image-studio-prompt-guide-elements-btn image-studio-prompt-ugc-option-btn${
            selectedId === option.id ? " is-selected" : ""
          }`}
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
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
  const isPackshotGuide = isPackshotDynamiqueGuideTemplate(template);
  const isBeverageGuide = template.extractorId === "beverage-hero";
  const showShotStylePicker = isShotStyleGuideTemplate(template);
  const showConversationUI = showShotStylePicker || isPackshotGuide;

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
  const [guideStep, setGuideStep] = useState(() => {
    if (isPackshotGuide) return /** @type {PackshotGuideStep} */ ("product");
    if (isLifestyleGuide) return /** @type {LifestyleGuideStep} */ ("product");
    return /** @type {BeverageGuideStep} */ ("drink");
  });
  const [selectedShotId, setSelectedShotId] = useState(null);
  const [selectedFromExtended, setSelectedFromExtended] = useState(false);
  /** @type {[null | 'yes' | 'no', import('react').Dispatch<import('react').SetStateAction<null | 'yes' | 'no'>>]} */
  const [moreStylesChoice, setMoreStylesChoice] = useState(null);
  const [packagingWasAsked, setPackagingWasAsked] = useState(false);
  const [shotStyleError, setShotStyleError] = useState(false);
  const [packshotProductValidationShown, setPackshotProductValidationShown] = useState(false);
  const [guideProductImagePreview, setGuideProductImagePreview] = useState(null);
  const [guideProductImageError, setGuideProductImageError] = useState(null);
  /** @type {[null | import('@/bibliotheque/imageStudio/lifestyleFramingConfig').LifestyleFramingId, import('react').Dispatch<import('react').SetStateAction<null | import('@/bibliotheque/imageStudio/lifestyleFramingConfig').LifestyleFramingId>>]} */
  const [lifestyleFramingId, setLifestyleFramingId] = useState(null);

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
      if (isPackshotGuide) {
        return assemblePackshotDynamiquePromptFromSlots(slots);
      }
      if (isLifestyleGuide) {
        return assemblePromptFromTemplate(template, slots, {
          shotId: selectedShotId ?? undefined,
          lifestyleFramingId,
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
    [isLifestyleGuide, isPackshotGuide, isStudioGuide, lifestyleFramingId, ready, template, slots, selectedShot, selectedShotId],
  );

  const inputPlaceholder = useMemo(() => {
    if (isPackshotGuide) {
      if (guideStep === "customAmbiance") return "Ex. bohème désertique, industriel brut…";
      if (guideStep === "product") return "Ex. bougie artisanale en verre ambré, cire végétale…";
      return "Votre réponse…";
    }
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
  }, [guideStep, isBeverageGuide, isLifestyleGuide, isPackshotGuide]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [guideStep, selectedShotId]);

  const pushMessage = useCallback((role, text) => {
    setMessages((prev) => [...prev, { id: nextMessageId(), role, text }]);
  }, []);

  const handleGuideProductImagePick = useCallback(async (file) => {
    setGuideProductImageError(null);
    if (!file) return;

    const result = await readGuideProductImageFile(file);
    if (!result.ok) {
      setGuideProductImageError(result.error);
      return;
    }

    setGuideProductImagePreview(result.dataUrl);
    setGuideProductImageError(null);
  }, []);

  const finalizeGuide = useCallback(
    (nextSlots) => {
      setSlots(nextSlots);
      setReady(true);
      setGuideStep("ready");
      if (!isPackshotGuide) {
        pushMessage("bot", template.botReady);
      }
    },
    [isPackshotGuide, pushMessage, template.botReady],
  );

  const advancePackshotAfterBackground = useCallback((backgroundId) => {
    if (backgroundId === "environnement") {
      setGuideStep("ambiance");
    } else {
      setGuideStep("interaction");
    }
  }, []);

  const handlePackshotProductSubmit = useCallback(
    (raw) => {
      const productDescription = raw.trim();
      const hasImage = Boolean(guideProductImagePreview);

      if (productDescription.length < 2 && !hasImage) {
        setPackshotProductValidationShown(true);
        return;
      }

      setPackshotProductValidationShown(false);
      setDraft("");
      setSlots((prev) => ({
        ...prev,
        productDescription:
          productDescription.length >= 2
            ? productDescription
            : IMAGE_STUDIO_PRODUCT_MENTION_TOKEN,
        productImageUrl: guideProductImagePreview,
        productInputMode: productDescription.length >= 2 ? "text" : "image",
      }));
      setGuideStep("position");
    },
    [guideProductImagePreview],
  );

  const handleLifestyleProductSubmit = useCallback(
    (raw) => {
      const product = raw.trim();
      const hasImage = Boolean(guideProductImagePreview);

      if (product.length < 2 && !hasImage) {
        setReady(false);
        pushMessage("bot", template.botAskRequired);
        return;
      }

      setDraft("");
      setSlots((prev) => ({
        ...prev,
        product: product.length >= 2 ? product : IMAGE_STUDIO_PRODUCT_MENTION_TOKEN,
        productImageUrl: guideProductImagePreview,
        productInputMode: product.length >= 2 ? "text" : "image",
      }));
      setGuideStep("environment");
    },
    [guideProductImagePreview, pushMessage, template.botAskRequired],
  );

  const handlePackshotPositionSelect = useCallback((positionId) => {
    setSlots((prev) => ({ ...prev, positionId }));
    setGuideStep("background");
  }, []);

  const handlePackshotBackgroundSelect = useCallback(
    (backgroundId) => {
      setSlots((prev) => {
        const next = { ...prev, backgroundId };
        if (backgroundId === "neutre") {
          next.ambianceId = null;
          next.customAmbiance = null;
        }
        return next;
      });
      advancePackshotAfterBackground(backgroundId);
    },
    [advancePackshotAfterBackground],
  );

  const handlePackshotAmbianceSelect = useCallback((ambianceId) => {
    setSlots((prev) => ({ ...prev, ambianceId }));
    if (ambianceId === "autre") {
      setGuideStep("customAmbiance");
    } else {
      setGuideStep("interaction");
    }
  }, []);

  const handlePackshotCustomAmbianceSubmit = useCallback((raw) => {
    const customAmbiance = raw.trim();
    if (customAmbiance.length < 2) return;
    setDraft("");
    setSlots((prev) => ({ ...prev, customAmbiance }));
    setGuideStep("interaction");
  }, []);

  const handlePackshotInteractionSelect = useCallback((interactionId) => {
    setSlots((prev) => ({ ...prev, interactionId }));
    setGuideStep("state");
  }, []);

  const handlePackshotInteractionSkip = useCallback(() => {
    setSlots((prev) => ({ ...prev, interactionId: "aucun" }));
    setGuideStep("state");
  }, []);

  const handlePackshotStateSelect = useCallback((productStateId) => {
    setSlots((prev) => ({ ...prev, productStateId }));
    setGuideStep("format");
  }, []);

  const handlePackshotStateSkip = useCallback(() => {
    setSlots((prev) => ({ ...prev, productStateId: "ferme-neuf" }));
    setGuideStep("format");
  }, []);

  const handlePackshotFormatSelect = useCallback(
    (formatId) => {
      setSlots((prev) => {
        const next = { ...prev, formatId };
        finalizeGuide(next);
        return next;
      });
    },
    [finalizeGuide],
  );

  const handlePackshotFormatSkip = useCallback(() => {
    setSlots((prev) => {
      const next = { ...prev, formatId: "banniere-4-5" };
      finalizeGuide(next);
      return next;
    });
  }, [finalizeGuide]);

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
      if (guideStep === "environment") {
        const environment = extractVerbatimSlot(text);
        if (environment.length < 2) {
          setReady(false);
          return;
        }

        pushMessage("user", text);
        finalizeGuide(mergeTemplateSlots(slots, { environment }));
      }
    },
    [finalizeGuide, guideStep, pushMessage, slots],
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
      if (isPackshotGuide) {
        if (guideStep === "product") {
          handlePackshotProductSubmit(draft);
          return;
        }
        if (guideStep === "customAmbiance") {
          handlePackshotCustomAmbianceSubmit(draft);
        }
        return;
      }
      if (isLifestyleGuide && guideStep === "product") {
        handleLifestyleProductSubmit(draft);
        return;
      }
      processUserMessage(draft);
    },
    [
      draft,
      guideStep,
      handleLifestyleProductSubmit,
      handlePackshotCustomAmbianceSubmit,
      handlePackshotProductSubmit,
      isLifestyleGuide,
      isPackshotGuide,
      processUserMessage,
    ],
  );

  const handleSlotChange = useCallback(
    (key, value) => {
      setSlots((prev) => {
        const next = { ...prev, [key]: value };
        if (isPackshotGuide) {
          setReady(isPackshotDynamiqueGuideReady(next));
        } else if (isLifestyleGuide) {
          setReady(isLifestyleGuideReady(template, next));
        } else {
          setReady(isBeverageGuideReady(template, next));
        }
        return next;
      });
    },
    [isLifestyleGuide, isPackshotGuide, template],
  );

  const handleShotSelect = useCallback(
    (shotId, fromExtended = false) => {
      setSelectedShotId(shotId);
      setSelectedFromExtended(fromExtended);
      setShotStyleError(false);
      if (isLifestyleGuide) {
        setLifestyleFramingId(null);
        setGuideProductImagePreview(null);
        setGuideProductImageError(null);
        if (isLifestyleFramingEligible(shotId)) {
          setGuideStep("framing");
        } else {
          setGuideStep("product");
        }
      }
    },
    [isLifestyleGuide],
  );

  const handleLifestyleFramingSelect = useCallback((framingId) => {
    setLifestyleFramingId(framingId);
    setGuideStep("product");
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
    if (slots.productImageUrl) {
      onApplyPrompt({ prompt: assembledPrompt, productImageUrl: slots.productImageUrl });
    } else {
      onApplyPrompt(assembledPrompt);
    }
    onClose();
  }, [
    assembledPrompt,
    onApplyPrompt,
    onClose,
    selectedShotId,
    showShotStylePicker,
    slots.productImageUrl,
  ]);

  const canSubmitGuideProduct =
    Boolean(draft.trim()) || Boolean(guideProductImagePreview);

  const composeForm =
    guideStep !== "ready" && !ready && (
      isPackshotGuide
        ? guideStep === "product" || guideStep === "customAmbiance"
        : isLifestyleGuide
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
          disabled={
            (isPackshotGuide || isLifestyleGuide) && guideStep === "product"
              ? !canSubmitGuideProduct
              : !draft.trim()
          }
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
    Boolean(slots.product?.trim()) &&
    (guideStep === "environment" || ready);

  const lifestyleProductDescription = slots.product?.trim() ?? "";

  const showLifestyleFramingBot =
    isLifestyleGuide &&
    selectedShotId &&
    isLifestyleFramingEligible(selectedShotId);

  const showLifestyleProductBot =
    selectedShotId &&
    (!isLifestyleGuide ||
      !isLifestyleFramingEligible(selectedShotId) ||
      Boolean(lifestyleFramingId));

  const lifestyleFramingLabel = getLifestyleFramingOptionLabel(lifestyleFramingId);

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
    if (!showConversationUI) return [];

    if (isPackshotGuide) {
      const productDescription = slots.productDescription?.trim() ?? "";
      const keys = ["product"];
      if (productDescription) keys.push("position");
      if (slots.positionId) keys.push("background");
      if (slots.backgroundId) {
        if (slots.backgroundId === "environnement") {
          keys.push("ambiance");
          if (slots.ambianceId === "autre") keys.push("customAmbiance");
        }
        if (slots.interactionId || guideStep === "interaction") keys.push("interaction");
      }
      if (slots.productStateId || guideStep === "state") keys.push("state");
      if (guideStep === "format" || ready) keys.push("format");
      if (packshotProductValidationShown) keys.push("product-validation");
      if (ready) keys.push("result");
      return keys;
    }

    if (isLifestyleGuide) {
      const keys = ["shot"];
      if (showMoreStylesBubble) keys.push("more-styles");
      if (moreStylesChoice === "yes") keys.push("extended-shots");
      if (showLifestyleFramingBot) {
        keys.push("framing");
        if (lifestyleFramingId) keys.push("product");
      } else if (selectedShotId) {
        keys.push("product");
      }
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
    isPackshotGuide,
    lifestyleFramingId,
    moreStylesChoice,
    packagingValidationBotMessage,
    packshotProductValidationShown,
    productValidationBotMessage,
    ready,
    selectedShotId,
    showConversationUI,
    showElementsBot,
    showEnvironmentBot,
    showLifestyleFramingBot,
    showMoreStylesBubble,
    showPackagingBot,
    slots.ambianceId,
    slots.backgroundId,
    slots.interactionId,
    slots.positionId,
    slots.productDescription,
    slots.productStateId,
    userMessages,
  ]);

  const packshotProductDescription = slots.productDescription?.trim() ?? "";
  const packshotPositionLabel = findPackshotOptionLabel(PACKSHOT_POSITION_OPTIONS, slots.positionId);
  const packshotBackgroundLabel = findPackshotOptionLabel(
    PACKSHOT_BACKGROUND_OPTIONS,
    slots.backgroundId,
  );
  const packshotAmbianceLabel =
    slots.ambianceId === "autre"
      ? slots.customAmbiance?.trim() || "Autre"
      : findPackshotOptionLabel(PACKSHOT_AMBIANCE_OPTIONS, slots.ambianceId);
  const packshotInteractionLabel = findPackshotOptionLabel(
    PACKSHOT_INTERACTION_OPTIONS,
    slots.interactionId,
  );
  const packshotStateLabel = findPackshotOptionLabel(PACKSHOT_STATE_OPTIONS, slots.productStateId);
  const packshotFormatLabel = findPackshotOptionLabel(PACKSHOT_FORMAT_OPTIONS, slots.formatId);

  const { isBotVisible, isTyping } = useConversationBotVisibility(botTurnKeys);

  useEffect(() => {
    if (!showConversationUI) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [
    adjustOpen,
    botTurnKeys.length,
    guideStep,
    isTyping,
    messages,
    ready,
    selectedShotId,
    showConversationUI,
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
        showConversationUI ? " image-studio-prompt-guide-chat--conversation" : ""
      }`}
    >
      <div
        className={`image-studio-prompt-guide-chat-head${
          showConversationUI ? " image-studio-prompt-guide-chat-head--minimal" : ""
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
        {showConversationUI ? (
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

      {showConversationUI ? (
        <div
          className="image-studio-prompt-guide-messages image-studio-prompt-guide-messages--conversation studio-subtle-scrollbar"
          role="log"
          aria-live="polite"
        >
          {isPackshotGuide ? (
            <>
              <ConversationBubble role="bot" visible={isBotVisible("product")}>
                <p className="image-studio-prompt-guide-bubble-text">
                  Décris ton produit (nom, matière visible, couleur dominante)
                </p>
                {guideStep === "product" ? (
                  <>
                    <div className="image-studio-prompt-guide-bubble-compose">{composeForm}</div>
                    <GuideProductImagePicker
                      disabled={false}
                      previewUrl={guideProductImagePreview}
                      errorMessage={guideProductImageError}
                      onPickFile={handleGuideProductImagePick}
                    />
                  </>
                ) : null}
              </ConversationBubble>

              {packshotProductValidationShown ? (
                <ConversationBubble role="bot" visible={isBotVisible("product-validation")}>
                  <p className="image-studio-prompt-guide-bubble-text">{template.botAskRequired}</p>
                </ConversationBubble>
              ) : null}

              {packshotProductDescription ? (
                <ConversationBubble role="user">
                  {guideProductImagePreview || slots.productImageUrl ? (
                    <div className="image-studio-prompt-ugc-product-answer">
                      <img
                        src={guideProductImagePreview || slots.productImageUrl}
                        alt=""
                        className="image-studio-prompt-ugc-product-answer-img"
                      />
                      <p className="image-studio-prompt-guide-bubble-text">{packshotProductDescription}</p>
                    </div>
                  ) : (
                    <p className="image-studio-prompt-guide-bubble-text">{packshotProductDescription}</p>
                  )}
                </ConversationBubble>
              ) : null}

              {packshotProductDescription ? (
                <ConversationBubble role="bot" wide visible={isBotVisible("position")}>
                  <p className="image-studio-prompt-guide-bubble-text">
                    Comment le produit est-il positionné ?
                  </p>
                  {guideStep === "position" ? (
                    <PackshotOptionButtonRow
                      options={PACKSHOT_POSITION_OPTIONS}
                      selectedId={slots.positionId}
                      disabled={false}
                      onSelect={handlePackshotPositionSelect}
                      ariaLabel="Position du produit"
                    />
                  ) : null}
                </ConversationBubble>
              ) : null}

              {packshotPositionLabel ? (
                <ConversationBubble role="user">
                  <p className="image-studio-prompt-guide-bubble-text">{packshotPositionLabel}</p>
                </ConversationBubble>
              ) : null}

              {slots.positionId ? (
                <ConversationBubble role="bot" visible={isBotVisible("background")}>
                  <p className="image-studio-prompt-guide-bubble-text">Quel type de fond veux-tu ?</p>
                  {guideStep === "background" ? (
                    <PackshotOptionButtonRow
                      options={PACKSHOT_BACKGROUND_OPTIONS}
                      selectedId={slots.backgroundId}
                      disabled={false}
                      onSelect={handlePackshotBackgroundSelect}
                      ariaLabel="Type de fond"
                    />
                  ) : null}
                </ConversationBubble>
              ) : null}

              {packshotBackgroundLabel ? (
                <ConversationBubble role="user">
                  <p className="image-studio-prompt-guide-bubble-text">{packshotBackgroundLabel}</p>
                </ConversationBubble>
              ) : null}

              {slots.backgroundId === "environnement" ? (
                <ConversationBubble role="bot" wide visible={isBotVisible("ambiance")}>
                  <p className="image-studio-prompt-guide-bubble-text">Quelle ambiance ?</p>
                  {guideStep === "ambiance" ? (
                    <PackshotOptionButtonRow
                      options={PACKSHOT_AMBIANCE_OPTIONS}
                      selectedId={slots.ambianceId}
                      disabled={false}
                      onSelect={handlePackshotAmbianceSelect}
                      ariaLabel="Ambiance environnement"
                    />
                  ) : null}
                </ConversationBubble>
              ) : null}

              {slots.backgroundId === "environnement" && packshotAmbianceLabel && slots.ambianceId ? (
                <ConversationBubble role="user">
                  <p className="image-studio-prompt-guide-bubble-text">{packshotAmbianceLabel}</p>
                </ConversationBubble>
              ) : null}

              {guideStep === "customAmbiance" || (slots.ambianceId === "autre" && slots.customAmbiance) ? (
                <ConversationBubble role="bot" visible={isBotVisible("customAmbiance")}>
                  <p className="image-studio-prompt-guide-bubble-text">
                    Précise ton ambiance personnalisée
                  </p>
                  {guideStep === "customAmbiance" ? (
                    <div className="image-studio-prompt-guide-bubble-compose">{composeForm}</div>
                  ) : null}
                </ConversationBubble>
              ) : null}

              {(slots.interactionId || guideStep === "interaction") &&
              (slots.backgroundId === "neutre" || slots.ambianceId) ? (
                <ConversationBubble role="bot" wide visible={isBotVisible("interaction")}>
                  <p className="image-studio-prompt-guide-bubble-text">
                    Veux-tu ajouter un effet dynamique ?
                  </p>
                  {guideStep === "interaction" ? (
                    <div className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions">
                      <PackshotOptionButtonRow
                        options={PACKSHOT_INTERACTION_OPTIONS}
                        selectedId={slots.interactionId}
                        disabled={false}
                        onSelect={handlePackshotInteractionSelect}
                        ariaLabel="Effet dynamique"
                      />
                      <button
                        type="button"
                        className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                        onClick={handlePackshotInteractionSkip}
                      >
                        Passer
                      </button>
                    </div>
                  ) : null}
                </ConversationBubble>
              ) : null}

              {packshotInteractionLabel && slots.interactionId ? (
                <ConversationBubble role="user">
                  <p className="image-studio-prompt-guide-bubble-text">{packshotInteractionLabel}</p>
                </ConversationBubble>
              ) : null}

              {(slots.productStateId || guideStep === "state") && slots.interactionId ? (
                <ConversationBubble role="bot" wide visible={isBotVisible("state")}>
                  <p className="image-studio-prompt-guide-bubble-text">
                    Produit neuf/fermé ou entamé/ouvert ?
                  </p>
                  {guideStep === "state" ? (
                    <div className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions">
                      <PackshotOptionButtonRow
                        options={PACKSHOT_STATE_OPTIONS}
                        selectedId={slots.productStateId}
                        disabled={false}
                        onSelect={handlePackshotStateSelect}
                        ariaLabel="État du produit"
                      />
                      <button
                        type="button"
                        className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                        onClick={handlePackshotStateSkip}
                      >
                        Passer
                      </button>
                    </div>
                  ) : null}
                </ConversationBubble>
              ) : null}

              {packshotStateLabel && slots.productStateId ? (
                <ConversationBubble role="user">
                  <p className="image-studio-prompt-guide-bubble-text">{packshotStateLabel}</p>
                </ConversationBubble>
              ) : null}

              {(guideStep === "format" || ready) && slots.productStateId ? (
                <ConversationBubble role="bot" wide visible={isBotVisible("format")}>
                  <p className="image-studio-prompt-guide-bubble-text">Format de destination ?</p>
                  {guideStep === "format" && !ready ? (
                    <div className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions">
                      <PackshotOptionButtonRow
                        options={PACKSHOT_FORMAT_OPTIONS}
                        selectedId={slots.formatId}
                        disabled={false}
                        onSelect={handlePackshotFormatSelect}
                        ariaLabel="Format de destination"
                      />
                      <button
                        type="button"
                        className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                        onClick={handlePackshotFormatSkip}
                      >
                        Passer
                      </button>
                    </div>
                  ) : null}
                </ConversationBubble>
              ) : null}

              {packshotFormatLabel && ready ? (
                <ConversationBubble role="user">
                  <p className="image-studio-prompt-guide-bubble-text">{packshotFormatLabel}</p>
                </ConversationBubble>
              ) : null}
            </>
          ) : (
            <>
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

          {showLifestyleFramingBot ? (
            <ConversationBubble role="bot" wide visible={isBotVisible("framing")}>
              <p className="image-studio-prompt-guide-bubble-text">Quel cadrage ?</p>
              <p className="image-studio-prompt-guide-bubble-text image-studio-prompt-guide-bubble-hint">
                {selectedShotId === "deux-mains"
                  ? "Serré : produit dominant. Large : plan moyen — mains et action visibles, décor plus présent."
                  : "Serré : produit dominant. Large : produit intégré dans la scène."}
              </p>
              {guideStep === "framing" && !lifestyleFramingId ? (
                <PackshotOptionButtonRow
                  options={LIFESTYLE_FRAMING_OPTIONS}
                  selectedId={lifestyleFramingId}
                  disabled={false}
                  onSelect={handleLifestyleFramingSelect}
                  ariaLabel="Cadrage lifestyle"
                />
              ) : null}
            </ConversationBubble>
          ) : null}

          {lifestyleFramingLabel ? (
            <ConversationBubble role="user">
              <p className="image-studio-prompt-guide-bubble-text">{lifestyleFramingLabel}</p>
            </ConversationBubble>
          ) : null}

          {showLifestyleProductBot ? (
            <ConversationBubble role="bot" visible={isBotVisible("drink") || isBotVisible("product")}>
              <p className="image-studio-prompt-guide-bubble-text">
                {isLifestyleGuide ? template.botIntro : "Quelle boisson ?"}
              </p>
              {(isLifestyleGuide ? guideStep === "product" : guideStep === "drink") ? (
                <>
                  <div className="image-studio-prompt-guide-bubble-compose">{composeForm}</div>
                  {isLifestyleGuide && guideStep === "product" ? (
                    <GuideProductImagePicker
                      disabled={false}
                      previewUrl={guideProductImagePreview}
                      errorMessage={guideProductImageError}
                      onPickFile={handleGuideProductImagePick}
                    />
                  ) : null}
                </>
              ) : null}
            </ConversationBubble>
          ) : null}

          {isLifestyleGuide && lifestyleProductDescription ? (
            <ConversationBubble role="user">
              {slots.productImageUrl ? (
                <div className="image-studio-prompt-ugc-product-answer">
                  <img
                    src={slots.productImageUrl}
                    alt=""
                    className="image-studio-prompt-ugc-product-answer-img"
                  />
                  <p className="image-studio-prompt-guide-bubble-text">{lifestyleProductDescription}</p>
                </div>
              ) : (
                <p className="image-studio-prompt-guide-bubble-text">{lifestyleProductDescription}</p>
              )}
            </ConversationBubble>
          ) : null}

          {!isLifestyleGuide && userMessages[0] ? (
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

          {isLifestyleGuide && userMessages[0] ? (
            <ConversationBubble role="user">
              <p className="image-studio-prompt-guide-bubble-text">{userMessages[0].text}</p>
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
            </>
          )}

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
      className="image-studio-prompts-modal-backdrop"
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
            <header className="image-studio-prompts-hub-header">
              <div className="image-studio-prompts-hub-title-row">
                <span className="image-studio-prompts-hub-badge" aria-hidden>
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <h2 id="image-studio-prompts-title" className="image-studio-prompts-hub-title">
                  Type d&apos;image
                </h2>
              </div>
              <button
                type="button"
                className="image-studio-prompts-hub-close"
                onClick={onClose}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="image-studio-prompts-list image-studio-prompts-visual-grid studio-subtle-scrollbar">
              {IMAGE_STUDIO_PROMPT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="image-studio-prompt-visual-tile"
                  onClick={() => openTemplate(template)}
                  aria-label={`Ouvrir le guide ${template.label}`}
                >
                  <div className="image-studio-prompt-visual-tile-frame">
                    {template.heroImage ? (
                      <img
                        src={template.heroImage}
                        alt=""
                        className="image-studio-prompt-visual-tile-img"
                      />
                    ) : (
                      <span className="image-studio-prompt-visual-tile-fallback">
                        <TemplateIcon icon={template.icon} className="h-5 w-5" />
                      </span>
                    )}
                  </div>
                  <span className="image-studio-prompt-visual-tile-label">{template.label}</span>
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
          ) : isUgcPresentationGuideTemplate(activeTemplate) ? (
            <UgcPresentationPromptGuideChat
              template={activeTemplate}
              onBack={handleBack}
              onApplyPrompt={onApplyPrompt}
              onClose={onClose}
            />
          ) : isBrandCampaignShootGuideTemplate(activeTemplate) ? (
            <BrandCampaignShootPromptGuideChat
              template={activeTemplate}
              onBack={handleBack}
              onApplyPrompt={onApplyPrompt}
              onClose={onClose}
            />
          ) : isEditorialWornHeldGuideTemplate(activeTemplate) ? (
            <EditorialWornHeldPromptGuideChat
              template={activeTemplate}
              onBack={handleBack}
              onApplyPrompt={onApplyPrompt}
              onClose={onClose}
            />
          ) : isProduitEnApplicationGuideTemplate(activeTemplate) ? (
            <ProduitEnApplicationPromptGuideChat
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
