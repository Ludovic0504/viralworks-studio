import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Clock,
  Crop,
  Layers2,
  Loader2,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useT } from "@/contexte/FournisseurLocale";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { hasImageStudioPlan } from "@/bibliotheque/supabase/premiumAccess";
import {
  fetchImageStudioQuota,
} from "@/bibliotheque/supabase/imageStudioQuota";
import { IMAGE_STUDIO_MONTHLY_QUOTA_DEFAULT, getImageStudioMonthlyLimit } from "@/bibliotheque/supabase/planQuotas";
import {
  dismissImageStudioAlert,
  shouldShowImageStudioLowQuotaWarning,
  wasImageStudioAlertDismissed,
} from "@/bibliotheque/imageStudio/quotaAlerts";
import BandeauRenouvellementQuotaImageStudio from "@/composants/image/BandeauRenouvellementQuotaImageStudio";
import IndicateurCreditsImageStudio from "@/composants/image/IndicateurCreditsImageStudio";
import ImageStudioModelIcon from "@/composants/image/ImageStudioModelIcon";
import ModalAbonnementImageStudio from "@/composants/image/ModalAbonnementImageStudio";
import ModalPromptsImageStudio from "@/composants/image/ModalPromptsImageStudio";
import ModalPromptAssistImageStudio from "@/composants/image/ModalPromptAssistImageStudio";
import SheetReglagesImageStudio from "@/composants/image/SheetReglagesImageStudio";
import ImageStudioFeedPanel from "@/composants/image/ImageStudioFeedPanel";
import SheetHistoriqueImageStudio from "@/composants/image/SheetHistoriqueImageStudio";
import ImageStudioModeTabs from "@/composants/image/ImageStudioModeTabs";
import ImageStudioProjectsGrid from "@/composants/image/ImageStudioProjectsGrid";
import ImageStudioProjectCanvas from "@/composants/image/ImageStudioProjectCanvas";
import ImageStudioProjectsHistoryStrip from "@/composants/image/ImageStudioProjectsHistoryStrip";
import ImageStudioPromptInput, {
  insertPromptMentionAtCursor,
} from "@/composants/image/ImageStudioPromptInput";
import ModalImageStudioPreview from "@/composants/image/ModalImageStudioPreview";
import ModalQuotaImageStudio from "@/composants/image/ModalQuotaImageStudio";
import {
  fetchImageStudioModels,
  generateImageStudio,
  IMAGE_STUDIO_PATIENT_HINT,
  IMAGE_STUDIO_RETRY_HINT,
} from "@/bibliotheque/imageStudio/generateImageStudio";
import {
  IMAGE_STUDIO_MODEL_OPTIONS,
} from "@/bibliotheque/imageStudio/imageStudioModels";
import {
  findHistoryItemForImage,
  getGenerationRefsFromHistory,
  getImageUrlFromHistory,
  listImageStudioHistory,
  saveImageStudioHistory,
} from "@/bibliotheque/imageStudio/imageStudioHistory";
import { mergeFeedRowsFromHistory } from "@/bibliotheque/imageStudio/imageStudioFeed";
import { subscribeImageStudioHistory } from "@/bibliotheque/imageStudio/imageStudioRealtime";
import {
  loadImageStudioUiState,
  saveImageStudioUiState,
} from "@/bibliotheque/imageStudio/imageStudioUiState";
import {
  applyImageStudioHistoryCache,
  saveImageStudioHistoryCache,
} from "@/bibliotheque/imageStudio/imageStudioHistoryCache";
import { resolvePromptMentions, IMAGE_STUDIO_PROMPT_MAX_LENGTH, getImageStudioUserPrompt, removePromptMentionToken } from "@/bibliotheque/imageStudio/promptMentions";
import { resolveImageStudioGuideApplyPayload } from "@/bibliotheque/imageStudio/imageStudioGuideApply";
import {
  uploadImageStudioReferenceUrl,
  isSupportedImageStudioReferenceMime,
  IMAGE_STUDIO_REF_IMPORT_MESSAGE,
} from "@/bibliotheque/imageStudio/uploadImageStudioReference";
import {
  listImageStudioProjects,
  createImageStudioProject,
  renameImageStudioProject,
  deleteImageStudioProject,
} from "@/bibliotheque/imageStudio/imageStudioProjects";
import {
  createImageStudioProjectNode,
  createImageStudioProjectEdge,
  loadImageStudioProjectCanvas,
  addImageToImageStudioProject,
  nextNodePositions,
} from "@/bibliotheque/imageStudio/imageStudioProjectCanvas";
import ModalBibliothequeAvatars from "@/composants/studio/avatar/ModalBibliothequeAvatars";
import ModalBibliothequeProduits from "@/composants/studio/product/ModalBibliothequeProduits";
import { capturePostHog, trackPostHogError } from "@/bibliotheque/posthog/client";
import { requestPromoModalOpen } from "@/bibliotheque/promo/promoModalGate";

const ASPECT_RATIOS = ["1:1", "4:5", "9:16", "16:9"];
const GENERATION_COUNTS = [1, 2, 3, 4];

const DEFAULT_MODELS = {
  nano_banana_pro: false,
  hailuo: false,
  gpt_image_2: false,
};

const PROMPT_MAX_ROWS = 10;

function pickDefaultModel(availability) {
  for (const opt of IMAGE_STUDIO_MODEL_OPTIONS) {
    if (availability[opt.id]) return opt.id;
  }
  return "nano_banana_pro";
}

const MOBILE_DROPDOWN_MQ = "(max-width: 639px)";
const COMMAND_BAR_DROPDOWN_GAP_PX = 8;

function useDropdownDismiss(open, setOpen, rootRef, menuRef) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const inRoot = rootRef.current?.contains(e.target);
      const inMenu = menuRef?.current?.contains(e.target);
      if (!inRoot && !inMenu) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, rootRef, menuRef]);
}

function useCommandBarDropdownMenu(open, anchorRef, menuRef) {
  const [menuStyle, setMenuStyle] = useState(null);
  const [useFixedMenu, setUseFixedMenu] = useState(false);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setMenuStyle(null);
      setUseFixedMenu(false);
      return;
    }

    const mq = window.matchMedia(MOBILE_DROPDOWN_MQ);

    const update = () => {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (!anchor) return;

      const fixed = mq.matches;
      setUseFixedMenu(fixed);

      if (!fixed) {
        setMenuStyle(null);
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const viewportPadding = 12;
      const menuWidth = menu?.offsetWidth ?? 0;

      let left = rect.left;
      if (menuWidth > 0) {
        const maxLeft = window.innerWidth - menuWidth - viewportPadding;
        left = Math.min(Math.max(viewportPadding, left), Math.max(viewportPadding, maxLeft));
      }

      setMenuStyle({
        position: "fixed",
        left: `${left}px`,
        bottom: `${window.innerHeight - rect.top + COMMAND_BAR_DROPDOWN_GAP_PX}px`,
        zIndex: 200,
      });
    };

    update();
    const raf = requestAnimationFrame(update);

    const ro = menuRef.current ? new ResizeObserver(update) : null;
    if (menuRef.current) ro?.observe(menuRef.current);

    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, menuRef]);

  return { menuStyle, useFixedMenu };
}

