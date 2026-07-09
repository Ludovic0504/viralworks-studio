import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, SendHorizontal } from "lucide-react";
import {
  assembleEditorialWornHeldPromptFromSlots,
  isEditorialWornHeldGuideReady,
} from "@/bibliotheque/imageStudio/editorialWornHeldAssembly";
import {
  EDITORIAL_AMBIANCE_OPTIONS,
  EDITORIAL_BACKGROUND_OPTIONS,
  EDITORIAL_FORMAT_OPTIONS,
  EDITORIAL_FRAMING_OPTIONS,
  EDITORIAL_GENDER_OPTIONS,
  EDITORIAL_HELD_ZONE_OPTIONS,
  EDITORIAL_JEWELRY_ZONE_OPTIONS,
  EDITORIAL_POSTURE_OPTIONS,
  EDITORIAL_SCENE_TYPE_OPTIONS,
  getAvailableEditorialFramingOptions,
  resolveEditorialFormatRatio,
  resolveEditorialZoneProfile,
} from "@/bibliotheque/imageStudio/editorialWornHeldConfig";
import { fillTemplateSlotDefaults } from "@/bibliotheque/imageStudio/promptTemplateEngine";
import { IMAGE_STUDIO_PRODUCT_MENTION_TOKEN } from "@/bibliotheque/imageStudio/imageStudioGuideApply";
import { readGuideProductImageFile } from "@/bibliotheque/imageStudio/guideProductImage";
import GuideProductImagePicker from "@/composants/image/GuideProductImagePicker";

/** @typedef {'sceneType' | 'gender' | 'zone' | 'framing' | 'outfit' | 'background' | 'ambiance' | 'customAmbiance' | 'product' | 'pose' | 'format' | 'ready'} EditorialGuideStep */

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

function findOptionLabel(options, id) {
  return options.find((item) => item.id === id)?.label ?? null;
}

