import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Footprints,
  Hand,
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
import {
  getUgcSelfieProfileById,
  getUgcSelfieProfilesForGender,
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

/** @typedef {'presentationMode' | 'bodyZone' | 'posture' | 'gender' | 'age' | 'physical' | 'product' | 'autreTenue' | 'autreTenueCustom' | 'location' | 'ready'} UgcPresentationGuideStep */

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

function BodyZoneGrid({ selectedId, disabled, onSelect }) {
  return (
    <div
      className="image-studio-prompt-ugc-body-zone-grid"
      role="radiogroup"
      aria-label="Zone du corps"
    >
      {UGC_PRESENTATION_BODY_ZONE_OPTIONS.map((option) => {
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

function LocationGrid({ presets, selectedId, disabled, onSelect, onOther }) {
  return (
    <div className="image-studio-prompt-ugc-location-grid" role="radiogroup" aria-label="Lieu">
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
        Autre
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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [presentationMode, setPresentationMode] = useState(null);
  const [bodyZone, setBodyZone] = useState(null);
  const [pose, setPose] = useState(null);
  const [gender, setGender] = useState(null);
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

  const profile = useMemo(() => getUgcSelfieProfileById(profileId), [profileId]);
  const ageProfiles = useMemo(
    () => (gender ? getUgcSelfieProfilesForGender(gender) : []),
    [gender],
  );
  const isFullOutfit = bodyZone === "full-outfit";

  const filledSlots = useMemo(() => fillTemplateSlotDefaults(template, slots), [template, slots]);

  const assembledPrompt = useMemo(() => {
    if (!ready) return "";
    return assembleUgcPresentationPromptFromSlots(slots);
  }, [ready, slots]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [guideStep, locationOtherOpen]);

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
    setGuideStep("age");
  }, []);

  const handleProfileSelect = useCallback((nextProfileId) => {
    setProfileId(nextProfileId);
    setSlots((prev) => ({ ...prev, profileId: nextProfileId }));
    setPhysicalSkinId(null);
    setPhysicalHairId(null);
    setGuideStep("physical");
  }, []);

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
      if (isFullOutfit) {
        setSlots((prev) => ({ ...prev, productName, autreTenue: "" }));
        setGuideStep("location");
      } else {
        setSlots((prev) => ({ ...prev, productName }));
        setGuideStep("autreTenue");
      }
    },
    [isFullOutfit],
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
    onApplyPrompt(assembledPrompt);
    onClose();
  }, [assembledPrompt, onApplyPrompt, onClose]);

  const showTextInput =
    guideStep === "product" ||
    guideStep === "autreTenueCustom" ||
    (guideStep === "location" && locationOtherOpen);

  const inputPlaceholder =
    guideStep === "product"
      ? isFullOutfit
        ? "ex: red sleeveless draped evening dress"
        : "ex: red sleeveless draped dress"
      : guideStep === "autreTenueCustom"
        ? "ex: soft beige knit cardigan over a dark top"
        : "Décrivez le lieu…";

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

  const presentationModeLabel =
    presentationMode === "held"
      ? "Tenu en main"
      : presentationMode === "worn"
        ? "Porté sur le corps"
        : null;

  const bodyZoneLabel = useMemo(() => {
    if (!bodyZone) return null;
    return UGC_PRESENTATION_BODY_ZONE_OPTIONS.find((option) => option.id === bodyZone)?.label ?? null;
  }, [bodyZone]);

  const postureLabel = useMemo(() => {
    if (!pose) return null;
    if (pose === "forward") return "Penchée vers l'avant";
    if (pose === "natural") return "Debout, posture naturelle";
    return null;
  }, [pose]);

  const genderLabel = gender === "homme" ? "Homme" : gender === "femme" ? "Femme" : null;
  const productName = (slots.productName ?? "").trim();
  const productQuestion =
    isFullOutfit ? "Décrivez la tenue complète" : "Quel est le produit ?";

  const locationLabel = useMemo(() => {
    const location = slots.location;
    if (location === undefined || location === null) return null;
    const preset = UGC_PRESENTATION_LOCATION_PRESETS.find((item) => item.promptValue === location);
    if (preset) return preset.label;
    if (location === "") return "Dressing luxe";
    return location;
  }, [slots.location]);

  const autreTenueLabel = useMemo(() => {
    if (isFullOutfit) return null;
    if (guideStep === "autreTenue" || guideStep === "autreTenueCustom") return null;
    if (!(slots.productName ?? "").trim()) return null;
    const autreTenue = (slots.autreTenue ?? "").trim();
    if (autreTenue) return autreTenue;
    if (guideStep === "location" || ready) return "Rien";
    return null;
  }, [guideStep, isFullOutfit, ready, slots.autreTenue, slots.productName]);

  const physicalAnswerLabel = useMemo(() => {
    if (guideStep === "physical") return null;
    const parts = [];
    const skin = UGC_SELFIE_SKIN_TONE_OPTIONS.find((option) => option.id === physicalSkinId);
    const hair = UGC_SELFIE_HAIR_OPTIONS.find((option) => option.id === physicalHairId);
    if (skin) parts.push(skin.label);
    if (hair) parts.push(hair.label);
    if (parts.length > 0) return parts.join(" · ");
    if (slots.physicalMode === "default" && profileId) return "Laisser le chatbot choisir";
    return null;
  }, [guideStep, physicalHairId, physicalSkinId, profileId, slots.physicalMode]);

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
        <ConversationBubble role="bot" visible={isBotVisible("presentationMode")}>
          <p className="image-studio-prompt-guide-bubble-text">
            Le produit est-il tenu en main ou porté sur le corps ?
          </p>
          {guideStep === "presentationMode" ? (
            <div
              className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
              role="group"
              aria-label="Mode de présentation"
            >
              <button
                type="button"
                className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                onClick={() => handlePresentationModeSelect("held")}
              >
                Tenu en main
              </button>
              <button
                type="button"
                className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                onClick={() => handlePresentationModeSelect("worn")}
              >
                Porté sur le corps
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
              Quelle partie du corps porte le produit ?
            </p>
            {guideStep === "bodyZone" ? (
              <BodyZoneGrid
                selectedId={bodyZone}
                disabled={false}
                onSelect={handleBodyZoneSelect}
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
              Comment la personne se tient-elle face à la caméra ?
            </p>
            {postureStepActive ? (
              <div
                className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
                role="group"
                aria-label="Posture"
              >
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={() => handlePostureSelect("forward")}
                >
                  Penchée vers l&apos;avant
                </button>
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={() => handlePostureSelect("natural")}
                >
                  Debout, posture naturelle
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
            <p className="image-studio-prompt-guide-bubble-text">Homme ou Femme ?</p>
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
        )}

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
              Raffinement physique ? (optionnel)
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
            </div>
            {physicalStepActive ? (
              <div className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions image-studio-prompt-ugc-physical-actions">
                <button
                  type="button"
                  className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                  onClick={handlePhysicalDefault}
                >
                  Laisser le chatbot choisir
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

        {physicalAnswerLabel ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">{physicalAnswerLabel}</p>
          </ConversationBubble>
        ) : null}

        {guideStep === "product" || productName ? (
          <ConversationBubble role="bot" visible={isBotVisible("product")}>
            <p className="image-studio-prompt-guide-bubble-text">{productQuestion}</p>
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

        {!isFullOutfit && guideStep === "autreTenue" ? (
          <ConversationBubble role="bot" visible={isBotVisible("autreTenue")}>
            <p className="image-studio-prompt-guide-bubble-text">
              Que porte-t{gender === "homme" ? "-il" : "-elle"} d&apos;autre ?
            </p>
            <div
              className="image-studio-prompt-guide-elements-actions image-studio-prompt-guide-bubble-actions"
              role="group"
              aria-label="Reste de la tenue"
            >
              <button
                type="button"
                className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                onClick={handleAutreTenueRien}
              >
                Rien
              </button>
              <button
                type="button"
                className="studio-toolbar-btn image-studio-prompt-guide-elements-btn"
                onClick={handleAutreTenuePersonnaliser}
              >
                Personnaliser
              </button>
            </div>
          </ConversationBubble>
        ) : null}

        {guideStep === "autreTenueCustom" ? (
          <ConversationBubble role="user">
            <p className="image-studio-prompt-guide-bubble-text">Personnaliser</p>
          </ConversationBubble>
        ) : null}

        {!isFullOutfit && guideStep === "autreTenueCustom" ? (
          <ConversationBubble role="bot" visible={isBotVisible("autreTenueCustom")}>
            <p className="image-studio-prompt-guide-bubble-text">Décrivez le reste de la tenue</p>
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
            <p className="image-studio-prompt-guide-bubble-text">Où se passe la scène ?</p>
            {guideStep === "location" && !ready ? (
              <>
                <LocationGrid
                  presets={UGC_PRESENTATION_LOCATION_PRESETS}
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
