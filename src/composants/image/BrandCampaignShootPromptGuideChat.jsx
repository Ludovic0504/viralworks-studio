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

function AmbianceButtons({ selectedId, disabled, onSelect }) {
  return (
    <div className="image-studio-prompt-ugc-option-row" role="radiogroup" aria-label="Ambiance">
      {BRAND_CAMPAIGN_AMBIANCE_OPTIONS.map((option) => (
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

function CameraAngleButtons({ selectedId, disabled, onSelect }) {
  return (
    <div
      className="image-studio-prompt-brand-camera-angle-list"
      role="radiogroup"
      aria-label="Angle de la caméra"
    >
      {BRAND_CAMPAIGN_CAMERA_ANGLE_OPTIONS.map((option) => {
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

  const ambiance = useMemo(
    () => BRAND_CAMPAIGN_AMBIANCE_OPTIONS.find((item) => item.id === ambianceId) ?? null,
    [ambianceId],
  );

  const actionOptions = useMemo(
    () => (ambianceId ? buildBankOptions(BRAND_CAMPAIGN_ACTION_BANKS[ambianceId], "action") : []),
    [ambianceId],
  );

  const environmentOptions = useMemo(
    () =>
      ambianceId ? buildBankOptions(BRAND_CAMPAIGN_ENVIRONMENT_BANKS[ambianceId], "env") : [],
    [ambianceId],
  );

  const filledSlots = useMemo(() => fillTemplateSlotDefaults(template, slots), [template, slots]);

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

  const handleProductSubmit = useCallback(
    (raw) => {
      const productOutfit = raw.trim();
      if (productOutfit.length < 2) {
        setProductValidationShown(true);
        return;
      }
      setProductValidationShown(false);
      setDraft("");
      setSlots((prev) => ({ ...prev, productOutfit }));
      setGuideStep("physical");
    },
    [],
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
    onApplyPrompt(assembledPrompt);
    onClose();
  }, [assembledPrompt, onApplyPrompt, onClose]);

  const composeForm =
    guideStep === "product" && !ready ? (
      <form className="image-studio-prompt-guide-compose" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ex. navy Lacoste polo with yellow shoulder stripes…"
          className="image-studio-prompt-guide-input"
          aria-label="Tenue ou produit"
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

  const genderLabel = gender === "homme" ? "Homme" : gender === "femme" ? "Femme" : null;
  const cameraAngleLabel =
    BRAND_CAMPAIGN_CAMERA_ANGLE_OPTIONS.find((item) => item.id === cameraAngleId)?.label ?? null;
  const gazeLabel =
    gazeId === "vers-camera"
      ? "Oui, vers la caméra"
      : gazeId === "regard-ailleurs"
        ? "Non, regard ailleurs"
        : null;
  const distanceLabel =
    BRAND_CAMPAIGN_DISTANCE_OPTIONS.find((item) => item.id === distanceId)?.label ?? null;
  const actionLabel =
    actionChoiceId === "surprise"
      ? "Surprends-moi"
      : actionOptions.find((item) => item.id === actionChoiceId)?.label ?? null;
  const environmentLabel =
    environmentChoiceId === "surprise"
      ? "Surprends-moi"
      : environmentOptions.find((item) => item.id === environmentChoiceId)?.label ?? null;
  const productOutfit = slots.productOutfit?.trim() ?? "";
  const physicalAnswerLabel = useMemo(() => {
    if (guideStep === "physical") return null;
    if (slots.physicalMode === "random") return "Garder aléatoire";
    if (slots.physicalMode === "manual" && physicalAge && physicalMorphology) {
      const morphologyLabel =
        BRAND_CAMPAIGN_MORPHOLOGY_OPTIONS.find((item) => item.id === physicalMorphology)?.label ??
        physicalMorphology;
      return `${physicalAge} ans, ${morphologyLabel}`;
    }
    return null;
  }, [guideStep, physicalAge, physicalMorphology, slots.physicalMode]);
  const formatLabel =
    outputFormat === "story"
      ? "Story/Reel (9:16)"
      : outputFormat === "feed"
        ? "Feed (4:5)"
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
        <ConversationBubble role="bot" visible={isBotVisible("gender")}>
          <p className="image-studio-prompt-guide-bubble-text">Qui présente le produit ?</p>
          {guideStep === "gender" ? (
            <div
              className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
              role="group"
              aria-label="Sexe"
            >
              <button
                type="button"
                className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                onClick={() => handleGenderSelect("homme")}
              >
                Homme
              </button>
              <button
                type="button"
                className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                onClick={() => handleGenderSelect("femme")}
              >
                Femme
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
            <p className="image-studio-prompt-guide-bubble-text">Quelle ambiance pour ce shooting ?</p>
            {guideStep === "ambiance" ? (
              <AmbianceButtons
                selectedId={ambianceId}
                disabled={false}
                onSelect={handleAmbianceSelect}
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
            <p className="image-studio-prompt-guide-bubble-text">D&apos;où vient le regard de la caméra ?</p>
            {guideStep === "cameraAngle" ? (
              <CameraAngleButtons
                selectedId={cameraAngleId}
                disabled={false}
                onSelect={handleCameraAngleSelect}
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
              La personne regarde-t-elle la caméra ?
            </p>
            {guideStep === "gaze" ? (
              <div
                className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
                role="group"
                aria-label="Regard"
              >
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={() => handleGazeSelect("vers-camera")}
                >
                  Oui, vers la caméra
                </button>
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={() => handleGazeSelect("regard-ailleurs")}
                >
                  Non, regard ailleurs
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
            <p className="image-studio-prompt-guide-bubble-text">À quelle distance de la personne ?</p>
            {guideStep === "distance" ? (
              <div
                className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
                role="group"
                aria-label="Distance"
              >
                {BRAND_CAMPAIGN_DISTANCE_OPTIONS.map((option) => (
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
            <p className="image-studio-prompt-guide-bubble-text">Quelle pose ou action ?</p>
            {guideStep === "action" ? (
              <BankOptionGrid
                options={actionOptions}
                selectedId={actionChoiceId}
                disabled={false}
                onSelect={handleActionSelect}
                onSurprise={handleActionSurprise}
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
            <p className="image-studio-prompt-guide-bubble-text">Où se déroule la scène ?</p>
            {guideStep === "environment" ? (
              <BankOptionGrid
                options={environmentOptions}
                selectedId={environmentChoiceId}
                disabled={false}
                onSelect={handleEnvironmentSelect}
                onSurprise={handleEnvironmentSurprise}
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
              Décris la tenue ou le produit à mettre en avant
            </p>
            {guideStep === "product" ? (
              <div className="image-studio-prompt-guide-bubble-compose">{composeForm}</div>
            ) : null}
          </ConversationBubble>
        ) : null}

        {productValidationShown ? (
          <ConversationBubble role="bot" visible={isBotVisible("product-validation")}>
            <p className="image-studio-prompt-guide-bubble-text">{template.botAskRequired}</p>
          </ConversationBubble>
        ) : null}

        {productOutfit ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{productOutfit}</p>
          </ConversationBubble>
        ) : null}

        {productOutfit ? (
          <ConversationBubble role="bot" wide visible={isBotVisible("physical")}>
            <p className="image-studio-prompt-guide-bubble-text">
              Veux-tu préciser l&apos;apparence physique ?
            </p>
            {physicalStepActive ? (
              <>
                <div className="image-studio-prompt-ugc-option-group">
                  <p className="image-studio-prompt-ugc-option-group-label">Âge</p>
                  <div className="image-studio-prompt-ugc-option-row" role="group" aria-label="Âge">
                    {BRAND_CAMPAIGN_AGE_OPTIONS.map((age) => (
                      <button
                        key={age}
                        type="button"
                        className={`studio-toolbar-btn image-studio-prompt-guide-elements-btn image-studio-prompt-ugc-option-btn${
                          physicalAge === age ? " is-selected" : ""
                        }`}
                        onClick={() => setPhysicalAge(age)}
                      >
                        {age} ans
                      </button>
                    ))}
                  </div>
                </div>
                <div className="image-studio-prompt-ugc-option-group">
                  <p className="image-studio-prompt-ugc-option-group-label">Morphologie</p>
                  <div
                    className="image-studio-prompt-ugc-option-row"
                    role="group"
                    aria-label="Morphologie"
                  >
                    {BRAND_CAMPAIGN_MORPHOLOGY_OPTIONS.map((option) => (
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
                    Garder aléatoire
                  </button>
                  {canConfirmPhysical ? (
                    <button
                      type="button"
                      className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                      onClick={handlePhysicalConfirm}
                    >
                      Valider
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
            <p className="image-studio-prompt-guide-bubble-text">Feed ou Story ?</p>
            {guideStep === "format" && !ready ? (
              <div
                className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
                role="group"
                aria-label="Format de sortie"
              >
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={() => handleFormatSelect("feed")}
                >
                  Feed (4:5)
                </button>
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={() => handleFormatSelect("story")}
                >
                  Story/Reel (9:16)
                </button>
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={handleFormatSkip}
                >
                  Passer
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

        <TypingIndicator visible={isTyping} />
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
