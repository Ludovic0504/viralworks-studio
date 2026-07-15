import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Footprints,
  Hand,
  ImageUp,
  SendHorizontal,
  Shirt,
  ShoppingBag,
  Sparkles,
  User,
} from "lucide-react";
import {
  assembleUgcPresentationPromptFromSlots,
  fillTemplateSlotDefaults,
  isUgcPresentationGuideReady,
} from "@/bibliotheque/imageStudio/promptTemplateEngine";
import { IMAGE_STUDIO_PRODUCT_MENTION_TOKEN } from "@/bibliotheque/imageStudio/imageStudioGuideApply";
import {
  IMAGE_STUDIO_REF_IMPORT_MESSAGE,
  isSupportedImageStudioReferenceMime,
} from "@/bibliotheque/imageStudio/uploadImageStudioReference";
import {
  getUgcSelfieProfileById,
  UGC_PRESENTATION_AGE_DEFAULT,
  UGC_PRESENTATION_AGE_MAX,
  UGC_PRESENTATION_AGE_MIN,
  resolveUgcPresentationProfileIdFromAge,
  UGC_SELFIE_HAIR_OPTIONS,
  UGC_SELFIE_SKIN_TONE_OPTIONS,
} from "@/bibliotheque/imageStudio/ugcSelfieProfiles";
import {
  UGC_PRESENTATION_BODY_ZONE_OPTIONS,
  UGC_PRESENTATION_LOCATION_PRESETS,
} from "@/bibliotheque/imageStudio/ugcPresentationConfig";
import {
  drawUgcPresentationPhysicalCustom,
  drawUgcPresentationPhysicalDefaults,
} from "@/bibliotheque/imageStudio/ugcPresentationPhysicalPools";
import { useImageStudioChatbotTr } from "@/bibliotheque/i18n/useImageStudioChatbotTr";
import { translateLabeledOptions } from "@/bibliotheque/i18n/chatbotTranslate";

/** @typedef {'presentationMode' | 'bodyZone' | 'posture' | 'gender' | 'age' | 'physical' | 'product' | 'autreTenue' | 'autreTenueCustom' | 'location' | 'ready'} UgcPresentationGuideStep */
/** @typedef {'text' | 'image'} UgcPresentationProductInputMode */

const PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const BOT_TYPING_DELAY_MS = 520;

const BODY_ZONE_ICONS = {
  head: User,
  wrist: Hand,
  upper: Shirt,
  lower: ShoppingBag,
  feet: Footprints,
  shoulder: ShoppingBag,
  "full-outfit": Sparkles,
};

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

