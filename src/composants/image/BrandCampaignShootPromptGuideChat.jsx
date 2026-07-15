import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, SendHorizontal } from "lucide-react";
import {
  assembleBrandCampaignShootPromptFromSlots,
  drawRandomBrandCampaignProfileId,
  isBrandCampaignShootGuideReady,
  resolveBrandCampaignFormatRatio,
  resolveBrandCampaignRandomPhysique,
} from "@/bibliotheque/imageStudio/brandCampaignShootAssembly";
import {
  BRAND_CAMPAIGN_ACTION_BANKS,
  BRAND_CAMPAIGN_AMBIANCE_OPTIONS,
  BRAND_CAMPAIGN_CAMERA_ANGLE_OPTIONS,
  BRAND_CAMPAIGN_DISTANCE_OPTIONS,
  BRAND_CAMPAIGN_ENVIRONMENT_BANKS,
  BRAND_CAMPAIGN_MORPHOLOGY_OPTIONS,
  BRAND_CAMPAIGN_AGE_OPTIONS,
  buildBrandCampaignBankGridOptions,
  resolveBrandCampaignCameraAngleTier,
  resolveBrandCampaignDistanceTier,
  resolveBrandCampaignGaze,
  resolveBrandCampaignManualPhysique,
} from "@/bibliotheque/imageStudio/brandCampaignShootConfig";
import { fillTemplateSlotDefaults } from "@/bibliotheque/imageStudio/promptTemplateEngine";
import { IMAGE_STUDIO_PRODUCT_MENTION_TOKEN } from "@/bibliotheque/imageStudio/imageStudioGuideApply";
import { readGuideProductImageFile } from "@/bibliotheque/imageStudio/guideProductImage";
import GuideProductImagePicker from "@/composants/image/GuideProductImagePicker";
import { useImageStudioChatbotTr } from "@/bibliotheque/i18n/useImageStudioChatbotTr";
import {
  translateHintOption,
  translateLabeledOptions,
} from "@/bibliotheque/i18n/chatbotTranslate";

/** @typedef {'gender' | 'ambiance' | 'cameraAngle' | 'gaze' | 'distance' | 'action' | 'environment' | 'product' | 'physical' | 'format' | 'ready'} BrandCampaignGuideStep */

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

function AmbianceButtons({ options, selectedId, disabled, onSelect, ariaLabel = "Ambiance" }) {
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

function CameraAngleButtons({ options, selectedId, disabled, onSelect, ariaLabel = "Angle de la caméra" }) {
  return (
    <div
      className="image-studio-prompt-brand-camera-angle-list"
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
            disabled={disabled}
            className={`image-studio-prompt-brand-camera-angle-btn studio-toolbar-btn image-studio-prompt-guide-elements-btn${
              selected ? " is-selected" : ""
            }`}
            onClick={() => onSelect(option.id)}
          >
            <span className="image-studio-prompt-brand-camera-angle-label">{option.label}</span>
            <span className="image-studio-prompt-brand-camera-angle-subtitle">{option.subtitle}</span>
          </button>
        );
      })}
    </div>
  );
}

function BankOptionGrid({ options, selectedId, disabled, onSelect, onSurprise, surpriseLabel = "Surprends-moi" }) {
  return (
    <div className="image-studio-prompt-ugc-location-grid" role="radiogroup">
      {options.map((option, index) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={selectedId === option.id}
          disabled={disabled}
          className={`studio-toolbar-btn image-studio-prompt-guide-elements-btn image-studio-prompt-ugc-location-btn${
            selectedId === option.id ? " is-selected" : ""
          }`}
          onClick={() => onSelect(option.id, option.promptValue)}
        >
          {option.label || `Option ${index + 1}`}
        </button>
      ))}
      <button
        type="button"
        className={`studio-toolbar-btn image-studio-prompt-guide-elements-btn image-studio-prompt-ugc-location-btn${
          selectedId === "surprise" ? " is-selected" : ""
        }`}
        disabled={disabled}
        onClick={onSurprise}
      >
        {surpriseLabel}
      </button>
    </div>
  );
}

function buildBankOptions(bank, prefix) {
  return buildBrandCampaignBankGridOptions(bank, prefix);
}

