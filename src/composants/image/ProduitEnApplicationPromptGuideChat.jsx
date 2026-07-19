import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, SendHorizontal } from "lucide-react";
import {
  assembleProduitApplicationPromptFromSlots,
  isProduitEnApplicationGuideReady,
} from "@/bibliotheque/imageStudio/produitEnApplicationAssembly";
import {
  getProduitApplicationBodyZoneOptions,
  getProduitApplicationObjectOptionsForZone,
  PRODUIT_APPLICATION_CONTAINER_OPTIONS,
  PRODUIT_APPLICATION_DECOR_OPTIONS,
  PRODUIT_APPLICATION_GENDER_OPTIONS,
  PRODUIT_APPLICATION_LIGHTING_OPTIONS,
  PRODUIT_APPLICATION_POSTURE_OPTIONS,
  PRODUIT_APPLICATION_PRODUCT_TYPE_OPTIONS,
  PRODUIT_APPLICATION_TEXTURE_TYPE_OPTIONS,
  resolveProduitApplicationDefaultLightingId,
} from "@/bibliotheque/imageStudio/produitEnApplicationConfig";
import { fillTemplateSlotDefaults } from "@/bibliotheque/imageStudio/promptTemplateEngine";
import { IMAGE_STUDIO_PRODUCT_MENTION_TOKEN } from "@/bibliotheque/imageStudio/imageStudioGuideApply";
import { readGuideProductImageFile } from "@/bibliotheque/imageStudio/guideProductImage";
import GuideProductImagePicker from "@/composants/image/GuideProductImagePicker";
import { useImageStudioChatbotTr } from "@/bibliotheque/i18n/useImageStudioChatbotTr";
import { translateLabeledOptions } from "@/bibliotheque/i18n/chatbotTranslate";
import { genderFromContext, shouldSkipIdentitySteps } from "@/bibliotheque/imageStudio/promptFromImage";

/** @typedef {'productType' | 'gender' | 'bodyZone' | 'container' | 'textureOrObject' | 'posture' | 'decor' | 'lighting' | 'product' | 'ready'} ProduitApplicationGuideStep */

const BOT_TYPING_DELAY_MS = 520;

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

