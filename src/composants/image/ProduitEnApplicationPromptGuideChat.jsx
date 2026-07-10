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
}) {
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [productTypeId, setProductTypeId] = useState(null);
  const [genderId, setGenderId] = useState(null);
  const [bodyZoneId, setBodyZoneId] = useState(null);
  const [containerId, setContainerId] = useState(null);
  const [textureTypeId, setTextureTypeId] = useState(null);
  const [objectTypeId, setObjectTypeId] = useState(null);
  const [postureId, setPostureId] = useState(null);
  const [decorId, setDecorId] = useState(null);
  const [lightingId, setLightingId] = useState(null);

  const [guideStep, setGuideStep] = useState(/** @type {ProduitApplicationGuideStep} */ ("productType"));
  const [slots, setSlots] = useState({});
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [productValidationShown, setProductValidationShown] = useState(false);
  const [guideProductImagePreview, setGuideProductImagePreview] = useState(null);
  const [guideProductImageError, setGuideProductImageError] = useState(null);

  const isTextureGuide = productTypeId === "texture";
  const bodyZoneOptions = useMemo(
    () => getProduitApplicationBodyZoneOptions(productTypeId),
    [productTypeId],
  );
  const objectOptions = useMemo(
    () => getProduitApplicationObjectOptionsForZone(bodyZoneId),
    [bodyZoneId],
  );

  const filledSlots = useMemo(() => fillTemplateSlotDefaults(template, slots), [template, slots]);

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
    }));
    setGuideStep("gender");
  }, []);

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
    if (slots.productImageUrl) {
      onApplyPrompt({ prompt: assembledPrompt, productImageUrl: slots.productImageUrl });
    } else {
      onApplyPrompt(assembledPrompt);
    }
    onClose();
  }, [assembledPrompt, onApplyPrompt, onClose, slots.productImageUrl]);

  const canSubmitGuideProduct = Boolean(draft.trim()) || Boolean(guideProductImagePreview);

  const composeForm =
    guideStep === "product" && !ready ? (
      <form className="image-studio-prompt-guide-compose" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ex. crème hydratante SPF 50, sérum vitamine C…"
          className="image-studio-prompt-guide-input"
          aria-label="Nom du produit"
        />
        <button
          type="submit"
          className="image-studio-prompt-guide-send"
          disabled={!canSubmitGuideProduct}
          aria-label="Envoyer"
        >
          <SendHorizontal className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </form>
    ) : null;

  const productTypeLabel = findOptionLabel(PRODUIT_APPLICATION_PRODUCT_TYPE_OPTIONS, productTypeId);
  const genderLabel = findOptionLabel(PRODUIT_APPLICATION_GENDER_OPTIONS, genderId);
  const bodyZoneLabel = findOptionLabel(bodyZoneOptions, bodyZoneId);
  const containerLabel = findOptionLabel(PRODUIT_APPLICATION_CONTAINER_OPTIONS, containerId);
  const textureLabel = findOptionLabel(PRODUIT_APPLICATION_TEXTURE_TYPE_OPTIONS, textureTypeId);
  const objectLabel = findOptionLabel(objectOptions, objectTypeId);
  const postureLabel = findOptionLabel(PRODUIT_APPLICATION_POSTURE_OPTIONS, postureId);
  const decorLabel = findOptionLabel(PRODUIT_APPLICATION_DECOR_OPTIONS, decorId);
  const lightingLabel = findOptionLabel(PRODUIT_APPLICATION_LIGHTING_OPTIONS, lightingId);
  const resolvedLightingId = lightingId ?? slots.lightingId ?? null;
  const productName = slots.productName?.trim() ?? "";

  const textureOrObjectAnswerLabel = isTextureGuide ? textureLabel : objectLabel;

  const postureAnswerLabel = useMemo(() => {
    if (!postureId && guideStep !== "posture" && !ready) return null;
    if (postureId === "debout" && (guideStep === "decor" || guideStep === "lighting" || guideStep === "product" || ready)) {
      if (slots.postureId === "debout" && guideStep !== "posture") return "Debout (par défaut)";
    }
    return postureLabel;
  }, [guideStep, postureId, postureLabel, ready, slots.postureId]);

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
    <div className="image-studio-prompt-guide-chat image-studio-prompt-guide-chat--conversation">
      <div className="image-studio-prompt-guide-chat-head image-studio-prompt-guide-chat-head--minimal">
        <button
          type="button"
          className="image-studio-prompt-guide-back"
          onClick={onBack}
          aria-label="Retour aux modèles"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <div className="image-studio-prompt-guide-chat-title-row">
          <p className="image-studio-prompt-guide-chat-title">{template.label}</p>
          <span className="pulse-dot pulse-dot--online shrink-0" aria-hidden="true" />
        </div>
      </div>

      <div
        className="image-studio-prompt-guide-messages image-studio-prompt-guide-messages--conversation studio-subtle-scrollbar"
        role="log"
        aria-live="polite"
      >
        <ConversationBubble role="bot" visible={isBotVisible("productType")}>
          <p className="image-studio-prompt-guide-bubble-text">Quel type de produit ?</p>
          {guideStep === "productType" ? (
            <OptionButtonRow
              options={PRODUIT_APPLICATION_PRODUCT_TYPE_OPTIONS}
              selectedId={productTypeId}
              disabled={false}
              onSelect={handleProductTypeSelect}
              ariaLabel="Type de produit"
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
            <p className="image-studio-prompt-guide-bubble-text">Sexe du modèle</p>
            {guideStep === "gender" ? (
              <OptionButtonRow
                options={PRODUIT_APPLICATION_GENDER_OPTIONS}
                selectedId={genderId}
                disabled={false}
                onSelect={handleGenderSelect}
                ariaLabel="Sexe du modèle"
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
            <p className="image-studio-prompt-guide-bubble-text">Zone du corps</p>
            {guideStep === "bodyZone" ? (
              <OptionGrid
                options={bodyZoneOptions}
                selectedId={bodyZoneId}
                disabled={false}
                onSelect={handleBodyZoneSelect}
                ariaLabel="Zone du corps"
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
            <p className="image-studio-prompt-guide-bubble-text">Contenant</p>
            {guideStep === "container" ? (
              <>
                <OptionButtonRow
                  options={PRODUIT_APPLICATION_CONTAINER_OPTIONS}
                  selectedId={containerId}
                  disabled={false}
                  onSelect={handleContainerSelect}
                  ariaLabel="Contenant"
                />
                <SkipButton disabled={false} onClick={handleContainerSkip} />
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
              {isTextureGuide ? "Type de texture" : "Type d'objet"}
            </p>
            {guideStep === "textureOrObject" ? (
              <OptionGrid
                options={isTextureGuide ? PRODUIT_APPLICATION_TEXTURE_TYPE_OPTIONS : objectOptions}
                selectedId={isTextureGuide ? textureTypeId : objectTypeId}
                disabled={false}
                onSelect={isTextureGuide ? handleTextureTypeSelect : handleObjectTypeSelect}
                ariaLabel={isTextureGuide ? "Type de texture" : "Type d'objet"}
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
            <p className="image-studio-prompt-guide-bubble-text">Posture</p>
            {guideStep === "posture" ? (
              <>
                <OptionButtonRow
                  options={PRODUIT_APPLICATION_POSTURE_OPTIONS}
                  selectedId={postureId}
                  disabled={false}
                  onSelect={handlePostureSelect}
                  ariaLabel="Posture"
                />
                <SkipButton disabled={false} onClick={handlePostureSkip} />
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
            <p className="image-studio-prompt-guide-bubble-text">Décor</p>
            {guideStep === "decor" ? (
              <>
                <OptionButtonRow
                  options={PRODUIT_APPLICATION_DECOR_OPTIONS}
                  selectedId={decorId}
                  disabled={false}
                  onSelect={handleDecorSelect}
                  ariaLabel="Décor"
                />
                <SkipButton disabled={false} onClick={handleDecorSkip} />
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
            <p className="image-studio-prompt-guide-bubble-text">Éclairage</p>
            {guideStep === "lighting" ? (
              <>
                <OptionButtonRow
                  options={PRODUIT_APPLICATION_LIGHTING_OPTIONS}
                  selectedId={resolvedLightingId}
                  disabled={false}
                  onSelect={handleLightingSelect}
                  ariaLabel="Éclairage"
                />
                <SkipButton disabled={false} onClick={handleLightingSkip} />
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
            <p className="image-studio-prompt-guide-bubble-text">Nom du produit</p>
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
            <p className="image-studio-prompt-guide-bubble-text">{template.botAskRequired}</p>
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

        <TypingIndicator visible={isTyping} />
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