export default function EditorialWornHeldPromptGuideChat({
  template,
  onBack,
  onApplyPrompt,
  onClose,
}) {
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [sceneTypeId, setSceneTypeId] = useState(null);
  const [genderId, setGenderId] = useState(null);
  const [zoneId, setZoneId] = useState(null);
  const [framingId, setFramingId] = useState(null);
  const [backgroundId, setBackgroundId] = useState(null);
  const [ambianceId, setAmbianceId] = useState(null);
  const [poseCustomizing, setPoseCustomizing] = useState(false);
  const [postureId, setPostureId] = useState(null);

  const [guideStep, setGuideStep] = useState(/** @type {EditorialGuideStep} */ ("sceneType"));
  const [slots, setSlots] = useState({});
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [productValidationShown, setProductValidationShown] = useState(false);
  const [guideProductImagePreview, setGuideProductImagePreview] = useState(null);
  const [guideProductImageError, setGuideProductImageError] = useState(null);

  const zoneOptions = useMemo(() => {
    if (sceneTypeId === "bijou-porte") return EDITORIAL_JEWELRY_ZONE_OPTIONS;
    if (sceneTypeId === "produit-tenu") return EDITORIAL_HELD_ZONE_OPTIONS;
    return [];
  }, [sceneTypeId]);

  const framingOptions = useMemo(() => {
    if (!sceneTypeId || !zoneId) return EDITORIAL_FRAMING_OPTIONS;
    return getAvailableEditorialFramingOptions(sceneTypeId, zoneId);
  }, [sceneTypeId, zoneId]);

  const filledSlots = useMemo(() => fillTemplateSlotDefaults(template, slots), [template, slots]);

  const assembledPrompt = useMemo(() => {
    if (!ready) return "";
    return assembleEditorialWornHeldPromptFromSlots(slots);
  }, [ready, slots]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [guideStep, poseCustomizing]);

  const finalizeGuide = useCallback((nextSlots) => {
    setSlots(nextSlots);
    setReady(true);
    setGuideStep("ready");
  }, []);

  const advanceAfterBackground = useCallback((nextBackgroundId) => {
    if (nextBackgroundId === "environnement") {
      setGuideStep("ambiance");
    } else {
      setGuideStep("product");
    }
  }, []);

  const advanceAfterAmbiance = useCallback((nextAmbianceId) => {
    if (nextAmbianceId === "autre") {
      setGuideStep("customAmbiance");
    } else {
      setGuideStep("product");
    }
  }, []);

  const handleSceneTypeSelect = useCallback((nextSceneTypeId) => {
    setSceneTypeId(nextSceneTypeId);
    setZoneId(null);
    setFramingId(null);
    setSlots((prev) => ({ ...prev, sceneTypeId: nextSceneTypeId, zoneId: "", framingId: "" }));
    setGuideStep("gender");
  }, []);

  const handleGenderSelect = useCallback((nextGenderId) => {
    setGenderId(nextGenderId);
    setSlots((prev) => ({ ...prev, genderId: nextGenderId }));
    setGuideStep("zone");
  }, []);

  const handleZoneSelect = useCallback((nextZoneId) => {
    setZoneId(nextZoneId);
    setFramingId(null);
    setSlots((prev) => ({ ...prev, zoneId: nextZoneId, framingId: "" }));
    setGuideStep("framing");
  }, []);

  const handleFramingSelect = useCallback((nextFramingId) => {
    setFramingId(nextFramingId);
    setSlots((prev) => ({ ...prev, framingId: nextFramingId }));
    if (nextFramingId === "corps-entier") {
      setGuideStep("outfit");
    } else {
      setGuideStep("background");
    }
  }, []);

  const handleOutfitSubmit = useCallback((raw) => {
    const outfitDescription = raw.trim();
    if (outfitDescription.length < 2) return;
    setDraft("");
    setSlots((prev) => ({ ...prev, outfitDescription }));
    setGuideStep("background");
  }, []);

  const handleBackgroundSelect = useCallback(
    (nextBackgroundId) => {
      setBackgroundId(nextBackgroundId);
      setAmbianceId(null);
      setSlots((prev) => ({
        ...prev,
        backgroundId: nextBackgroundId,
        ambianceId: nextBackgroundId === "neutre" ? "" : prev.ambianceId,
        customAmbiance: nextBackgroundId === "neutre" ? "" : prev.customAmbiance,
      }));
      advanceAfterBackground(nextBackgroundId);
    },
    [advanceAfterBackground],
  );

  const handleAmbianceSelect = useCallback(
    (nextAmbianceId) => {
      setAmbianceId(nextAmbianceId);
      setSlots((prev) => ({
        ...prev,
        ambianceId: nextAmbianceId,
        customAmbiance: nextAmbianceId === "autre" ? prev.customAmbiance : "",
      }));
      advanceAfterAmbiance(nextAmbianceId);
    },
    [advanceAfterAmbiance],
  );

  const handleCustomAmbianceSubmit = useCallback((raw) => {
    const customAmbiance = raw.trim();
    if (customAmbiance.length < 2) return;
    setDraft("");
    setSlots((prev) => ({ ...prev, customAmbiance }));
    setGuideStep("product");
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

  const handleProductSubmit = useCallback(
    (raw) => {
      const productDescription = raw.trim();
      const hasImage = Boolean(guideProductImagePreview);
      if (productDescription.length < 2 && !hasImage) {
        setProductValidationShown(true);
        return;
      }
      setProductValidationShown(false);
      setDraft("");
      setSlots((prev) => ({
        ...prev,
        productDescription:
          productDescription.length >= 2 ? productDescription : IMAGE_STUDIO_PRODUCT_MENTION_TOKEN,
        productImageUrl: guideProductImagePreview,
        productInputMode: productDescription.length >= 2 ? "text" : "image",
      }));
      setGuideStep("pose");
    },
    [guideProductImagePreview],
  );

  const handlePoseSkip = useCallback(() => {
    setPoseCustomizing(false);
    setPostureId(null);
    setSlots((prev) => {
      const next = { ...prev, postureId: "", customGesture: "" };
      return next;
    });
    setGuideStep("format");
  }, []);

  const handlePoseCustomize = useCallback(() => {
    setPoseCustomizing(true);
    if (!postureId && sceneTypeId && zoneId) {
      const profile = resolveEditorialZoneProfile(sceneTypeId, zoneId);
      if (profile) setPostureId(profile.defaultPosture);
    }
  }, [postureId, sceneTypeId, zoneId]);

  const handlePoseConfirm = useCallback(() => {
    const customGesture = draft.trim();
    setSlots((prev) => ({
      ...prev,
      postureId: postureId ?? "",
      customGesture,
    }));
    setDraft("");
    setPoseCustomizing(false);
    setGuideStep("format");
  }, [draft, postureId]);

  const handleFormatSelect = useCallback(
    (formatId) => {
      setSlots((prev) => {
        const next = { ...prev, formatId, aspectRatio: resolveEditorialFormatRatio(formatId) };
        finalizeGuide(next);
        return next;
      });
    },
    [finalizeGuide],
  );

  const handleFormatSkip = useCallback(() => {
    setSlots((prev) => {
      const next = {
        ...prev,
        formatId: "banniere-4-5",
        aspectRatio: resolveEditorialFormatRatio("banniere-4-5"),
      };
      finalizeGuide(next);
      return next;
    });
  }, [finalizeGuide]);

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (guideStep === "outfit") {
        handleOutfitSubmit(draft);
      } else if (guideStep === "customAmbiance") {
        handleCustomAmbianceSubmit(draft);
      } else if (guideStep === "product") {
        handleProductSubmit(draft);
      } else if (guideStep === "pose" && poseCustomizing) {
        handlePoseConfirm();
      }
    },
    [
      draft,
      guideStep,
      handleCustomAmbianceSubmit,
      handleOutfitSubmit,
      handlePoseConfirm,
      handleProductSubmit,
      poseCustomizing,
    ],
  );

  const handleSlotChange = useCallback((key, value) => {
    setSlots((prev) => {
      const next = { ...prev, [key]: value };
      setReady(isEditorialWornHeldGuideReady(next));
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

  const inputPlaceholder = useMemo(() => {
    if (guideStep === "outfit") return "Ex. robe fluide blanche et sandales nude…";
    if (guideStep === "customAmbiance") return "Ex. atelier joaillier, loft industriel…";
    if (guideStep === "product") return "Ex. bracelet chaîne torsadée en argent poli…";
    if (guideStep === "pose" && poseCustomizing) return "Ex. main dans les cheveux, regard déporté…";
    return "Votre réponse…";
  }, [guideStep, poseCustomizing]);

  const showComposeForm =
    (guideStep === "outfit" ||
      guideStep === "customAmbiance" ||
      guideStep === "product" ||
      (guideStep === "pose" && poseCustomizing)) &&
    !ready;

  const composeForm = showComposeForm ? (
    <form className="image-studio-prompt-guide-compose" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={inputPlaceholder}
        className="image-studio-prompt-guide-input"
        aria-label="Réponse"
      />
      <button
        type="submit"
        className="image-studio-prompt-guide-send"
        disabled={
          guideStep === "product"
            ? !canSubmitGuideProduct
            : guideStep === "pose"
              ? !postureId
              : !draft.trim()
        }
        aria-label="Envoyer"
      >
        <SendHorizontal className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </form>
  ) : null;

  const sceneTypeLabel = findOptionLabel(EDITORIAL_SCENE_TYPE_OPTIONS, sceneTypeId);
  const genderLabel = findOptionLabel(EDITORIAL_GENDER_OPTIONS, genderId);
  const zoneLabel = findOptionLabel(zoneOptions, zoneId);
  const framingLabel = findOptionLabel(EDITORIAL_FRAMING_OPTIONS, framingId);
  const backgroundLabel = findOptionLabel(EDITORIAL_BACKGROUND_OPTIONS, backgroundId);
  const ambianceLabel = findOptionLabel(EDITORIAL_AMBIANCE_OPTIONS, ambianceId);
  const outfitDescription = slots.outfitDescription?.trim() ?? "";
  const productDescription = slots.productDescription?.trim() ?? "";
  const customAmbiance = slots.customAmbiance?.trim() ?? "";
  const formatLabel =
    slots.formatId === "carre-1-1"
      ? "Post carré (1:1)"
      : slots.formatId === "story-9-16"
        ? "Story-Reel (9:16)"
        : slots.formatId === "banniere-4-5"
          ? "Bannière-pub (4:5)"
          : null;

  const poseAnswerLabel = useMemo(() => {
    if (guideStep === "pose" || !slots.productDescription) return null;
    if (slots.customGesture?.trim() || slots.postureId) {
      const postureLabel = findOptionLabel(EDITORIAL_POSTURE_OPTIONS, slots.postureId);
      const gesture = slots.customGesture?.trim();
      if (postureLabel && gesture) return `${postureLabel}, ${gesture}`;
      if (gesture) return gesture;
      if (postureLabel) return postureLabel;
    }
    if (guideStep === "format" || ready) return "Pose par défaut";
    return null;
  }, [guideStep, ready, slots.customGesture, slots.postureId, slots.productDescription]);

  const botTurnKeys = useMemo(() => {
    const keys = ["sceneType"];
    if (sceneTypeId) keys.push("gender");
    if (genderId) keys.push("zone");
    if (zoneId) keys.push("framing");
    if (framingId === "corps-entier") keys.push("outfit");
    if (backgroundId || guideStep === "background" || slots.backgroundId) keys.push("background");
    if (backgroundId === "environnement") keys.push("ambiance");
    if (ambianceId === "autre" || guideStep === "customAmbiance") keys.push("customAmbiance");
    if (guideStep === "product" || productDescription) keys.push("product");
    if (productValidationShown) keys.push("product-validation");
    if (guideStep === "pose" || poseAnswerLabel) keys.push("pose");
    if (guideStep === "format" || ready) keys.push("format");
    if (ready) keys.push("result");
    return keys;
  }, [
    ambianceId,
    backgroundId,
    framingId,
    genderId,
    guideStep,
    poseAnswerLabel,
    productDescription,
    productValidationShown,
    ready,
    sceneTypeId,
    slots.backgroundId,
    zoneId,
  ]);

  const { isBotVisible, isTyping } = useConversationBotVisibility(botTurnKeys);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [adjustOpen, botTurnKeys.length, guideStep, isTyping, poseCustomizing, ready]);

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
        <ConversationBubble role="bot" visible={isBotVisible("sceneType")}>
          <p className="image-studio-prompt-guide-bubble-text">Quel type de mise en scène ?</p>
          {guideStep === "sceneType" ? (
            <OptionButtonRow
              options={EDITORIAL_SCENE_TYPE_OPTIONS}
              selectedId={sceneTypeId}
              disabled={false}
              onSelect={handleSceneTypeSelect}
              ariaLabel="Type de mise en scène"
            />
          ) : null}
        </ConversationBubble>

        {sceneTypeLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{sceneTypeLabel}</p>
          </ConversationBubble>
        ) : null}

        {sceneTypeId ? (
          <ConversationBubble role="bot" visible={isBotVisible("gender")}>
            <p className="image-studio-prompt-guide-bubble-text">Genre du modèle</p>
            {guideStep === "gender" ? (
              <OptionButtonRow
                options={EDITORIAL_GENDER_OPTIONS}
                selectedId={genderId}
                disabled={false}
                onSelect={handleGenderSelect}
                ariaLabel="Genre du modèle"
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
          <ConversationBubble role="bot" visible={isBotVisible("zone")}>
            <p className="image-studio-prompt-guide-bubble-text">
              {sceneTypeId === "bijou-porte"
                ? "Quelle partie du corps porte le bijou ?"
                : "Où le produit est-il tenu ?"}
            </p>
            {guideStep === "zone" ? (
              <OptionButtonRow
                options={zoneOptions}
                selectedId={zoneId}
                disabled={false}
                onSelect={handleZoneSelect}
                ariaLabel="Zone du corps"
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {zoneLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{zoneLabel}</p>
          </ConversationBubble>
        ) : null}

        {zoneId ? (
          <ConversationBubble role="bot" visible={isBotVisible("framing")}>
            <p className="image-studio-prompt-guide-bubble-text">Quel cadrage veux-tu ?</p>
            {guideStep === "framing" ? (
              <OptionButtonRow
                options={framingOptions}
                selectedId={framingId}
                disabled={false}
                onSelect={handleFramingSelect}
                ariaLabel="Cadrage"
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {framingLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{framingLabel}</p>
          </ConversationBubble>
        ) : null}

        {framingId === "corps-entier" ? (
          <ConversationBubble role="bot" visible={isBotVisible("outfit")}>
            <p className="image-studio-prompt-guide-bubble-text">Décris la tenue du modèle</p>
            {guideStep === "outfit" ? (
              <div className="image-studio-prompt-guide-bubble-compose">{composeForm}</div>
            ) : null}
          </ConversationBubble>
        ) : null}

        {outfitDescription ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{outfitDescription}</p>
          </ConversationBubble>
        ) : null}

        {(framingId && framingId !== "corps-entier") || outfitDescription ? (
          <ConversationBubble role="bot" visible={isBotVisible("background")}>
            <p className="image-studio-prompt-guide-bubble-text">Type de fond</p>
            {guideStep === "background" ? (
              <OptionButtonRow
                options={EDITORIAL_BACKGROUND_OPTIONS}
                selectedId={backgroundId}
                disabled={false}
                onSelect={handleBackgroundSelect}
                ariaLabel="Type de fond"
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {backgroundLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{backgroundLabel}</p>
          </ConversationBubble>
        ) : null}

        {backgroundId === "environnement" ? (
          <ConversationBubble role="bot" visible={isBotVisible("ambiance")}>
            <p className="image-studio-prompt-guide-bubble-text">Ambiance</p>
            {guideStep === "ambiance" ? (
              <OptionButtonRow
                options={EDITORIAL_AMBIANCE_OPTIONS}
                selectedId={ambianceId}
                disabled={false}
                onSelect={handleAmbianceSelect}
                ariaLabel="Ambiance"
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {ambianceLabel && backgroundId === "environnement" ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">
              {ambianceId === "autre" && customAmbiance ? customAmbiance : ambianceLabel}
            </p>
          </ConversationBubble>
        ) : null}

        {guideStep === "customAmbiance" || (ambianceId === "autre" && customAmbiance) ? (
          <ConversationBubble role="bot" visible={isBotVisible("customAmbiance")}>
            <p className="image-studio-prompt-guide-bubble-text">
              Décris l&apos;ambiance souhaitée
            </p>
            {guideStep === "customAmbiance" ? (
              <div className="image-studio-prompt-guide-bubble-compose">{composeForm}</div>
            ) : null}
          </ConversationBubble>
        ) : null}

        {(backgroundId === "neutre" ||
          (backgroundId === "environnement" && ambianceId && ambianceId !== "autre") ||
          customAmbiance) &&
        (guideStep === "product" || productDescription) ? (
          <ConversationBubble role="bot" visible={isBotVisible("product")}>
            <p className="image-studio-prompt-guide-bubble-text">Décris le bijou ou le produit</p>
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

        {productDescription ? (
          <ConversationBubble role="user">
            {slots.productImageUrl ? (
              <div className="image-studio-prompt-ugc-product-answer">
                <img
                  src={slots.productImageUrl}
                  alt=""
                  className="image-studio-prompt-ugc-product-answer-img"
                />
                <p className="image-studio-prompt-guide-bubble-text">{productDescription}</p>
              </div>
            ) : (
              <p className="image-studio-prompt-guide-bubble-text">{productDescription}</p>
            )}
          </ConversationBubble>
        ) : null}

        {productDescription ? (
          <ConversationBubble role="bot" visible={isBotVisible("pose")}>
            <p className="image-studio-prompt-guide-bubble-text">Posture &amp; pose</p>
            {guideStep === "pose" && !poseCustomizing ? (
              <div
                className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
                role="group"
                aria-label="Posture et pose"
              >
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={handlePoseSkip}
                >
                  Passer
                </button>
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={handlePoseCustomize}
                >
                  Personnaliser
                </button>
              </div>
            ) : null}
            {guideStep === "pose" && poseCustomizing ? (
              <>
                <div className="image-studio-prompt-ugc-option-group">
                  <p className="image-studio-prompt-ugc-option-group-label">Posture</p>
                  <OptionButtonRow
                    options={EDITORIAL_POSTURE_OPTIONS}
                    selectedId={postureId}
                    disabled={false}
                    onSelect={setPostureId}
                    ariaLabel="Posture"
                  />
                </div>
                <div className="image-studio-prompt-guide-bubble-compose">{composeForm}</div>
              </>
            ) : null}
          </ConversationBubble>
        ) : null}

        {poseAnswerLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{poseAnswerLabel}</p>
          </ConversationBubble>
        ) : null}

        {guideStep === "format" || ready ? (
          <ConversationBubble role="bot" visible={isBotVisible("format")}>
            <p className="image-studio-prompt-guide-bubble-text">Format</p>
            {guideStep === "format" && !ready ? (
              <div
                className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
                role="group"
                aria-label="Format"
              >
                {EDITORIAL_FORMAT_OPTIONS.map((option) => (
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