function CommandBarDropdownMenu({
  open,
  anchorRef,
  menuRef,
  children,
  role = "listbox",
  menuClassName = "",
}) {
  const { menuStyle, useFixedMenu } = useCommandBarDropdownMenu(open, anchorRef, menuRef);

  if (!open) return null;

  const menu = (
    <div
      ref={menuRef}
      className={`image-studio-dropdown-menu${useFixedMenu ? " is-fixed" : ""}${menuClassName ? ` ${menuClassName}` : ""}`}
      style={menuStyle ?? undefined}
      role={role}
    >
      {children}
    </div>
  );

  return useFixedMenu ? createPortal(menu, document.body) : menu;
}

function ModelDropdown({ value, onChange, availability, disabled, loading }) {
  const t = useT();
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = IMAGE_STUDIO_MODEL_OPTIONS.find((o) => o.id === value);

  useDropdownDismiss(open, setOpen, rootRef, menuRef);

  return (
    <div ref={rootRef} className={`image-studio-dropdown shrink-0${open ? " is-open" : ""}`}>
      <button
        type="button"
        disabled={disabled || loading}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="image-studio-setting-pill"
        onClick={() => setOpen((v) => !v)}
        title={loading ? t("common.model") : selected?.label ?? t("common.model")}
        aria-label={`${t("common.model")} : ${loading ? t("common.loading") : selected?.label ?? t("common.model")}`}
      >
        {loading ? (
          <Wand2 className="image-studio-setting-pill-icon" strokeWidth={2} aria-hidden />
        ) : (
          <ImageStudioModelIcon modelId={value} size="sm" className="image-studio-setting-pill-model-icon" />
        )}
        <span className="image-studio-setting-pill-label max-w-[6.5rem] truncate sm:max-w-[8rem]">
          {loading ? "…" : selected?.label ?? t("common.model")}
        </span>
        <ChevronDown
          className={`image-studio-setting-pill-chevron h-3.5 w-3.5 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2.25}
        />
      </button>

      <CommandBarDropdownMenu
        open={open}
        anchorRef={rootRef}
        menuRef={menuRef}
        menuClassName="image-studio-dropdown-menu--models"
      >
        {IMAGE_STUDIO_MODEL_OPTIONS.map((opt) => {
          const available = availability[opt.id];
          const isSelected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={!available}
              className={`image-studio-model-option ${isSelected ? "is-selected" : ""}`}
              onClick={() => {
                if (!available) return;
                onChange(opt.id);
                setOpen(false);
              }}
            >
              <ImageStudioModelIcon modelId={opt.id} size="md" />
              <span className="image-studio-model-option-copy">
                <span className="image-studio-model-option-name">{opt.label}</span>
                <span className="image-studio-model-option-desc">{opt.description}</span>
              </span>
              {!available ? (
                <span className="image-studio-dropdown-soon">{t("common.soon")}</span>
              ) : (
                <Check
                  className={`image-studio-model-option-check${isSelected ? " is-visible" : ""}`}
                  strokeWidth={2.5}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </CommandBarDropdownMenu>
    </div>
  );
}

function AspectRatioDropdown({ value, onChange, disabled }) {
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);

  useDropdownDismiss(open, setOpen, rootRef, menuRef);

  return (
    <div ref={rootRef} className={`image-studio-dropdown shrink-0${open ? " is-open" : ""}`}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="image-studio-setting-pill"
        onClick={() => setOpen((v) => !v)}
        title={`Format : ${value}`}
        aria-label={`Format : ${value}`}
      >
        <Crop className="image-studio-setting-pill-icon" strokeWidth={2} aria-hidden />
        <span className="image-studio-setting-pill-label">{value}</span>
        <ChevronDown
          className={`image-studio-setting-pill-chevron h-3.5 w-3.5 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2.25}
        />
      </button>

      <CommandBarDropdownMenu open={open} anchorRef={rootRef} menuRef={menuRef}>
        {ASPECT_RATIOS.map((ratio) => (
          <button
            key={ratio}
            type="button"
            role="option"
            aria-selected={value === ratio}
            className={`image-studio-dropdown-option ${value === ratio ? "is-selected" : ""}`}
            onClick={() => {
              onChange(ratio);
              setOpen(false);
            }}
          >
            <span>{ratio}</span>
          </button>
        ))}
      </CommandBarDropdownMenu>
    </div>
  );
}