function TypingIndicator({ visible = true, typingLabel = "Le guide écrit…" }) {
  if (!visible) return null;

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

function OptionButtonRow({ options, selectedId, disabled, onSelect, ariaLabel }) {
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

function OptionGrid({ options, selectedId, disabled, onSelect, ariaLabel }) {
  return (
    <div
      className="image-studio-prompt-ugc-option-grid image-studio-prompt-ugc-option-grid--wrap"
      role="radiogroup"
      aria-label={ariaLabel}
    >
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

function SkipButton({ disabled, onClick, label = "Passer" }) {
  return (
    <div className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions">
      <button
        type="button"
        className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
        disabled={disabled}
        onClick={onClick}
      >
        {label}
      </button>
    </div>
  );
}

function findOptionLabel(options, id) {
  return options.find((item) => item.id === id)?.label ?? null;
}

export default function ProduitEnApplicationPromptGuideChat({
  template,
  onBack,
  onApplyPrompt,
  onClose,
  fromImageContext = null,
}) {
  const { ui, tr, template: localizeTemplate, locale } = useImageStudioChatbotTr();
  const localizedTemplate = useMemo(
    () => localizeTemplate(template),
    [localizeTemplate, template, locale],
  );
  const localizedProductTypeOptions = useMemo(
    () =>
      translateLabeledOptions(
        PRODUIT_APPLICATION_PRODUCT_TYPE_OPTIONS,
        tr,
        "chatbot.produitApplication.productType",
      ),
    [tr],
  );
  const localizedGenderOptions = useMemo(
    () =>
      translateLabeledOptions(
        PRODUIT_APPLICATION_GENDER_OPTIONS,
        tr,
        "chatbot.produitApplication.gender",
      ),
    [tr],
  );
  const localizedContainerOptions = useMemo(
    () =>
      translateLabeledOptions(
        PRODUIT_APPLICATION_CONTAINER_OPTIONS,
        tr,
        "chatbot.produitApplication.container",
      ),
    [tr],
  );
  const localizedTextureTypeOptions = useMemo(
    () =>
      translateLabeledOptions(
        PRODUIT_APPLICATION_TEXTURE_TYPE_OPTIONS,
        tr,
        "chatbot.produitApplication.textureType",
      ),
    [tr],
  );
  const localizedPostureOptions = useMemo(
    () =>
      translateLabeledOptions(
        PRODUIT_APPLICATION_POSTURE_OPTIONS,
        tr,
        "chatbot.produitApplication.posture",
      ),
    [tr],
  );
  const localizedDecorOptions = useMemo(
    () =>
      translateLabeledOptions(
        PRODUIT_APPLICATION_DECOR_OPTIONS,
        tr,
        "chatbot.produitApplication.decor",
      ),
    [tr],
  );
  const localizedLightingOptions = useMemo(
    () =>
      translateLabeledOptions(
        PRODUIT_APPLICATION_LIGHTING_OPTIONS,
        tr,
        "chatbot.produitApplication.lighting",
      ),
    [tr],
  );

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const skipIdentity = shouldSkipIdentitySteps(fromImageContext);
  const seededGender = genderFromContext(fromImageContext);

  const [productTypeId, setProductTypeId] = useState(null);
  const [genderId, setGenderId] = useState(seededGender);
  const [bodyZoneId, setBodyZoneId] = useState(null);
  const [containerId, setContainerId] = useState(null);
  const [textureTypeId, setTextureTypeId] = useState(null);
  const [objectTypeId, setObjectTypeId] = useState(null);
  const [postureId, setPostureId] = useState(null);
  const [decorId, setDecorId] = useState(null);
  const [lightingId, setLightingId] = useState(null);

  const [guideStep, setGuideStep] = useState(/** @type {ProduitApplicationGuideStep} */ ("productType"));
  const [slots, setSlots] = useState(() =>
    skipIdentity && seededGender ? { genderId: seededGender } : {},
  );
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [productValidationShown, setProductValidationShown] = useState(false);
  const [guideProductImagePreview, setGuideProductImagePreview] = useState(null);
  const [guideProductImageError, setGuideProductImageError] = useState(null);

  const isTextureGuide = productTypeId === "texture";
  const bodyZoneOptions = useMemo(
    () =>
      translateLabeledOptions(
        getProduitApplicationBodyZoneOptions(productTypeId),
        tr,
        "chatbot.produitApplication.bodyZone",
      ),
    [productTypeId, tr],
  );
  const objectOptions = useMemo(
    () =>
      translateLabeledOptions(
        getProduitApplicationObjectOptionsForZone(bodyZoneId),
        tr,
        "chatbot.produitApplication.objectType",
      ),
    [bodyZoneId, tr],
  );

  const filledSlots = useMemo(() => fillTemplateSlotDefaults(localizedTemplate, slots), [localizedTemplate, slots]);

  const assembledPrompt = useMemo(() => {
    if (!ready) return "";
    return assembleProduitApplicationPromptFromSlots(slots);
  }, [ready, slots]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [guideStep]);

  const finalizeGuide = useCallback((nextSlots) => {
    setSlots(nextSlots);
    setReady(true);
    setGuideStep("ready");
  }, []);

  const handleProductTypeSelect = useCallback((nextProductTypeId) => {
    setProductTypeId(nextProductTypeId);
    setBodyZoneId(null);
    setContainerId(null);
    setTextureTypeId(null);
    setObjectTypeId(null);
    setSlots((prev) => ({
      ...prev,
      productTypeId: nextProductTypeId,
      bodyZoneId: "",
      containerId: "",
      textureTypeId: "",
      objectTypeId: "",
      ...(skipIdentity && seededGender ? { genderId: seededGender } : {}),
    }));
    if (skipIdentity && seededGender) {
      setGenderId(seededGender);
      setGuideStep("bodyZone");
    } else {
      setGuideStep("gender");
    }
  }, [seededGender, skipIdentity]);

  const handleGenderSelect = useCallback((nextGenderId) => {
    setGenderId(nextGenderId);
    setSlots((prev) => ({ ...prev, genderId: nextGenderId }));
    setGuideStep("bodyZone");
  }, []);

  const handleBodyZoneSelect = useCallback(
    (nextBodyZoneId) => {
      setBodyZoneId(nextBodyZoneId);
      setTextureTypeId(null);
      setObjectTypeId(null);
      setSlots((prev) => ({
        ...prev,
        bodyZoneId: nextBodyZoneId,
        textureTypeId: "",
        objectTypeId: "",
      }));
      setGuideStep(productTypeId === "objet" ? "textureOrObject" : "container");
    },
    [productTypeId],
  );

  const handleContainerSelect = useCallback((nextContainerId) => {
    setContainerId(nextContainerId);
    setSlots((prev) => ({ ...prev, containerId: nextContainerId }));
    setGuideStep("textureOrObject");
  }, []);

  const handleContainerSkip = useCallback(() => {
    setContainerId("visible");
    setSlots((prev) => ({ ...prev, containerId: "visible" }));
    setGuideStep("textureOrObject");
  }, []);

  const handleTextureTypeSelect = useCallback((nextTextureTypeId) => {
    setTextureTypeId(nextTextureTypeId);
    setSlots((prev) => ({ ...prev, textureTypeId: nextTextureTypeId }));
    setGuideStep("posture");
  }, []);

  const handleObjectTypeSelect = useCallback((nextObjectTypeId) => {
    setObjectTypeId(nextObjectTypeId);
    setSlots((prev) => ({ ...prev, objectTypeId: nextObjectTypeId }));
    setGuideStep("posture");
  }, []);

  const handlePostureSelect = useCallback((nextPostureId) => {
    setPostureId(nextPostureId);
    setSlots((prev) => ({ ...prev, postureId: nextPostureId }));
    setGuideStep("decor");
  }, []);

  const handlePostureSkip = useCallback(() => {
    setPostureId("debout");
    setSlots((prev) => ({ ...prev, postureId: "debout" }));
    setGuideStep("decor");
  }, []);

  const handleDecorSelect = useCallback((nextDecorId) => {
    setDecorId(nextDecorId);
    setLightingId(null);
    setSlots((prev) => ({
      ...prev,
      decorId: nextDecorId,
      lightingId: "",
    }));
    setGuideStep("lighting");
  }, []);

  const handleDecorSkip = useCallback(() => {
    const nextDecorId = "studio";
    setDecorId(nextDecorId);
    setLightingId(null);
    setSlots((prev) => ({
      ...prev,
      decorId: nextDecorId,
      lightingId: "",
    }));
    setGuideStep("lighting");
  }, []);

  const handleLightingSelect = useCallback((nextLightingId) => {
    setLightingId(nextLightingId);
    setSlots((prev) => ({ ...prev, lightingId: nextLightingId }));
    setGuideStep("product");
  }, []);

  const handleLightingSkip = useCallback(() => {
    const defaultLighting = resolveProduitApplicationDefaultLightingId(decorId ?? "studio");
    setLightingId(defaultLighting);
    setSlots((prev) => ({ ...prev, lightingId: defaultLighting }));
    setGuideStep("product");
  }, [decorId]);

  useEffect(() => {
    if (guideStep !== "lighting") return;

    const defaultLighting = resolveProduitApplicationDefaultLightingId(decorId ?? "studio");
    setLightingId(defaultLighting);
    setSlots((prev) => {
      if (prev.lightingId === defaultLighting) return prev;
      return { ...prev, lightingId: defaultLighting };
    });
  }, [decorId, guideStep]);

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

  const handleProductSubmit = useCallback(
    (raw) => {
      const productName = raw.trim();
      const hasImage = Boolean(guideProductImagePreview);
      if (productName.length < 2 && !hasImage) {
        setProductValidationShown(true);
        return;
      }
      setProductValidationShown(false);
      setDraft("");
      const nextSlots = {
        ...slots,
        productName: productName.length >= 2 ? productName : IMAGE_STUDIO_PRODUCT_MENTION_TOKEN,
        productImageUrl: guideProductImagePreview,
      };
      setSlots(nextSlots);
      finalizeGuide(nextSlots);
    },
    [finalizeGuide, guideProductImagePreview, slots],
  );

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (guideStep === "product") {
        handleProductSubmit(draft);
      }
    },
    [draft, guideStep, handleProductSubmit],
  );

  const handleSlotChange = useCallback((key, value) => {
    setSlots((prev) => {
      const next = { ...prev, [key]: value };
      setReady(isProduitEnApplicationGuideReady(next));
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    if (!assembledPrompt) return;
    onApplyPrompt({
      prompt: assembledPrompt,
      productImageUrl: slots.productImageUrl || null,
      avatarUrl: fromImageContext?.avatarUrl || null,
    });
    onClose();
  }, [assembledPrompt, fromImageContext?.avatarUrl, onApplyPrompt, onClose, slots.productImageUrl]);

  const canSubmitGuideProduct = Boolean(draft.trim()) || Boolean(guideProductImagePreview);

  const composeForm =
    guideStep === "product" && !ready ? (
      <form className="image-studio-prompt-guide-compose" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={ui("produitNamePlaceholder", "Ex. crème hydratante SPF 50, sérum vitamine C…")}
          className="image-studio-prompt-guide-input"
          aria-label={ui("produitNameAria", "Nom du produit")}
        />
        <button
          type="submit"
          className="image-studio-prompt-guide-send"
          disabled={!canSubmitGuideProduct}
          aria-label={ui("send", "Envoyer")}
        >
          <SendHorizontal className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </form>
    ) : null;

  const productTypeLabel = findOptionLabel(localizedProductTypeOptions, productTypeId);
  const genderLabel = findOptionLabel(localizedGenderOptions, genderId);
  const bodyZoneLabel = findOptionLabel(bodyZoneOptions, bodyZoneId);
  const containerLabel = findOptionLabel(localizedContainerOptions, containerId);
  const textureLabel = findOptionLabel(localizedTextureTypeOptions, textureTypeId);
  const objectLabel = findOptionLabel(objectOptions, objectTypeId);
  const postureLabel = findOptionLabel(localizedPostureOptions, postureId);
  const decorLabel = findOptionLabel(localizedDecorOptions, decorId);
  const lightingLabel = findOptionLabel(localizedLightingOptions, lightingId);
  const resolvedLightingId = lightingId ?? slots.lightingId ?? null;
  const productName = slots.productName?.trim() ?? "";

  const textureOrObjectAnswerLabel = isTextureGuide ? textureLabel : objectLabel;

  const postureAnswerLabel = useMemo(() => {
    if (!postureId && guideStep !== "posture" && !ready) return null;
    if (postureId === "debout" && (guideStep === "decor" || guideStep === "lighting" || guideStep === "product" || ready)) {
      if (slots.postureId === "debout" && guideStep !== "posture") {
        return ui("produitStandingDefault", "Debout (par défaut)");
      }
    }
    return postureLabel;
  }, [guideStep, postureId, postureLabel, ready, slots.postureId, ui]);

  const botTurnKeys = useMemo(() => {
    const keys = ["productType"];
    if (productTypeId) keys.push("gender");
    if (genderId) keys.push("bodyZone");
    if (bodyZoneId && isTextureGuide) keys.push("container");
    const canShowTextureOrObject =
      isTextureGuide
        ? containerId || guideStep === "textureOrObject" || textureOrObjectAnswerLabel
        : bodyZoneId && (guideStep === "textureOrObject" || textureOrObjectAnswerLabel);
    if (canShowTextureOrObject) keys.push("textureOrObject");
    if (textureOrObjectAnswerLabel) keys.push("posture");
    if (postureAnswerLabel || guideStep === "posture") keys.push("posture-answer");
    if (decorId || guideStep === "decor" || decorLabel) keys.push("decor");
    if (resolvedLightingId || guideStep === "lighting") keys.push("lighting");
    if (guideStep === "product" || productName) keys.push("product");
    if (productValidationShown) keys.push("product-validation");
    if (ready) keys.push("result");
    return keys;
  }, [
    bodyZoneId,
    containerId,
    decorId,
    decorLabel,
    genderId,
    guideStep,
    isTextureGuide,
    postureAnswerLabel,
    productName,
    productTypeId,
    productValidationShown,
    ready,
    resolvedLightingId,
    textureOrObjectAnswerLabel,
  ]);

  const { isBotVisible, isTyping } = useConversationBotVisibility(botTurnKeys);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [adjustOpen, botTurnKeys.length, guideStep, isTyping, ready]);

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
        {ui("adjustFields", "Ajuster les champs")}
        {adjustOpen ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
        )}
      </button>

      {adjustOpen ? (
        <div className="image-studio-prompt-guide-fields">
          {localizedTemplate.variables.map((variable) => (
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
        {ui("applyPrompt", "Appliquer au prompt")}
      </button>
    </div>
  ) : null;

  const skipLabel = ui("pass", "Passer");

  return (
    <div className="image-studio-prompt-guide-chat image-studio-prompt-guide-chat--conversation">
      <div className="image-studio-prompt-guide-chat-head image-studio-prompt-guide-chat-head--minimal">
        <button
          type="button"
          className="image-studio-prompt-guide-back"
          onClick={onBack}
          aria-label={ui("back", "Retour aux modèles")}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <div className="image-studio-prompt-guide-chat-title-row">
          <p className="image-studio-prompt-guide-chat-title">{localizedTemplate.label}</p>
          <span className="pulse-dot pulse-dot--online shrink-0" aria-hidden="true" />
        </div>
      </div>

      <div
        className="image-studio-prompt-guide-messages image-studio-prompt-guide-messages--conversation studio-subtle-scrollbar"
        role="log"
        aria-live="polite"
      >
        <ConversationBubble role="bot" visible={isBotVisible("productType")}>
          <p className="image-studio-prompt-guide-bubble-text">
            {ui("produitTypeQuestion", "Quel type de produit ?")}
          </p>
          {guideStep === "productType" ? (
            <OptionButtonRow
              options={localizedProductTypeOptions}
              selectedId={productTypeId}
              disabled={false}
              onSelect={handleProductTypeSelect}
              ariaLabel={ui("produitTypeAria", "Type de produit")}
            />
          ) : null}
        </ConversationBubble>

        {productTypeLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{productTypeLabel}</p>
          </ConversationBubble>
        ) : null}

        {productTypeId ? (
          <ConversationBubble role="bot" visible={isBotVisible("gender")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("produitModelGender", "Sexe du modèle")}
            </p>
            {guideStep === "gender" ? (
              <OptionButtonRow
                options={localizedGenderOptions}
                selectedId={genderId}
                disabled={false}
                onSelect={handleGenderSelect}
                ariaLabel={ui("produitModelGender", "Sexe du modèle")}
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {genderLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{genderLabel}</p>
          </ConversationBubble>
        ) : null}

        {genderId ? (
          <ConversationBubble role="bot" visible={isBotVisible("bodyZone")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("produitBodyZone", "Zone du corps")}
            </p>
            {guideStep === "bodyZone" ? (
              <OptionGrid
                options={bodyZoneOptions}
                selectedId={bodyZoneId}
                disabled={false}
                onSelect={handleBodyZoneSelect}
                ariaLabel={ui("produitBodyZone", "Zone du corps")}
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {bodyZoneLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{bodyZoneLabel}</p>
          </ConversationBubble>
        ) : null}

        {bodyZoneId && isTextureGuide ? (
          <ConversationBubble role="bot" visible={isBotVisible("container")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("produitContainer", "Contenant")}
            </p>
            {guideStep === "container" ? (
              <>
                <OptionButtonRow
                  options={localizedContainerOptions}
                  selectedId={containerId}
                  disabled={false}
                  onSelect={handleContainerSelect}
                  ariaLabel={ui("produitContainer", "Contenant")}
                />
                <SkipButton disabled={false} onClick={handleContainerSkip} label={skipLabel} />
              </>
            ) : null}
          </ConversationBubble>
        ) : null}

        {containerLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{containerLabel}</p>
          </ConversationBubble>
        ) : null}

        {(isTextureGuide ? containerId || guideStep === "textureOrObject" : bodyZoneId) &&
        bodyZoneId ? (
          <ConversationBubble role="bot" visible={isBotVisible("textureOrObject")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {isTextureGuide
                ? ui("produitTextureType", "Type de texture")
                : ui("produitObjectType", "Type d'objet")}
            </p>
            {guideStep === "textureOrObject" ? (
              <OptionGrid
                options={isTextureGuide ? localizedTextureTypeOptions : objectOptions}
                selectedId={isTextureGuide ? textureTypeId : objectTypeId}
                disabled={false}
                onSelect={isTextureGuide ? handleTextureTypeSelect : handleObjectTypeSelect}
                ariaLabel={
                  isTextureGuide
                    ? ui("produitTextureType", "Type de texture")
                    : ui("produitObjectType", "Type d'objet")
                }
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {textureOrObjectAnswerLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{textureOrObjectAnswerLabel}</p>
          </ConversationBubble>
        ) : null}

        {textureOrObjectAnswerLabel ? (
          <ConversationBubble role="bot" visible={isBotVisible("posture")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("produitPosture", "Posture")}
            </p>
            {guideStep === "posture" ? (
              <>
                <OptionButtonRow
                  options={localizedPostureOptions}
                  selectedId={postureId}
                  disabled={false}
                  onSelect={handlePostureSelect}
                  ariaLabel={ui("produitPosture", "Posture")}
                />
                <SkipButton disabled={false} onClick={handlePostureSkip} label={skipLabel} />
              </>
            ) : null}
          </ConversationBubble>
        ) : null}

        {postureAnswerLabel ? (
          <ConversationBubble role="user" visible={isBotVisible("posture-answer")}>
            <p className="image-studio-prompt-guide-bubble-text">{postureAnswerLabel}</p>
          </ConversationBubble>
        ) : null}

        {textureOrObjectAnswerLabel ? (
          <ConversationBubble role="bot" visible={isBotVisible("decor")}>
            <p className="image-studio-prompt-guide-bubble-text">{ui("produitDecor", "Décor")}</p>
            {guideStep === "decor" ? (
              <>
                <OptionButtonRow
                  options={localizedDecorOptions}
                  selectedId={decorId}
                  disabled={false}
                  onSelect={handleDecorSelect}
                  ariaLabel={ui("produitDecor", "Décor")}
                />
                <SkipButton disabled={false} onClick={handleDecorSkip} label={skipLabel} />
              </>
            ) : null}
          </ConversationBubble>
        ) : null}

        {decorLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{decorLabel}</p>
          </ConversationBubble>
        ) : null}

        {(decorId || guideStep === "lighting") && textureOrObjectAnswerLabel ? (
          <ConversationBubble role="bot" visible={isBotVisible("lighting")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("produitLighting", "Éclairage")}
            </p>
            {guideStep === "lighting" ? (
              <>
                <OptionButtonRow
                  options={localizedLightingOptions}
                  selectedId={resolvedLightingId}
                  disabled={false}
                  onSelect={handleLightingSelect}
                  ariaLabel={ui("produitLighting", "Éclairage")}
                />
                <SkipButton disabled={false} onClick={handleLightingSkip} label={skipLabel} />
              </>
            ) : null}
          </ConversationBubble>
        ) : null}

        {lightingLabel && guideStep !== "lighting" ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{lightingLabel}</p>
          </ConversationBubble>
        ) : null}

        {(guideStep === "product" || productName) && resolvedLightingId ? (
          <ConversationBubble role="bot" visible={isBotVisible("product")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("produitNameQuestion", "Nom du produit")}
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
        ) : null}

        {productValidationShown ? (
          <ConversationBubble role="bot" visible={isBotVisible("product-validation")}>
            <p className="image-studio-prompt-guide-bubble-text">{localizedTemplate.botAskRequired}</p>
          </ConversationBubble>
        ) : null}

        {productName ? (
          <ConversationBubble role="user">
            {slots.productImageUrl ? (
              <div className="image-studio-prompt-ugc-product-answer">
                <img
                  src={slots.productImageUrl}
                  alt=""
                  className="image-studio-prompt-ugc-product-answer-img"
                />
                <p className="image-studio-prompt-guide-bubble-text">{productName}</p>
              </div>
            ) : (
              <p className="image-studio-prompt-guide-bubble-text">{productName}</p>
            )}
          </ConversationBubble>
        ) : null}

        {ready ? (
          <ConversationBubble role="bot" wide visible={isBotVisible("result")}>
            {promptResultBlock}
          </ConversationBubble>
        ) : null}

        <TypingIndicator visible={isTyping} typingLabel={ui("typing", "Le guide écrit…")} />
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
