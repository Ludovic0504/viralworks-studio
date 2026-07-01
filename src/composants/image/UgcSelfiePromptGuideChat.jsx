import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, SendHorizontal } from "lucide-react";
import {
  assembleUgcSelfiePromptFromSlots,
  fillTemplateSlotDefaults,
  isUgcSelfieGuideReady,
  resolveUgcSelfiePhysicalSlots,
} from "@/bibliotheque/imageStudio/promptTemplateEngine";
import {
  getUgcSelfieProfileById,
  getUgcSelfieProfilesForGender,
  UGC_SELFIE_HAIR_OPTIONS,
  UGC_SELFIE_LOCATION_PRESETS,
  UGC_SELFIE_OUTFIT_OPTIONS,
  UGC_SELFIE_SKIN_TONE_OPTIONS,
} from "@/bibliotheque/imageStudio/ugcSelfieProfiles";

/** @typedef {'gender' | 'age' | 'physical' | 'product' | 'location' | 'ready'} UgcSelfieGuideStep */

const BOT_TYPING_DELAY_MS = 520;

function nextMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function AgeProfileGrid({ profiles, selectedId, locked, onSelect }) {
  return (
    <div
      className={`image-studio-prompt-shot-grid${locked ? " image-studio-prompt-shot-grid--locked" : ""}`}
      role="radiogroup"
      aria-label="Âge"
    >
      {profiles.map((profile) => {
        const selected = selectedId === profile.id;
        return (
          <button
            key={profile.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={locked}
            className={`image-studio-prompt-shot-tile${selected ? " is-selected" : ""}${
              locked ? " is-locked" : ""
            }`}
            onClick={() => onSelect(profile.id)}
          >
            <img src={profile.image} alt="" className="image-studio-prompt-shot-tile-img" />
            <span className="image-studio-prompt-shot-tile-label">{profile.ageLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

function SkinToneSwatchGroup({ options, selectedId, disabled, onSelect }) {
  return (
    <div className="image-studio-prompt-ugc-option-group">
      <p className="image-studio-prompt-ugc-option-group-label">Teint de peau</p>
      <div
        className="image-studio-prompt-ugc-skin-grid"
        role="radiogroup"
        aria-label="Teint de peau"
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

function LocationGrid({ selectedId, disabled, onSelect, onOther }) {
  return (
    <div className="image-studio-prompt-ugc-location-grid" role="radiogroup" aria-label="Lieu">
      {UGC_SELFIE_LOCATION_PRESETS.map((preset) => (
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
        Autre
      </button>
    </div>
  );
}

export default function UgcSelfiePromptGuideChat({ template, onBack, onApplyPrompt, onClose }) {
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  /** @type {[null | 'homme' | 'femme', import('react').Dispatch<import('react').SetStateAction<null | 'homme' | 'femme'>>]} */
  const [gender, setGender] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [guideStep, setGuideStep] = useState(/** @type {UgcSelfieGuideStep} */ ("gender"));
  const [slots, setSlots] = useState({});
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [physicalSkinId, setPhysicalSkinId] = useState(null);
  const [physicalHairId, setPhysicalHairId] = useState(null);
  const [physicalOutfitId, setPhysicalOutfitId] = useState(null);
  const [locationPresetId, setLocationPresetId] = useState(null);
  const [locationOtherOpen, setLocationOtherOpen] = useState(false);
  const [productValidationShown, setProductValidationShown] = useState(false);

  const profile = useMemo(() => getUgcSelfieProfileById(profileId), [profileId]);
  const ageProfiles = useMemo(
    () => (gender ? getUgcSelfieProfilesForGender(gender) : []),
    [gender],
  );

  const filledSlots = useMemo(() => fillTemplateSlotDefaults(template, slots), [template, slots]);

  const assembledPrompt = useMemo(() => {
    if (!ready) return "";
    return assembleUgcSelfiePromptFromSlots(slots);
  }, [ready, slots]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [guideStep, locationOtherOpen]);

  const finalizeGuide = useCallback((nextSlots) => {
    setSlots(nextSlots);
    setReady(true);
    setGuideStep("ready");
  }, []);

  const applyPhysicalOverrides = useCallback(
    (skinId, hairId, outfitId) => {
      const skin = UGC_SELFIE_SKIN_TONE_OPTIONS.find((option) => option.id === skinId);
      const hair = UGC_SELFIE_HAIR_OPTIONS.find((option) => option.id === hairId);
      const outfit = UGC_SELFIE_OUTFIT_OPTIONS.find((option) => option.id === outfitId);
      const patch = {};
      if (skin) patch.skinTone = skin.promptValue;
      if (hair) patch.hair = hair.promptValue;
      if (outfit) patch.outfit = outfit.promptValue;
      return patch;
    },
    [],
  );

  const handleGenderSelect = useCallback((nextGender) => {
    setGender(nextGender);
    setGuideStep("age");
  }, []);

  const handleProfileSelect = useCallback(
    (nextProfileId) => {
      setProfileId(nextProfileId);
      setSlots((prev) => ({ ...prev, profileId: nextProfileId }));
      setPhysicalSkinId(null);
      setPhysicalHairId(null);
      setPhysicalOutfitId(null);
      setGuideStep("physical");
    },
    [],
  );

  const mergeResolvedPhysicalSlots = useCallback((prev, partialOverrides = {}, mode = "improvise") => {
    const profileKey = prev.profileId;
    if (!profileKey) return prev;
    const resolved = resolveUgcSelfiePhysicalSlots(profileKey, partialOverrides, mode);
    if (!resolved) return prev;
    return { ...prev, ...resolved, physicalMode: mode };
  }, []);

  const handleKeepPhotoDefaults = useCallback(() => {
    setSlots((prev) => mergeResolvedPhysicalSlots(prev, {}, "photo"));
    setPhysicalSkinId(null);
    setPhysicalHairId(null);
    setPhysicalOutfitId(null);
    setGuideStep("product");
  }, [mergeResolvedPhysicalSlots]);

  const handlePhysicalContinue = useCallback(() => {
    const patch = applyPhysicalOverrides(physicalSkinId, physicalHairId, physicalOutfitId);
    setSlots((prev) => mergeResolvedPhysicalSlots(prev, patch, "improvise"));
    setGuideStep("product");
  }, [applyPhysicalOverrides, mergeResolvedPhysicalSlots, physicalHairId, physicalOutfitId, physicalSkinId]);

  const handleProductSubmit = useCallback(
    (raw) => {
      const productName = raw.trim();
      if (productName.length < 2) {
        setProductValidationShown(true);
        return;
      }
      setProductValidationShown(false);
      setSlots((prev) => ({ ...prev, productName }));
      setDraft("");
      setGuideStep("location");
    },
    [],
  );

  const handleLocationPreset = useCallback((preset) => {
    setLocationPresetId(preset.id);
    setLocationOtherOpen(false);
    setSlots((prev) => {
      const next = { ...prev, location: preset.promptValue };
      finalizeGuide(next);
      return next;
    });
  }, [finalizeGuide]);

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
      if (guideStep === "location" && locationOtherOpen) {
        handleLocationOtherSubmit(draft);
      }
    },
    [draft, guideStep, handleLocationOtherSubmit, handleProductSubmit, locationOtherOpen],
  );

  const handleSlotChange = useCallback(
    (key, value) => {
      setSlots((prev) => {
        const next = { ...prev, [key]: value };
        setReady(isUgcSelfieGuideReady(template, next));
        return next;
      });
    },
    [template],
  );

  const handleApply = useCallback(() => {
    if (!assembledPrompt) return;
    onApplyPrompt(assembledPrompt);
    onClose();
  }, [assembledPrompt, onApplyPrompt, onClose]);

  const inputPlaceholder =
    guideStep === "product"
      ? "ex: Chewing-gum Freedent"
      : "Décrivez le lieu…";

  const composeForm =
    (guideStep === "product" || (guideStep === "location" && locationOtherOpen)) && !ready ? (
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

  const genderLabel = gender === "homme" ? "Homme" : gender === "femme" ? "Femme" : null;
  const productName = (slots.productName ?? "").trim();
  const locationLabel = useMemo(() => {
    const location = (slots.location ?? "").trim();
    if (!location) return null;
    const preset = UGC_SELFIE_LOCATION_PRESETS.find((item) => item.promptValue === location);
    return preset?.label ?? location;
  }, [slots.location]);

  const botTurnKeys = useMemo(() => {
    const keys = ["gender"];
    if (gender) keys.push("age");
    if (profileId) keys.push("physical");
    if (guideStep === "product" || productName) keys.push("product");
    if (productValidationShown) keys.push("product-validation");
    if (guideStep === "location" || ready) keys.push("location");
    if (ready) keys.push("result");
    return keys;
  }, [gender, guideStep, productName, productValidationShown, profileId, ready]);

  const { isBotVisible, isTyping } = useConversationBotVisibility(botTurnKeys);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [adjustOpen, botTurnKeys.length, guideStep, isTyping, ready, gender, profileId]);

  const physicalStepActive = guideStep === "physical";
  const hasPhysicalSelection = Boolean(physicalSkinId || physicalHairId || physicalOutfitId);

  const physicalAnswerLabel = useMemo(() => {
    const parts = [];
    const skin = UGC_SELFIE_SKIN_TONE_OPTIONS.find((option) => option.id === physicalSkinId);
    const hair = UGC_SELFIE_HAIR_OPTIONS.find((option) => option.id === physicalHairId);
    const outfit = UGC_SELFIE_OUTFIT_OPTIONS.find((option) => option.id === physicalOutfitId);
    if (skin) parts.push(skin.label);
    if (hair) parts.push(hair.label);
    if (outfit) parts.push(outfit.label);
    if (parts.length > 0) return parts.join(" · ");
    if (slots.physicalMode === "photo") return "Garder comme sur la photo";
    return null;
  }, [physicalHairId, physicalOutfitId, physicalSkinId, slots.physicalMode]);

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
          {profile ? (
            <label className="image-studio-prompt-guide-field">
              <span>Profil</span>
              <input type="text" value={`${genderLabel} · ${profile.ageLabel}`} readOnly />
            </label>
          ) : null}
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
          <p className="image-studio-prompt-guide-bubble-text">Quel sexe ?</p>
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
          <ConversationBubble role="bot" wide visible={isBotVisible("age")}>
            <p className="image-studio-prompt-guide-bubble-text">Quel âge ?</p>
            {guideStep === "age" ? (
              <AgeProfileGrid
                profiles={ageProfiles}
                selectedId={profileId}
                locked={false}
                onSelect={handleProfileSelect}
              />
            ) : null}
          </ConversationBubble>
        ) : null}

        {profile ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{profile.ageLabel}</p>
          </ConversationBubble>
        ) : null}

        {profileId ? (
          <ConversationBubble role="bot" wide visible={isBotVisible("physical")}>
            <p className="image-studio-prompt-guide-bubble-text">
              Personnaliser le physique ? (optionnel)
            </p>
            <div className="image-studio-prompt-ugc-physical-groups">
              <SkinToneSwatchGroup
                options={UGC_SELFIE_SKIN_TONE_OPTIONS}
                selectedId={physicalSkinId}
                disabled={!physicalStepActive}
                onSelect={setPhysicalSkinId}
              />
              <QuickOptionGroup
                label="Style de cheveux"
                options={UGC_SELFIE_HAIR_OPTIONS}
                selectedId={physicalHairId}
                disabled={!physicalStepActive}
                onSelect={setPhysicalHairId}
              />
              <QuickOptionGroup
                label="Style vestimentaire"
                options={UGC_SELFIE_OUTFIT_OPTIONS}
                selectedId={physicalOutfitId}
                disabled={!physicalStepActive}
                onSelect={setPhysicalOutfitId}
              />
            </div>
            {physicalStepActive ? (
              <div className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions image-studio-prompt-ugc-physical-actions">
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={handleKeepPhotoDefaults}
                >
                  Garder comme sur la photo
                </button>
                {hasPhysicalSelection ? (
                  <button
                    type="button"
                    className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                    onClick={handlePhysicalContinue}
                  >
                    Valider
                  </button>
                ) : null}
              </div>
            ) : null}
          </ConversationBubble>
        ) : null}

        {guideStep !== "physical" && profileId && physicalAnswerLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{physicalAnswerLabel}</p>
          </ConversationBubble>
        ) : null}

        {guideStep === "product" || productName ? (
          <ConversationBubble role="bot" visible={isBotVisible("product")}>
            <p className="image-studio-prompt-guide-bubble-text">Quel est le produit ?</p>
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

        {productName ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{productName}</p>
          </ConversationBubble>
        ) : null}

        {guideStep === "location" || ready ? (
          <ConversationBubble role="bot" wide visible={isBotVisible("location")}>
            <p className="image-studio-prompt-guide-bubble-text">Où se passe la scène ?</p>
            {guideStep === "location" && !ready ? (
              <>
                <LocationGrid
                  selectedId={locationPresetId}
                  disabled={false}
                  onSelect={handleLocationPreset}
                  onOther={handleLocationOther}
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

        <TypingIndicator visible={isTyping} />
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
