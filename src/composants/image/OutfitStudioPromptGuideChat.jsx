import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, ImageUp, SendHorizontal, X } from "lucide-react";
import {
  assembleOutfitStudioPromptFromSlots,
  isOutfitStudioGuideReady,
} from "@/bibliotheque/imageStudio/outfitStudioAssembly";
import {
  getOutfitStudioPoseOptions,
  getOutfitStudioSubContextOptions,
  inferOutfitPieceTypeFromFilename,
  resolveOutfitStudioDefaultPoseId,
  resolveOutfitStudioReferenceImageUrls,
  OUTFIT_STUDIO_FRAMING_OPTIONS,
  OUTFIT_STUDIO_GENDER_OPTIONS,
  OUTFIT_STUDIO_RATIO_OPTIONS,
  OUTFIT_STUDIO_SCENE_TYPE_OPTIONS,
} from "@/bibliotheque/imageStudio/outfitStudioConfig";
import { fillTemplateSlotDefaults } from "@/bibliotheque/imageStudio/promptTemplateEngine";
import { readGuideProductImageFile } from "@/bibliotheque/imageStudio/guideProductImage";

/** @typedef {'gender' | 'clothing' | 'sceneType' | 'subContext' | 'framing' | 'ratio' | 'pose' | 'ready'} OutfitStudioGuideStep */

const BOT_TYPING_DELAY_MS = 520;
const MAX_CLOTHING_IMAGES = 4;

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