function GenerationCountDropdown({ value, onChange, disabled, maxCount = 4 }) {
  const t = useT();
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const label = value === 1 ? "1 image" : `${value} images`;

  useDropdownDismiss(open, setOpen, rootRef, menuRef);

  return (
    <div ref={rootRef} className={`image-studio-dropdown shrink-0${open ? " is-open" : ""}`}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="image-studio-setting-pill"
        onClick={() => setOpen((v) => !v)}
        title={`Générations : ${label}`}
        aria-label={`Générations : ${label}`}
      >
        <Layers2 className="image-studio-setting-pill-icon" strokeWidth={2} aria-hidden />
        <span className="image-studio-setting-pill-label">{value}</span>
        <ChevronDown
          className={`image-studio-setting-pill-chevron h-3.5 w-3.5 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2.25}
        />
      </button>

      <CommandBarDropdownMenu
        open={open}
        anchorRef={rootRef}
        menuRef={menuRef}
        menuClassName="image-studio-dropdown-menu--compact"
      >
        {GENERATION_COUNTS.map((count) => {
          const available = count <= maxCount;
          const selected = value === count;
          const optionLabel = count === 1 ? "1 image" : `${count} images`;
          return (
            <button
              key={count}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={optionLabel}
              disabled={!available}
              className={`image-studio-dropdown-option image-studio-dropdown-option--compact ${selected ? "is-selected" : ""}`}
              onClick={() => {
                if (!available) return;
                onChange(count);
                setOpen(false);
              }}
            >
              <span>{count}</span>
              {!available ? (
                <span className="image-studio-dropdown-soon">{t("common.quota")}</span>
              ) : (
                <Check
                  className={`image-studio-dropdown-option-check${selected ? " is-visible" : ""}`}
                  strokeWidth={2.5}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </CommandBarDropdownMenu>
    </div>
  );
}

function PromptImportSlot({ preview, disabled, onPick, onClear }) {
  const t = useT();
  const importLabel = t("imageStudio.importRef");
  const replaceLabel = t("imageStudio.replaceRef");
  return (
    <div className="image-studio-prompt-import shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={onPick}
        className={`image-studio-add-btn ${preview ? "has-ref" : ""}`}
        title={preview ? replaceLabel : importLabel}
        aria-label={preview ? replaceLabel : importLabel}
      >
        {preview ? (
          <img src={preview} alt="" className="image-studio-add-btn-img" />
        ) : (
          <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        )}
      </button>
      {preview ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="image-studio-add-btn-clear"
          aria-label={t("imageStudio.removeRef")}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </div>
  );
}

function ReferenceSlot({ label, preview, disabled, onPick, onClear, imageClassName = "" }) {
  return (
    <div className="image-studio-ref-slot">
      <button
        type="button"
        disabled={disabled}
        onClick={onPick}
        className={`image-studio-ref-slot-btn ${preview ? "has-ref" : ""}`}
        title={label}
        aria-label={label}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt=""
              className={`image-studio-ref-slot-img ${imageClassName}`.trim()}
            />
            <span className="image-studio-ref-slot-label">{label.toUpperCase()}</span>
          </>
        ) : (
          <>
            <span className="image-studio-ref-slot-plus" aria-hidden>
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <span className="image-studio-ref-slot-label">{label.toUpperCase()}</span>
          </>
        )}
      </button>
      {preview ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="image-studio-ref-slot-clear"
          aria-label={`Retirer ${label}`}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </div>
  );
}

export default function ImageStudio() {
  const t = useT();
  const promptInputRef = useRef(null);
  const promptImportInputRef = useRef(null);
  const { session, loading: authLoading } = useAuth();
  const { runWithAuth } = useRequireAuthAction();
  const { plan, loading: accessLoading } = usePremiumAccess();
  const [prompt, setPrompt] = useState("");
  const [feedRows, setFeedRows] = useState([]);
  const [referenceImage, setReferenceImage] = useState(null);
  const [referencePreview, setReferencePreview] = useState(null);
  const [importedRefImage, setImportedRefImage] = useState(null);
  const [importedRefPreview, setImportedRefPreview] = useState(null);
  const [productImage, setProductImage] = useState(null);
  const [productPreview, setProductPreview] = useState(null);
  const [productFocus, setProductFocus] = useState(null);
  const [avatarLibraryOpen, setAvatarLibraryOpen] = useState(false);
  const [productLibraryOpen, setProductLibraryOpen] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [generationCount, setGenerationCount] = useState(1);
  const [model, setModel] = useState("nano_banana_pro");
  const [modelsAvailability, setModelsAvailability] = useState(DEFAULT_MODELS);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationLoadingHint, setGenerationLoadingHint] = useState("");
  const [error, setError] = useState(null);
  const [quotaCount, setQuotaCount] = useState(0);
  const [quotaLimit, setQuotaLimit] = useState(IMAGE_STUDIO_MONTHLY_QUOTA_DEFAULT);
  const [quotaResetAt, setQuotaResetAt] = useState(null);
  const [quotaMode, setQuotaMode] = useState("monthly");
  const [quotaCycleEndsAt, setQuotaCycleEndsAt] = useState(null);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [quotaAlert, setQuotaAlert] = useState(null);
  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
  const [promptsModalOpen, setPromptsModalOpen] = useState(false);
  const [promptAssistModalOpen, setPromptAssistModalOpen] = useState(false);
  const [previewState, setPreviewState] = useState(null);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [scrollToEndToken, setScrollToEndToken] = useState(0);
  const [restoreFeedScrollTop, setRestoreFeedScrollTop] = useState(undefined);
  const [restoreThumbScrollTop, setRestoreThumbScrollTop] = useState(undefined);
  const [activeTab, setActiveTab] = useState("generation");
  const [isMobileLayout, setIsMobileLayout] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_DROPDOWN_MQ).matches;
  });
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [openProject, setOpenProject] = useState(null);
  const [selectedProjectNodeId, setSelectedProjectNodeId] = useState(null);
  const [projectCanvasReloadToken, setProjectCanvasReloadToken] = useState(0);
  const selectedProjectNodeRef = useRef(null);
  const projectNodeCountRef = useRef(0);
  const feedScrollTopRef = useRef(0);
  const thumbScrollTopRef = useRef(0);
  const feedPanelRef = useRef(null);
  const uiStateHydratedRef = useRef(false);
  const scrollPersistTimerRef = useRef(null);
  const [uiPersistReady, setUiPersistReady] = useState(false);

  /** Projets : desktop/tablette uniquement — mobile = génération classique. */
  const studioTab = isMobileLayout ? "generation" : activeTab;

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_DROPDOWN_MQ);
    const sync = () => setIsMobileLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isMobileLayout) return;
    setActiveTab("generation");
    setOpenProject(null);
    setSelectedProjectNodeId(null);
    selectedProjectNodeRef.current = null;
  }, [isMobileLayout]);

  const persistUiState = useCallback(
    (patch = {}) => {
      if (!session?.user?.id) return;
      saveImageStudioUiState(session.user.id, {
        feedScrollTop: feedScrollTopRef.current,
        thumbScrollTop: thumbScrollTopRef.current,
        activeHistoryId,
        prompt,
        model,
        aspectRatio,
        generationCount,
        ...patch,
      });
    },
    [
      session?.user?.id,
      activeHistoryId,
      prompt,
      model,
      aspectRatio,
      generationCount,
    ],
  );

  const scheduleScrollPersist = useCallback(() => {
    if (scrollPersistTimerRef.current) {
      window.clearTimeout(scrollPersistTimerRef.current);
    }
    scrollPersistTimerRef.current = window.setTimeout(() => {
      persistUiState();
    }, 250);
  }, [persistUiState]);

  useEffect(() => {
    return () => {
      if (scrollPersistTimerRef.current) {
        window.clearTimeout(scrollPersistTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    capturePostHog("image_studio_opened");
  }, []);

  useEffect(() => {
    if (!generating) {
      setGenerationLoadingHint("");
      return undefined;
    }

    setGenerationLoadingHint("");
    const patientTimer = window.setTimeout(() => {
      setGenerationLoadingHint(IMAGE_STUDIO_PATIENT_HINT);
    }, 25000);
    const retryTimer = window.setTimeout(() => {
      setGenerationLoadingHint(IMAGE_STUDIO_RETRY_HINT);
    }, 55000);

    return () => {
      window.clearTimeout(patientTimer);
      window.clearTimeout(retryTimer);
    };
  }, [generating]);

  const hasImagePlan = !accessLoading && hasImageStudioPlan(plan);

  const loadProjects = useCallback(async () => {
    if (!session?.user?.id) {
      setProjects([]);
      return;
    }
    setProjectsLoading(true);
    try {
      const rows = await listImageStudioProjects();
      setProjects(rows);
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (authLoading || studioTab !== "projects") return;
    void loadProjects();
  }, [authLoading, studioTab, loadProjects]);

  useEffect(() => {
    if (accessLoading) return;
    const planLimit = getImageStudioMonthlyLimit(plan);
    if (planLimit > 0) setQuotaLimit(planLimit);
  }, [plan, accessLoading]);

  useEffect(() => {
    uiStateHydratedRef.current = false;
    setUiPersistReady(false);

    if (!session?.user?.id) {
      setUiPersistReady(true);
      return;
    }

    const saved = loadImageStudioUiState(session.user.id);
    if (saved) {
      if (typeof saved.prompt === "string") setPrompt(saved.prompt);
      if (saved.model) setModel(saved.model);
      if (saved.aspectRatio) setAspectRatio(saved.aspectRatio);
      if (saved.generationCount) setGenerationCount(saved.generationCount);
      if (typeof saved.thumbScrollTop === "number") {
        thumbScrollTopRef.current = saved.thumbScrollTop;
        setRestoreThumbScrollTop(saved.thumbScrollTop);
      }
      if (typeof saved.feedScrollTop === "number") {
        feedScrollTopRef.current = saved.feedScrollTop;
        setRestoreFeedScrollTop(saved.feedScrollTop);
      }
      if (saved.activeHistoryId) setActiveHistoryId(saved.activeHistoryId);
    }

    uiStateHydratedRef.current = true;
    setUiPersistReady(true);
  }, [session?.user?.id]);

  useLayoutEffect(() => {
    if (!session?.user?.id) return;

    const cached = applyImageStudioHistoryCache(session.user.id);
    if (cached?.length) {
      setHistory(cached);
      setFeedRows(mergeFeedRowsFromHistory(cached, []));
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || history.length === 0) return;
    saveImageStudioHistoryCache(session.user.id, history);
  }, [history, session?.user?.id]);

  useEffect(() => {
    const onPersist = () => persistUiState();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onPersist();
    };
    window.addEventListener("beforeunload", onPersist);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onPersist);
      document.removeEventListener("visibilitychange", onVisibility);
      onPersist();
    };
  }, [persistUiState]);

  useEffect(() => {
    if (!uiPersistReady) return;
    persistUiState();
  }, [
    uiPersistReady,
    activeHistoryId,
    prompt,
    model,
    aspectRatio,
    generationCount,
    persistUiState,
  ]);

  const loadHistory = useCallback(async (options = {}) => {
    const { syncFeed = false, silent = false } = options;
    if (!session?.user?.id) {
      if (authLoading) return [];
      setHistory([]);
      if (syncFeed) setFeedRows([]);
      return [];
    }

    const hasCachedHistory = Boolean(applyImageStudioHistoryCache(session.user.id)?.length);
    if (!silent && !hasCachedHistory) {
      setHistoryLoading(true);
    }

    try {
      const rows = await listImageStudioHistory();
      setHistory(rows);
      if (rows.length > 0) {
        saveImageStudioHistoryCache(session.user.id, rows);
      }
      if (syncFeed) {
        setFeedRows((prev) => mergeFeedRowsFromHistory(rows, prev));
        if (session?.user?.id) {
          const saved = loadImageStudioUiState(session.user.id);
          const savedActive = saved?.activeHistoryId;
          if (savedActive && rows.some((row) => row.id === savedActive)) {
            setActiveHistoryId(savedActive);
          }
        }
      }
      return rows;
    } catch {
      setHistory([]);
      if (syncFeed) setFeedRows([]);
      return [];
    } finally {
      setHistoryLoading(false);
    }
  }, [session?.user?.id, authLoading]);

  useEffect(() => {
    if (authLoading || !session?.user?.id) return;
    setFeedRows((prev) => mergeFeedRowsFromHistory(history, prev));
  }, [history, authLoading, session?.user?.id]);

  useEffect(() => {
    let active = true;
    setModelsLoading(true);
    fetchImageStudioModels()
      .then((models) => {
        if (!active) return;
        setModelsAvailability(models);
        setModel((current) => (models[current] ? current : pickDefaultModel(models)));
      })
      .finally(() => {
        if (active) setModelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadQuota = useCallback(async () => {
    if (!session?.user?.id || !hasImagePlan) {
      setQuotaCount(0);
      setQuotaLoading(false);
      return;
    }
    setQuotaLoading(true);
    try {
      const quota = await fetchImageStudioQuota();
      setQuotaCount(quota.count);
      setQuotaLimit(quota.limit);
      setQuotaResetAt(quota.resetAt);
      setQuotaMode(quota.mode);
      setQuotaCycleEndsAt(quota.cycleEndsAt);
    } catch {
      setQuotaCount(0);
    } finally {
      setQuotaLoading(false);
    }
  }, [session?.user?.id, hasImagePlan]);

  useEffect(() => {
    if (authLoading) return;
    void loadQuota();
    if (!session?.user?.id) return;
    const hasCache = Boolean(applyImageStudioHistoryCache(session.user.id)?.length);
    void loadHistory({ syncFeed: true, silent: hasCache });
  }, [authLoading, loadQuota, loadHistory, session?.user?.id]);

  useEffect(() => {
    const refreshHistory = () => {
      if (document.visibilityState !== "visible" || authLoading || !session?.user?.id) {
        return;
      }
      void loadHistory({ syncFeed: true });
    };
    document.addEventListener("visibilitychange", refreshHistory);
    window.addEventListener("focus", refreshHistory);
    return () => {
      document.removeEventListener("visibilitychange", refreshHistory);
      window.removeEventListener("focus", refreshHistory);
    };
  }, [authLoading, session?.user?.id, loadHistory]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (authLoading || !userId) return;

    return subscribeImageStudioHistory(userId, {
      onInsert: (item) => {
        setHistory((prev) => {
          if (prev.some((row) => row.id === item.id)) return prev;
          return [item, ...prev];
        });
        setScrollToEndToken((token) => token + 1);
      },
      onUpdate: (item) => {
        setHistory((prev) =>
          prev.map((row) => (row.id === item.id ? { ...row, ...item } : row)),
        );
      },
      onDelete: (id) => {
        setHistory((prev) => prev.filter((row) => row.id !== id));
        setFeedRows((prev) =>
          prev
            .map((row) => ({
              ...row,
              images: row.images.filter((image) => image.historyId !== id),
            }))
            .filter((row) => row.images.length > 0 || row.generating),
        );
        setActiveHistoryId((current) => (current === id ? null : current));
      },
    });
  }, [authLoading, session?.user?.id, loadHistory]);

  const quotaAlertCycleKey =
    quotaMode === "trial" ? quotaCycleEndsAt : quotaResetAt;

  useEffect(() => {
    if (!hasImagePlan || quotaLoading) return;

    if (quotaCount >= quotaLimit) {
      if (!wasImageStudioAlertDismissed("exhausted", quotaAlertCycleKey)) {
        setQuotaAlert("exhausted");
      }
      return;
    }

    if (shouldShowImageStudioLowQuotaWarning(quotaCount, quotaLimit)) {
      if (!wasImageStudioAlertDismissed("warning", quotaAlertCycleKey)) {
        setQuotaAlert("warning");
      }
    }
  }, [hasImagePlan, quotaCount, quotaLimit, quotaLoading, quotaAlertCycleKey]);

  const closeQuotaAlert = useCallback(() => {
    if (quotaAlert) {
      dismissImageStudioAlert(quotaAlert, quotaAlertCycleKey);
    }
    setQuotaAlert(null);
  }, [quotaAlert, quotaAlertCycleKey]);

  const resizePromptTextarea = useCallback(() => {
    const el = promptInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const style = window.getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    const maxHeight = lineHeight * PROMPT_MAX_ROWS + paddingTop + paddingBottom;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    resizePromptTextarea();
  }, [prompt, resizePromptTextarea]);

  const quotaReached = hasImagePlan && quotaCount >= quotaLimit;
  const quotaHeadroom = hasImagePlan ? Math.max(0, quotaLimit - quotaCount) : 4;
  const maxGenerationCount = Math.min(4, Math.max(quotaHeadroom, 1));
  const canRunGeneration =
    Boolean(prompt.trim()) &&
    !generating &&
    !quotaReached &&
    generationCount <= quotaHeadroom &&
    Boolean(modelsAvailability[model]) &&
    !accessLoading &&
    !authLoading &&
    !(studioTab === "projects" && !openProject);
  const canClickGenerate = hasImagePlan
    ? canRunGeneration
    : !generating && !accessLoading && !(studioTab === "projects" && !openProject);

  useEffect(() => {
    if (generationCount > maxGenerationCount) {
      setGenerationCount(maxGenerationCount);
    }
  }, [generationCount, maxGenerationCount]);

  const openAvatarLibrary = useCallback(() => {
    void runWithAuth(() => {
      setAvatarLibraryOpen(true);
      return true;
    });
  }, [runWithAuth]);

  const handleAvatarLibrarySelect = useCallback((url) => {
    setReferenceImage(url);
    setReferencePreview(url);
    setError(null);
  }, []);

  const clearReference = useCallback(() => {
    setReferenceImage(null);
    setReferencePreview(null);
  }, []);

  const openPromptImport = useCallback(() => {
    promptImportInputRef.current?.click();
  }, []);

  const handlePromptImportChange = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!isSupportedImageStudioReferenceMime(file.type)) {
      setError(IMAGE_STUDIO_REF_IMPORT_MESSAGE);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const dataUrl = String(reader.result || "");
          if (!dataUrl) return;

          const userId = session?.user?.id;
          if (!userId) {
            setImportedRefImage(dataUrl);
            setImportedRefPreview(dataUrl);
            setError(null);
            return;
          }

          const publicUrl = await uploadImageStudioReferenceUrl(userId, dataUrl);
          setImportedRefImage(publicUrl);
          setImportedRefPreview(publicUrl);
          setError(null);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible d'importer l'image de référence.",
          );
        }
      })();
    };
    reader.readAsDataURL(file);
  }, [session?.user?.id]);

  const clearImportedRef = useCallback(() => {
    setImportedRefImage(null);
    setImportedRefPreview(null);
    setSelectedProjectNodeId(null);
    selectedProjectNodeRef.current = null;
  }, []);

  const clearImportedRefAndMention = useCallback(() => {
    clearImportedRef();
    setPrompt((current) => removePromptMentionToken(current, "@Image1"));
    window.requestAnimationFrame(() => {
      resizePromptTextarea();
    });
  }, [clearImportedRef, resizePromptTextarea]);

  const openProductLibrary = useCallback(() => {
    void runWithAuth(() => {
      setProductLibraryOpen(true);
      return true;
    });
  }, [runWithAuth]);

  const handleProductLibrarySelect = useCallback((url) => {
    setProductImage(url);
    setProductPreview(url);
    setError(null);
  }, []);

  const clearProduct = useCallback(() => {
    setProductImage(null);
    setProductPreview(null);
    setProductFocus(null);
  }, []);

  const handleGuideApplyPrompt = useCallback((payload) => {
    const {
      prompt: nextPrompt,
      productImageUrl,
      productFocus: nextProductFocus,
      importedRefImageUrl,
    } = resolveImageStudioGuideApplyPayload(payload);
    setPrompt(nextPrompt);
    if (productImageUrl) {
      setProductImage(productImageUrl);
      setProductPreview(productImageUrl);
      setProductFocus(nextProductFocus);
      setError(null);
    } else if (nextProductFocus) {
      setProductFocus(nextProductFocus);
    }
    if (importedRefImageUrl) {
      setImportedRefImage(importedRefImageUrl);
      setImportedRefPreview(importedRefImageUrl);
      setError(null);
    }
  }, []);

  const handlePromptAssistApply = useCallback((payload) => {
    const {
      prompt: nextPrompt,
      productImageUrl,
      productFocus: nextProductFocus,
      importedRefImageUrl,
    } = resolveImageStudioGuideApplyPayload(payload);
    setPrompt(nextPrompt);
    if (productImageUrl) {
      setProductImage(productImageUrl);
      setProductPreview(productImageUrl);
      setProductFocus(nextProductFocus);
      setError(null);
    } else if (nextProductFocus) {
      setProductFocus(nextProductFocus);
    }
    if (importedRefImageUrl) {
      setImportedRefImage(importedRefImageUrl);
      setImportedRefPreview(importedRefImageUrl);
      setError(null);
    }
    window.requestAnimationFrame(() => {
      resizePromptTextarea();
      promptInputRef.current?.focus();
    });
  }, [resizePromptTextarea]);

  const handleFeedScroll = useCallback(
    (scrollTop) => {
      feedScrollTopRef.current = scrollTop;
      scheduleScrollPersist();
    },
    [scheduleScrollPersist],
  );

  const handleThumbScroll = useCallback(
    (scrollTop) => {
      thumbScrollTopRef.current = scrollTop;
      scheduleScrollPersist();
    },
    [scheduleScrollPersist],
  );

  const focusHistoryImageInCanvas = useCallback((item) => {
    const url = getImageUrlFromHistory(item);
    if (!url) return;
    setActiveHistoryId(item.id);

    window.requestAnimationFrame(() => {
      feedPanelRef.current?.scrollToItem(item, { behavior: "smooth" });
    });
  }, []);

  const openImagePreview = useCallback(
    ({ url, historyId, prompt: rowPrompt, model: rowModel, aspectRatio: rowRatio }) => {
      const imageUrl = typeof url === "string" ? url.trim() : "";
      if (!imageUrl) return;

      const historyItem = findHistoryItemForImage(history, { historyId, url: imageUrl });
      const previewItem = historyItem ?? {
        id: historyId || imageUrl,
        input: rowPrompt || "",
        output: imageUrl,
        metadata: {
          aspectRatio: rowRatio,
          imageStudioModel: rowModel,
        },
      };

      if (historyId) setActiveHistoryId(historyId);
      setPreviewState({ url: imageUrl, item: previewItem });
    },
    [history],
  );

  const closeImagePreview = useCallback(() => {
    setPreviewState(null);
  }, []);

  const applyRefImageToPromptSlot = useCallback((url) => {
    const imageUrl = typeof url === "string" ? url.trim() : "";
    if (!imageUrl) return;
    setImportedRefImage(imageUrl);
    setImportedRefPreview(imageUrl);
    setError(null);
    closeImagePreview();
  }, [closeImagePreview]);

  const recreateFromPreviewItem = useCallback(
    (item) => {
      if (!item) return;

      const promptText = getImageStudioUserPrompt(item.input);
      if (promptText) setPrompt(promptText);

      const ratio = item.metadata?.aspectRatio;
      if (ASPECT_RATIOS.includes(ratio)) {
        setAspectRatio(ratio);
      }

      const histModel = item.metadata?.imageStudioModel;
      if (histModel && modelsAvailability[histModel]) {
        setModel(histModel);
      }

      const refs = getGenerationRefsFromHistory(item);
      if (refs.importedRefUrl) {
        setImportedRefImage(refs.importedRefUrl);
        setImportedRefPreview(refs.importedRefUrl);
      } else {
        clearImportedRef();
      }

      if (refs.avatarUrl) {
        setReferenceImage(refs.avatarUrl);
        setReferencePreview(refs.avatarUrl);
      } else {
        clearReference();
      }

      if (refs.productUrl) {
        setProductImage(refs.productUrl);
        setProductPreview(refs.productUrl);
      } else {
        clearProduct();
      }

      if (item.id) setActiveHistoryId(item.id);
      setError(null);
      closeImagePreview();
    },
    [modelsAvailability, clearImportedRef, clearReference, clearProduct, closeImagePreview],
  );

  const handleTabChange = useCallback((tab) => {
    if (isMobileLayout && tab === "projects") return;
    setActiveTab(tab);
    if (tab === "generation") {
      setOpenProject(null);
      setSelectedProjectNodeId(null);
      selectedProjectNodeRef.current = null;
    }
  }, [isMobileLayout]);

  const handleCreateProject = useCallback(async () => {
    const created = await createImageStudioProject(t("imageStudio.defaultProjectName"));
    if (!created) return null;
    setProjects((prev) => [created, ...prev]);
    return created;
  }, [t]);

  const handleRenameProject = useCallback(async (projectId, name) => {
    const updated = await renameImageStudioProject(projectId, name);
    if (!updated) return;
    setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
    setOpenProject((cur) => (cur?.id === projectId ? updated : cur));
  }, []);

  const handleDeleteProject = useCallback(async (projectId) => {
    await deleteImageStudioProject(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setOpenProject((cur) => {
      if (cur?.id !== projectId) return cur;
      setSelectedProjectNodeId(null);
      selectedProjectNodeRef.current = null;
      return null;
    });
  }, []);

  const handleOpenProject = useCallback((project) => {
    setOpenProject(project);
    setSelectedProjectNodeId(null);
    selectedProjectNodeRef.current = null;
    projectNodeCountRef.current = 0;
    setProjectCanvasReloadToken((n) => n + 1);
  }, []);

  const handleBackToProjects = useCallback(() => {
    setOpenProject(null);
    setSelectedProjectNodeId(null);
    selectedProjectNodeRef.current = null;
    void loadProjects();
  }, [loadProjects]);

  const handleSelectProjectNode = useCallback(
    (payload) => {
      if (!payload?.imageUrl) {
        setSelectedProjectNodeId(null);
        selectedProjectNodeRef.current = null;
        return;
      }
      setSelectedProjectNodeId(payload.nodeId);
      selectedProjectNodeRef.current = {
        nodeId: payload.nodeId,
        imageUrl: payload.imageUrl,
        pos_x: payload.posX ?? 0,
        pos_y: payload.posY ?? 0,
      };
      setImportedRefImage(payload.imageUrl);
      setImportedRefPreview(payload.imageUrl);
      setError(null);
      if (!prompt.includes("@Image1")) {
        insertPromptMentionAtCursor(promptInputRef, "@Image1");
      }
      window.requestAnimationFrame(() => {
        promptInputRef.current?.focus();
      });
    },
    [prompt],
  );

  const handleProjectCanvasChanged = useCallback(() => {
    void loadProjects();
  }, [loadProjects]);

  const readFileAsDataUrl = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
      reader.readAsDataURL(file);
    });
  }, []);

  const uploadDroppedImageFile = useCallback(
    async (file) => {
      if (!isSupportedImageStudioReferenceMime(file.type)) {
        throw new Error(IMAGE_STUDIO_REF_IMPORT_MESSAGE);
      }
      const userId = session?.user?.id;
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) throw new Error("Lecture du fichier impossible.");
      if (!userId) return dataUrl;
      return uploadImageStudioReferenceUrl(userId, dataUrl);
    },
    [session?.user?.id, readFileAsDataUrl],
  );

  const handleDropHistoryOnFolder = useCallback(
    async (project, payload) => {
      if (!project?.id || !payload?.imageUrl) return;
      try {
        await addImageToImageStudioProject({
          projectId: project.id,
          imageUrl: payload.imageUrl,
          prompt: payload.prompt || null,
          historyId: payload.historyId || null,
        });
        setProjects((prev) =>
          prev.map((p) =>
            p.id === project.id
              ? {
                  ...p,
                  cover_url: payload.imageUrl,
                  updated_at: new Date().toISOString(),
                }
              : p,
          ),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Impossible d'ajouter l'image au projet.",
        );
      }
    },
    [],
  );

  const handleDropFileOnFolder = useCallback(
    async (project, file) => {
      if (!project?.id || !file) return;
      try {
        const imageUrl = await uploadDroppedImageFile(file);
        await addImageToImageStudioProject({
          projectId: project.id,
          imageUrl,
          prompt: file.name || null,
          historyId: null,
        });
        setProjects((prev) =>
          prev.map((p) =>
            p.id === project.id
              ? {
                  ...p,
                  cover_url: imageUrl,
                  updated_at: new Date().toISOString(),
                }
              : p,
          ),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Impossible d'ajouter l'image au projet.",
        );
      }
    },
    [uploadDroppedImageFile],
  );

  const handleDropHistoryOnCanvas = useCallback(
    async (payload, flowPos) => {
      if (!openProject?.id || !payload?.imageUrl) return;
      try {
        await addImageToImageStudioProject({
          projectId: openProject.id,
          imageUrl: payload.imageUrl,
          prompt: payload.prompt || null,
          historyId: payload.historyId || null,
          posX: flowPos?.x,
          posY: flowPos?.y,
        });
        setOpenProject((cur) =>
          cur ? { ...cur, cover_url: payload.imageUrl } : cur,
        );
        setProjectCanvasReloadToken((n) => n + 1);
        void loadProjects();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Impossible d'ajouter l'image au projet.",
        );
      }
    },
    [openProject?.id, loadProjects],
  );

  const handleDropFileOnCanvas = useCallback(
    async (file, flowPos) => {
      if (!openProject?.id || !file) return;
      try {
        const imageUrl = await uploadDroppedImageFile(file);
        await addImageToImageStudioProject({
          projectId: openProject.id,
          imageUrl,
          prompt: file.name || null,
          historyId: null,
          posX: flowPos?.x,
          posY: flowPos?.y,
        });
        setOpenProject((cur) => (cur ? { ...cur, cover_url: imageUrl } : cur));
        setProjectCanvasReloadToken((n) => n + 1);
        void loadProjects();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Impossible d'ajouter l'image au projet.",
        );
      }
    },
    [openProject?.id, uploadDroppedImageFile, loadProjects],
  );

  const appendGeneratedImagesToProject = useCallback(
    async (results, trimmedPrompt) => {
      if (!openProject?.id || !results.length) return;

      const canvas = await loadImageStudioProjectCanvas(openProject.id);
      projectNodeCountRef.current = canvas.nodes.length;

      const sourceRef = selectedProjectNodeRef.current;
      const sourceNode = sourceRef?.nodeId
        ? canvas.nodes.find((n) => n.id === sourceRef.nodeId)
        : null;
      const sourcePos = sourceNode
        ? { pos_x: sourceNode.pos_x, pos_y: sourceNode.pos_y }
        : sourceRef
          ? { pos_x: sourceRef.pos_x ?? 0, pos_y: sourceRef.pos_y ?? 0 }
          : null;

      const positions = nextNodePositions(
        results.length,
        sourcePos,
        canvas.nodes.length,
      );

      const createdNodes = [];
      for (let i = 0; i < results.length; i += 1) {
        const result = results[i];
        const pos = positions[i];
        const node = await createImageStudioProjectNode({
          projectId: openProject.id,
          imageUrl: result.url,
          prompt: trimmedPrompt,
          historyId: result.historyId ?? null,
          posX: pos.posX,
          posY: pos.posY,
        });
        if (node) {
          createdNodes.push(node);
          projectNodeCountRef.current += 1;
          if (sourceRef?.nodeId) {
            try {
              await createImageStudioProjectEdge({
                projectId: openProject.id,
                sourceNodeId: sourceRef.nodeId,
                targetNodeId: node.id,
                sourceHandle: "right",
                targetHandle: "left",
                edgeStyle: "arrow",
              });
            } catch {
              // ignore duplicate edges
            }
          }
        }
      }

      if (createdNodes.length > 0) {
        setOpenProject((cur) =>
          cur
            ? { ...cur, cover_url: createdNodes[createdNodes.length - 1].image_url }
            : cur,
        );
        setProjectCanvasReloadToken((n) => n + 1);
        void loadProjects();
      }
    },
    [openProject?.id, loadProjects],
  );

  const handleGenerate = async () => {
    if (!hasImagePlan || !canRunGeneration) return;
    setError(null);

    const trimmedPrompt = prompt.trim();
    const resolved = resolvePromptMentions(trimmedPrompt, {
      avatarUrl: referenceImage,
      productUrl: productImage,
      image1Url: importedRefImage,
      productFocus,
    });

    const generationPrompt = resolved.generationPrompt;

    if (generationPrompt.length > IMAGE_STUDIO_PROMPT_MAX_LENGTH) {
      setError(
        `Prompt trop long (${generationPrompt.length.toLocaleString("fr-FR")} / ${IMAGE_STUDIO_PROMPT_MAX_LENGTH.toLocaleString("fr-FR")} caractères). Raccourcissez le texte.`,
      );
      return;
    }
    const batchId = crypto.randomUUID();
    const generationRefs = {
      avatarUrl: referenceImage || null,
      productUrl: productImage || null,
      importedRefUrl: importedRefImage || null,
    };
    const inProjectMode = studioTab === "projects" && Boolean(openProject?.id);

    setGenerating(true);
    if (!inProjectMode) {
      setFeedRows((prev) => [
        ...prev,
        {
          id: batchId,
          prompt: trimmedPrompt,
          model,
          aspectRatio,
          createdAt: new Date().toISOString(),
          images: [],
          generating: true,
          progress: { current: 0, total: generationCount },
        },
      ]);
    }

    let lastResult = null;
    const projectResults = [];

    try {
      for (let i = 0; i < generationCount; i += 1) {
        if (!inProjectMode) {
          setFeedRows((prev) =>
            prev.map((row) =>
              row.id === batchId
                ? { ...row, progress: { current: i + 1, total: generationCount } }
                : row,
            ),
          );
        }

        const result = await generateImageStudio(
          generationPrompt,
          aspectRatio,
          model,
          null,
          batchId,
          generationRefs,
          resolved.referenceImages.length > 0 ? resolved.referenceImages : null,
          trimmedPrompt,
        );
        lastResult = result;
        setActiveHistoryId(result.historyId ?? null);
        setQuotaCount(result.count);
        projectResults.push(result);

        if (!inProjectMode) {
          setFeedRows((prev) =>
            prev.map((row) =>
              row.id === batchId
                ? {
                    ...row,
                    images: [
                      ...row.images,
                      { url: result.url, historyId: result.historyId },
                    ],
                  }
                : row,
            ),
          );
        }

        if (!result.historyId) {
          await saveImageStudioHistory(
            trimmedPrompt,
            result.url,
            aspectRatio,
            model,
            batchId,
            generationRefs,
          );
        }
      }

      if (inProjectMode) {
        await appendGeneratedImagesToProject(projectResults, trimmedPrompt);
      } else {
        await loadHistory({ syncFeed: true });
        setScrollToEndToken((token) => token + 1);
      }
      setPrompt("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de la génération.";
      if (!lastResult) {
        if (!inProjectMode) {
          setFeedRows((prev) => prev.filter((row) => row.id !== batchId));
        }
        setError(message);
      } else {
        if (inProjectMode && projectResults.length > 0) {
          try {
            await appendGeneratedImagesToProject(projectResults, trimmedPrompt);
          } catch {
            // keep error message below
          }
        }
        setError(
          generationCount > 1
            ? `${message} Les images déjà générées restent visibles.`
            : message,
        );
      }
      trackPostHogError(message, "/image-studio", "generation");
      if (message.includes("ViralWorks Image")) {
        setSubscribeModalOpen(true);
      }
      if (message.includes("Quota mensuel")) {
        setQuotaCount(quotaLimit);
      }
      if (lastResult && !inProjectMode) {
        void loadHistory({ syncFeed: true });
      }
    } finally {
      if (!inProjectMode) {
        setFeedRows((prev) =>
          prev.map((row) =>
            row.id === batchId ? { ...row, generating: false, progress: undefined } : row,
          ),
        );
      }
      setGenerating(false);
    }
  };

  const handleAvatarShortcut = useCallback(() => {
    if (referenceImage) {
      insertPromptMentionAtCursor(promptInputRef, "@Avatar");
      return;
    }
    openAvatarLibrary();
  }, [referenceImage, openAvatarLibrary]);

  const handleProductShortcut = useCallback(() => {
    if (productImage) {
      insertPromptMentionAtCursor(promptInputRef, "@Produit");
      return;
    }
    openProductLibrary();
  }, [productImage, openProductLibrary]);

  const mentionAssets = useMemo(
    () => ({
      avatarUrl: referenceImage,
      productUrl: productImage,
      image1Url: importedRefImage,
      productFocus,
    }),
    [referenceImage, productImage, importedRefImage, productFocus],
  );

  const requestGenerate = () => {
    if (!canClickGenerate) return;

    if (!session) {
      requestPromoModalOpen("acquisition");
      return;
    }

    if (!hasImageStudioPlan(plan)) {
      requestPromoModalOpen("conversion");
      return;
    }

    if (!canRunGeneration) return;

    void handleGenerate();
  };

  return (
    <div className="image-studio-shell flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
            {(() => {
              const title = t("imageStudio.title");
              const lastSpace = title.lastIndexOf(" ");
              if (lastSpace === -1) return title;
              return (
                <>
                  {title.slice(0, lastSpace + 1)}
                  <span className="text-[#2af598]">{title.slice(lastSpace + 1)}</span>
                </>
              );
            })()}
          </h1>
          {isMobileLayout ? (
            <p className="mt-0.5 text-xs text-white/40 sm:text-sm">
              {t("imageStudio.subtitle")}
            </p>
          ) : (
            <ImageStudioModeTabs
              activeTab={activeTab}
              onChange={handleTabChange}
              t={t}
            />
          )}
        </div>
        {hasImagePlan ? (
          <IndicateurCreditsImageStudio
            count={quotaCount}
            limit={quotaLimit}
            loading={quotaLoading}
            mode={quotaMode}
          />
        ) : null}
      </div>

      {hasImagePlan ? (
        <BandeauRenouvellementQuotaImageStudio
          limit={quotaLimit}
          mode={quotaMode}
          cycleEndsAt={quotaCycleEndsAt}
        />
      ) : null}

      <div className="image-studio-main flex min-h-0 flex-1 flex-col">
        <div className="image-studio-workspace flex min-h-0 flex-1 flex-col gap-2 px-4 sm:px-6 lg:px-8">
          <div className="image-studio-canvas image-studio-canvas--feed relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl">
            {studioTab === "generation" ? (
              <>
                <button
                  type="button"
                  className="image-studio-history-fab sm:hidden"
                  onClick={() => setHistorySheetOpen(true)}
                  aria-label={`${t("imageStudio.history")} (${history.length} image${history.length !== 1 ? "s" : ""})`}
                  title={t("imageStudio.history")}
                >
                  <Clock className="h-4 w-4" strokeWidth={2} aria-hidden />
                  {history.length > 0 ? (
                    <span className="image-studio-history-fab-badge" aria-hidden>
                      {history.length > 99 ? "99+" : history.length}
                    </span>
                  ) : null}
                </button>

                <ImageStudioFeedPanel
                  ref={feedPanelRef}
                  feedRows={feedRows}
                  history={history}
                  historyLoading={historyLoading}
                  generating={generating}
                  generationLoadingHint={generationLoadingHint}
                  activeHistoryId={activeHistoryId}
                  onSelectHistoryItem={focusHistoryImageInCanvas}
                  onImageOpen={openImagePreview}
                  restoreFeedScrollTop={restoreFeedScrollTop}
                  restoreThumbScrollTop={restoreThumbScrollTop}
                  scrollToEndToken={scrollToEndToken}
                  onFeedScroll={handleFeedScroll}
                  onThumbScroll={handleThumbScroll}
                />
              </>
            ) : openProject ? (
              <ImageStudioProjectCanvas
                project={openProject}
                reloadToken={projectCanvasReloadToken}
                selectedNodeId={selectedProjectNodeId}
                onSelectNode={handleSelectProjectNode}
                onBack={handleBackToProjects}
                onCanvasChanged={handleProjectCanvasChanged}
                onDropHistoryImage={handleDropHistoryOnCanvas}
                onDropImageFile={handleDropFileOnCanvas}
                t={t}
              />
            ) : (
              <ImageStudioProjectsGrid
                projects={projects}
                loading={projectsLoading}
                onOpen={handleOpenProject}
                onCreate={handleCreateProject}
                onRename={handleRenameProject}
                onDelete={handleDeleteProject}
                onDropHistoryImage={handleDropHistoryOnFolder}
                onDropImageFile={handleDropFileOnFolder}
                t={t}
              />
            )}
          </div>

          {studioTab === "projects" ? (
            <ImageStudioProjectsHistoryStrip
              history={history}
              historyLoading={historyLoading}
              t={t}
            />
          ) : null}

          {studioTab === "projects" && openProject && selectedProjectNodeId ? (
            <p className="image-studio-project-ref-banner shrink-0" role="status">
              {t("imageStudio.projectSelectedAsRef")}
            </p>
          ) : null}

          {error ? (
            <p className="shrink-0 text-sm text-red-400 sm:pb-0" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {/* Mobile : canva (flex) → commande · Desktop : feed puis barre en bas */}
        <div className="image-studio-command-bar z-30 shrink-0 px-3 sm:sticky sm:bottom-0 sm:px-6 lg:px-8">
          <div className="image-studio-command-bar-inner mx-auto max-w-[1400px]">
            <div className="image-studio-command-layout">
              <div className="image-studio-prompt-row">
                <PromptImportSlot
                  preview={importedRefPreview}
                  disabled={generating}
                  onPick={openPromptImport}
                  onClear={clearImportedRefAndMention}
                />

                <input
                  ref={promptImportInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onChange={handlePromptImportChange}
                  className="hidden"
                  aria-hidden
                  tabIndex={-1}
                />

                <ImageStudioPromptInput
                  inputRef={promptInputRef}
                  value={prompt}
                  onChange={setPrompt}
                  onSubmit={requestGenerate}
                  disabled={generating || quotaReached}
                  assets={mentionAssets}
                  placeholder={t("imageStudio.promptPlaceholder")}
                  onOpenAvatarPicker={openAvatarLibrary}
                  onOpenProductPicker={openProductLibrary}
                  onOpenImage1Upload={openPromptImport}
                  onOpenPromptAssist={() => setPromptAssistModalOpen(true)}
                  onResize={resizePromptTextarea}
                />
              </div>

              <div className="image-studio-settings-row">
                <button
                  type="button"
                  className="image-studio-prompt-guide-chip shrink-0"
                  onClick={() => setPromptsModalOpen(true)}
                  disabled={generating}
                  title="Choisir un type d'image — l'assistant remplit le prompt"
                  aria-label="Choisir un type d'image — l'assistant remplit le prompt"
                >
                  <Sparkles className="image-studio-prompt-guide-chip-icon" strokeWidth={2} aria-hidden />
                  <span>{t("imageStudio.promptAssistant")}</span>
                </button>

                <div className="image-studio-settings-desktop">
                  <ModelDropdown
                    value={model}
                    onChange={setModel}
                    availability={modelsAvailability}
                    disabled={generating}
                    loading={modelsLoading}
                  />

                  <AspectRatioDropdown
                    value={aspectRatio}
                    onChange={setAspectRatio}
                    disabled={generating}
                  />

                  <GenerationCountDropdown
                    value={generationCount}
                    onChange={setGenerationCount}
                    disabled={generating}
                    maxCount={maxGenerationCount}
                  />
                </div>

                <button
                  type="button"
                  className="image-studio-settings-mobile-btn"
                  onClick={() => setMobileSettingsOpen(true)}
                  disabled={generating}
                  aria-label="Ouvrir les réglages : modèle, format et générations"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                  <span>{t("imageStudio.settings")}</span>
                </button>
              </div>

              <div className="image-studio-command-aside shrink-0">
                <div className="image-studio-ref-slots">
                  <ReferenceSlot
                    label={t("imageStudio.avatar")}
                    preview={referencePreview}
                    disabled={generating}
                    onPick={handleAvatarShortcut}
                    onClear={clearReference}
                    imageClassName="[object-position:16%_center]"
                  />

                  <ReferenceSlot
                    label={t("imageStudio.product")}
                    preview={productPreview}
                    disabled={generating}
                    onPick={handleProductShortcut}
                    onClear={clearProduct}
                  />
                </div>

                <button
                  type="button"
                  onClick={requestGenerate}
                  disabled={!canClickGenerate}
                  className="image-studio-generate-btn btn-vws-primary"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    t("imageStudio.generate")
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      <ModalBibliothequeAvatars
        open={avatarLibraryOpen}
        onClose={() => setAvatarLibraryOpen(false)}
        onSelect={handleAvatarLibrarySelect}
      />

      <ModalBibliothequeProduits
        open={productLibraryOpen}
        onClose={() => setProductLibraryOpen(false)}
        onSelect={handleProductLibrarySelect}
        onDeleted={(url) => {
          if (productImage === url || productPreview === url) clearProduct();
        }}
      />

      <ModalQuotaImageStudio
        open={hasImagePlan && quotaAlert !== null}
        kind={quotaAlert ?? "warning"}
        count={quotaCount}
        limit={quotaLimit}
        mode={quotaMode}
        onClose={closeQuotaAlert}
      />

      <ModalAbonnementImageStudio
        open={subscribeModalOpen}
        onClose={() => setSubscribeModalOpen(false)}
      />

      <ModalPromptsImageStudio
        open={promptsModalOpen}
        onClose={() => setPromptsModalOpen(false)}
        onApplyPrompt={handleGuideApplyPrompt}
      />

      <ModalPromptAssistImageStudio
        open={promptAssistModalOpen}
        onClose={() => setPromptAssistModalOpen(false)}
        onApplyPrompt={handlePromptAssistApply}
      />

      <ModalImageStudioPreview
        open={Boolean(previewState)}
        item={previewState?.item ?? null}
        imageUrl={previewState?.url ?? null}
        onClose={closeImagePreview}
        onRecreateContext={recreateFromPreviewItem}
        onUseAsReference={applyRefImageToPromptSlot}
      />

      <SheetHistoriqueImageStudio
        open={historySheetOpen}
        onClose={() => setHistorySheetOpen(false)}
        history={history}
        historyLoading={historyLoading}
        activeHistoryId={activeHistoryId}
        onSelectItem={focusHistoryImageInCanvas}
        scrollToStartToken={scrollToEndToken}
      />

      <SheetReglagesImageStudio
        open={mobileSettingsOpen}
        onClose={() => setMobileSettingsOpen(false)}
        model={model}
        onModelChange={setModel}
        modelOptions={IMAGE_STUDIO_MODEL_OPTIONS}
        modelsAvailability={modelsAvailability}
        modelsLoading={modelsLoading}
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        aspectRatios={ASPECT_RATIOS}
        generationCount={generationCount}
        onGenerationCountChange={setGenerationCount}
        generationCounts={GENERATION_COUNTS}
        maxGenerationCount={maxGenerationCount}
        disabled={generating}
      />
    </div>
  );
}