export default function BrandCampaignShootPromptGuideChat({
  template,
  onBack,
  onApplyPrompt,
  onClose,
}) {
  const { ui, tr, template: localizeTemplate, locale } = useImageStudioChatbotTr();
  const localizedTemplate = useMemo(
    () => localizeTemplate(template),
    [localizeTemplate, template, locale],
  );
  const localizedAmbianceOptions = useMemo(
    () => translateLabeledOptions(BRAND_CAMPAIGN_AMBIANCE_OPTIONS, tr, "chatbot.brand.ambiance"),
    [tr],
  );
  const localizedCameraAngleOptions = useMemo(
    () =>
      BRAND_CAMPAIGN_CAMERA_ANGLE_OPTIONS.map((option) =>
        translateHintOption(option, tr, "chatbot.brand.cameraAngle"),
      ),
    [tr],
  );
  const localizedDistanceOptions = useMemo(
    () => translateLabeledOptions(BRAND_CAMPAIGN_DISTANCE_OPTIONS, tr, "chatbot.brand.distance"),
    [tr],
  );
  const localizedMorphologyOptions = useMemo(
    () => translateLabeledOptions(BRAND_CAMPAIGN_MORPHOLOGY_OPTIONS, tr, "chatbot.brand.morphology"),
    [tr],
  );
  const localizedFormatOptions = useMemo(
    () => [
      { id: "feed", label: ui("brandFormatFeed", "Feed (4:5)") },
      { id: "story", label: ui("brandFormatStory", "Story/Reel (9:16)") },
    ],
    [ui],
  );

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [gender, setGender] = useState(null);
  const [ambianceId, setAmbianceId] = useState(null);
  const [cameraAngleId, setCameraAngleId] = useState(null);
  const [gazeId, setGazeId] = useState(null);
  const [distanceId, setDistanceId] = useState(null);
  const [actionChoiceId, setActionChoiceId] = useState(null);
  const [environmentChoiceId, setEnvironmentChoiceId] = useState(null);
  const [physicalAge, setPhysicalAge] = useState(null);
  const [physicalMorphology, setPhysicalMorphology] = useState(null);
  const [outputFormat, setOutputFormat] = useState(null);

  const [guideStep, setGuideStep] = useState(
    /** @type {BrandCampaignGuideStep} */ ("gender"),
  );
  const [slots, setSlots] = useState({});
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [productValidationShown, setProductValidationShown] = useState(false);
  const [guideProductImagePreview, setGuideProductImagePreview] = useState(null);
  const [guideProductImageError, setGuideProductImageError] = useState(null);

  const ambiance = useMemo(
    () => localizedAmbianceOptions.find((item) => item.id === ambianceId) ?? null,
    [ambianceId, localizedAmbianceOptions],
  );

  const actionOptions = useMemo(
    () =>
      ambianceId
        ? translateLabeledOptions(
            buildBankOptions(BRAND_CAMPAIGN_ACTION_BANKS[ambianceId], "action"),
            tr,
            `chatbot.brand.action.${ambianceId}`,
          )
        : [],
    [ambianceId, tr],
  );

  const environmentOptions = useMemo(
    () =>
      ambianceId
        ? translateLabeledOptions(
            buildBankOptions(BRAND_CAMPAIGN_ENVIRONMENT_BANKS[ambianceId], "env"),
            tr,
            `chatbot.brand.environment.${ambianceId}`,
          )
        : [],
    [ambianceId, tr],
  );

  const filledSlots = useMemo(() => fillTemplateSlotDefaults(localizedTemplate, slots), [localizedTemplate, slots]);

  const assembledPrompt = useMemo(() => {
    if (!ready) return "";
    return assembleBrandCampaignShootPromptFromSlots(slots);
  }, [ready, slots]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [guideStep]);

  const finalizeGuide = useCallback((nextSlots) => {
    setSlots(nextSlots);
    setReady(true);
    setGuideStep("ready");
  }, []);

  const handleGenderSelect = useCallback((nextGender) => {
    setGender(nextGender);
    setSlots((prev) => ({ ...prev, gender: nextGender }));
    setGuideStep("ambiance");
  }, []);

  const handleAmbianceSelect = useCallback((nextAmbianceId) => {
    const option = BRAND_CAMPAIGN_AMBIANCE_OPTIONS.find((item) => item.id === nextAmbianceId);
    if (!option) return;
    setAmbianceId(nextAmbianceId);
    setSlots((prev) => ({
      ...prev,
      ambianceId: nextAmbianceId,
      ambiancePrompt: option.promptValue,
    }));
    setGuideStep("cameraAngle");
  }, []);

  const handleCameraAngleSelect = useCallback((nextAngleId) => {
    const cameraAngleBlock = resolveBrandCampaignCameraAngleTier(nextAngleId);
    const gazeBlock = resolveBrandCampaignGaze(nextAngleId, null);
    setCameraAngleId(nextAngleId);
    setSlots((prev) => ({
      ...prev,
      cameraAngleId: nextAngleId,
      cameraAngleBlock,
      gazeBlock,
    }));
    if (nextAngleId === "face-a-face") {
      setGazeId(null);
      setGuideStep("distance");
    } else {
      setGuideStep("gaze");
    }
  }, []);

  const handleGazeSelect = useCallback(
    (nextGazeId) => {
      const gazeBlock = resolveBrandCampaignGaze(cameraAngleId, nextGazeId);
      setGazeId(nextGazeId);
      setSlots((prev) => ({
        ...prev,
        gazeId: nextGazeId,
        gazeBlock,
      }));
      setGuideStep("distance");
    },
    [cameraAngleId],
  );

  const handleDistanceSelect = useCallback((nextDistanceId) => {
    const distanceBlock = resolveBrandCampaignDistanceTier(nextDistanceId);
    setDistanceId(nextDistanceId);
    setSlots((prev) => ({
      ...prev,
      distanceId: nextDistanceId,
      distanceBlock,
    }));
    setGuideStep("action");
  }, []);

  const handleActionSelect = useCallback((choiceId, promptValue) => {
    setActionChoiceId(choiceId);
    setSlots((prev) => ({ ...prev, action: promptValue }));
    setGuideStep("environment");
  }, []);

  const handleActionSurprise = useCallback(() => {
    if (!ambianceId) return;
    const bank = BRAND_CAMPAIGN_ACTION_BANKS[ambianceId];
    const option = bank[Math.floor(Math.random() * bank.length)] ?? bank[0];
    setActionChoiceId("surprise");
    setSlots((prev) => ({ ...prev, action: option.promptValue }));
    setGuideStep("environment");
  }, [ambianceId]);

  const handleEnvironmentSelect = useCallback((choiceId, promptValue) => {
    setEnvironmentChoiceId(choiceId);
    setSlots((prev) => ({ ...prev, environment: promptValue }));
    setGuideStep("product");
  }, []);

  const handleEnvironmentSurprise = useCallback(() => {
    if (!ambianceId) return;
    const bank = BRAND_CAMPAIGN_ENVIRONMENT_BANKS[ambianceId];
    const option = bank[Math.floor(Math.random() * bank.length)] ?? bank[0];
    setEnvironmentChoiceId("surprise");
    setSlots((prev) => ({ ...prev, environment: option.promptValue }));
    setGuideStep("product");
  }, [ambianceId]);

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
      const productOutfit = raw.trim();
      const hasImage = Boolean(guideProductImagePreview);
      if (productOutfit.length < 2 && !hasImage) {
        setProductValidationShown(true);
        return;
      }
      setProductValidationShown(false);
      setDraft("");
      setSlots((prev) => ({
        ...prev,
        productOutfit: productOutfit.length >= 2 ? productOutfit : IMAGE_STUDIO_PRODUCT_MENTION_TOKEN,
        productImageUrl: guideProductImagePreview,
        productInputMode: productOutfit.length >= 2 ? "text" : "image",
      }));
      setGuideStep("physical");
    },
    [guideProductImagePreview],
  );

  const handlePhysicalRandom = useCallback(() => {
    if (!gender) return;
    const profileId = drawRandomBrandCampaignProfileId(gender);
    const physique = resolveBrandCampaignRandomPhysique(gender);
    setPhysicalAge(null);
    setPhysicalMorphology(null);
    setSlots((prev) => ({
      ...prev,
      physicalMode: "random",
      profileId,
      physique,
    }));
    setGuideStep("format");
  }, [gender]);

  const handlePhysicalConfirm = useCallback(() => {
    if (!gender || physicalAge === null || !physicalMorphology) return;
    const physique = resolveBrandCampaignManualPhysique(gender, physicalAge, physicalMorphology);
    setSlots((prev) => ({
      ...prev,
      physicalMode: "manual",
      physicalAge: String(physicalAge),
      physicalMorphology,
      physique,
    }));
    setGuideStep("format");
  }, [gender, physicalAge, physicalMorphology]);

  const handleFormatSelect = useCallback(
    (formatId) => {
      const ratio = resolveBrandCampaignFormatRatio(formatId);
      setOutputFormat(formatId);
      setSlots((prev) => {
        const next = {
          ...prev,
          outputFormat: formatId,
          aspectRatio: ratio,
        };
        finalizeGuide(next);
        return next;
      });
    },
    [finalizeGuide],
  );

  const handleFormatSkip = useCallback(() => {
    const ratio = resolveBrandCampaignFormatRatio("feed");
    setOutputFormat("feed");
    setSlots((prev) => {
      const next = {
        ...prev,
        outputFormat: "feed",
        aspectRatio: ratio,
      };
      finalizeGuide(next);
      return next;
    });
  }, [finalizeGuide]);

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
      setReady(isBrandCampaignShootGuideReady(next));
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

  const canSubmitGuideProduct =
    Boolean(draft.trim()) || Boolean(guideProductImagePreview);

  const composeForm =
    guideStep === "product" && !ready ? (
      <form className="image-studio-prompt-guide-compose" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={ui("brandOutfitPlaceholder", "Ex. navy Lacoste polo with yellow shoulder stripes…")}
          className="image-studio-prompt-guide-input"
          aria-label={ui("brandOutfitAria", "Tenue ou produit")}
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

  const genderLabel =
    gender === "homme"
      ? ui("ugcGenderHomme", "Homme")
      : gender === "femme"
        ? ui("ugcGenderFemme", "Femme")
        : null;
  const cameraAngleLabel =
    localizedCameraAngleOptions.find((item) => item.id === cameraAngleId)?.label ?? null;
  const gazeLabel =
    gazeId === "vers-camera"
      ? ui("brandGazeYes", "Oui, vers la caméra")
      : gazeId === "regard-ailleurs"
        ? ui("brandGazeNo", "Non, regard ailleurs")
        : null;
  const distanceLabel =
    localizedDistanceOptions.find((item) => item.id === distanceId)?.label ?? null;
  const surpriseLabel = ui("surpriseMe", "Surprends-moi");
  const actionLabel =
    actionChoiceId === "surprise"
      ? surpriseLabel
      : actionOptions.find((item) => item.id === actionChoiceId)?.label ?? null;
  const environmentLabel =
    environmentChoiceId === "surprise"
      ? surpriseLabel
      : environmentOptions.find((item) => item.id === environmentChoiceId)?.label ?? null;
  const productOutfit = slots.productOutfit?.trim() ?? "";
  const physicalAnswerLabel = useMemo(() => {
    if (guideStep === "physical") return null;
    if (slots.physicalMode === "random") return ui("brandKeepRandom", "Garder aléatoire");
    if (slots.physicalMode === "manual" && physicalAge && physicalMorphology) {
      const morphologyLabel =
        localizedMorphologyOptions.find((item) => item.id === physicalMorphology)?.label ??
        physicalMorphology;
      return `${physicalAge} ${ui("brandAgeYears", "ans")}, ${morphologyLabel}`;
    }
    return null;
  }, [guideStep, localizedMorphologyOptions, physicalAge, physicalMorphology, slots.physicalMode, ui]);
  const formatLabel =
    outputFormat === "story"
      ? localizedFormatOptions.find((item) => item.id === "story")?.label ?? null
      : outputFormat === "feed"
        ? localizedFormatOptions.find((item) => item.id === "feed")?.label ?? null
        : null;

  const physicalStepActive = guideStep === "physical";
  const canConfirmPhysical = physicalAge !== null && physicalMorphology !== null;

  const botTurnKeys = useMemo(() => {
    const keys = ["gender"];
    if (gender) keys.push("ambiance");
    if (ambianceId) keys.push("cameraAngle");
    if (cameraAngleId && cameraAngleId !== "face-a-face") keys.push("gaze");
    if (distanceId || guideStep === "distance" || slots.distanceBlock) keys.push("distance");
    if (slots.action || guideStep === "action") keys.push("action");
    if (slots.environment || guideStep === "environment") keys.push("environment");
    if (guideStep === "product" || productOutfit) keys.push("product");
    if (productValidationShown) keys.push("product-validation");
    if (guideStep === "physical" || physicalAnswerLabel) keys.push("physical");
    if (guideStep === "format" || ready) keys.push("format");
    if (ready) keys.push("result");
    return keys;
  }, [
    ambianceId,
    cameraAngleId,
    distanceId,
    gender,
    guideStep,
    physicalAnswerLabel,
    productOutfit,
    productValidationShown,
    ready,
    slots.action,
    slots.distanceBlock,
    slots.environment,
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
        <ConversationBubble role="bot" visible={isBotVisible("gender")}>
          <p className="image-studio-prompt-guide-bubble-text">
            {ui("brandPresenterQuestion", "Qui présente le produit ?")}
          </p>
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

        {genderLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{genderLabel}</p>
          </ConversationBubble>
        ) : null}

        {gender ? (
          <ConversationBubble role="bot" visible={isBotVisible("ambiance")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("brandAmbianceQuestion", "Quelle ambiance pour ce shooting ?")}
            </p>
            {guideStep === "ambiance" ? (
              <AmbianceButtons
                options={localizedAmbianceOptions}
                selectedId={ambianceId}
                disabled={false}
                onSelect={handleAmbianceSelect}
                ariaLabel={ui("ambianceQuestion", "Ambiance")}
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {ambiance ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{ambiance.label}</p>
          </ConversationBubble>
        ) : null}

        {ambianceId ? (
          <ConversationBubble role="bot" wide visible={isBotVisible("cameraAngle")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("brandCameraQuestion", "D'où vient le regard de la caméra ?")}
            </p>
            {guideStep === "cameraAngle" ? (
              <CameraAngleButtons
                options={localizedCameraAngleOptions}
                selectedId={cameraAngleId}
                disabled={false}
                onSelect={handleCameraAngleSelect}
                ariaLabel={ui("brandCameraAria", "Angle de la caméra")}
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {cameraAngleLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{cameraAngleLabel}</p>
          </ConversationBubble>
        ) : null}

        {cameraAngleId && cameraAngleId !== "face-a-face" ? (
          <ConversationBubble role="bot" visible={isBotVisible("gaze")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("brandGazeQuestion", "La personne regarde-t-elle la caméra ?")}
            </p>
            {guideStep === "gaze" ? (
              <div
                className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
                role="group"
                aria-label={ui("brandGazeAria", "Regard")}
              >
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={() => handleGazeSelect("vers-camera")}
                >
                  {ui("brandGazeYes", "Oui, vers la caméra")}
                </button>
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={() => handleGazeSelect("regard-ailleurs")}
                >
                  {ui("brandGazeNo", "Non, regard ailleurs")}
                </button>
              </div>
            ) : null}
          </ConversationBubble>
        ) : null}

        {gazeLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{gazeLabel}</p>
          </ConversationBubble>
        ) : null}

        {cameraAngleId ? (
          <ConversationBubble role="bot" visible={isBotVisible("distance")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("brandDistanceQuestion", "À quelle distance de la personne ?")}
            </p>
            {guideStep === "distance" ? (
              <div
                className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
                role="group"
                aria-label={ui("brandDistanceAria", "Distance")}
              >
                {localizedDistanceOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                    onClick={() => handleDistanceSelect(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </ConversationBubble>
        ) : null}

        {distanceLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{distanceLabel}</p>
          </ConversationBubble>
        ) : null}

        {distanceId ? (
          <ConversationBubble role="bot" wide visible={isBotVisible("action")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("brandActionQuestion", "Quelle pose ou action ?")}
            </p>
            {guideStep === "action" ? (
              <BankOptionGrid
                options={actionOptions}
                selectedId={actionChoiceId}
                disabled={false}
                onSelect={handleActionSelect}
                onSurprise={handleActionSurprise}
                surpriseLabel={surpriseLabel}
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {actionLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{actionLabel}</p>
          </ConversationBubble>
        ) : null}

        {slots.action ? (
          <ConversationBubble role="bot" wide visible={isBotVisible("environment")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("brandEnvironmentQuestion", "Où se déroule la scène ?")}
            </p>
            {guideStep === "environment" ? (
              <BankOptionGrid
                options={environmentOptions}
                selectedId={environmentChoiceId}
                disabled={false}
                onSelect={handleEnvironmentSelect}
                onSurprise={handleEnvironmentSurprise}
                surpriseLabel={surpriseLabel}
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {environmentLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{environmentLabel}</p>
          </ConversationBubble>
        ) : null}

        {slots.environment ? (
          <ConversationBubble role="bot" visible={isBotVisible("product")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("brandOutfitQuestion", "Décris la tenue ou le produit à mettre en avant")}
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

        {productOutfit ? (
          <ConversationBubble role="user">
            {slots.productImageUrl ? (
              <div className="image-studio-prompt-ugc-product-answer">
                <img
                  src={slots.productImageUrl}
                  alt=""
                  className="image-studio-prompt-ugc-product-answer-img"
                />
                <p className="image-studio-prompt-guide-bubble-text">{productOutfit}</p>
              </div>
            ) : (
              <p className="image-studio-prompt-guide-bubble-text">{productOutfit}</p>
            )}
          </ConversationBubble>
        ) : null}

        {productOutfit ? (
          <ConversationBubble role="bot" wide visible={isBotVisible("physical")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("brandPhysicalQuestion", "Veux-tu préciser l'apparence physique ?")}
            </p>
            {physicalStepActive ? (
              <>
                <div className="image-studio-prompt-ugc-option-group">
                  <p className="image-studio-prompt-ugc-option-group-label">{ui("ugcAgeQuestion", "Âge")}</p>
                  <div className="image-studio-prompt-ugc-option-row" role="group" aria-label={ui("ugcAgeAria", "Âge")}>
                    {BRAND_CAMPAIGN_AGE_OPTIONS.map((age) => (
                      <button
                        key={age}
                        type="button"
                        className={`studio-toolbar-btn image-studio-prompt-guide-elements-btn image-studio-prompt-ugc-option-btn${
                          physicalAge === age ? " is-selected" : ""
                        }`}
                        onClick={() => setPhysicalAge(age)}
                      >
                        {age} {ui("brandAgeYears", "ans")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="image-studio-prompt-ugc-option-group">
                  <p className="image-studio-prompt-ugc-option-group-label">
                    {ui("brandMorphology", "Morphologie")}
                  </p>
                  <div
                    className="image-studio-prompt-ugc-option-row"
                    role="group"
                    aria-label={ui("brandMorphology", "Morphologie")}
                  >
                    {localizedMorphologyOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`studio-toolbar-btn image-studio-prompt-guide-elements-btn image-studio-prompt-ugc-option-btn${
                          physicalMorphology === option.id ? " is-selected" : ""
                        }`}
                        onClick={() => setPhysicalMorphology(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions image-studio-prompt-ugc-physical-actions">
                  <button
                    type="button"
                    className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                    onClick={handlePhysicalRandom}
                  >
                    {ui("brandKeepRandom", "Garder aléatoire")}
                  </button>
                  {canConfirmPhysical ? (
                    <button
                      type="button"
                      className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                      onClick={handlePhysicalConfirm}
                    >
                      {ui("ugcConfirm", "Valider")}
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </ConversationBubble>
        ) : null}

        {physicalAnswerLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{physicalAnswerLabel}</p>
          </ConversationBubble>
        ) : null}

        {guideStep === "format" || ready ? (
          <ConversationBubble role="bot" visible={isBotVisible("format")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {ui("brandFormatQuestion", "Feed ou Story ?")}
            </p>
            {guideStep === "format" && !ready ? (
              <div
                className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
                role="group"
                aria-label={ui("brandFormatAria", "Format de sortie")}
              >
                {localizedFormatOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                    onClick={() => handleFormatSelect(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={handleFormatSkip}
                >
                  {ui("pass", "Passer")}
                </button>
              </div>
            ) : null}
          </ConversationBubble>
        ) : null}

        {formatLabel && ready ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{formatLabel}</p>
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