function SceneTypeTileGrid({ options, selectedId, disabled, onSelect }) {
  return (
    <div className="image-studio-prompt-shot-grid" role="radiogroup" aria-label="Type de scène">
      {options.map((option) => {
        const selected = selectedId === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            className={`image-studio-prompt-shot-tile${selected ? " is-selected" : ""}${
              disabled ? " is-disabled" : ""
            }`}
            onClick={() => onSelect(option.id)}
          >
            {option.image ? (
              <img src={option.image} alt="" className="image-studio-prompt-shot-tile-img" />
            ) : (
              <span className="image-studio-prompt-shot-tile-fallback">{option.label.charAt(0)}</span>
            )}
            <span className="image-studio-prompt-shot-tile-label">{option.label}</span>
          </button>
        );
      })}
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

function GuideOutfitImagePicker({
  disabled = false,
  previews,
  errorMessage,
  onPickFiles,
  onRemove,
}) {
  const inputRef = useRef(null);

  return (
    <div className="image-studio-prompt-ugc-product-image-picker">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        multiple
        className="sr-only"
        disabled={disabled || previews.length >= MAX_CLOTHING_IMAGES}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          onPickFiles(files);
        }}
      />
      <button
        type="button"
        className="studio-toolbar-btn image-studio-prompt-guide-elements-btn image-studio-prompt-ugc-product-image-btn"
        disabled={disabled || previews.length >= MAX_CLOTHING_IMAGES}
        onClick={() => inputRef.current?.click()}
      >
        <ImageUp className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span>
          {previews.length > 0
            ? `Ajouter un vêtement (${previews.length}/${MAX_CLOTHING_IMAGES})`
            : "Ajouter une ou plusieurs images de vêtements"}
        </span>
      </button>
      {previews.length > 0 ? (
        <div className="image-studio-prompt-ugc-product-image-preview image-studio-prompt-ugc-product-image-preview--multi">
          {previews.map((preview) => (
            <div key={preview.id} className="image-studio-prompt-ugc-product-image-preview-item">
              <img src={preview.dataUrl} alt="" />
              <button
                type="button"
                className="image-studio-prompt-ugc-product-image-remove"
                aria-label="Retirer l'image"
                disabled={disabled}
                onClick={() => onRemove(preview.id)}
              >
                <X className="h-3 w-3" strokeWidth={2.25} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {errorMessage ? (
        <p className="image-studio-prompt-ugc-product-image-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export default function OutfitStudioPromptGuideChat({ template, onBack, onApplyPrompt, onClose }) {
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [genderId, setGenderId] = useState(null);
  const [sceneTypeId, setSceneTypeId] = useState(null);
  const [subContextId, setSubContextId] = useState(null);
  const [framingId, setFramingId] = useState(null);
  const [ratioId, setRatioId] = useState(null);
  const [poseId, setPoseId] = useState(null);

  const [guideStep, setGuideStep] = useState(/** @type {OutfitStudioGuideStep} */ ("gender"));
  const [slots, setSlots] = useState({});
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [clothingValidationShown, setClothingValidationShown] = useState(false);
  const [clothingImageError, setClothingImageError] = useState(null);
  const [clothingPreviews, setClothingPreviews] = useState([]);

  const poseOptions = useMemo(
    () => (genderId ? getOutfitStudioPoseOptions(genderId) : []),
    [genderId],
  );

  const subContextOptions = useMemo(
    () => (sceneTypeId ? getOutfitStudioSubContextOptions(sceneTypeId) : []),
    [sceneTypeId],
  );

  const filledSlots = useMemo(() => fillTemplateSlotDefaults(template, slots), [template, slots]);

  const assembledPrompt = useMemo(() => {
    if (!ready) return "";
    return assembleOutfitStudioPromptFromSlots(slots);
  }, [ready, slots]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [guideStep]);

  const finalizeGuide = useCallback((nextSlots) => {
    setSlots(nextSlots);
    setReady(true);
    setGuideStep("ready");
  }, []);

  const handleGenderSelect = useCallback((nextGenderId) => {
    setGenderId(nextGenderId);
    setPoseId(null);
    setSlots((prev) => ({ ...prev, genderId: nextGenderId, poseId: "" }));
    setGuideStep("clothing");
  }, []);

  const handleClothingImagePick = useCallback(
    async (files) => {
      setClothingImageError(null);
      if (!files.length) return;

      const remaining = MAX_CLOTHING_IMAGES - clothingPreviews.length;
      const batch = files.slice(0, remaining);
      const results = await Promise.all(batch.map((file) => readGuideProductImageFile(file)));

      const valid = [];
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        if (!result.ok) {
          setClothingImageError(result.error);
          continue;
        }
        valid.push({
          id: `${Date.now()}-${index}-${batch[index].name}`,
          dataUrl: result.dataUrl,
          filename: batch[index].name,
          pieceType: inferOutfitPieceTypeFromFilename(batch[index].name),
        });
      }

      if (!valid.length) return;
      setClothingPreviews((prev) => [...prev, ...valid]);
    },
    [clothingPreviews.length],
  );

  const handleClothingImageRemove = useCallback((previewId) => {
    setClothingPreviews((prev) => prev.filter((item) => item.id !== previewId));
  }, []);

  const buildClothingSlots = useCallback(
    (notes) => {
      const primaryPreview = clothingPreviews[0] ?? null;
      return {
        clothingNotes: notes,
        clothingImageUrl: primaryPreview?.dataUrl ?? "",
        clothingImageCount: String(clothingPreviews.length),
        clothingImageFilenames: clothingPreviews.map((item) => item.filename).join("\n"),
      };
    },
    [clothingPreviews],
  );

  const handleClothingSubmit = useCallback(
    (raw) => {
      const notes = raw.trim();
      const hasImages = clothingPreviews.length > 0;
      if (notes.length < 2 && !hasImages) {
        setClothingValidationShown(true);
        return;
      }
      setClothingValidationShown(false);
      setDraft("");
      setSlots((prev) => ({
        ...prev,
        ...buildClothingSlots(notes),
      }));
      setGuideStep("sceneType");
    },
    [buildClothingSlots, clothingPreviews.length],
  );

  const handleClothingSkip = useCallback(() => {
    if (clothingPreviews.length === 0) return;
    handleClothingSubmit("");
  }, [clothingPreviews.length, handleClothingSubmit]);

  const handleClothingTextSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (!draft.length) return;
      handleClothingSubmit(draft);
    },
    [draft, handleClothingSubmit],
  );

  const handleSceneTypeSelect = useCallback((nextSceneTypeId) => {
    setSceneTypeId(nextSceneTypeId);
    setSubContextId(null);
    setSlots((prev) => ({
      ...prev,
      sceneTypeId: nextSceneTypeId,
      subContextId: "",
    }));
    if (nextSceneTypeId === "studio-blanc") {
      setGuideStep("framing");
    } else {
      setGuideStep("subContext");
    }
  }, []);

  const handleSubContextSelect = useCallback((nextSubContextId) => {
    setSubContextId(nextSubContextId);
    setSlots((prev) => ({ ...prev, subContextId: nextSubContextId }));
    setGuideStep("framing");
  }, []);

  const handleFramingSelect = useCallback((nextFramingId) => {
    setFramingId(nextFramingId);
    setSlots((prev) => ({ ...prev, framingId: nextFramingId }));
    setGuideStep("ratio");
  }, []);

  const handleRatioSelect = useCallback((nextRatioId) => {
    setRatioId(nextRatioId);
    setSlots((prev) => ({ ...prev, ratioId: nextRatioId }));
    setGuideStep("pose");
  }, []);

  const handlePoseSelect = useCallback((nextPoseId) => {
    setPoseId(nextPoseId);
    setSlots((prev) => {
      const nextSlots = { ...prev, poseId: nextPoseId };
      finalizeGuide(nextSlots);
      return nextSlots;
    });
  }, [finalizeGuide]);

  const handlePoseSkip = useCallback(() => {
    if (!genderId) return;
    const defaultPoseId = resolveOutfitStudioDefaultPoseId(genderId);
    setPoseId(defaultPoseId);
    setSlots((prev) => {
      const nextSlots = { ...prev, poseId: defaultPoseId };
      finalizeGuide(nextSlots);
      return nextSlots;
    });
  }, [finalizeGuide, genderId]);

  const handleSlotChange = useCallback((key, value) => {
    setSlots((prev) => {
      const next = { ...prev, [key]: value };
      setReady(isOutfitStudioGuideReady(next));
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    if (!assembledPrompt) return;

    const clothingNotes = slots.clothingNotes?.trim() ?? "";
    const { productImageUrl, importedRefImageUrl } = resolveOutfitStudioReferenceImageUrls({
      imageUrls: clothingPreviews.map((preview) => preview.dataUrl),
      imageFilenames: clothingPreviews.map((preview) => preview.filename),
      userNotes: clothingNotes,
      assembledPrompt,
    });

    if (productImageUrl) {
      onApplyPrompt({
        prompt: assembledPrompt,
        productImageUrl,
        importedRefImageUrl,
        productFocus: clothingNotes || null,
      });
    } else {
      onApplyPrompt(assembledPrompt);
    }
    onClose();
  }, [assembledPrompt, clothingPreviews, onApplyPrompt, onClose, slots.clothingNotes]);

  const genderLabel = findOptionLabel(OUTFIT_STUDIO_GENDER_OPTIONS, genderId);
  const sceneTypeLabel = findOptionLabel(OUTFIT_STUDIO_SCENE_TYPE_OPTIONS, sceneTypeId);
  const subContextLabel = findOptionLabel(subContextOptions, subContextId);
  const framingLabel = findOptionLabel(OUTFIT_STUDIO_FRAMING_OPTIONS, framingId);
  const ratioLabel = findOptionLabel(OUTFIT_STUDIO_RATIO_OPTIONS, ratioId);
  const poseLabel = findOptionLabel(poseOptions, poseId);
  const clothingNotes = slots.clothingNotes?.trim() ?? "";

  const clothingAnswerLabel = useMemo(() => {
    if (guideStep === "clothing") return null;

    const notes = slots.clothingNotes?.trim() ?? "";
    const imageCount = Number(slots.clothingImageCount || 0);
    if (imageCount === 0 && !notes) return null;

    const parts = [];
    if (imageCount > 0) {
      parts.push(
        imageCount === 1 ? "1 vêtement uploadé" : `${imageCount} vêtements uploadés`,
      );
    }
    if (notes) parts.push(notes);
    return parts.join(" — ");
  }, [guideStep, slots.clothingImageCount, slots.clothingNotes]);

  const poseAnswerLabel = useMemo(() => {
    if (!poseId && guideStep !== "pose" && !ready) return null;
    if (
      poseId === resolveOutfitStudioDefaultPoseId(genderId ?? "femme") &&
      slots.poseId &&
      guideStep !== "pose"
    ) {
      return "Debout statique (par défaut)";
    }
    return poseLabel;
  }, [genderId, guideStep, poseId, poseLabel, ready, slots.poseId]);

  const botTurnKeys = useMemo(() => {
    const keys = ["gender"];
    if (genderId) keys.push("clothing");
    if (guideStep !== "gender" && guideStep !== "clothing") keys.push("sceneType");
    if (sceneTypeId && sceneTypeId !== "studio-blanc") keys.push("subContext");
    if (framingId || guideStep === "framing" || (sceneTypeId && (subContextId || sceneTypeId === "studio-blanc"))) {
      keys.push("framing");
    }
    if (ratioId || guideStep === "ratio" || framingId) keys.push("ratio");
    if (guideStep === "pose" || poseAnswerLabel) keys.push("pose");
    if (clothingValidationShown) keys.push("clothing-validation");
    if (ready) keys.push("result");
    return keys;
  }, [
    clothingValidationShown,
    framingId,
    genderId,
    guideStep,
    poseAnswerLabel,
    ratioId,
    ready,
    sceneTypeId,
    subContextId,
  ]);

  const { isBotVisible, isTyping } = useConversationBotVisibility(botTurnKeys);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [adjustOpen, botTurnKeys.length, guideStep, isTyping, ready, clothingPreviews.length]);

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
          <p className="image-studio-prompt-guide-bubble-text">Sexe du modèle</p>
          {guideStep === "gender" ? (
            <OptionButtonRow
              options={OUTFIT_STUDIO_GENDER_OPTIONS}
              selectedId={genderId}
              disabled={false}
              onSelect={handleGenderSelect}
              ariaLabel="Sexe du modèle"
            />
          ) : null}
        </ConversationBubble>

        {genderLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{genderLabel}</p>
          </ConversationBubble>
        ) : null}

        {genderId ? (
          <ConversationBubble role="bot" visible={isBotVisible("clothing")} wide>
            <p className="image-studio-prompt-guide-bubble-text">
              Uploadez un ou plusieurs vêtements à styliser sur le mannequin. Vous pouvez aussi
              préciser librement la pièce à mettre en avant ou le cadrage souhaité.
            </p>
            {guideStep === "clothing" ? (
              <>
                <GuideOutfitImagePicker
                  disabled={false}
                  previews={clothingPreviews}
                  errorMessage={clothingImageError}
                  onPickFiles={handleClothingImagePick}
                  onRemove={handleClothingImageRemove}
                />
                {clothingPreviews.length > 0 ? (
                  <>
                    <p className="image-studio-prompt-guide-bubble-hint">
                      Précisez la pièce à mettre en avant si besoin, ou continuez sans précision.
                    </p>
                    <div className="image-studio-prompt-guide-bubble-compose">
                      <form
                        className="image-studio-prompt-guide-compose"
                        onSubmit={handleClothingTextSubmit}
                      >
                        <input
                          ref={inputRef}
                          type="text"
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          placeholder="Ex. focus sur la veste, plan buste… (optionnel)"
                          className="image-studio-prompt-guide-input"
                          aria-label="Précisions sur les vêtements"
                        />
                        {draft.length > 0 ? (
                          <button
                            type="submit"
                            className="image-studio-prompt-guide-send"
                            aria-label="Valider la précision"
                            title="Valider"
                          >
                            <SendHorizontal className="h-4 w-4" strokeWidth={2.25} />
                          </button>
                        ) : null}
                      </form>
                    </div>
                    <SkipButton
                      disabled={false}
                      onClick={handleClothingSkip}
                      label="Continuer sans précision"
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </ConversationBubble>
        ) : null}

        {clothingAnswerLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{clothingAnswerLabel}</p>
          </ConversationBubble>
        ) : null}

        {clothingValidationShown ? (
          <ConversationBubble role="bot" visible={isBotVisible("clothing-validation")}>
            <p className="image-studio-prompt-guide-bubble-text" role="alert">
              Ajoutez au moins une image de vêtement ou quelques mots de description.
            </p>
          </ConversationBubble>
        ) : null}

        {clothingAnswerLabel ? (
          <ConversationBubble role="bot" visible={isBotVisible("sceneType")} wide>
            <p className="image-studio-prompt-guide-bubble-text">Type de scène</p>
            {guideStep === "sceneType" ? (
              <SceneTypeTileGrid
                options={OUTFIT_STUDIO_SCENE_TYPE_OPTIONS}
                selectedId={sceneTypeId}
                disabled={false}
                onSelect={handleSceneTypeSelect}
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {sceneTypeLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{sceneTypeLabel}</p>
          </ConversationBubble>
        ) : null}

        {sceneTypeId && sceneTypeId !== "studio-blanc" ? (
          <ConversationBubble role="bot" visible={isBotVisible("subContext")} wide>
            <p className="image-studio-prompt-guide-bubble-text">Sous-contexte</p>
            {guideStep === "subContext" ? (
              <OptionGrid
                options={subContextOptions}
                selectedId={subContextId}
                disabled={false}
                onSelect={handleSubContextSelect}
                ariaLabel="Sous-contexte"
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {subContextLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{subContextLabel}</p>
          </ConversationBubble>
        ) : null}

        {(framingId || guideStep === "framing" || (sceneTypeId && (subContextId || sceneTypeId === "studio-blanc"))) &&
        (subContextLabel || sceneTypeId === "studio-blanc") ? (
          <ConversationBubble role="bot" visible={isBotVisible("framing")}>
            <p className="image-studio-prompt-guide-bubble-text">Cadrage</p>
            {guideStep === "framing" ? (
              <OptionButtonRow
                options={OUTFIT_STUDIO_FRAMING_OPTIONS}
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

        {(ratioId || guideStep === "ratio" || framingId) && framingLabel ? (
          <ConversationBubble role="bot" visible={isBotVisible("ratio")}>
            <p className="image-studio-prompt-guide-bubble-text">Ratio de sortie</p>
            {guideStep === "ratio" ? (
              <OptionButtonRow
                options={OUTFIT_STUDIO_RATIO_OPTIONS}
                selectedId={ratioId}
                disabled={false}
                onSelect={handleRatioSelect}
                ariaLabel="Ratio de sortie"
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {ratioLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{ratioLabel}</p>
          </ConversationBubble>
        ) : null}

        {(guideStep === "pose" || poseAnswerLabel) && ratioLabel ? (
          <ConversationBubble role="bot" visible={isBotVisible("pose")} wide>
            <p className="image-studio-prompt-guide-bubble-text">
              Pose / attitude <span className="image-studio-prompt-guide-optional">(optionnel)</span>
            </p>
            {guideStep === "pose" ? (
              <>
                <OptionGrid
                  options={poseOptions}
                  selectedId={poseId}
                  disabled={false}
                  onSelect={handlePoseSelect}
                  ariaLabel="Pose"
                />
                <SkipButton disabled={false} onClick={handlePoseSkip} label="Passer (défaut)" />
              </>
            ) : null}
          </ConversationBubble>
        ) : null}

        {poseAnswerLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{poseAnswerLabel}</p>
          </ConversationBubble>
        ) : null}

        {ready ? (
          <ConversationBubble role="bot" visible={isBotVisible("result")} wide>
            <p className="image-studio-prompt-guide-bubble-text">{template.botReady}</p>
            {promptResultBlock}
          </ConversationBubble>
        ) : null}

        {isTyping ? <TypingIndicator /> : null}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
