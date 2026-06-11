import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import ModalBibliothequeAvatars from "@/composants/studio/avatar/ModalBibliothequeAvatars";
import { saveHistory as saveHistorySupabase } from "@/bibliotheque/supabase/historique";
import { hasEnoughCredits, getUserCredits } from "@/bibliotheque/supabase/credits";
import { uploadImagesFromUrls } from "@/bibliotheque/supabase/storage";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import {
  canUseImageGeneration,
  canUseImageModification,
  consumeImageGeneration,
  consumeImageModification,
  getWorkflowUsage,
  resetWorkflowUsage,
} from "@/bibliotheque/workflowQuota";
import { SS_CAMPAIGN_IDEA_LIVE_KEY } from "@/bibliotheque/viralWorksStudioStorage";
import {
  loadImageMediaRefs,
  saveImageMediaRef,
} from "@/bibliotheque/viralWorksMediaCache";
import {
  createDefaultCampaignGenerationSpec,
  getSafeIntentProfile,
  getSafeScenes,
  normalizeCampaignGenerationSpec,
} from "@/bibliotheque/campaignGenerationSpec";
import { STUDIO_24S_TEMPORAL_HOOK_IMAGES_ENABLED } from "@/bibliotheque/studio24sTemporalHookImages";
import VisuelAccrocheExplicationSheet from "../composants/image/VisuelAccrocheExplicationSheet";
import {
  modifyImageWithNanoBanana,
  IMAGE_EDIT_BUSY_MESSAGE,
} from "@/bibliotheque/nanobanana/modifyImage";
import { buildHookImageApiPrompt } from "@/bibliotheque/vwsPromptEngine";
import { getFormatById } from "@/bibliotheque/vwsVideoFormatsCatalog";
import {
  Sparkles,
  X,
  Check,
  BookOpen,
  Settings2,
  ChevronRight,
  History,
  RectangleHorizontal,
  Smartphone,
  Square,
  Upload,
  Plus,
  User,
} from "lucide-react";

function clarificationModeToImagePromptLine(mode, stagingId) {
  if (mode === "MODE_A") {
    if (
      stagingId === "facecam" ||
      stagingId === "situation" ||
      stagingId === "mains_produit"
    ) {
      return "";
    }
    return "Frame 0: no human presence visible, scene elements begin autonomous transformation, subject absent at opening frame.";
  }
  if (mode === "MODE_B") {
    return "Frame 0: human or artisan visibly present and active from the first instant, triggering action visible at opening frame.";
  }
  return "";
}

const PRODUCT_REF_PROMPT_LINE =
  "Reproduce exactly the same product as shown in the reference image — identical packaging, same colors, same label, same shape.";

function buildHookSubjectReferences({
  isProductMode,
  avatarRefDataUrl,
  productRefDataUrl,
  refCharDataUrl,
}) {
  const refs = [];
  let productReference = null;
  if (isProductMode) {
    const av = typeof avatarRefDataUrl === "string" ? avatarRefDataUrl.trim() : "";
    const pr = typeof productRefDataUrl === "string" ? productRefDataUrl.trim() : "";
    if (av) refs.push(av);
    if (pr) productReference = pr;
  } else {
    const ref = typeof refCharDataUrl === "string" ? refCharDataUrl.trim() : "";
    if (ref) refs.push(ref);
  }
  if (refs.length === 0) {
    const legacy = typeof refCharDataUrl === "string" ? refCharDataUrl.trim() : "";
    if (legacy) refs.push(legacy);
  }
  const out = {};
  if (refs.length > 0) out.subjectReferences = refs;
  if (productReference) out.productReference = productReference;
  return out;
}

function buildProductRefPromptPrefix({ isProductMode, avatarRefDataUrl, productRefDataUrl }) {
  if (!isProductMode) return "";
  const lines = [];
  const av = typeof avatarRefDataUrl === "string" ? avatarRefDataUrl.trim() : "";
  const pr = typeof productRefDataUrl === "string" ? productRefDataUrl.trim() : "";
  if (av) {
    lines.push(
      "Use the person from the reference image as the exact character in this scene. Match their face, hair, and appearance precisely."
    );
  }
  if (pr) {
    lines.push(PRODUCT_REF_PROMPT_LINE);
  }
  return lines.join("\n\n");
}