function AgeSliderPicker({
  value,
  disabled,
  onChange,
  onConfirm,
  confirmLabel = "Valider",
  ageAriaLabel = "Âge",
}) {
  const progress =
    ((value - UGC_PRESENTATION_AGE_MIN) / (UGC_PRESENTATION_AGE_MAX - UGC_PRESENTATION_AGE_MIN)) *
    100;

  return (
    <div className="image-studio-prompt-ugc-age-slider">
      <p className="image-studio-prompt-ugc-age-value" aria-live="polite">
        {value}
      </p>
      <input
        type="range"
        min={UGC_PRESENTATION_AGE_MIN}
        max={UGC_PRESENTATION_AGE_MAX}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        onDragStart={(event) => event.preventDefault()}
        className="image-studio-prompt-ugc-age-range"
        style={{ "--age-pct": `${progress}%` }}
        aria-label={ageAriaLabel}
        aria-valuemin={UGC_PRESENTATION_AGE_MIN}
        aria-valuemax={UGC_PRESENTATION_AGE_MAX}
        aria-valuenow={value}
      />
      <div className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions image-studio-prompt-ugc-age-actions">
        <button
          type="button"
          className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
          disabled={disabled}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

function ProductImageImportPicker({
  disabled,
  previewUrl,
  focusValue,
  errorMessage,
  onPickFile,
  onFocusChange,
  onConfirm,
  chooseImageLabel = "Choisir une image",
  changeImageLabel = "Changer l'image",
  focusQuestionLabel = "Quel article reprendre ?",
  optionalLabel = "(optionnel)",
  focusPlaceholder = "ex: la veste uniquement, ignorer le pantalon",
  confirmLabel = "Valider",
}) {
  const inputRef = useRef(null);

  return (
    <div className="image-studio-prompt-ugc-product-image-picker">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          onPickFile(file);
        }}
      />
      <button
        type="button"
        className="studio-toolbar-btn image-studio-prompt-guide-elements-btn image-studio-prompt-ugc-product-image-btn"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <ImageUp className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span>{previewUrl ? changeImageLabel : chooseImageLabel}</span>
      </button>
      {previewUrl ? (
        <>
          <div className="image-studio-prompt-ugc-product-image-preview" aria-hidden="true">
            <img src={previewUrl} alt="" />
          </div>
          <label className="image-studio-prompt-ugc-product-focus-field">
            <span className="image-studio-prompt-ugc-product-focus-label">
              {focusQuestionLabel}{" "}
              <span className="image-studio-prompt-ugc-optional">{optionalLabel}</span>
            </span>
            <input
              type="text"
              value={focusValue}
              onChange={(event) => onFocusChange(event.target.value)}
              placeholder={focusPlaceholder}
              className="image-studio-prompt-guide-input image-studio-prompt-ugc-product-focus-input"
              disabled={disabled}
            />
          </label>
          <div className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions image-studio-prompt-ugc-product-image-actions">
            <button
              type="button"
              className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
              disabled={disabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </>
      ) : null}
      {errorMessage ? (
        <p className="image-studio-prompt-ugc-product-image-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

function BodyZoneGrid({ options, selectedId, disabled, onSelect, ariaLabel = "Zone du corps" }) {
  return (
    <div
      className="image-studio-prompt-ugc-body-zone-grid"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const Icon = BODY_ZONE_ICONS[option.id] ?? User;
        const selected = selectedId === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            className={`studio-toolbar-btn image-studio-prompt-guide-elements-btn image-studio-prompt-ugc-body-zone-btn${
              selected ? " is-selected" : ""
            }`}
            onClick={() => onSelect(option.id)}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SkinToneSwatchGroup({
  options,
  selectedId,
  disabled,
  onSelect,
  label = "Teint de peau",
  ariaLabel = "Teint de peau",
}) {
  return (
    <div className="image-studio-prompt-ugc-option-group">
      <p className="image-studio-prompt-ugc-option-group-label">{label}</p>
      <div
        className="image-studio-prompt-ugc-skin-grid"
        role="radiogroup"
        aria-label={ariaLabel}
      >
        {options.map((option) => {
          const selected = selectedId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              title={option.label}
              disabled={disabled}
              className={`image-studio-prompt-ugc-skin-swatch${selected ? " is-selected" : ""}`}
              style={{ backgroundColor: option.swatchColor }}
              onClick={() => onSelect(option.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function QuickOptionGroup({ label, options, selectedId, disabled, onSelect }) {
  return (
    <div className="image-studio-prompt-ugc-option-group">
      <p className="image-studio-prompt-ugc-option-group-label">{label}</p>
      <div className="image-studio-prompt-ugc-option-row" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`studio-toolbar-btn image-studio-prompt-guide-elements-btn image-studio-prompt-ugc-option-btn${
              selectedId === option.id ? " is-selected" : ""
            }`}
            disabled={disabled}
            onClick={() => onSelect(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LocationGrid({
  presets,
  selectedId,
  disabled,
  onSelect,
  onOther,
  otherLabel = "Autre",
  ariaLabel = "Lieu",
}) {
  return (
    <div className="image-studio-prompt-ugc-location-grid" role="radiogroup" aria-label={ariaLabel}>
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          role="radio"
          aria-checked={selectedId === preset.id}
          disabled={disabled}
          className={`studio-toolbar-btn image-studio-prompt-guide-elements-btn image-studio-prompt-ugc-location-btn${
            selectedId === preset.id ? " is-selected" : ""
          }`}
          onClick={() => onSelect(preset)}
        >
          {preset.label}
        </button>
      ))}
      <button
        type="button"
        role="radio"
        aria-checked={selectedId === "other"}
        disabled={disabled}
        className={`studio-toolbar-btn image-studio-prompt-guide-elements-btn image-studio-prompt-ugc-location-btn${
          selectedId === "other" ? " is-selected" : ""
        }`}
        onClick={onOther}
      >
        {otherLabel}
      </button>
    </div>
  );
}

function goToAfterBodyZone(bodyZone) {
  if (bodyZone === "feet") {
    return { step: "gender", pose: "default" };
  }
  return { step: "posture", pose: null };
}

export default function UgcPresentationPromptGuideChat({ template, onBack, onApplyPrompt, onClose }) {
  const { ui, tr, template: localizeTemplate, locale } = useImageStudioChatbotTr();
  const localizedTemplate = useMemo(
    () => localizeTemplate(template),
    [localizeTemplate, template, locale],
  );
  const localizedBodyZoneOptions = useMemo(
    () => translateLabeledOptions(UGC_PRESENTATION_BODY_ZONE_OPTIONS, tr, "chatbot.ugc.presentation.bodyZone"),
    [tr],
  );
  const localizedSkinToneOptions = useMemo(
    () => translateLabeledOptions(UGC_SELFIE_SKIN_TONE_OPTIONS, tr, "chatbot.ugc.skinTone"),
    [tr],
  );
  const localizedHairOptions = useMemo(
    () => translateLabeledOptions(UGC_SELFIE_HAIR_OPTIONS, tr, "chatbot.ugc.hair"),
    [tr],
  );
  const localizedLocationPresets = useMemo(
    () => translateLabeledOptions(UGC_PRESENTATION_LOCATION_PRESETS, tr, "chatbot.ugc.presentation.location"),
    [tr],
  );

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [presentationMode, setPresentationMode] = useState(null);
  const [bodyZone, setBodyZone] = useState(null);
  const [pose, setPose] = useState(null);
  const [gender, setGender] = useState(null);
  const [age, setAge] = useState(UGC_PRESENTATION_AGE_DEFAULT);
  const [profileId, setProfileId] = useState(null);
  const [guideStep, setGuideStep] = useState(
    /** @type {UgcPresentationGuideStep} */ ("presentationMode"),
  );
  const [slots, setSlots] = useState({});
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [physicalSkinId, setPhysicalSkinId] = useState(null);
  const [physicalHairId, setPhysicalHairId] = useState(null);
  const [locationPresetId, setLocationPresetId] = useState(null);
  const [locationOtherOpen, setLocationOtherOpen] = useState(false);
  const [productValidationShown, setProductValidationShown] = useState(false);
  const [productInputMode, setProductInputMode] = useState(
    /** @type {UgcPresentationProductInputMode | null} */ (null),
  );
  const [productImageDraft, setProductImageDraft] = useState(null);
  const [productImagePreview, setProductImagePreview] = useState(null);
  const [productFocusDraft, setProductFocusDraft] = useState("");
  const [productImageError, setProductImageError] = useState(null);

  const profile = useMemo(() => getUgcSelfieProfileById(profileId), [profileId]);
  const selectedAge = (slots.age ?? "").trim();
  const isFullOutfit = bodyZone === "full-outfit";

  const filledSlots = useMemo(() => fillTemplateSlotDefaults(localizedTemplate, slots), [localizedTemplate, slots]);

  const assembledPrompt = useMemo(() => {
    if (!ready) return "";
    return assembleUgcPresentationPromptFromSlots(slots);
  }, [ready, slots]);

  const advanceAfterProduct = useCallback(
    (nextSlots) => {
      if (isFullOutfit) {
        setSlots((prev) => ({ ...prev, ...nextSlots, autreTenue: "" }));
        setGuideStep("location");
        return;
      }
      setSlots((prev) => ({ ...prev, ...nextSlots }));
      setGuideStep("autreTenue");
    },
    [isFullOutfit],
  );

  const handleProductModeSelect = useCallback((mode) => {
    setProductInputMode(mode);
    setProductValidationShown(false);
    setProductImageError(null);
    setProductImageDraft(null);
    setProductFocusDraft("");
    if (mode === "text") {
      setProductImagePreview(null);
    } else {
      setDraft("");
    }
  }, []);

  const handleProductImagePick = useCallback((file) => {
    if (!file) return;

    if (!isSupportedImageStudioReferenceMime(file.type)) {
      setProductImageError(IMAGE_STUDIO_REF_IMPORT_MESSAGE);
      return;
    }

    if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
      setProductImageError(IMAGE_STUDIO_REF_IMPORT_MESSAGE);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "").trim();
      if (!dataUrl) {
        setProductImageError(IMAGE_STUDIO_REF_IMPORT_MESSAGE);
        return;
      }

      setProductImageDraft(dataUrl);
      setProductImageError(null);
      setProductValidationShown(false);
    };
    reader.onerror = () => {
      setProductImageError(IMAGE_STUDIO_REF_IMPORT_MESSAGE);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleProductImageConfirm = useCallback(() => {
    if (!productImageDraft) return;

    const productFocus = productFocusDraft.trim();
    setProductImagePreview(productImageDraft);
    setProductImageDraft(null);
    setProductValidationShown(false);
    advanceAfterProduct({
      productName: IMAGE_STUDIO_PRODUCT_MENTION_TOKEN,
      productInputMode: "image",
      productFocus,
    });
  }, [advanceAfterProduct, productFocusDraft, productImageDraft]);

  const finalizeGuide = useCallback((nextSlots) => {
    setSlots(nextSlots);
    setReady(true);
    setGuideStep("ready");
  }, []);

  const handlePresentationModeSelect = useCallback((mode) => {
    setPresentationMode(mode);
    setSlots((prev) => ({ ...prev, presentationMode: mode }));
    if (mode === "held") {
      setGuideStep("posture");
    } else {
      setGuideStep("bodyZone");
    }
  }, []);

  const handleBodyZoneSelect = useCallback((zoneId) => {
    setBodyZone(zoneId);
    const next = goToAfterBodyZone(zoneId);
    setSlots((prev) => ({
      ...prev,
      bodyZone: zoneId,
      pose: next.pose ?? prev.pose,
    }));
    if (next.pose) {
      setPose(next.pose);
    }
    setGuideStep(next.step);
  }, []);

  const handlePostureSelect = useCallback((poseId) => {
    setPose(poseId);
    setSlots((prev) => ({ ...prev, pose: poseId }));
    setGuideStep("gender");
  }, []);

  const handleGenderSelect = useCallback((nextGender) => {
    setGender(nextGender);
    setAge(UGC_PRESENTATION_AGE_DEFAULT);
    setProfileId(null);
    setGuideStep("age");
  }, []);

  const handleAgeConfirm = useCallback(() => {
    if (!gender) return;
    const nextProfileId = resolveUgcPresentationProfileIdFromAge(gender, age);
    setProfileId(nextProfileId);
    setSlots((prev) => ({
      ...prev,
      profileId: nextProfileId,
      age: String(age),
    }));
    setPhysicalSkinId(null);
    setPhysicalHairId(null);
    setGuideStep("physical");
  }, [age, gender]);

  const handlePhysicalDefault = useCallback(() => {
    if (!profileId) return;
    const drawn = drawUgcPresentationPhysicalDefaults(profileId);
    setSlots((prev) => ({
      ...prev,
      physicalMode: "default",
      physique: drawn.physique,
      hairDescription: drawn.hairDescription,
      skinTone: undefined,
      hair: undefined,
    }));
    setPhysicalSkinId(null);
    setPhysicalHairId(null);
    setGuideStep("product");
  }, [profileId]);

  const handlePhysicalContinue = useCallback(() => {
    if (!profileId) return;
    const skin = UGC_SELFIE_SKIN_TONE_OPTIONS.find((option) => option.id === physicalSkinId);
    const hair = UGC_SELFIE_HAIR_OPTIONS.find((option) => option.id === physicalHairId);
    const drawn = drawUgcPresentationPhysicalCustom(profileId, {
      skinTone: skin?.promptValue,
      hairPromptValue: hair?.promptValue,
    });
    setSlots((prev) => ({
      ...prev,
      physicalMode: "custom",
      physique: drawn.physique,
      hairDescription: drawn.hairDescription,
      skinTone: skin?.promptValue,
      hair: hair?.promptValue,
    }));
    setGuideStep("product");
  }, [physicalHairId, physicalSkinId, profileId]);

  const handleProductSubmit = useCallback(
    (raw) => {
      const productName = raw.trim();
      if (productName.length < 2) {
        setProductValidationShown(true);
        return;
      }
      setProductValidationShown(false);
      setDraft("");
      setProductImagePreview(null);
      setProductImageDraft(null);
      setProductFocusDraft("");
      setProductImageError(null);
      advanceAfterProduct({
        productName,
        productInputMode: "text",
        productFocus: "",
      });
    },
    [advanceAfterProduct],
  );

  const handleAutreTenueRien = useCallback(() => {
    setSlots((prev) => ({ ...prev, autreTenue: "" }));
    setGuideStep("location");
  }, []);

  const handleAutreTenuePersonnaliser = useCallback(() => {
    setGuideStep("autreTenueCustom");
  }, []);

  const handleAutreTenueCustomSubmit = useCallback((raw) => {
    const autreTenue = raw.trim();
    if (autreTenue.length < 2) return;
    setSlots((prev) => ({ ...prev, autreTenue }));
    setDraft("");
    setGuideStep("location");
  }, []);

  const handleLocationPreset = useCallback(
    (preset) => {
      setLocationPresetId(preset.id);
      setLocationOtherOpen(false);
      setSlots((prev) => {
        const next = { ...prev, location: preset.promptValue };
        finalizeGuide(next);
        return next;
      });
    },
    [finalizeGuide],
  );

  const handleLocationOther = useCallback(() => {
    setLocationPresetId("other");
    setLocationOtherOpen(true);
  }, []);

  const handleLocationOtherSubmit = useCallback(
    (raw) => {
      const location = raw.trim();
      if (location.length < 2) return;
      setSlots((prev) => {
        const next = { ...prev, location };
        finalizeGuide(next);
        return next;
      });
      setDraft("");
    },
    [finalizeGuide],
  );

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (guideStep === "product") {
        handleProductSubmit(draft);
        return;
      }
      if (guideStep === "autreTenueCustom") {
        handleAutreTenueCustomSubmit(draft);
        return;
      }
      if (guideStep === "location" && locationOtherOpen) {
        handleLocationOtherSubmit(draft);
      }
    },
    [
      draft,
      guideStep,
      handleAutreTenueCustomSubmit,
      handleLocationOtherSubmit,
      handleProductSubmit,
      locationOtherOpen,
    ],
  );

  const handleSlotChange = useCallback(
    (key, value) => {
      setSlots((prev) => {
        const next = { ...prev, [key]: value };
        setReady(isUgcPresentationGuideReady(template, next));
        return next;
      });
    },
    [template],
  );

  const handleApply = useCallback(() => {
    if (!assembledPrompt) return;
    if (slots.productInputMode === "image" && productImagePreview) {
      const productFocus = (slots.productFocus ?? "").trim();
      onApplyPrompt({
        prompt: assembledPrompt,
        productImageUrl: productImagePreview,
        productFocus: productFocus || null,
      });
    } else {
      onApplyPrompt(assembledPrompt);
    }
    onClose();
  }, [
    assembledPrompt,
    onApplyPrompt,
    onClose,
    productImagePreview,
    slots.productFocus,
    slots.productInputMode,
  ]);

  const showTextInput =
    guideStep === "autreTenueCustom" || (guideStep === "location" && locationOtherOpen);

  const inputPlaceholder =
    guideStep === "product"
      ? isFullOutfit
        ? ui("ugcDescribeFullOutfit", "ex: red sleeveless draped evening dress")
        : ui("ugcProductPlaceholder", "ex: red sleeveless draped dress")
      : guideStep === "autreTenueCustom"
        ? ui("ugcAutreTenuePlaceholder", "ex: soft beige knit cardigan over a dark top")
        : ui("ugcDescribeLocation", "Décrivez le lieu…");

  const productQuestion = isFullOutfit
    ? ui("ugcDescribeFullOutfitQuestion", "Décrivez la tenue complète")
    : ui("ugcProductQuestion", "Quel est le produit ?");
  const productModeLabel =
    productInputMode === "text"
      ? ui("ugcWriteProduct", "Écrire le produit")
      : productInputMode === "image"
        ? ui("ugcImportImage", "Importer une image")
        : null;
  const productStepActive = guideStep === "product" && !productName;
  const showProductModePicker = productStepActive;
  const showProductInputBubble =
    productStepActive && (productInputMode === "text" || productInputMode === "image");

  const composeForm =
    showTextInput && !ready ? (
      <form className="image-studio-prompt-guide-compose" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={inputPlaceholder}
          className="image-studio-prompt-guide-input"
          aria-label={ui("yourMessage", "Votre message")}
        />
        <button
          type="submit"
          className="image-studio-prompt-guide-send"
          disabled={!draft.trim()}
          aria-label={ui("send", "Envoyer")}
        >
          <SendHorizontal className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </form>
    ) : null;

  const productTextComposeForm =
    showProductInputBubble && productInputMode === "text" && !ready ? (
      <form className="image-studio-prompt-guide-compose" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={inputPlaceholder}
          className="image-studio-prompt-guide-input"
          aria-label={ui("yourMessage", "Votre message")}
        />
        <button
          type="submit"
          className="image-studio-prompt-guide-send"
          disabled={!draft.trim()}
          aria-label={ui("send", "Envoyer")}
        >
          <SendHorizontal className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </form>
    ) : null;

  useEffect(() => {
    if (showProductInputBubble && productInputMode === "text") {
      inputRef.current?.focus();
    }
  }, [guideStep, locationOtherOpen, productInputMode, showProductInputBubble]);

  const presentationModeLabel =
    presentationMode === "held"
      ? ui("ugcHeldInHand", "Tenu en main")
      : presentationMode === "worn"
        ? ui("ugcWornOnBody", "Porté sur le corps")
        : null;

  const bodyZoneLabel = useMemo(() => {
    if (!bodyZone) return null;
    return localizedBodyZoneOptions.find((option) => option.id === bodyZone)?.label ?? null;
  }, [bodyZone, localizedBodyZoneOptions]);

  const postureLabel = useMemo(() => {
    if (!pose) return null;
    if (pose === "forward") return ui("ugcPostureForward", "Penchée vers l'avant");
    if (pose === "natural") return ui("ugcPostureNatural", "Debout, posture naturelle");
    return null;
  }, [pose, ui]);

  const genderLabel =
    gender === "homme"
      ? ui("ugcGenderHomme", "Homme")
      : gender === "femme"
        ? ui("ugcGenderFemme", "Femme")
        : null;

  const locationLabel = useMemo(() => {
    const location = slots.location;
    if (location === undefined || location === null) return null;
    const preset = localizedLocationPresets.find((item) => item.promptValue === location);
    if (preset) return preset.label;
    if (location === "") return ui("ugcLuxuryDressing", "Dressing luxe");
    return location;
  }, [localizedLocationPresets, slots.location, ui]);

  const autreTenueLabel = useMemo(() => {
    if (isFullOutfit) return null;
    if (guideStep === "autreTenue" || guideStep === "autreTenueCustom") return null;
    if (!(slots.productName ?? "").trim()) return null;
    const autreTenue = (slots.autreTenue ?? "").trim();
    if (autreTenue) return autreTenue;
    if (guideStep === "location" || ready) return ui("nothing", "Rien");
    return null;
  }, [guideStep, isFullOutfit, ready, slots.autreTenue, slots.productName, ui]);

  const physicalAnswerLabel = useMemo(() => {
    if (guideStep === "physical") return null;
    const parts = [];
    const skin = localizedSkinToneOptions.find((option) => option.id === physicalSkinId);
    const hair = localizedHairOptions.find((option) => option.id === physicalHairId);
    if (skin) parts.push(skin.label);
    if (hair) parts.push(hair.label);
    if (parts.length > 0) return parts.join(" · ");
    if (slots.physicalMode === "default" && profileId) return ui("ugcChooseForMe", "Choisir pour moi");
    return null;
  }, [
    guideStep,
    localizedHairOptions,
    localizedSkinToneOptions,
    physicalHairId,
    physicalSkinId,
    profileId,
    slots.physicalMode,
    ui,
  ]);

  const showPostureStep =
    presentationMode === "held" || (presentationMode === "worn" && bodyZone && bodyZone !== "feet");

  const botTurnKeys = useMemo(() => {
    const keys = ["presentationMode"];
    if (presentationMode === "worn") keys.push("bodyZone");
    if (
      showPostureStep &&
      presentationMode &&
      (presentationMode === "held" || bodyZone)
    ) {
      keys.push("posture");
    }
    if (gender || guideStep === "gender" || profileId) keys.push("gender");
    if (gender) keys.push("age");
    if (profileId) keys.push("physical");
    if (guideStep === "product" || productName) keys.push("product");
    if (showProductInputBubble) keys.push("product-input");
    if (productValidationShown) keys.push("product-validation");
    if (!isFullOutfit && guideStep === "autreTenue") {
      keys.push("autreTenue");
    }
    if (!isFullOutfit && guideStep === "autreTenueCustom") {
      keys.push("autreTenueCustom");
    }
    if (guideStep === "location" || ready) keys.push("location");
    if (ready) keys.push("result");
    return keys;
  }, [
    autreTenueLabel,
    bodyZone,
    gender,
    guideStep,
    isFullOutfit,
    presentationMode,
    productName,
    productValidationShown,
    profileId,
    ready,
    showPostureStep,
    showProductInputBubble,
  ]);

  const { isBotVisible, isTyping } = useConversationBotVisibility(botTurnKeys);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [
    adjustOpen,
    botTurnKeys.length,
    guideStep,
    isTyping,
    ready,
    gender,
    profileId,
    productInputMode,
  ]);

  const physicalStepActive = guideStep === "physical";
  const hasPhysicalSelection = Boolean(physicalSkinId || physicalHairId);
  const postureStepActive = guideStep === "posture";

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
          {profile ? (
            <label className="image-studio-prompt-guide-field">
              <span>{ui("ugcProfile", "Profil")}</span>
              <input type="text" value={`${genderLabel} · ${selectedAge}`} readOnly />
            </label>
          ) : null}
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
        <ConversationBubble role="bot" visible={isBotVisible("presentationMode")}>
          <p className="image-studio-prompt-guide-bubble-text">{localizedTemplate.botIntro}</p>
          {guideStep === "presentationMode" ? (
            <div
              className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
              role="group"
              aria-label={ui("ugcPresentationModeAria", "Mode de présentation")}
            >
              <button
                type="button"
                className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                onClick={() => handlePresentationModeSelect("held")}
              >
                {ui("ugcHeldInHand", "Tenu en main")}
              </button>
              <button
                type="button"
                className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                onClick={() => handlePresentationModeSelect("worn")}
              >
                {ui("ugcWornOnBody", "Porté sur le corps")}
              </button>
            </div>
          ) : null}
        </ConversationBubble>

        {presentationModeLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{presentationModeLabel}</p>
          </ConversationBubble>
        ) : null}

        {presentationMode === "worn" ? (
          <ConversationBubble role="bot" wide visible={isBotVisible("bodyZone")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("ugcBodyZoneQuestion", "Quelle partie du corps porte le produit ?")}
            </p>
            {guideStep === "bodyZone" ? (
              <BodyZoneGrid
                options={localizedBodyZoneOptions}
                selectedId={bodyZone}
                disabled={false}
                onSelect={handleBodyZoneSelect}
                ariaLabel={ui("ugcBodyZoneAria", "Zone du corps")}
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {bodyZoneLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{bodyZoneLabel}</p>
          </ConversationBubble>
        ) : null}

        {showPostureStep ? (
          <ConversationBubble role="bot" visible={isBotVisible("posture")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("ugcPostureQuestion", "Comment la personne se tient-elle face à la caméra ?")}
            </p>
            {postureStepActive ? (
              <div
                className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
                role="group"
                aria-label={ui("ugcPostureAria", "Posture")}
              >
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={() => handlePostureSelect("forward")}
                >
                  {ui("ugcPostureForward", "Penchée vers l'avant")}
                </button>
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={() => handlePostureSelect("natural")}
                >
                  {ui("ugcPostureNatural", "Debout, posture naturelle")}
                </button>
              </div>
            ) : null}
          </ConversationBubble>
        ) : null}

        {postureLabel && showPostureStep ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{postureLabel}</p>
          </ConversationBubble>
        ) : null}

        {(gender || guideStep === "gender" || profileId) && (
          <ConversationBubble role="bot" visible={isBotVisible("gender")}>
            <p className="image-studio-prompt-guide-bubble-text">{ui("ugcManOrWoman", "Homme ou Femme ?")}</p>
            {guideStep === "gender" ? (
              <div
                className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
                role="group"
                aria-label={ui("ugcGenderAria", "Sexe")}
              >
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={() => handleGenderSelect("homme")}
                >
                  {ui("ugcGenderHomme", "Homme")}
                </button>
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={() => handleGenderSelect("femme")}
                >
                  {ui("ugcGenderFemme", "Femme")}
                </button>
              </div>
            ) : null}
          </ConversationBubble>
        )}

        {genderLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{genderLabel}</p>
          </ConversationBubble>
        ) : null}

        {gender ? (
          <ConversationBubble role="bot" wide visible={isBotVisible("age")}>
            <p className="image-studio-prompt-guide-bubble-text">{ui("ugcAgeQuestion", "Quel âge ?")}</p>
            {guideStep === "age" ? (
              <AgeSliderPicker
                value={age}
                disabled={false}
                onChange={setAge}
                onConfirm={handleAgeConfirm}
                confirmLabel={ui("ugcConfirm", "Valider")}
                ageAriaLabel={ui("ugcAgeAria", "Âge")}
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {selectedAge ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{selectedAge}</p>
          </ConversationBubble>
        ) : null}

        {profileId ? (
          <ConversationBubble role="bot" wide visible={isBotVisible("physical")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("ugcRefinePhysical", "Raffinement physique ? (optionnel)")}
            </p>
            <div className="image-studio-prompt-ugc-physical-groups">
              <SkinToneSwatchGroup
                options={localizedSkinToneOptions}
                selectedId={physicalSkinId}
                disabled={!physicalStepActive}
                onSelect={setPhysicalSkinId}
                label={ui("ugcSkinTone", "Teint de peau")}
                ariaLabel={ui("ugcSkinTone", "Teint de peau")}
              />
              <QuickOptionGroup
                label={ui("ugcHairStyle", "Style de cheveux")}
                options={localizedHairOptions}
                selectedId={physicalHairId}
                disabled={!physicalStepActive}
                onSelect={setPhysicalHairId}
              />
            </div>
            {physicalStepActive ? (
              <div className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions image-studio-prompt-ugc-physical-actions">
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={handlePhysicalDefault}
                >
                  {ui("ugcChooseForMe", "Choisir pour moi")}
                </button>
                <button
                  type="button"
                  className={`studio-toolbar-btn image-studio-prompt-guide-elements-btn${
                    hasPhysicalSelection ? "" : " image-studio-prompt-ugc-physical-validate--hidden"
                  }`}
                  disabled={!hasPhysicalSelection}
                  onClick={handlePhysicalContinue}
                  aria-hidden={!hasPhysicalSelection}
                  tabIndex={hasPhysicalSelection ? 0 : -1}
                >
                  {ui("ugcConfirm", "Valider")}
                </button>
              </div>
            ) : null}
          </ConversationBubble>
        ) : null}

        {physicalAnswerLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{physicalAnswerLabel}</p>
          </ConversationBubble>
        ) : null}

        {guideStep === "product" || productName ? (
          <ConversationBubble role="bot" visible={isBotVisible("product")}>
            <p className="image-studio-prompt-guide-bubble-text">{productQuestion}</p>
            {showProductModePicker ? (
              <div
                className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions image-studio-prompt-ugc-product-mode-actions"
                role="group"
                aria-label={ui("ugcProductInputModeAria", "Mode de saisie du produit")}
              >
                <button
                  type="button"
                  className={`studio-toolbar-btn image-studio-prompt-guide-elements-btn${
                    productInputMode === "text" ? " is-selected" : ""
                  }`}
                  onClick={() => handleProductModeSelect("text")}
                >
                  {ui("ugcWriteProduct", "Écrire le produit")}
                </button>
                <button
                  type="button"
                  className={`studio-toolbar-btn image-studio-prompt-guide-elements-btn${
                    productInputMode === "image" ? " is-selected" : ""
                  }`}
                  onClick={() => handleProductModeSelect("image")}
                >
                  {ui("ugcImportImage", "Importer une image")}
                </button>
              </div>
            ) : null}
          </ConversationBubble>
        ) : null}

        {productModeLabel && productStepActive ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{productModeLabel}</p>
          </ConversationBubble>
        ) : null}

        {showProductInputBubble ? (
          <ConversationBubble role="bot" wide visible={isBotVisible("product-input")}>
            {productInputMode === "text" ? (
              <div className="image-studio-prompt-guide-bubble-compose">{productTextComposeForm}</div>
            ) : (
              <ProductImageImportPicker
                disabled={false}
                previewUrl={productImageDraft}
                focusValue={productFocusDraft}
                errorMessage={productImageError}
                onPickFile={handleProductImagePick}
                onFocusChange={setProductFocusDraft}
                onConfirm={handleProductImageConfirm}
                chooseImageLabel={ui("ugcChooseImage", "Choisir une image")}
                changeImageLabel={ui("ugcChangeImage", "Changer l'image")}
                focusQuestionLabel={ui("ugcWhichArticle", "Quel article reprendre ?")}
                optionalLabel={ui("ugcOptional", "(optionnel)")}
                focusPlaceholder={ui(
                  "ugcProductFocusPlaceholder",
                  "ex: la veste uniquement, ignorer le pantalon",
                )}
                confirmLabel={ui("ugcConfirm", "Valider")}
              />
            )}
          </ConversationBubble>
        ) : null}

        {productValidationShown ? (
          <ConversationBubble role="bot" visible={isBotVisible("product-validation")}>
            <p className="image-studio-prompt-guide-bubble-text">{localizedTemplate.botAskRequired}</p>
          </ConversationBubble>
        ) : null}

        {productName ? (
          <ConversationBubble role="user">
            {isProductImageMode && productImagePreview ? (
              <div className="image-studio-prompt-ugc-product-answer">
                <img
                  src={productImagePreview}
                  alt=""
                  className="image-studio-prompt-ugc-product-answer-img"
                />
                <div className="image-studio-prompt-ugc-product-answer-copy">
                  <p className="image-studio-prompt-guide-bubble-text">
                    {IMAGE_STUDIO_PRODUCT_MENTION_TOKEN}
                  </p>
                  {productFocusLabel ? (
                    <p className="image-studio-prompt-ugc-product-answer-focus">{productFocusLabel}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="image-studio-prompt-guide-bubble-text">{productName}</p>
            )}
          </ConversationBubble>
        ) : null}

        {!isFullOutfit && guideStep === "autreTenue" ? (
          <ConversationBubble role="bot" visible={isBotVisible("autreTenue")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {gender === "homme"
                ? ui("ugcWhatElseHeWears", "Que porte-t-il d'autre ?")
                : ui("ugcWhatElseSheWears", "Que porte-t-elle d'autre ?")}
            </p>
            <div
              className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
              role="group"
              aria-label={ui("ugcRestOfOutfitAria", "Reste de la tenue")}
            >
              <button
                type="button"
                className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                onClick={handleAutreTenueRien}
              >
                {ui("nothing", "Rien")}
              </button>
              <button
                type="button"
                className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                onClick={handleAutreTenuePersonnaliser}
              >
                {ui("ugcCustomize", "Personnaliser")}
              </button>
            </div>
          </ConversationBubble>
        ) : null}

        {guideStep === "autreTenueCustom" ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{ui("ugcCustomize", "Personnaliser")}</p>
          </ConversationBubble>
        ) : null}

        {!isFullOutfit && guideStep === "autreTenueCustom" ? (
          <ConversationBubble role="bot" visible={isBotVisible("autreTenueCustom")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("ugcDescribeRestOutfit", "Décrivez le reste de la tenue")}
            </p>
            <div className="image-studio-prompt-guide-bubble-compose">{composeForm}</div>
          </ConversationBubble>
        ) : null}

        {autreTenueLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{autreTenueLabel}</p>
          </ConversationBubble>
        ) : null}

        {guideStep === "location" || ready ? (
          <ConversationBubble role="bot" wide visible={isBotVisible("location")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("ugcSceneLocation", "Où se passe la scène ?")}
            </p>
            {guideStep === "location" && !ready ? (
              <>
                <LocationGrid
                  presets={localizedLocationPresets}
                  selectedId={locationPresetId}
                  disabled={false}
                  onSelect={handleLocationPreset}
                  onOther={handleLocationOther}
                  otherLabel={ui("other", "Autre")}
                  ariaLabel={ui("ugcLocationAria", "Lieu")}
                />
                {locationOtherOpen ? (
                  <div className="image-studio-prompt-guide-bubble-compose">{composeForm}</div>
                ) : null}
              </>
            ) : null}
          </ConversationBubble>
        ) : null}

        {locationLabel && ready ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{locationLabel}</p>
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