function ProductRefCard({
  label,
  imageUrl,
  onPick,
  onClear,
  disabled,
  emptyIcon: EmptyIcon = Plus,
  imageClassName = "",
}) {
  const hasImage = Boolean(imageUrl);
  return (
    <div className="group relative h-20 w-14 shrink-0">
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-lg border bg-[#161d2e] transition hover:bg-[#1a2236] disabled:cursor-not-allowed disabled:opacity-50 ${
          hasImage ? "border-white/20" : "border-dashed border-white/20"
        }`}
        aria-label={hasImage ? `${label} — changer` : label}
      >
        {hasImage ? (
          <>
            <img
              src={imageUrl}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover ${imageClassName}`.trim()}
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/75 text-[8px] font-medium text-white/90 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              Changer
            </span>
          </>
        ) : (
          <>
            <EmptyIcon className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
            <span className="mt-0.5 px-0.5 text-center text-[9px] leading-tight text-white/60">{label}</span>
          </>
        )}
      </button>
      {hasImage ? (
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="absolute right-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-gray-300 hover:text-white disabled:opacity-50"
          aria-label={`Retirer ${label}`}
        >
          <X className="h-2.5 w-2.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

const IMAGE_GENERATION_COST = 1;
const VIDEO_QUOTA_EXHAUSTED_MESSAGE =
  "limite vidéo atteint pour ce mois, veuillez attendre la fin du mois pour le renouvellement des vidéos ou acheter des packs vidéos pour continuer a créer";
const NON_SUBSCRIBER_BLOCKED_MESSAGE =
  "Prenez un abonnement pour profiter de ViralWorks Studio et lancer vos générations.";

function QuotaBlockedModal({ open, title, message, actionLabel, onClose, onGoToShop }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="studio-panel max-w-xl w-full overflow-hidden border border-amber-500/35 bg-[#131920]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-gray-200">{title || "Quota mensuel épuisé"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3">
            <p className="text-sm text-amber-100">{message || VIDEO_QUOTA_EXHAUSTED_MESSAGE}</p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={onGoToShop}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold hover:from-cyan-400 hover:to-teal-400 transition-all"
            >
              {actionLabel || "Aller vers Packs vidéos"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function userKey(uid) {
  return uid ? `u:${uid}` : "guest";
}

const LS_HISTORY = "history_v2";
function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Impossible de charger l'historique local image:", err);
    return [];
  }
}
function saveHistory(items) {
  try {
    localStorage.setItem(LS_HISTORY, JSON.stringify(items));
  } catch (err) {
    console.warn("Impossible de sauvegarder l'historique local image:", err);
  }
}
function addImageHistory({ uid, prompt, urls, meta }) {
  const id = crypto.randomUUID?.() || String(Date.now());
  const createdAt = new Date().toISOString();
  const entry = {
    id,
    kind: "image",
    prompt,
    output: null,
    urls,
    meta,
    createdAt,
    pinned: false,
    owner: userKey(uid),
  };
  const items = loadHistory();
  saveHistory([entry, ...items]);
  window.dispatchEvent(new Event("onetool:history:changed"));
}
const DEFAULT_IMAGE_STEP = {
  campaignIdeaPrompt: "",
  prompt: "",
  ratio: "9:16",
  quantity: 4,
  refCharDataUrl: null,
  productAvatarRefUrl: null,
  productAvatarRefSource: null,
  productProductRefUrl: null,
  lastGeneratedImages: null,
  lastGeneratedPrompt: "",
  selectedImageIndex: 0,
  modifyInstruction: "",
  pairedCampaignIdea: null,
  image24sDebug: null,
  sceneHookImages: [null, null, null],
  sceneHookStatus: {
    scene2: { status: "idle", message: "" },
    scene3: { status: "idle", message: "" },
  },
  sceneHookAutoKey: null,
};

function formatVisualSnapshotLabel(t) {
  try {
    return new Date(t).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Session";
  }
}

export default function ImagePage({
  campaignIdea = "",
  campaignStagingChips = [],
  campaignJobType = "",
  campaignModifiers = "",
  campaignClarifyMode = null,
  campaignClarifyAnswer = null,
  campaignCameraAerialAngle = null,
  campaignCameraViewAngle = null,
  campaignGlobalIntentProfile = null,
  campaignSelfieMode = false,
  sequenceType = "single_8s",
  scriptScene1Idea = "",
  scriptScene2Idea = "",
  scriptScene3Idea = "",
  campaignRevealMode = false,
  campaignMicroAnswer = null,
  visualStepActive = false,
  imageStep,
  campaignGenerationSpec = null,
  patchImageStep,
  resetImageStep,
  onUseImageAndContinue,
  visualSnapshots = [],
  onRestoreVisualSnapshot,
}) {
  const { session, supabase } = useAuth();
  const { runWithAuth } = useRequireAuthAction();
  const uid = session?.user?.id;

  const {
    campaignIdeaPrompt,
    prompt,
    ratio,
    quantity,
    refCharDataUrl,
    productAvatarRefUrl,
    productAvatarRefSource,
    productProductRefUrl,
    lastGeneratedImages,
    lastGeneratedPrompt,
    selectedImageIndex,
    modifyInstruction,
    sceneHookImages,
    sceneHookStatus,
    sceneHookAutoKey,
    image24sDebug,
  } = imageStep ?? DEFAULT_IMAGE_STEP;

  const canonicalSpec = useMemo(() => {
    const fallback = createDefaultCampaignGenerationSpec();
    const fromIncoming = normalizeCampaignGenerationSpec(campaignGenerationSpec ?? imageStep?.campaignGenerationSpec ?? fallback);
    const spec = normalizeCampaignGenerationSpec({
      ...fromIncoming,
      campaign: {
        ...fromIncoming.campaign,
        profession: String(campaignJobType || fromIncoming.campaign.profession || ""),
        core_idea: String(campaignIdea || fromIncoming.campaign.core_idea || ""),
        style_details: String(campaignModifiers || fromIncoming.campaign.style_details || ""),
        intent_profile: campaignGlobalIntentProfile ?? fromIncoming.campaign.intent_profile,
        clarification: {
          ...fromIncoming.campaign.clarification,
          mode: campaignClarifyMode ?? fromIncoming.campaign.clarification.mode,
          last_user_freeform_answer:
            campaignClarifyAnswer ?? fromIncoming.campaign.clarification.last_user_freeform_answer,
          camera_aerial_angle:
            campaignCameraAerialAngle ?? fromIncoming.campaign.clarification.camera_aerial_angle,
          camera_view_angle:
            campaignCameraViewAngle ?? fromIncoming.campaign.clarification.camera_view_angle,
          initial_state: campaignMicroAnswer ?? fromIncoming.campaign.clarification.initial_state,
        },
      },
      creative: {
        ...fromIncoming.creative,
        scenes: [
          {
            ...getSafeScenes(fromIncoming)[0],
            script_text: String(scriptScene1Idea || getSafeScenes(fromIncoming)[0]?.script_text || ""),
          },
          {
            ...getSafeScenes(fromIncoming)[1],
            script_text: String(scriptScene2Idea || getSafeScenes(fromIncoming)[1]?.script_text || ""),
          },
          {
            ...getSafeScenes(fromIncoming)[2],
            script_text: String(scriptScene3Idea || getSafeScenes(fromIncoming)[2]?.script_text || ""),
          },
        ],
        hook_visual: {
          ...fromIncoming.creative.hook_visual,
          prompt_text: String(campaignIdeaPrompt || fromIncoming.creative.hook_visual.prompt_text || ""),
          provider_prompt_raw: String(prompt || fromIncoming.creative.hook_visual.provider_prompt_raw || ""),
          image_variants: Array.isArray(lastGeneratedImages) ? [...lastGeneratedImages] : [],
          selected_variant_index: Number.isFinite(Number(selectedImageIndex)) ? Number(selectedImageIndex) : 0,
          selected_image_url:
            (Array.isArray(lastGeneratedImages) && lastGeneratedImages[Number(selectedImageIndex)])
              ? String(lastGeneratedImages[Number(selectedImageIndex)] || "")
              : String(fromIncoming.creative.hook_visual.selected_image_url || ""),
          last_generation_prompt:
            String(lastGeneratedPrompt || fromIncoming.creative.hook_visual.last_generation_prompt || ""),
          modification_instruction:
            String(modifyInstruction || fromIncoming.creative.hook_visual.modification_instruction || ""),
        },
      },
      rendering: {
        ...fromIncoming.rendering,
        camera: {
          ...fromIncoming.rendering.camera,
          reveal_mode: Boolean(campaignRevealMode ?? fromIncoming.rendering.camera.reveal_mode),
          selfie_mode: Boolean(campaignSelfieMode ?? fromIncoming.rendering.camera.selfie_mode),
        },
      },
    });
    console.log("[Image useMemo] packaging_box_appearance:", spec.campaign.packaging_box_appearance);
    return spec;
  }, [
    campaignGenerationSpec,
    imageStep?.campaignGenerationSpec,
    campaignJobType,
    campaignIdea,
    campaignModifiers,
    campaignGlobalIntentProfile,
    campaignClarifyMode,
    campaignClarifyAnswer,
    campaignCameraAerialAngle,
    campaignCameraViewAngle,
    campaignMicroAnswer,
    scriptScene1Idea,
    scriptScene2Idea,
    scriptScene3Idea,
    campaignIdeaPrompt,
    prompt,
    lastGeneratedImages,
    selectedImageIndex,
    lastGeneratedPrompt,
    modifyInstruction,
    campaignRevealMode,
    campaignSelfieMode,
  ]);

  const writeHookVisualSpec = useCallback(
    (updates) => {
      if (!patchImageStep) return;
      patchImageStep((prev) => {
        const prevAsObject = prev && typeof prev === "object" ? prev : {};
        const baseSpec = normalizeCampaignGenerationSpec(
          prevAsObject.campaignGenerationSpec ?? canonicalSpec
        );
        const next = normalizeCampaignGenerationSpec({
          ...baseSpec,
          creative: {
            ...baseSpec.creative,
            hook_visual: {
              ...baseSpec.creative.hook_visual,
              ...updates,
            },
          },
        });
        return {
          ...prevAsObject,
          campaignGenerationSpec: next,
        };
      });
    },
    [patchImageStep, canonicalSpec]
  );

  /** Évite une boucle update-depth : l’effet de sync des variantes ne doit pas dépendre de la callback, qui change quand canonicalSpec change. */
  const writeHookVisualSpecRef = useRef(writeHookVisualSpec);
  writeHookVisualSpecRef.current = writeHookVisualSpec;

  const [model] = useState("Image-01");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  const [modifyLoading, setModifyLoading] = useState(false);
  const [modifyError, setModifyError] = useState("");
  const [showSystemVideo, setShowSystemVideo] = useState(false);
  const [showVisuelAidePulse, setShowVisuelAidePulse] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      return !window.localStorage.getItem("aide_seen_visuel");
    } catch {
      return true;
    }
  });
  const openVisuelAide = useCallback(() => {
    try {
      window.localStorage.setItem("aide_seen_visuel", "1");
    } catch {
      /* quota / mode privé */
    }
    setShowVisuelAidePulse(false);
    setShowSystemVideo(true);
  }, []);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const isProductMode = useMemo(() => {
    const formatId = canonicalSpec.campaign.video_format_id;
    return getFormatById(formatId)?.categoryId === "produit";
  }, [canonicalSpec.campaign.video_format_id]);

  const [avatarLibraryOpen, setAvatarLibraryOpen] = useState(false);
  const [avatarLibraryTarget, setAvatarLibraryTarget] = useState("product");
  const avatarRefFileInputRef = useRef(null);
  const productRefFileInputRef = useRef(null);

  const openAvatarLibrary = useCallback(
    (target) => {
      void runWithAuth(() => {
        setAvatarLibraryTarget(target);
        setAvatarLibraryOpen(true);
        return true;
      });
    },
    [runWithAuth]
  );

  const handleAvatarLibrarySelect = useCallback(
    (url) => {
      if (avatarLibraryTarget === "product") {
        patchImageStep?.({
          productAvatarRefUrl: url,
          productAvatarRefSource: "library",
        });
      } else {
        patchImageStep?.({ refCharDataUrl: url });
      }
    },
    [avatarLibraryTarget, patchImageStep]
  );

  const clearAvatarRef = useCallback(() => {
    patchImageStep?.({
      productAvatarRefUrl: null,
      productAvatarRefSource: null,
    });
  }, [patchImageStep]);

  const clearProductRefCards = useCallback(() => {
    patchImageStep?.({
      productAvatarRefUrl: null,
      productAvatarRefSource: null,
      productProductRefUrl: null,
    });
  }, [patchImageStep]);

  const onAvatarRefFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    const rd = new FileReader();
    rd.onload = () => {
      const dataUrl = String(rd.result || "") || null;
      patchImageStep?.({
        productAvatarRefUrl: dataUrl,
        productAvatarRefSource: dataUrl ? "import" : null,
      });
    };
    rd.readAsDataURL(f);
    e.target.value = "";
  };

  const onProductRefFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    const rd = new FileReader();
    rd.onload = () =>
      patchImageStep?.({ productProductRefUrl: String(rd.result || "") || null });
    rd.readAsDataURL(f);
    e.target.value = "";
  };

  const is24s = sequenceType === "three_x_8s" || canonicalSpec.creative.sequence_type === "three_x_8s";
  const autoHookInFlightRef = useRef(false);

  const getSelectedHookUrl = useCallback(() => {
    const urls = Array.isArray(lastGeneratedImages) ? lastGeneratedImages : [];
    const n = urls.length;
    if (n === 0) return "";
    const idx = Math.max(0, Math.min(Number(selectedImageIndex) || 0, n - 1));
    return String(urls[idx] || "").trim();
  }, [lastGeneratedImages, selectedImageIndex]);

  const buildNanoHookInstruction = useCallback((sceneText, sceneIndex1Based) => {
    const base = String(sceneText || "").trim();
    const label = sceneIndex1Based === 2 ? "Transformation (scène 2/3)" : "Résultat (scène 3/3)";
    return [
      `Tu modifies l'image de référence pour illustrer: ${label}.`,
      "",
      "Règles de continuité (OBLIGATOIRES):",
      "- Conserver exactement le même personnage (visage, âge, vêtements), mêmes objets principaux, même décor, même lumière et même style.",
      "- Conserver un cadrage et une perspective cohérents (pas de changement de caméra radical).",
      "- Ne pas changer de lieu, ne pas changer de saison/heure, ne pas ajouter de nouveaux personnages.",
      "",
      "Objectif de la scène:",
      base || "(décris une progression logique de l'action, sans changer l'identité du sujet)",
      "",
      "Tu fais évoluer uniquement l'action/état de la scène selon l'objectif ci-dessus, tout en gardant la continuité.",
    ].join("\n");
  }, []);

  const fetchImageUrlAsDataUrl = useCallback(async (url) => {
    const u = String(url || "").trim();
    if (!u) return null;
    const res = await fetch(u);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;
    const dataUrl = await new Promise((resolve) => {
      const rd = new FileReader();
      rd.onload = () => resolve(typeof rd.result === "string" ? rd.result : null);
      rd.onerror = () => resolve(null);
      rd.readAsDataURL(blob);
    });
    return typeof dataUrl === "string" && dataUrl.startsWith("data:") ? dataUrl : null;
  }, []);

  const buildHailuoHookPrompt = useCallback((sceneText, sceneIndex1Based) => {
    const base = String(sceneText || "").trim();
    const label = sceneIndex1Based === 2 ? "Transformation (scène 2/3)" : "Résultat (scène 3/3)";
    return [
      "Objectif: générer une image unique qui représente l'état initial t=0 de ce segment, cohérente avec l'image de référence.",
      `Segment: ${label}`,
      "",
      "Résumé de la scène (à respecter):",
      base || "(résumé manquant)",
      "",
      "Contraintes de continuité (OBLIGATOIRES):",
      "- Conserver exactement le même personnage (visage, âge, vêtements), mêmes objets principaux, même décor, même lumière et même style.",
      "- Conserver un cadrage et une perspective cohérents (pas de changement de caméra radical).",
      "- Même lieu, mêmes éléments, pas de nouveaux personnages.",
      "",
      "Évolution autorisée:",
      "- Seule l'action du personnage et son impact visible sur l'environnement évoluent, en cohérence avec le résumé.",
    ].join("\n");
  }, []);

  const formatDebugJson = (value) => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value || "");
    }
  };

  function DebugAccordion({ title, debug, referenceUrl }) {
    const [open, setOpen] = useState(false);
    const ref =
      (typeof debug?.referenceUrl === "string" && debug.referenceUrl.trim())
        ? debug.referenceUrl.trim()
        : (typeof referenceUrl === "string" ? referenceUrl.trim() : "");
    const hasAnyDetails = Boolean(
      (typeof debug?.prompt === "string" && debug.prompt.trim()) ||
      debug?.requestBody ||
      (typeof debug?.functionUrl === "string" && debug.functionUrl.trim()) ||
      (typeof debug?.provider === "string" && debug.provider.trim()) ||
      ref
    );
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
        >
          <span className="select-none">{open ? "▲" : "▼"}</span>
          <span className="underline underline-offset-2">{open ? "Masquer les détails" : "Voir les détails"}</span>
        </button>
        {open ? (
          <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-2 space-y-2">
            {title ? <p className="text-[10px] font-semibold text-gray-300">{title}</p> : null}
            {!hasAnyDetails ? (
              <p className="text-[10px] text-gray-500">
                Détails pas encore capturés. Relance une génération (image 1) ou attends la génération auto (images 2/3),
                puis ré-ouvre ce panneau.
              </p>
            ) : null}
            {ref ? (
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Référence</p>
                <a href={ref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                  <img
                    src={ref}
                    alt=""
                    className="h-14 w-10 rounded border border-white/10 object-cover"
                    loading="lazy"
                  />
                  <span className="text-[10px] text-gray-500 break-all max-w-[14rem]">{ref}</span>
                </a>
                {typeof debug?.referenceSummary === "string" && debug.referenceSummary.trim() ? (
                  <p className="mt-1 text-[10px] text-gray-600">{debug.referenceSummary}</p>
                ) : null}
              </div>
            ) : null}
            {typeof debug?.prompt === "string" && debug.prompt.trim() ? (
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Prompt exact envoyé</p>
                <pre className="whitespace-pre-wrap text-[10px] leading-snug text-gray-200/90 max-h-44 overflow-auto">
                  {debug.prompt}
                </pre>
              </div>
            ) : null}
            {debug?.requestBody ? (
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Payload (body JSON) envoyé</p>
                <pre className="whitespace-pre-wrap text-[10px] leading-snug text-gray-200/90 max-h-44 overflow-auto">
                  {formatDebugJson(debug.requestBody)}
                </pre>
              </div>
            ) : null}
            {(typeof debug?.functionUrl === "string" && debug.functionUrl.trim()) ? (
              <p className="text-[10px] text-gray-600 break-all">Endpoint: {debug.functionUrl}</p>
            ) : null}
            {(typeof debug?.provider === "string" && debug.provider.trim()) ? (
              <p className="text-[10px] text-gray-600">Provider: {debug.provider}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  const summarizeDataUrl = useCallback((dataUrl) => {
    const s = typeof dataUrl === "string" ? dataUrl : "";
    if (!s.startsWith("data:")) return "";
    const head = s.slice(0, Math.min(80, s.length));
    const mime = head.slice(5).split(";")[0] || "unknown";
    return `data:${mime};base64,(len=${s.length})`;
  }, []);

  const generateHookWithHailuo = useCallback(
    async ({ sceneIndex1Based, sceneText, refDataUrl, referenceUrl }) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const accessToken = session?.access_token;
      if (!supabaseUrl || !supabaseAnonKey || !accessToken) return null;

      const functionUrl = `${supabaseUrl}/functions/v1/hailuo-image`;
      const hailuoPrompt = buildHookImageApiPrompt(
        [
          String(canonicalSpec.campaign.core_idea || "").trim(),
          canonicalSpec.campaign.profession ? `Métier: ${canonicalSpec.campaign.profession}` : "",
          canonicalSpec.campaign.style_details ? `Style: ${canonicalSpec.campaign.style_details}` : "",
          buildHailuoHookPrompt(sceneText, sceneIndex1Based),
        ]
          .filter(Boolean)
          .join("\n\n"),
        {
          revealMode: canonicalSpec.rendering.camera.reveal_mode === true,
          initialStateMode: null,
          jobTypeLabel: canonicalSpec.campaign.profession || "",
          lockedVideoScriptScene0: undefined,
          cameraAerialAngle: canonicalSpec.campaign.clarification.camera_aerial_angle,
          cameraViewAngle: canonicalSpec.campaign.clarification.camera_view_angle,
          globalIntent: getSafeIntentProfile(canonicalSpec),
          selfieMode: canonicalSpec.rendering.camera.selfie_mode === true,
          cameraFixed: canonicalSpec.rendering.camera.fixed === true,
          openingHookStill: false,
        }
      );

      const requestBody = {
        prompt: hailuoPrompt,
        ratio,
        quantity: 1,
        model,
        refCharacter: refDataUrl || null,
      };

      // Debug UI: capture du payload exact envoyé (Image 2/3).
      const debugKey = sceneIndex1Based === 2 ? "image2" : "image3";
      patchImageStep((prev) => {
        const p = prev && typeof prev === "object" ? prev : {};
        return {
          ...p,
          image24sDebug: {
            ...(p.image24sDebug || {}),
            [debugKey]: {
              provider: "hailuo",
              functionUrl,
              prompt: hailuoPrompt,
              requestBody,
              ratio,
              model,
              quantity: 1,
              referenceUrl: typeof referenceUrl === "string" && referenceUrl.trim() ? referenceUrl.trim() : "",
              referenceSummary: summarizeDataUrl(refDataUrl),
              createdAt: new Date().toISOString(),
            },
          },
        };
      });

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify(requestBody),
      });
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || `Erreur HTTP ${response.status}` };
      }
      if (!response.ok) return null;
      const urls = Array.isArray(data?.urls) ? data.urls : [];
      const first = typeof urls?.[0] === "string" ? urls[0].trim() : "";
      return first || null;
    },
    [session?.access_token, canonicalSpec, ratio, model, buildHailuoHookPrompt, patchImageStep, summarizeDataUrl]
  );

  useEffect(() => {
    if (!patchImageStep) return;
    if (!is24s) return;
    const base = getSelectedHookUrl();
    if (!base) return;
    const next0 = sceneHookImages?.[0] ? String(sceneHookImages[0]) : "";
    if (next0 === base) return;
    patchImageStep((prev) => {
      const p = prev && typeof prev === "object" ? prev : {};
      const arr = Array.isArray(p.sceneHookImages) ? [...p.sceneHookImages] : [null, null, null];
      arr[0] = base;
      return { ...p, sceneHookImages: arr };
    });
  }, [is24s, getSelectedHookUrl, patchImageStep, sceneHookImages]);

  useEffect(() => {
    const run = async () => {
      if (!patchImageStep) return;
      if (!is24s) return;
      if (!STUDIO_24S_TEMPORAL_HOOK_IMAGES_ENABLED) return;
      if (autoHookInFlightRef.current) return;
      if (!session?.access_token) return;

      const baseUrl = getSelectedHookUrl();
      if (!baseUrl) return;

      const s2 = String(getSafeScenes(canonicalSpec)?.[1]?.script_text || "").trim();
      const s3 = String(getSafeScenes(canonicalSpec)?.[2]?.script_text || "").trim();
      if (!s2 || !s3) return;

      const key = [
        "v1",
        String(campaignIdea || "").trim().slice(0, 140),
        baseUrl.slice(0, 220),
        s2.slice(0, 140),
        s3.slice(0, 140),
      ].join("|");
      const has2 = Boolean(sceneHookImages?.[1]);
      const has3 = Boolean(sceneHookImages?.[2]);
      // Ne pas bloquer les retries si les images 2/3 manquent encore.
      if (sceneHookAutoKey && sceneHookAutoKey === key && has2 && has3) return;
      if (has2 && has3) {
        patchImageStep({ sceneHookAutoKey: key });
        return;
      }

      autoHookInFlightRef.current = true;
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) return;

        const auth = { accessToken: session.access_token, supabaseUrl, supabaseAnonKey };
        // Circuit breaker: si NanoBanana a déjà échoué par manque de crédits (402/Kie credits),
        // ne plus le retenter dans cette session pour éviter un spam réseau + console.
        if (!window.__vwsNanoDisabledForSession) window.__vwsNanoDisabledForSession = false;
        const canNano = canUseImageModification() && !window.__vwsNanoDisabledForSession;
        // Hailuo: le quota local peut être désynchronisé (ex: crédits rajoutés côté serveur).
        // Tant que le solde serveur est OK, on autorise le fallback auto.
        const hasServerCreditsForHailuo = session ? await hasEnoughCredits(1) : false;
        const canHailuo = canUseImageGeneration() || hasServerCreditsForHailuo;
        let refDataUrl = null;
        if (!canNano && canHailuo) {
          refDataUrl = await fetchImageUrlAsDataUrl(baseUrl);
        }
        // Si aucun provider n'est possible, sortir proprement (évite re-run en boucle).
        if (!canNano && !canHailuo) {
          patchImageStep({
            sceneHookStatus: {
              ...(sceneHookStatus || {}),
              scene2: has2 ? (sceneHookStatus?.scene2 || { status: "idle", message: "" }) : { status: "error", message: "Vidéos insuffisantes pour générer les images (Hailuo)." },
              scene3: has3 ? (sceneHookStatus?.scene3 || { status: "idle", message: "" }) : { status: "error", message: "Vidéos insuffisantes pour générer les images (Hailuo)." },
            },
            sceneHookAutoKey: key,
          });
          return;
        }

        const shouldFallbackToHailuo = (err) => {
          const msg = String(err?.message || err || "").toLowerCase();
          return (
            msg.includes("kie") ||
            msg.includes("credits") ||
            msg.includes("crédits") ||
            msg.includes("vidéos") ||
            msg.includes("insuffisant") ||
            msg.includes("insufficient") ||
            msg.includes("payment required") ||
            msg.includes("402")
          );
        };

        if (!has2) {
          patchImageStep({
            sceneHookStatus: { ...(sceneHookStatus || {}), scene2: { status: "generating", message: "Génération scène 2…" } },
          });
          let url2 = null;
          let usedNano2 = false;
          if (canNano) {
            try {
              url2 = await modifyImageWithNanoBanana(baseUrl, buildNanoHookInstruction(s2, 2), auth);
              usedNano2 = true;
            } catch (e) {
              if (canHailuo && shouldFallbackToHailuo(e)) {
                // Désactiver Nano pour cette session pour éviter de retenter après 402.
                window.__vwsNanoDisabledForSession = true;
                patchImageStep({
                  sceneHookStatus: {
                    ...(sceneHookStatus || {}),
                    scene2: { status: "generating", message: "NanoBanana indisponible — fallback Hailuo…" },
                  },
                });
                if (!refDataUrl) refDataUrl = await fetchImageUrlAsDataUrl(baseUrl);
                url2 = await generateHookWithHailuo({ sceneIndex1Based: 2, sceneText: s2, refDataUrl, referenceUrl: baseUrl });
              } else {
                throw e;
              }
            }
          } else if (canHailuo) {
            url2 = await generateHookWithHailuo({ sceneIndex1Based: 2, sceneText: s2, refDataUrl, referenceUrl: baseUrl });
          }
          if (url2) {
            if (usedNano2) consumeImageModification();
            else consumeImageGeneration();
            const uploaded = uid ? await uploadImagesFromUrls([url2], uid, "scene2_hook") : { success: false, urls: null };
            const final2 = uploaded?.success && uploaded.urls?.[0] ? String(uploaded.urls[0]) : String(url2);
            patchImageStep((prev) => {
              const p = prev && typeof prev === "object" ? prev : {};
              const arr = Array.isArray(p.sceneHookImages) ? [...p.sceneHookImages] : [null, null, null];
              arr[1] = final2;
              return {
                ...p,
                sceneHookImages: arr,
                sceneHookStatus: { ...(p.sceneHookStatus || {}), scene2: { status: "done", message: "" } },
              };
            });
          } else {
            patchImageStep({
              sceneHookStatus: { ...(sceneHookStatus || {}), scene2: { status: "error", message: IMAGE_EDIT_BUSY_MESSAGE } },
              // Anti-boucle: si aucun provider n'a produit d'URL, mémoriser la clé pour éviter de retry en boucle
              sceneHookAutoKey: key,
            });
          }
        }

        if (!has3) {
          patchImageStep({
            sceneHookStatus: { ...(sceneHookStatus || {}), scene3: { status: "generating", message: "Génération scène 3…" } },
          });
          let url3 = null;
          let usedNano3 = false;
          if (canNano) {
            try {
              url3 = await modifyImageWithNanoBanana(baseUrl, buildNanoHookInstruction(s3, 3), auth);
              usedNano3 = true;
            } catch (e) {
              if (canHailuo && shouldFallbackToHailuo(e)) {
                // Désactiver Nano pour cette session pour éviter de retenter après 402.
                window.__vwsNanoDisabledForSession = true;
                patchImageStep({
                  sceneHookStatus: {
                    ...(sceneHookStatus || {}),
                    scene3: { status: "generating", message: "NanoBanana indisponible — fallback Hailuo…" },
                  },
                });
                if (!refDataUrl) refDataUrl = await fetchImageUrlAsDataUrl(baseUrl);
                url3 = await generateHookWithHailuo({ sceneIndex1Based: 3, sceneText: s3, refDataUrl, referenceUrl: baseUrl });
              } else {
                throw e;
              }
            }
          } else if (canHailuo) {
            url3 = await generateHookWithHailuo({ sceneIndex1Based: 3, sceneText: s3, refDataUrl, referenceUrl: baseUrl });
          }
          if (url3) {
            if (usedNano3) consumeImageModification();
            else consumeImageGeneration();
            const uploaded = uid ? await uploadImagesFromUrls([url3], uid, "scene3_hook") : { success: false, urls: null };
            const final3 = uploaded?.success && uploaded.urls?.[0] ? String(uploaded.urls[0]) : String(url3);
            patchImageStep((prev) => {
              const p = prev && typeof prev === "object" ? prev : {};
              const arr = Array.isArray(p.sceneHookImages) ? [...p.sceneHookImages] : [null, null, null];
              arr[2] = final3;
              return {
                ...p,
                sceneHookImages: arr,
                sceneHookStatus: { ...(p.sceneHookStatus || {}), scene3: { status: "done", message: "" } },
              };
            });
          } else {
            patchImageStep({
              sceneHookStatus: { ...(sceneHookStatus || {}), scene3: { status: "error", message: IMAGE_EDIT_BUSY_MESSAGE } },
              // Anti-boucle: si aucun provider n'a produit d'URL, mémoriser la clé pour éviter de retry en boucle
              sceneHookAutoKey: key,
            });
          }
        }

        patchImageStep({ sceneHookAutoKey: key });
      } catch (e) {
        patchImageStep({
          sceneHookStatus: {
            ...(sceneHookStatus || {}),
            scene2: (sceneHookStatus?.scene2?.status === "generating")
              ? { status: "error", message: String(e?.message || "Erreur génération scène 2").slice(0, 180) }
              : (sceneHookStatus?.scene2 || { status: "idle", message: "" }),
            scene3: (sceneHookStatus?.scene3?.status === "generating")
              ? { status: "error", message: String(e?.message || "Erreur génération scène 3").slice(0, 180) }
              : (sceneHookStatus?.scene3 || { status: "idle", message: "" }),
          },
        });
      } finally {
        autoHookInFlightRef.current = false;
      }
    };
    void run();
  }, [
    is24s,
    patchImageStep,
    session?.access_token,
    uid,
    campaignIdea,
    canonicalSpec,
    getSelectedHookUrl,
    sceneHookImages,
    sceneHookStatus,
    sceneHookAutoKey,
    buildNanoHookInstruction,
    fetchImageUrlAsDataUrl,
    generateHookWithHailuo,
  ]);

  useEffect(() => {
    let active = true;
    const hydrateImagesFromCache = async () => {
      if (Array.isArray(lastGeneratedImages) && lastGeneratedImages.length > 0) return;
      const cached = await loadImageMediaRefs();
      if (!active || !cached) return;
      const urls =
        Array.isArray(cached.urls) && cached.urls.length > 0
          ? cached.urls
          : Array.isArray(cached.fallbackData)
          ? cached.fallbackData
          : [];
      if (!urls.length) return;
      patchImageStep({
        lastGeneratedImages: urls,
        lastGeneratedPrompt:
          typeof imageStep?.lastGeneratedPrompt === "string" && imageStep.lastGeneratedPrompt.trim()
            ? imageStep.lastGeneratedPrompt
            : "Session restaurée",
      });
    };
    void hydrateImagesFromCache();
    return () => {
      active = false;
    };
  }, [lastGeneratedImages, patchImageStep, imageStep?.lastGeneratedPrompt]);

  useEffect(() => {
    if (!Array.isArray(lastGeneratedImages) || lastGeneratedImages.length === 0) return;
    void saveImageMediaRef({
      urls: lastGeneratedImages,
      createdAt: new Date().toISOString(),
      fallbackData: [],
    });
  }, [lastGeneratedImages]);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaModalMessage, setQuotaModalMessage] = useState(VIDEO_QUOTA_EXHAUSTED_MESSAGE);
  const { hasAccess } = usePremiumAccess();
  const historyPanelRef = useRef(null);
  /** Valeur réelle du champ au clic (évite instruction vide si le state parent n’est pas encore recalé). */
  const bottomFieldInputRef = useRef(null);
  const [scrollbarVisible, setScrollbarVisible] = useState(false);
  /** ImagePage reste montée sur les autres étapes : ne pas recopier l’idée à chaque frappe (sinon prompt = 1ère lettre bloquée). */
  const wasVisualStepActiveRef = useRef(false);

  /** ≤640px : marges inline des blocs visuel + textarea auto-hauteur studio */
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const fn = () => setIsMobile(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  /** Mobile studio (≤640px) : textarea auto-hauteur sans scrollbar interne */
  const [narrowVisualStudio, setNarrowVisualStudio] = useState(false);
  useEffect(() => {
    if (!visualStepActive) {
      setNarrowVisualStudio(false);
      return;
    }
    const mq = window.matchMedia("(max-width: 640px)");
    const fn = () => setNarrowVisualStudio(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [visualStepActive]);

  const adjustBottomTextareaHeight = useCallback(() => {
    const el = bottomFieldInputRef.current;
    if (!el || !narrowVisualStudio) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [narrowVisualStudio]);

  useEffect(() => {
    if (!historyOpen) return;
    const onDoc = (e) => {
      if (historyPanelRef.current?.contains(e.target)) return;
      setHistoryOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [historyOpen]);

  useEffect(() => {
    const refresh = async () => {
      if (session) {
        await loadCredits();
      }
    };
    void refresh();
  }, [session, uid]);

  useEffect(() => {
    if (!patchImageStep) return;
    const justEntered = visualStepActive && !wasVisualStepActiveRef.current;
    wasVisualStepActiveRef.current = visualStepActive;
    if (!justEntered) return;

    patchImageStep((prev) => {
      const next = { ...prev };
      const campaignText = String(campaignIdea || "").trim();
      const scriptText = String(scriptScene1Idea || "").trim();
      if (campaignText) {
        const currentIdea = String(prev.campaignIdeaPrompt || "").trim();
        if (!currentIdea || currentIdea.length <= 2 || campaignText.startsWith(currentIdea)) {
          next.campaignIdeaPrompt = campaignText;
          next.pairedCampaignIdea = campaignText;
        }
      }
      if (scriptText) {
        const currentPrompt = String(prev.prompt || "").trim();
        if (!currentPrompt || currentPrompt.length <= 2) {
          next.prompt = scriptText;
        }
      }
      return next;
    });
  }, [visualStepActive, campaignIdea, scriptScene1Idea, patchImageStep]);

  const loadCredits = async () => {
    try {
      await getUserCredits();
    } catch (err) {
      console.error("Erreur chargement crédits:", err);
    }
  };

  const openQuotaModal = (message) => {
    setQuotaModalMessage(
      message || (hasAccess ? VIDEO_QUOTA_EXHAUSTED_MESSAGE : NON_SUBSCRIBER_BLOCKED_MESSAGE)
    );
    setShowQuotaModal(true);
  };

  const canGenerate = useMemo(() => {
    if (!session) return false;
    return !!String(campaignIdeaPrompt || "").trim() && !busy;
  }, [campaignIdeaPrompt, busy, session]);

  const fileInputRef = useRef(null);
  const hookImportFileInputRef = useRef(null);
  const onPickRefImage = () => fileInputRef.current?.click();
  const onPickHookImport = () => hookImportFileInputRef.current?.click();
  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () =>
      patchImageStep({ refCharDataUrl: String(rd.result) });
    rd.readAsDataURL(f);
  };
  const onHookImportFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    const rd = new FileReader();
    rd.onload = () => {
      const dataUrl = String(rd.result || "");
      if (!dataUrl) return;
      patchImageStep({
        lastGeneratedImages: [dataUrl],
        selectedImageIndex: 0,
        lastGeneratedPrompt: "",
      });
      writeHookVisualSpec({
        image_variants: [dataUrl],
        selected_variant_index: 0,
        selected_image_url: dataUrl,
      });
    };
    rd.readAsDataURL(f);
    e.target.value = "";
  };

  async function generate() {
    if (!canGenerate) return;

    if (!canUseImageGeneration()) {
      // Le quota local peut être désynchronisé (ex: crédits workflow rajoutés côté admin).
      // Quota local studio ; le solde workflow vidéo n'est débité qu'au téléchargement (Video.jsx).
      if (!session) {
        const usage = getWorkflowUsage();
        if (usage.videoAttemptsUsed >= 1) {
          resetWorkflowUsage();
        } else {
          openQuotaModal("Quota Visuel d'accroche atteint pour ce workflow (3 générations d'images).");
          return;
        }
      }
    }

    const backupUrls =
      lastGeneratedImages?.length > 0 ? [...lastGeneratedImages] : null;

    setBusy(true);
    setProgress(0);
    setProgressMessage("Initialisation...");
    patchImageStep({ lastGeneratedImages: null });

    try {
      setProgress(10);
      setProgressMessage("Vérification du quota...");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Configuration Supabase manquante");
      }

      const functionUrl = `${supabaseUrl}/functions/v1/generate-hook-visual`;
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Token d'authentification manquant");
      }

      setProgress(20);
      setProgressMessage("Envoi de la requête...");
      console.log("📡 Appel de la fonction Edge Function:", functionUrl);

      const hookStagingId =
        canonicalSpec.campaign.staging_chips?.[0] ?? campaignStagingChips?.[0];
      console.log("[Visuel] staging debug", {
        staging_chips_spec: canonicalSpec.campaign.staging_chips,
        stagingChips_prop: campaignStagingChips,
        hookStagingId,
        clarifyMode: canonicalSpec.campaign.clarification.mode,
      });

      const baseImage1Prompt = buildHookImageApiPrompt(
        [
          String(canonicalSpec.creative.hook_visual.prompt_text || "").trim() ||
            String(canonicalSpec.campaign.core_idea || "").trim(),
          canonicalSpec.campaign.profession
            ? `Métier: ${canonicalSpec.campaign.profession}`
            : "",
          canonicalSpec.campaign.style_details
            ? `Style: ${canonicalSpec.campaign.style_details}`
            : "",
          canonicalSpec.campaign.video_format_id === "produit_unboxing" &&
          canonicalSpec.campaign.packaging_box_appearance
            ? `Product box appearance: ${canonicalSpec.campaign.packaging_box_appearance}`
            : "",
          clarificationModeToImagePromptLine(
            canonicalSpec.campaign.clarification.mode,
            hookStagingId
          ),
          canonicalSpec.campaign.clarification.last_user_freeform_answer
            ? `Précision utilisateur: ${canonicalSpec.campaign.clarification.last_user_freeform_answer}`
            : "",
          canonicalSpec.campaign.clarification.camera_aerial_angle
            ? `Aerial angle: ${canonicalSpec.campaign.clarification.camera_aerial_angle}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        {
          revealMode: canonicalSpec.rendering.camera.reveal_mode === true,
          initialStateMode:
            canonicalSpec.campaign.clarification.initial_state === "from_nothing"
              ? "from_nothing"
              : null,
          jobTypeLabel: canonicalSpec.campaign.profession || "",
          lockedVideoScriptScene0:
            String(getSafeScenes(canonicalSpec)[0]?.script_text || "").trim() || undefined,
          cameraAerialAngle: canonicalSpec.campaign.clarification.camera_aerial_angle,
          cameraViewAngle: canonicalSpec.campaign.clarification.camera_view_angle,
          // Guard: fallback neutre si intent profile absent/incomplet.
          globalIntent: getSafeIntentProfile(canonicalSpec),
          selfieMode: canonicalSpec.rendering.camera.selfie_mode === true,
          cameraFixed: canonicalSpec.rendering.camera.fixed === true,
          openingHookStill: true,
          hookId: canonicalSpec.campaign.product_opening_hook_id,
          stagingIds: hookStagingId ? [hookStagingId] : canonicalSpec.campaign.staging_chips,
        }
      );
      const refPromptPrefix = buildProductRefPromptPrefix({
        isProductMode,
        avatarRefDataUrl: productAvatarRefUrl,
        productRefDataUrl: productProductRefUrl,
      });
      const image1Prompt = refPromptPrefix
        ? `${refPromptPrefix}\n\n${baseImage1Prompt}`
        : baseImage1Prompt;

      patchImageStep({ prompt: image1Prompt });

      const hookSubjectRefs = buildHookSubjectReferences({
        isProductMode,
        avatarRefDataUrl: productAvatarRefUrl,
        productRefDataUrl: productProductRefUrl,
        refCharDataUrl,
      });
      const subjectReferences = hookSubjectRefs.subjectReferences;
      const productReference = hookSubjectRefs.productReference ?? null;

      const image1RequestBody = {
        prompt: image1Prompt,
        hookId: canonicalSpec.campaign.product_opening_hook_id,
        stagingIds: hookStagingId ? [hookStagingId] : canonicalSpec.campaign.staging_chips,
        aspectRatio: ratio,
        subjectReferences:
          Array.isArray(subjectReferences) && subjectReferences.length > 0
            ? subjectReferences
            : undefined,
        productReference: productReference ?? undefined,
      };

      console.log("[Visuel] debug avatar", {
        isProductMode,
        productAvatarRefUrl: productAvatarRefUrl?.slice(0, 80) ?? null,
        refCharDataUrl: refCharDataUrl?.slice(0, 80) ?? null,
        subjectReferencesCount: image1RequestBody.subjectReferences?.length ?? 0,
        hasProductReference: Boolean(productReference),
        productReferencePreview: productReference ? summarizeDataUrl(productReference) : null,
        subjectReferences: image1RequestBody.subjectReferences,
        hookId: image1RequestBody.hookId,
      });

      const debugRequestBody = {
        ...image1RequestBody,
        ...(Array.isArray(image1RequestBody.subjectReferences)
          ? {
              subjectReferences: image1RequestBody.subjectReferences.map((u) =>
                summarizeDataUrl(u)
              ),
            }
          : {}),
        ...(image1RequestBody.productReference
          ? { productReference: summarizeDataUrl(image1RequestBody.productReference) }
          : {}),
      };

      // Debug UI: capture du payload exact envoyé (Image 1).
      patchImageStep((prev) => {
        const p = prev && typeof prev === "object" ? prev : {};
        return {
          ...p,
          image24sDebug: {
            ...(p.image24sDebug || {}),
            image1: {
              provider: "generate-hook-visual",
              functionUrl,
              prompt: image1Prompt,
              requestBody: debugRequestBody,
              ratio,
              model,
              quantity,
              createdAt: new Date().toISOString(),
            },
          },
        };
      });

      setProgress(40);
      setProgressMessage("Génération des images en cours...");

      const callGenerateHookVisualOnce = async () => {
        const response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify(image1RequestBody),
        });

        const responseText = await response.text();

        let responseData;
        try {
          responseData = responseText ? JSON.parse(responseText) : {};
        } catch {
          console.error("❌ Impossible de parser la réponse JSON:", responseText);
          throw new Error(`Erreur serveur (${response.status}): ${responseText.substring(0, 200)}`);
        }

        if (!response.ok) {
          console.error("❌ Erreur API:", response.status, responseData);
          console.error("📋 Détails complets de la réponse:", JSON.stringify(responseData, null, 2));

          let errorMessage = responseData?.error || `Erreur HTTP ${response.status}`;

          if (responseData?.details) {
            console.error("📦 Détails de l'erreur:", responseData.details);
            if (responseData.details.base_resp?.status_msg) {
              errorMessage = responseData.details.base_resp.status_msg;
            } else if (responseData.details.metadata) {
              errorMessage += ` (${JSON.stringify(responseData.details.metadata)})`;
            }
          }

          throw new Error(errorMessage);
        }

        const rawImageUrl =
          typeof responseData?.imageUrl === "string" ? responseData.imageUrl.trim() : "";
        if (!rawImageUrl) {
          throw new Error("Aucune image reçue");
        }

        const imageUrl = rawImageUrl.startsWith("http://")
          ? rawImageUrl.replace("http://", "https://")
          : rawImageUrl;

        return { imageUrl };
      };

      const safeQuantity = Math.max(1, Math.min(4, Number(quantity) || 1));
      const results = await Promise.all(
        Array.from({ length: safeQuantity }, () => callGenerateHookVisualOnce())
      );

      setProgress(60);
      setProgressMessage("Traitement de la réponse...");

      const urls = results.map((r) => r.imageUrl);

      setProgress(80);
      setProgressMessage("Téléchargement vers le stockage...");

      let finalUrls = urls;
      if (uid) {
        try {
          console.log("📤 Téléchargement des images vers Supabase Storage...");
          const uploadResult = await uploadImagesFromUrls(urls, uid, prompt);
          if (uploadResult.success && uploadResult.urls) {
            finalUrls = uploadResult.urls;

            const successCount = uploadResult.urls.filter((url, i) => {
              const isSupabaseUrl = url && (
                url.includes('supabase.co') || 
                url.includes('supabase') ||
                url.includes('/storage/v1/object/public/generated-images/')
              );
              const isDifferent = url !== urls[i];
              return isSupabaseUrl && isDifferent;
            }).length;
            
            console.log(`✅ ${successCount}/${urls.length} image(s) téléchargée(s) vers Supabase Storage`);
            
            if (successCount > 0) {
              console.log("📋 URLs Supabase sauvegardées:", 
                uploadResult.urls.filter(url => url && url.includes('supabase'))
              );
            }
            if (uploadResult.errors && uploadResult.errors.length > 0) {
              console.warn("⚠️ Certaines images n'ont pas pu être téléchargées:", uploadResult.errors);
              if (successCount === 0) {
                const errorMsg = uploadResult.errors[0] || "Erreur inconnue";
                console.error("❌ Aucune image n'a pu être uploadée vers Supabase Storage");
                console.error("📋 Erreur:", errorMsg);

                if (errorMsg.includes("bucket") || errorMsg.includes("n'existe pas")) {
                  alert(
                    "⚠️ Problème de stockage détecté\n\n" +
                    "Le bucket 'generated-images' n'existe pas dans Supabase Storage.\n\n" +
                    "Pour résoudre ce problème:\n" +
                    "1. Allez dans le dashboard Supabase > Storage\n" +
                    "2. Créez un bucket nommé 'generated-images' (public)\n" +
                    "3. Ou exécutez la migration SQL: supabase/migrations/create_generated_images_bucket.sql\n\n" +
                    "Les images seront stockées avec les URLs originales pour l'instant."
                  );
                }
              }
            }
          } else {
            console.error("❌ Échec complet du téléchargement vers Storage");
            console.error("📋 Vérifiez la console pour plus de détails");
          }
        } catch (err) {
          console.error("❌ Erreur lors du téléchargement vers Storage:", err);
          console.error("📋 L'application continuera avec les URLs originales");
        }
      } else {
        console.warn("⚠️ Utilisateur non connecté, images non uploadées vers Supabase Storage");
      }

      setProgress(100);
      setProgressMessage("Terminé !");

      patchImageStep({
        lastGeneratedImages: finalUrls,
        prompt: image1Prompt,
        lastGeneratedPrompt: String(campaignIdeaPrompt || "").trim() || prompt,
        pairedCampaignIdea: String(campaignIdea || "").trim() || null,
      });
      writeHookVisualSpec({
        prompt_text:
          String(canonicalSpec.creative.hook_visual.prompt_text || "").trim() ||
          String(canonicalSpec.campaign.core_idea || "").trim(),
        image_variants: Array.isArray(finalUrls) ? finalUrls : [],
        selected_variant_index: 0,
        selected_image_url: Array.isArray(finalUrls) && finalUrls[0] ? String(finalUrls[0]) : "",
        last_generation_prompt: String(campaignIdeaPrompt || "").trim() || String(prompt || "").trim(),
      });
      consumeImageGeneration();
      
    } catch (err) {
      console.error("Erreur génération image:", err);
      const errorMessage = err?.message || "Erreur inconnue";
      alert(`Erreur lors de la génération : ${errorMessage}`);
      if (backupUrls?.length) {
        patchImageStep((prev) => ({ ...prev, lastGeneratedImages: backupUrls }));
      }
      if (session) {
        await loadCredits();
      }
    } finally {
      setBusy(false);
      setTimeout(() => {
        setProgress(0);
        setProgressMessage("");
      }, 500);
    }
  }

  const resetRef = () => patchImageStep({ refCharDataUrl: null });

  const handleValidate = async (opts = {}) => {
    const { quiet = false, onSuccess, preserveLocalVisualState = false } = opts;
    if (!lastGeneratedImages || lastGeneratedImages.length === 0) return;

    const nImg = lastGeneratedImages.length;
    const rawSel = Number(selectedImageIndex);
    const selIdx =
      Number.isFinite(rawSel) ? Math.max(0, Math.min(Math.floor(rawSel), nImg - 1)) : 0;
    const primaryUrl = lastGeneratedImages[selIdx];
    const urlsForHistory = [
      primaryUrl,
      ...lastGeneratedImages.filter((_, i) => i !== selIdx),
    ];

    try {
      let validationNotice = "";

      if (!uid) {
        addImageHistory({
          uid,
          prompt: lastGeneratedPrompt,
          urls: urlsForHistory,
          meta: { ratio, model, quantity, selectedIndex: selIdx },
        });
      }
      
      if (uid) {
        try {
          const isSupabaseStoredImageUrl = (url) =>
            Boolean(url && url.includes("/storage/v1/object/public/generated-images/"));

          const cleanedUrls = urlsForHistory.map((url) => {
            if (!url) return url;
            if (url.startsWith("http://")) {
              url = url.replace("http://", "https://");
            }
            return url;
          });

          let urlsToSave = cleanedUrls;
          let supabaseUrls = urlsToSave.filter(isSupabaseStoredImageUrl);
          console.log("💾 Sauvegarde dans Supabase:", {
            totalUrls: urlsToSave.length,
            supabaseUrls: supabaseUrls.length,
            urls: urlsToSave
          });

          if (supabaseUrls.length === 0) {
            console.warn("⚠️ Aucune URL Supabase détectée, nouvelle tentative d'upload avant sauvegarde.");
            const retryUploadResult = await uploadImagesFromUrls(
              cleanedUrls,
              uid,
              lastGeneratedPrompt || prompt
            );

            if (retryUploadResult.success && retryUploadResult.urls?.length) {
              urlsToSave = retryUploadResult.urls.map((url) => {
                if (!url) return url;
                return url.startsWith("http://") ? url.replace("http://", "https://") : url;
              });
              supabaseUrls = urlsToSave.filter(isSupabaseStoredImageUrl);
              console.log("✅ Deuxième tentative d'upload terminée:", {
                totalUrls: urlsToSave.length,
                supabaseUrls: supabaseUrls.length,
              });
            }

            if (supabaseUrls.length === 0) {
              validationNotice =
                "Avertissement: images non stockées dans le bucket Supabase (liens externes conservés).";
            }
          }
          
          await saveHistorySupabase({
            kind: "image",
            input: lastGeneratedPrompt,
            output: null,
            model: model,
            metadata: {
              urls: urlsToSave,
              ratio: ratio,
              quantity: quantity,
              selectedIndex: selIdx,
            },
          });
          
          console.log("✅ Historique sauvegardé dans Supabase avec", urlsToSave.length, "URL(s)");
        } catch (err) {
          console.error("❌ Erreur sauvegarde Supabase:", err);
          console.warn("⚠️ Les images seront disponibles uniquement dans localStorage");
        }
      }
      
      if (!quiet) {
        alert(
          validationNotice
            ? `✅ Images validées et enregistrées avec succès !\n\n⚠️ ${validationNotice}`
            : "✅ Images validées et enregistrées avec succès !"
        );
      }
      if (!preserveLocalVisualState) {
        patchImageStep({
          lastGeneratedImages: null,
          lastGeneratedPrompt: "",
          prompt: "",
          campaignIdeaPrompt: "",
          refCharDataUrl: null,
          selectedImageIndex: 0,
          modifyInstruction: "",
          pairedCampaignIdea: null,
        });
        writeHookVisualSpec({
          prompt_text: "",
          provider_prompt_raw: "",
          image_variants: [],
          selected_variant_index: 0,
          selected_image_url: "",
          last_generation_prompt: "",
          modification_instruction: "",
        });
      }
      window.dispatchEvent(new Event("onetool:history:changed"));
      onSuccess?.();
    } catch (err) {
      console.error("Erreur validation:", err);
      if (!quiet) alert("Erreur lors de la validation");
    }
  };

  const reloadIdeaFromCampaign = () => {
    const fromCampaign = String(campaignIdea || "").trim();
    const fromScript = String(scriptScene1Idea || "").trim();
    const fromProp = fromCampaign || fromScript;
    const applyReload = (value) => {
      const hadImages = Boolean(lastGeneratedImages?.length);
      if (hadImages) {
        // Conserver les images affichées : on recharge l'idée dans le champ actif
        // sans vider la session visuelle.
        patchImageStep({
          campaignIdeaPrompt: value,
          pairedCampaignIdea: value,
        });
        writeHookVisualSpec({ prompt_text: String(value || "") });
        setModifyError("");
        return;
      }
      patchImageStep({ campaignIdeaPrompt: value, pairedCampaignIdea: value });
      writeHookVisualSpec({ prompt_text: String(value || "") });
    };
    if (fromProp) {
      applyReload(fromProp);
      return;
    }
    try {
      const live = sessionStorage.getItem(SS_CAMPAIGN_IDEA_LIVE_KEY);
      const fromLive = live != null ? String(live).trim() : "";
      if (fromLive) {
        applyReload(fromLive);
        return;
      }
    } catch {
      /* ignore */
    }
  };

  const handleUseThisImage = async () => {
    await handleValidate({
      quiet: Boolean(onUseImageAndContinue),
      onSuccess: onUseImageAndContinue,
      preserveLocalVisualState: Boolean(onUseImageAndContinue),
    });
  };

  const handleModifyImage = async () => {
    const fromDom = bottomFieldInputRef.current?.value;
    const instruction = String(fromDom ?? modifyInstruction ?? "").trim();
    if (!lastGeneratedImages?.length || !instruction || modifyLoading) return;

    if (!canUseImageModification()) {
      // Même logique: ne pas bloquer à tort si le solde serveur permet encore une action.
      const hasServerCredits = session ? await hasEnoughCredits(1) : false;
      if (!(session && hasServerCredits)) {
        const usage = getWorkflowUsage();
        if (usage.videoAttemptsUsed >= 1) {
          resetWorkflowUsage();
        } else {
          openQuotaModal("Quota Visuel d'accroche atteint pour ce workflow (5 modifications d'image).");
          return;
        }
      }
    }

    setModifyError("");

    let accessToken = session?.access_token ?? null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data?.session?.access_token) {
        accessToken = data.session.access_token;
      }
    } catch {
      /* garde session du contexte */
    }

    if (!accessToken) {
      const msg =
        "Tu dois être connecté pour modifier une image. Connecte-toi puis réessaie.";
      setModifyError(msg);
      alert(msg);
      return;
    }

    const imageUrl = String(
      lastGeneratedImages[selectedImageIndex] ?? lastGeneratedImages[0] ?? ""
    ).trim();
    if (!imageUrl) {
      const msg = "Aucune image valide à modifier. Regénère ou sélectionne une variante.";
      setModifyError(msg);
      alert(msg);
      return;
    }

    setModifyLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Configuration Supabase manquante (variables d’environnement).");
      }
      const newUrl = await modifyImageWithNanoBanana(imageUrl, instruction, {
        accessToken,
        supabaseUrl,
        supabaseAnonKey,
      });
        if (newUrl) {
        patchImageStep((prev) => {
          const next = [...(prev.lastGeneratedImages || []), newUrl];
          return {
            ...prev,
            lastGeneratedImages: next,
            selectedImageIndex: next.length - 1,
            modifyInstruction: "",
          };
        });
        writeHookVisualSpec({
          image_variants: [...(canonicalSpec.creative.hook_visual.image_variants || []), newUrl],
          selected_variant_index: (canonicalSpec.creative.hook_visual.image_variants || []).length,
          selected_image_url: String(newUrl || ""),
          modification_instruction: "",
        });
        consumeImageModification();
      } else {
        const msg =
          "L’édition n’a pas renvoyé d’image. Les serveurs peuvent être occupés — réessaie dans quelques instants ou reformule ta consigne.";
        setModifyError(msg);
        alert(msg);
      }
    } catch (err) {
      console.error("Erreur modification image:", err);
      const msg =
        typeof err?.message === "string" && err.message.trim()
          ? err.message
          : IMAGE_EDIT_BUSY_MESSAGE;
      setModifyError(msg);
      alert(msg);
    } finally {
      setModifyLoading(false);
    }
  };

  useEffect(() => {
    const len = lastGeneratedImages?.length ?? 0;
    if (!len) return;
    patchImageStep((prev) => {
      const max = len - 1;
      const next = Math.min(prev.selectedImageIndex, max);
      return next === prev.selectedImageIndex ? prev : { ...prev, selectedImageIndex: next };
    });
    const safeIdx = Math.min(Number(selectedImageIndex) || 0, len - 1);
    const safeUrl = String(lastGeneratedImages?.[safeIdx] || "");
    writeHookVisualSpecRef.current({
      image_variants: Array.isArray(lastGeneratedImages) ? [...lastGeneratedImages] : [],
      selected_variant_index: safeIdx,
      selected_image_url: safeUrl,
    });
  }, [lastGeneratedImages, selectedImageIndex, patchImageStep]);

  const hasSessionImages = Boolean(lastGeneratedImages?.length);
  const bottomFieldValue = hasSessionImages ? modifyInstruction : campaignIdeaPrompt;
  const setBottomFieldValue = (v) => {
    if (hasSessionImages) {
      patchImageStep({ modifyInstruction: v });
      writeHookVisualSpec({ modification_instruction: String(v || "") });
    } else {
      patchImageStep({ campaignIdeaPrompt: v });
      writeHookVisualSpec({ prompt_text: String(v || "") });
    }
  };
  const canBottomSubmit = hasSessionImages
    ? Boolean((modifyInstruction ?? "").trim()) && !modifyLoading && !busy
    : canGenerate;
  const runBottomSubmit = () => {
    if (hasSessionImages) void handleModifyImage();
    else void generate();
  };
  const showHookImportLink = !lastGeneratedImages?.length && !busy;

  useLayoutEffect(() => {
    adjustBottomTextareaHeight();
  }, [
    adjustBottomTextareaHeight,
    bottomFieldValue,
    busy,
    modifyLoading,
    hasSessionImages,
    narrowVisualStudio,
  ]);

  const ratioOptions = [
    { value: "16:9", label: "YouTube" },
    { value: "9:16", label: "TikTok" },
    { value: "1:1", label: "Carré" },
  ];

  const ratioIcon = (v) => {
    if (v === "16:9")
      return <RectangleHorizontal className="h-4 w-4 text-[#00d4a0]" aria-hidden />;
    if (v === "1:1") return <Square className="h-4 w-4 text-[#00d4a0]" aria-hidden />;
    return <Smartphone className="h-4 w-4 text-[#00d4a0]" aria-hidden />;
  };

  const sceneHook1Url =
    is24s && typeof sceneHookImages?.[0] === "string" && sceneHookImages[0].trim()
      ? String(sceneHookImages[0]).trim()
      : Array.isArray(lastGeneratedImages) && lastGeneratedImages[selectedImageIndex]
        ? String(lastGeneratedImages[selectedImageIndex]).trim()
        : "";
  const sceneHook2Url =
    is24s && typeof sceneHookImages?.[1] === "string" ? String(sceneHookImages[1] || "").trim() : "";
  const sceneHook3Url =
    is24s && typeof sceneHookImages?.[2] === "string" ? String(sceneHookImages[2] || "").trim() : "";
  const scene2Status = sceneHookStatus?.scene2?.status || "idle";
  const scene3Status = sceneHookStatus?.scene3?.status || "idle";
  const scene2Msg = String(sceneHookStatus?.scene2?.message || "").trim();
  const scene3Msg = String(sceneHookStatus?.scene3?.message || "").trim();

  const reconstructedImage1Debug = useMemo(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/hailuo-image` : "";
    const hookStagingId =
      canonicalSpec.campaign.staging_chips?.[0] ?? campaignStagingChips?.[0];
    const image1Prompt = buildHookImageApiPrompt(
      [
        String(canonicalSpec.creative.hook_visual.prompt_text || "").trim() ||
          String(canonicalSpec.campaign.core_idea || "").trim(),
        canonicalSpec.campaign.profession ? `Métier: ${canonicalSpec.campaign.profession}` : "",
        canonicalSpec.campaign.style_details ? `Style: ${canonicalSpec.campaign.style_details}` : "",
        clarificationModeToImagePromptLine(
          canonicalSpec.campaign.clarification.mode,
          hookStagingId
        ),
        canonicalSpec.campaign.clarification.last_user_freeform_answer
          ? `Précision utilisateur: ${canonicalSpec.campaign.clarification.last_user_freeform_answer}`
          : "",
        canonicalSpec.campaign.clarification.camera_aerial_angle
          ? `Aerial angle: ${canonicalSpec.campaign.clarification.camera_aerial_angle}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      {
        revealMode: canonicalSpec.rendering.camera.reveal_mode === true,
        initialStateMode:
          canonicalSpec.campaign.clarification.initial_state === "from_nothing" ? "from_nothing" : null,
        jobTypeLabel: canonicalSpec.campaign.profession || "",
        lockedVideoScriptScene0:
          String(getSafeScenes(canonicalSpec)[0]?.script_text || "").trim() || undefined,
        cameraAerialAngle: canonicalSpec.campaign.clarification.camera_aerial_angle,
        cameraViewAngle: canonicalSpec.campaign.clarification.camera_view_angle,
        globalIntent: getSafeIntentProfile(canonicalSpec),
        selfieMode: canonicalSpec.rendering.camera.selfie_mode === true,
        cameraFixed: canonicalSpec.rendering.camera.fixed === true,
        openingHookStill: true,
        hookId: canonicalSpec.campaign.product_opening_hook_id,
        stagingIds: hookStagingId ? [hookStagingId] : canonicalSpec.campaign.staging_chips,
      }
    );

    return {
      provider: "hailuo (reconstitué)",
      functionUrl,
      prompt: image1Prompt,
      requestBody: {
        prompt: image1Prompt,
        ratio,
        quantity,
        model,
        refCharacter: refCharDataUrl ? "(dataURL utilisateur via champ refCharacter)" : null,
      },
      ratio,
      model,
      quantity,
      referenceSummary: "Reconstitué: body JSON envoyé à Hailuo (Image 1).",
      createdAt: "",
    };
  }, [canonicalSpec, campaignStagingChips, ratio, quantity, model, refCharDataUrl]);

  const reconstructedHookDebug = useMemo(() => {
    if (!is24s) return { image2: null, image3: null };
    const baseUrl = String(sceneHook1Url || "").trim();
    const s2 = String(getSafeScenes(canonicalSpec)?.[1]?.script_text || "").trim();
    const s3 = String(getSafeScenes(canonicalSpec)?.[2]?.script_text || "").trim();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/hailuo-image` : "";

    const mk = (sceneIndex1Based, sceneText) => {
      if (!sceneText) return null;
      const hailuoPrompt = buildHookImageApiPrompt(
        [
          String(canonicalSpec.campaign.core_idea || "").trim(),
          canonicalSpec.campaign.profession ? `Métier: ${canonicalSpec.campaign.profession}` : "",
          canonicalSpec.campaign.style_details ? `Style: ${canonicalSpec.campaign.style_details}` : "",
          buildHailuoHookPrompt(sceneText, sceneIndex1Based),
        ]
          .filter(Boolean)
          .join("\n\n"),
        {
          revealMode: canonicalSpec.rendering.camera.reveal_mode === true,
          initialStateMode: null,
          jobTypeLabel: canonicalSpec.campaign.profession || "",
          lockedVideoScriptScene0: undefined,
          cameraAerialAngle: canonicalSpec.campaign.clarification.camera_aerial_angle,
          cameraViewAngle: canonicalSpec.campaign.clarification.camera_view_angle,
          globalIntent: getSafeIntentProfile(canonicalSpec),
          selfieMode: canonicalSpec.rendering.camera.selfie_mode === true,
          cameraFixed: canonicalSpec.rendering.camera.fixed === true,
          openingHookStill: false,
        }
      );

      return {
        provider: "hailuo (reconstitué)",
        functionUrl,
        prompt: hailuoPrompt,
        requestBody: {
          prompt: hailuoPrompt,
          ratio,
          quantity: 1,
          model,
          refCharacter: "(dataURL générée depuis referenceUrl via fetchImageUrlAsDataUrl)",
        },
        ratio,
        model,
        quantity: 1,
        referenceUrl: baseUrl,
        referenceSummary:
          "Reconstitué: refCharacter est transmis via le champ `refCharacter` (data URL) du body JSON.",
        createdAt: "",
      };
    };

    return {
      image2: mk(2, s2),
      image3: mk(3, s3),
    };
  }, [is24s, sceneHook1Url, canonicalSpec, ratio, model, buildHailuoHookPrompt]);

  const interactionPanel = (
    <div
      className={`min-w-0 w-full px-4 py-4 sm:px-5 sm:py-5 ${
        visualStepActive ? "max-[640px]:px-3 max-[640px]:py-3" : ""
      }`}
    >
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={reloadIdeaFromCampaign}
              className="text-[10px] uppercase tracking-wider text-gray-500 hover:text-gray-300 border border-white/10 rounded-md px-2 py-1 bg-white/[0.03] hover:bg-white/[0.06] transition-colors shrink-0"
            >
              {visualStepActive ? (
                <>
                  <span className="max-[640px]:hidden">Recharger l&apos;idée de la campagne</span>
                  <span className="hidden max-[640px]:inline">Recharger l&apos;idée</span>
                </>
              ) : (
                "Recharger l'idée de la campagne"
              )}
            </button>
          </div>
          <div className="relative min-w-0 w-full">
            {isProductMode ? (
              <>
                <div className="absolute -top-16 left-2 z-10 flex gap-3">
                  <ProductRefCard
                    label="Mes avatars IA"
                    emptyIcon={User}
                    imageUrl={productAvatarRefSource === "library" ? productAvatarRefUrl : null}
                    imageClassName="[object-position:16%_center]"
                    onPick={() => openAvatarLibrary("product")}
                    onClear={clearAvatarRef}
                    disabled={busy || modifyLoading}
                  />
                  <ProductRefCard
                    label="Produit"
                    imageUrl={productProductRefUrl}
                    onPick={() => productRefFileInputRef.current?.click()}
                    onClear={() => patchImageStep?.({ productProductRefUrl: null })}
                    disabled={busy || modifyLoading}
                  />
                  <ProductRefCard
                    label="Importer une image"
                    emptyIcon={Upload}
                    imageUrl={productAvatarRefSource === "import" ? productAvatarRefUrl : null}
                    onPick={() => avatarRefFileInputRef.current?.click()}
                    onClear={clearAvatarRef}
                    disabled={busy || modifyLoading}
                  />
                </div>
                <input
                  ref={avatarRefFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onAvatarRefFileChange}
                  className="hidden"
                  aria-hidden
                  tabIndex={-1}
                />
                <input
                  ref={productRefFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onProductRefFileChange}
                  className="hidden"
                  aria-hidden
                  tabIndex={-1}
                />
              </>
            ) : null}
            <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] focus-within:ring-2 focus-within:ring-cyan-500/35">
              <div className="flex flex-row items-center">
              <textarea
                ref={bottomFieldInputRef}
                rows={narrowVisualStudio ? 1 : 2}
                value={bottomFieldValue}
                onChange={(e) => {
                  setModifyError("");
                  setBottomFieldValue(e.target.value);
                }}
                onInput={() => {
                  requestAnimationFrame(() => adjustBottomTextareaHeight());
                }}
                maxLength={hasSessionImages ? 500 : 1500}
                disabled={busy || modifyLoading}
                placeholder={
                  hasSessionImages
                    ? "Ex. : ajoute un détail au premier plan, change l'arrière-plan…"
                    : "Ex. : gros plan sur une personne surprise qui regarde la caméra…"
                }
                className={`min-w-0 flex-1 resize-none rounded-2xl bg-transparent px-4 py-3 pr-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full ${
                  narrowVisualStudio
                    ? "min-h-[60px] overflow-hidden overflow-y-hidden"
                    : "min-h-[3.5rem]"
                }`}
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: scrollbarVisible
                    ? "rgba(255,255,255,0.25) transparent"
                    : "transparent transparent",
                }}
                onMouseEnter={() => setScrollbarVisible(true)}
                onMouseLeave={() => setScrollbarVisible(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canBottomSubmit) runBottomSubmit();
                  }
                }}
              />
              <button
                type="button"
                onClick={runBottomSubmit}
                disabled={!canBottomSubmit}
                className="mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-gray-950 shadow-lg transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  hasSessionImages
                    ? !session
                      ? "Appliquer la modification (connexion requise au moment d’envoyer)"
                      : "Appliquer la modification"
                    : "Générer les images"
                }
              >
                {busy || modifyLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-gray-900" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </button>
              </div>
            </div>
          </div>
          {hasSessionImages && modifyError ? (
            <p className="mt-1.5 text-xs text-amber-300/90" role="alert">
              {modifyError}
            </p>
          ) : null}
        </div>
        <div
          className={`flex w-full shrink-0 flex-col gap-2 sm:w-64 ${
            visualStepActive ? "max-[640px]:flex-row max-[640px]:gap-1.5 max-[640px]:w-full" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => void handleUseThisImage()}
            disabled={!lastGeneratedImages?.length || busy || modifyLoading}
            className={`rounded-xl border px-4 py-3.5 text-center text-sm font-semibold transition ${
              lastGeneratedImages?.length && !busy && !modifyLoading
                ? "border-white/12 bg-white/[0.06] text-white shadow-none hover:border-cyan-400/30 hover:bg-white/[0.09]"
                : "cursor-not-allowed border-white/10 bg-white/[0.03] text-gray-500"
            } ${
              visualStepActive
                ? "max-[640px]:flex-[2] max-[640px]:rounded-[10px] max-[640px]:border max-[640px]:border-[#2a3560] max-[640px]:bg-[#1e2845] max-[640px]:px-2.5 max-[640px]:py-[7px] max-[640px]:text-[11px] max-[640px]:font-semibold max-[640px]:leading-tight max-[640px]:text-[#00d4a0] max-[640px]:shadow-none"
                : ""
            }`}
          >
            Utiliser cette image
          </button>
          <button
            type="button"
            onClick={() => {
              const hasSomethingToReset =
                Boolean(lastGeneratedImages?.length) ||
                Boolean(String(prompt || "").trim()) ||
                Boolean(String(modifyInstruction || "").trim()) ||
                Boolean(refCharDataUrl) ||
                Boolean(productAvatarRefUrl) ||
                Boolean(productProductRefUrl) ||
                Boolean(String(lastGeneratedPrompt || "").trim()) ||
                Boolean(String(campaignIdeaPrompt || "").trim()) ||
                Number(selectedImageIndex || 0) !== 0;
              if (!hasSomethingToReset) return;
              if (!confirm("Repartir de zéro sur cette étape ? Les images non enregistrées seront perdues.")) {
                return;
              }
              clearProductRefCards();
              resetImageStep();
            }}
            className={`text-center text-[10px] uppercase tracking-wider text-gray-600 underline decoration-gray-700 underline-offset-2 hover:text-gray-500 ${
              visualStepActive
                ? "max-[640px]:flex-1 max-[640px]:rounded-[10px] max-[640px]:border max-[640px]:border-[#1e2845] max-[640px]:bg-transparent max-[640px]:px-2 max-[640px]:py-[7px] max-[640px]:normal-case max-[640px]:no-underline max-[640px]:text-[10px] max-[640px]:font-normal max-[640px]:leading-tight max-[640px]:text-[#3e4870]"
                : ""
            }`}
          >
            {visualStepActive ? (
              <>
                <span className="max-[640px]:hidden">Réinitialiser cette étape</span>
                <span className="hidden max-[640px]:inline">Réinitialiser</span>
              </>
            ) : (
              "Réinitialiser cette étape"
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <QuotaBlockedModal
        open={showQuotaModal}
        title={hasAccess ? "Quota mensuel épuisé" : "Accès abonnement requis"}
        message={quotaModalMessage}
        actionLabel={hasAccess ? "Aller vers Packs vidéos" : "Voir les abonnements"}
        onClose={() => setShowQuotaModal(false)}
        onGoToShop={() => {
          setShowQuotaModal(false);
          window.location.href = hasAccess
            ? "/boutique?section=packs-videos"
            : "/boutique?section=subscription";
        }}
      />
      <div
        className={`studio-panel box-border w-full min-w-0 max-w-full p-5 sm:p-6 space-y-4 ${
          visualStepActive ? "max-[640px]:space-y-0 max-[640px]:p-3" : ""
        }`}
      >
        {visualStepActive ? (
          <div className="flex min-w-0 w-full flex-col gap-3 max-[640px]:gap-3">
            <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-200">
              <Sparkles className="h-4 w-4 shrink-0 text-cyan-400" />
              <span className="truncate">Étape 2 – Votre visuel d&apos;accroche</span>
            </h2>
            <div
              className="relative grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 min-[640px]:inline-flex min-[640px]:w-auto min-[640px]:max-w-full min-[640px]:grid-cols-none min-[640px]:flex-row min-[640px]:flex-nowrap min-[640px]:items-center min-[640px]:justify-start min-[640px]:gap-1"
              ref={historyPanelRef}
            >
              <button
                type="button"
                onClick={openVisuelAide}
                className="vws-campagne-aide-btn box-border flex min-h-[44px] min-w-0 w-full max-w-full flex-row flex-nowrap items-center justify-start gap-1.5 px-2 py-2 text-left text-[11px] font-semibold leading-tight max-[639px]:max-w-full min-[640px]:h-auto min-[640px]:w-auto min-[640px]:min-h-0 min-[640px]:shrink-0 min-[640px]:gap-1.5 min-[640px]:px-2.5 min-[640px]:py-1.5 min-[640px]:text-sm sm:min-h-0"
              >
                <BookOpen className="vws-campagne-aide-btn__icon h-3.5 w-3.5 shrink-0 min-[640px]:h-[0.875rem] min-[640px]:w-[0.875rem]" />
                {showVisuelAidePulse ? <span className="pulse-dot shrink-0" aria-hidden="true" /> : null}
                <span className="min-w-0 whitespace-nowrap">Aide pour commencer</span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                disabled={!onRestoreVisualSnapshot || visualSnapshots.length === 0}
                title={
                  visualSnapshots.length === 0
                    ? "Aucune grille enregistrée dans cette session (génère ou modifie d’abord des images)"
                    : "Restaurer une grille ou un état visuel enregistré"
                }
                className="studio-toolbar-btn box-border inline-flex min-h-[44px] shrink-0 flex-row items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium leading-tight text-gray-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-gray-400 min-[640px]:min-h-0 min-[640px]:gap-1.5 min-[640px]:px-2.5 min-[640px]:py-1.5 min-[640px]:text-sm"
              >
                <History className="h-3.5 w-3.5 shrink-0 text-cyan-500/90" />
                <span className="whitespace-nowrap">Historique</span>
              </button>
              {historyOpen && visualSnapshots.length > 0 && (
                <div className="absolute right-0 top-full z-30 mt-1 w-[min(100%,18rem)] max-w-[min(280px,calc(100vw-1.5rem))] rounded-xl border border-white/12 bg-gray-950/95 p-2 shadow-xl shadow-black/50 backdrop-blur-md">
                  <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Sessions visuelles
                  </p>
                  <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {visualSnapshots.map((entry) => {
                      const thumb = entry.step?.lastGeneratedImages?.[0];
                      const n = entry.step?.lastGeneratedImages?.length ?? 0;
                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onClick={() => {
                              onRestoreVisualSnapshot(entry);
                              setHistoryOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.06]"
                          >
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                className="h-10 w-10 shrink-0 rounded-md border border-white/10 object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 shrink-0 rounded-md border border-white/10 bg-white/5" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-medium text-gray-200">
                                {formatVisualSnapshotLabel(entry.t)}
                              </span>
                              <span className="block text-[10px] text-gray-500">
                                {n} variante{n > 1 ? "s" : ""}
                                {typeof entry.step?.selectedImageIndex === "number"
                                  ? ` · sélection #${(entry.step.selectedImageIndex ?? 0) + 1}`
                                  : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 w-full flex-col gap-3">
            <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-200">
              <Sparkles className="h-4 w-4 shrink-0 text-cyan-400" />
              <span className="truncate">Étape 2 – Votre visuel d&apos;accroche</span>
            </h2>
            <div
              className="relative grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 min-[640px]:inline-flex min-[640px]:w-auto min-[640px]:max-w-full min-[640px]:grid-cols-none min-[640px]:flex-row min-[640px]:flex-nowrap min-[640px]:items-center min-[640px]:justify-start min-[640px]:gap-1"
              ref={historyPanelRef}
            >
              <button
                type="button"
                onClick={openVisuelAide}
                className="vws-campagne-aide-btn box-border flex min-h-[44px] min-w-0 w-full max-w-full flex-row flex-nowrap items-center justify-start gap-1.5 px-2 py-2 text-left text-[11px] font-semibold leading-tight max-[639px]:max-w-full min-[640px]:h-auto min-[640px]:w-auto min-[640px]:min-h-0 min-[640px]:shrink-0 min-[640px]:gap-1.5 min-[640px]:px-2.5 min-[640px]:py-1.5 min-[640px]:text-sm sm:min-h-0"
              >
                <BookOpen className="vws-campagne-aide-btn__icon h-3.5 w-3.5 shrink-0 min-[640px]:h-[0.875rem] min-[640px]:w-[0.875rem]" />
                {showVisuelAidePulse ? <span className="pulse-dot shrink-0" aria-hidden="true" /> : null}
                <span className="min-w-0 whitespace-nowrap">Aide pour commencer</span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                disabled={!onRestoreVisualSnapshot || visualSnapshots.length === 0}
                title={
                  visualSnapshots.length === 0
                    ? "Aucune grille enregistrée dans cette session (génère ou modifie d’abord des images)"
                    : "Restaurer une grille ou un état visuel enregistré"
                }
                className="studio-toolbar-btn box-border inline-flex min-h-[44px] shrink-0 flex-row items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium leading-tight text-gray-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-gray-400 min-[640px]:min-h-0 min-[640px]:gap-1.5 min-[640px]:px-2.5 min-[640px]:py-1.5 min-[640px]:text-sm"
              >
                <History className="h-3.5 w-3.5 shrink-0 text-cyan-500/90" />
                <span className="whitespace-nowrap">Historique</span>
              </button>
              {historyOpen && visualSnapshots.length > 0 && (
                <div className="absolute right-0 top-full z-30 mt-1 w-[min(100%,18rem)] max-w-[min(280px,calc(100vw-1.5rem))] rounded-xl border border-white/12 bg-gray-950/95 p-2 shadow-xl shadow-black/50 backdrop-blur-md">
                  <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Sessions visuelles
                  </p>
                  <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {visualSnapshots.map((entry) => {
                      const thumb = entry.step?.lastGeneratedImages?.[0];
                      const n = entry.step?.lastGeneratedImages?.length ?? 0;
                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onClick={() => {
                              onRestoreVisualSnapshot(entry);
                              setHistoryOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.06]"
                          >
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                className="h-10 w-10 shrink-0 rounded-md border border-white/10 object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 shrink-0 rounded-md border border-white/10 bg-white/5" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-medium text-gray-200">
                                {formatVisualSnapshotLabel(entry.t)}
                              </span>
                              <span className="block text-[10px] text-gray-500">
                                {n} variante{n > 1 ? "s" : ""}
                                {typeof entry.step?.selectedImageIndex === "number"
                                  ? ` · sélection #${(entry.step.selectedImageIndex ?? 0) + 1}`
                                  : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

      {/* 1. Configuration : format + variantes */}
      {visualStepActive ? (
        <div
          className="mb-2 hidden max-[640px]:grid w-full grid-cols-2 gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2"
          style={isMobile ? { marginTop: "20px" } : undefined}
        >
          <div className="min-w-0">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Format
            </span>
            <div className="relative">
              <select
                value={ratio}
                onChange={(e) => patchImageStep({ ratio: e.target.value })}
                className="w-full appearance-none rounded-xl border border-white/10 bg-black/30 py-2.5 pl-3 pr-10 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00d4a0]/35"
                aria-label="Format d'image"
              >
                {ratioOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#0C1116]">
                    {opt.label}
                  </option>
                ))}
              </select>
              <span
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                aria-hidden
              >
                {ratioIcon(ratio)}
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Variantes
            </span>
            <select
              value={String(quantity)}
              onChange={(e) => patchImageStep({ quantity: Number(e.target.value) })}
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 px-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00d4a0]/35"
              aria-label="Nombre de variantes"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n} className="bg-[#0C1116]">
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      <div
        className={`mb-2 flex w-full flex-col items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-3 sm:px-5 ${
          visualStepActive ? "max-[640px]:hidden" : ""
        }`}
      >
        <div className="flex flex-col items-center gap-1.5 sm:items-start">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Format</span>
          <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
            {ratioOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => patchImageStep({ ratio: opt.value })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  ratio === opt.value
                    ? "bg-cyan-500/25 text-cyan-100 border border-cyan-400/40"
                    : "text-gray-400 hover:text-gray-200 border border-transparent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5 sm:items-start">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Variantes</span>
          <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1 gap-0.5">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => patchImageStep({ quantity: n })}
                className={`w-9 h-9 rounded-lg text-xs font-semibold transition-all ${
                  quantity === n
                    ? "bg-cyan-500/25 text-cyan-100 border border-cyan-400/40"
                    : "text-gray-400 hover:text-gray-200 border border-transparent"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Zone images : aperçu principal + variantes en colonne à droite (tous viewports) */}
      {lastGeneratedImages?.length ? (
        <div
          className="flex w-full justify-center"
          style={isMobile ? { marginTop: "16px" } : undefined}
        >
          <div className="flex max-w-full w-fit flex-row items-start justify-center gap-2">
          <div className="relative shrink-0 overflow-hidden rounded-xl bg-transparent">
            {busy && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 px-6">
                <Sparkles className="mb-3 h-8 w-8 animate-pulse text-cyan-400" />
                <p className="text-sm font-medium text-gray-200">{progressMessage || "Génération…"}</p>
                <div
                  className={`mt-4 w-full max-w-xs overflow-hidden rounded-full ${
                    visualStepActive ? "h-[3px]" : "h-1.5 bg-white/10"
                  }`}
                  style={visualStepActive ? { backgroundColor: "#1e2845" } : undefined}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      visualStepActive ? "" : "bg-cyan-500"
                    }`}
                    style={
                      visualStepActive
                        ? { width: `${progress}%`, backgroundColor: "#00d4a0" }
                        : { width: `${progress}%` }
                    }
                  />
                </div>
                <p className="mt-2 text-xs text-gray-400">{progress}%</p>
              </div>
            )}
            <img
              src={lastGeneratedImages[selectedImageIndex]}
              alt="Visuel sélectionné"
              className="block max-h-[min(42vh,380px)] w-auto max-w-full object-contain"
            />
          </div>
          <div className="flex shrink-0 flex-col items-start justify-start gap-2">
            {lastGeneratedImages.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={() => {
                  patchImageStep({ selectedImageIndex: index });
                  writeHookVisualSpec({
                    selected_variant_index: index,
                    selected_image_url: String(url || ""),
                  });
                }}
                className={`relative aspect-[9/16] w-11 shrink-0 overflow-hidden rounded-lg border transition-all sm:w-12 ${
                  selectedImageIndex === index
                    ? "border-cyan-400"
                    : "border-white/15 opacity-90 hover:border-white/30 hover:opacity-100"
                }`}
              >
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                <span
                  className={`absolute right-0.5 top-0.5 rounded-full px-1 py-px text-[9px] font-bold sm:text-[10px] ${
                    selectedImageIndex === index ? "bg-cyan-500 text-gray-950" : "bg-black/60 text-gray-200"
                  }`}
                >
                  V{index + 1}
                </span>
                {selectedImageIndex === index && (
                  <Check className="absolute left-0.5 top-0.5 h-3.5 w-3.5 text-cyan-400 sm:h-4 sm:w-4" aria-hidden />
                )}
              </button>
            ))}
          </div>
          </div>
        </div>
      ) : (
        <div
          className={`relative min-w-0 overflow-hidden rounded-xl min-h-[220px] border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-black/20 lg:min-h-[260px] mx-auto w-1/2 max-w-full shrink-0 ${
            visualStepActive
              ? "max-[640px]:mx-auto max-[640px]:min-h-0 max-[640px]:w-auto max-[640px]:max-w-none max-[640px]:overflow-visible max-[640px]:rounded-none max-[640px]:border-0 max-[640px]:bg-transparent"
              : ""
          }`}
          style={isMobile ? { marginTop: "16px" } : undefined}
        >
          {busy && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 px-6">
              <Sparkles className="mb-3 h-8 w-8 animate-pulse text-cyan-400" />
              <p className="text-sm font-medium text-gray-200">{progressMessage || "Génération…"}</p>
              <div
                className={`mt-4 w-full max-w-xs overflow-hidden rounded-full ${
                  visualStepActive ? "h-[3px]" : "h-1.5 bg-white/10"
                }`}
                style={visualStepActive ? { backgroundColor: "#1e2845" } : undefined}
              >
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    visualStepActive ? "" : "bg-cyan-500"
                  }`}
                  style={
                    visualStepActive
                      ? { width: `${progress}%`, backgroundColor: "#00d4a0" }
                      : { width: `${progress}%` }
                  }
                />
              </div>
              <p className="mt-2 text-xs text-gray-400">{progress}%</p>
            </div>
          )}
          {visualStepActive ? (
            <div className="mx-auto my-2 hidden flex-col items-center gap-1.5 max-[640px]:flex">
              <div
                className="flex h-[90px] w-[120px] flex-shrink-0 items-center justify-center rounded-[11px] border border-[#1e2845] bg-[#161d2e]"
                role="status"
              >
                <p
                  className="px-1 text-center text-[9px] leading-tight"
                  style={{ color: "#3e4870" }}
                >
                  Tes visuels générés s’afficheront ici.
                </p>
              </div>
              {showHookImportLink ? (
                <button
                  type="button"
                  onClick={onPickHookImport}
                  disabled={modifyLoading}
                  className="inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-400 disabled:pointer-events-none disabled:opacity-40"
                >
                  <Upload className="h-3 w-3 shrink-0" aria-hidden />
                  ou importer ma propre image
                </button>
              ) : null}
            </div>
          ) : null}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 py-10 ${
              visualStepActive ? "max-[640px]:hidden" : ""
            }`}
          >
            <p className="text-center text-sm leading-relaxed text-gray-500">
              Tes visuels générés s’afficheront ici.
            </p>
            {showHookImportLink ? (
              <button
                type="button"
                onClick={onPickHookImport}
                disabled={modifyLoading}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400 disabled:pointer-events-none disabled:opacity-40"
              >
                <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden />
                ou importer ma propre image
              </button>
            ) : null}
          </div>
          <input
            ref={hookImportFileInputRef}
            type="file"
            accept="image/*"
            onChange={onHookImportFileChange}
            className="hidden"
            aria-hidden
            tabIndex={-1}
          />
        </div>
      )}

      {is24s && STUDIO_24S_TEMPORAL_HOOK_IMAGES_ENABLED ? (
        <section className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold text-gray-200 tracking-wide">
              Images 24 s (Début / Transformation / Résultat)
            </h3>
            <span className="text-[10px] uppercase tracking-wider text-gray-500">Auto</span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500 leading-relaxed">
            Scène 1 = image sélectionnée. Scènes 2 &amp; 3 se génèrent en arrière-plan (NanoBanana, sinon Hailuo).
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: "Début", url: sceneHook1Url, status: "done", msg: "" },
              { label: "Transformation", url: sceneHook2Url, status: scene2Status, msg: scene2Msg },
              { label: "Résultat", url: sceneHook3Url, status: scene3Status, msg: scene3Msg },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-gray-300">{card.label}</span>
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">
                    {card.status === "generating"
                      ? "génération…"
                      : card.status === "error"
                        ? "erreur"
                        : card.url
                          ? "ok"
                          : "en attente"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] aspect-[9/16]">
                  {card.url ? (
                    <img src={card.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="px-2 text-center text-[10px] leading-snug text-gray-500">
                      {card.status === "generating"
                        ? "Génération en cours…"
                        : card.status === "error"
                          ? "Impossible de générer."
                          : "Pas encore générée."}
                    </span>
                  )}
                </div>
                {card.label === "Début" ? (
                  <DebugAccordion
                    title="Image 1 (Début)"
                    debug={image24sDebug?.image1 || reconstructedImage1Debug}
                  />
                ) : card.label === "Transformation" ? (
                  <DebugAccordion
                    title="Image 2 (Transformation)"
                    debug={image24sDebug?.image2 || reconstructedHookDebug?.image2}
                    referenceUrl={sceneHook1Url}
                  />
                ) : card.label === "Résultat" ? (
                  <DebugAccordion
                    title="Image 3 (Résultat)"
                    debug={image24sDebug?.image3 || reconstructedHookDebug?.image3}
                    referenceUrl={sceneHook1Url}
                  />
                ) : null}
                {card.status === "error" && card.msg ? (
                  <p className="mt-2 text-[10px] text-amber-200/80">{card.msg}</p>
                ) : card.status === "error" ? (
                  <p className="mt-2 text-[10px] text-amber-200/80">
                    Réessai automatique au prochain changement d’image 1 / de résumé.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 4. Zone d’interaction principale */}
      <div style={isMobile ? { marginTop: "20px" } : undefined}>{interactionPanel}</div>

      {/* 5. Options avancées — en bas, discret */}
      <div
        className="border-t border-white/[0.06] pt-6"
        style={isMobile ? { marginTop: "16px" } : undefined}
      >
          <div className="flex justify-center">
            <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-gray-600 hover:text-gray-500 select-none">
              <input
                type="checkbox"
                className="rounded border-white/15 bg-white/[0.04] text-cyan-600 focus:ring-cyan-500/30"
                checked={showAdvancedOptions}
                onChange={(e) => setShowAdvancedOptions(e.target.checked)}
              />
              <Settings2 className="w-3 h-3 opacity-60" />
              Options avancées
            </label>
          </div>

          {showAdvancedOptions && (
            <div className="mt-4 space-y-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4 sm:p-5">
              <p className="text-[11px] text-amber-200/70">
                Réservé aux utilisateurs expérimentés. Le champ principal suffit dans la plupart des cas.
              </p>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-300">Prompt personnalisé (optionnel)</label>
                <textarea
                  value={prompt}
                  onChange={(e) => patchImageStep({ prompt: e.target.value })}
                  maxLength={1500}
                  rows={5}
                  className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                />
              </div>
              <details className="rounded-xl border border-white/10 bg-black/20">
                <summary className="cursor-pointer list-none px-4 py-3 text-xs font-medium text-gray-400 [&::-webkit-details-marker]:hidden">
                  Paramètres techniques (optionnels)
                </summary>
                <div className="space-y-4 border-t border-white/10 px-4 py-4">
                  <p className="text-[11px] leading-relaxed text-amber-200/70">
                    Modifier ces paramètres peut impacter le résultat (nombre de propositions, cadrage, image de référence).
                  </p>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">Image de référence</span>
                    <div className="mt-2">
                      {refCharDataUrl ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <img src={refCharDataUrl} alt="" className="h-20 w-20 rounded-lg object-cover border border-white/10" />
                            <div className="flex flex-col gap-1">
                              <button type="button" onClick={resetRef} className="text-left text-xs text-gray-400 underline">
                                Retirer
                              </button>
                              <button
                                type="button"
                                onClick={() => openAvatarLibrary("classic")}
                                className="text-left text-xs text-cyan-400/90 underline-offset-2 hover:text-cyan-300 hover:underline"
                              >
                                Choisir depuis mes avatars
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={onPickRefImage}
                            className="rounded-lg border border-dashed border-white/20 px-4 py-3 text-xs text-gray-400 hover:border-cyan-500/30"
                          >
                            Ajouter une image de référence
                          </button>
                          <button
                            type="button"
                            onClick={() => openAvatarLibrary("classic")}
                            className="text-left text-xs text-cyan-400/90 underline-offset-2 hover:text-cyan-300 hover:underline"
                          >
                            Choisir depuis mes avatars
                          </button>
                        </div>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Modèle : <span className="text-gray-300">{model}</span>
                  </div>
                </div>
              </details>
            </div>
          )}
      </div>
      </div>

      <ModalBibliothequeAvatars
        open={avatarLibraryOpen}
        onClose={() => setAvatarLibraryOpen(false)}
        onSelect={handleAvatarLibrarySelect}
      />

      <VisuelAccrocheExplicationSheet open={showSystemVideo} onClose={() => setShowSystemVideo(false)} />
    </>
  );
}
