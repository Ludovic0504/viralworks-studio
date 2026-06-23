import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Crop,
  Layers2,
  Loader2,
  Plus,
  SlidersHorizontal,
  Wand2,
  X,
} from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { hasImageStudioPlan } from "@/bibliotheque/supabase/premiumAccess";
import {
  fetchImageStudioQuota,
  IMAGE_STUDIO_MONTHLY_LIMIT,
} from "@/bibliotheque/supabase/imageStudioQuota";
import { getImageStudioMonthlyLimit } from "@/bibliotheque/supabase/planQuotas";
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
import SheetReglagesImageStudio from "@/composants/image/SheetReglagesImageStudio";
import ImageStudioFeedPanel, {
  scrollImageStudioFeedToItem,
} from "@/composants/image/ImageStudioFeedPanel";
import SheetHistoriqueImageStudio from "@/composants/image/SheetHistoriqueImageStudio";
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
import { groupHistoryIntoFeedRows, mergeFeedRowsFromHistory } from "@/bibliotheque/imageStudio/imageStudioFeed";
import { subscribeImageStudioHistory } from "@/bibliotheque/imageStudio/imageStudioRealtime";
import {
  loadImageStudioUiState,
  saveImageStudioUiState,
} from "@/bibliotheque/imageStudio/imageStudioUiState";
import {
  applyImageStudioHistoryCache,
  saveImageStudioHistoryCache,
} from "@/bibliotheque/imageStudio/imageStudioHistoryCache";
import { resolvePromptMentions, IMAGE_STUDIO_PROMPT_MAX_LENGTH, getImageStudioUserPrompt } from "@/bibliotheque/imageStudio/promptMentions";
import { uploadImageStudioReferenceUrl } from "@/bibliotheque/imageStudio/uploadImageStudioReference";
import ModalBibliothequeAvatars from "@/composants/studio/avatar/ModalBibliothequeAvatars";
import ModalBibliothequeProduits from "@/composants/studio/product/ModalBibliothequeProduits";
import { capturePostHog, trackPostHogError } from "@/bibliotheque/posthog/client";

const ASPECT_RATIOS = ["1:1", "9:16", "16:9"];
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
        title={loading ? "Modèle" : selected?.label ?? "Modèle"}
        aria-label={`Modèle : ${loading ? "chargement" : selected?.label ?? "Modèle"}`}
      >
        {loading ? (
          <Wand2 className="image-studio-setting-pill-icon" strokeWidth={2} aria-hidden />
        ) : (
          <ImageStudioModelIcon modelId={value} size="sm" className="image-studio-setting-pill-model-icon" />
        )}
        <span className="image-studio-setting-pill-label max-w-[6.5rem] truncate sm:max-w-[8rem]">
          {loading ? "…" : selected?.label ?? "Modèle"}
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
                <span className="image-studio-dropdown-soon">Bientôt</span>
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
                <span className="image-studio-dropdown-soon">Quota</span>
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
  return (
    <div className="image-studio-prompt-import shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={onPick}
        className={`image-studio-add-btn ${preview ? "has-ref" : ""}`}
        title={preview ? "Image @Image1 — cliquer pour remplacer" : "Importer une image de référence (@Image1)"}
        aria-label={
          preview ? "Image @Image1 — cliquer pour remplacer" : "Importer une image de référence (@Image1)"
        }
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
          aria-label="Retirer l'image importée"
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
  const [quotaLimit, setQuotaLimit] = useState(IMAGE_STUDIO_MONTHLY_LIMIT);
  const [quotaResetAt, setQuotaResetAt] = useState(null);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [quotaAlert, setQuotaAlert] = useState(null);
  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
  const [promptsModalOpen, setPromptsModalOpen] = useState(false);
  const [previewState, setPreviewState] = useState(null);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [scrollToEndToken, setScrollToEndToken] = useState(0);
  const [restoreFeedScrollTop, setRestoreFeedScrollTop] = useState(undefined);
  const [restoreThumbScrollTop, setRestoreThumbScrollTop] = useState(undefined);
  const feedScrollTopRef = useRef(0);
  const thumbScrollTopRef = useRef(0);
  const uiStateHydratedRef = useRef(false);
  const scrollPersistTimerRef = useRef(null);
  const [uiPersistReady, setUiPersistReady] = useState(false);

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

  useEffect(() => {
    if (!hasImagePlan || quotaLoading) return;

    if (quotaCount >= quotaLimit) {
      if (!wasImageStudioAlertDismissed("exhausted", quotaResetAt)) {
        setQuotaAlert("exhausted");
      }
      return;
    }

    if (shouldShowImageStudioLowQuotaWarning(quotaCount, quotaLimit)) {
      if (!wasImageStudioAlertDismissed("warning", quotaResetAt)) {
        setQuotaAlert("warning");
      }
    }
  }, [hasImagePlan, quotaCount, quotaLimit, quotaLoading, quotaResetAt]);

  const closeQuotaAlert = useCallback(() => {
    if (quotaAlert) {
      dismissImageStudioAlert(quotaAlert, quotaResetAt);
    }
    setQuotaAlert(null);
  }, [quotaAlert, quotaResetAt]);

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
  const modelAvailable = modelsAvailability[model];
  const canGenerate =
    Boolean(prompt.trim()) &&
    !generating &&
    !quotaReached &&
    generationCount <= quotaHeadroom &&
    modelAvailable &&
    !accessLoading;

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
    void runWithAuth(() => {
      promptImportInputRef.current?.click();
      return true;
    });
  }, [runWithAuth]);

  const handlePromptImportChange = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;

    const userId = session?.user?.id;
    if (!userId) {
      setError("Connexion requise pour importer une image de référence.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const dataUrl = String(reader.result || "");
          if (!dataUrl) return;
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
  }, []);

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
  }, []);

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
      scrollImageStudioFeedToItem(item, { behavior: "smooth" });
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
      if (ratio === "1:1" || ratio === "9:16" || ratio === "16:9") {
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

  const handleGenerate = async () => {
    if (!hasImagePlan || !canGenerate) return;
    setError(null);

    const trimmedPrompt = prompt.trim();
    const resolved = resolvePromptMentions(trimmedPrompt, {
      avatarUrl: referenceImage,
      productUrl: productImage,
      image1Url: importedRefImage,
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

    setGenerating(true);
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

    let lastResult = null;

    try {
      for (let i = 0; i < generationCount; i += 1) {
        setFeedRows((prev) =>
          prev.map((row) =>
            row.id === batchId
              ? { ...row, progress: { current: i + 1, total: generationCount } }
              : row,
          ),
        );

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
      await loadHistory({ syncFeed: true });
      setScrollToEndToken((token) => token + 1);
      setPrompt("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de la génération.";
      if (!lastResult) {
        setFeedRows((prev) => prev.filter((row) => row.id !== batchId));
        setError(message);
      } else {
        setError(
          generationCount > 1
            ? `${message} Les images déjà générées restent visibles dans le flux.`
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
      if (lastResult) {
        void loadHistory({ syncFeed: true });
      }
    } finally {
      setFeedRows((prev) =>
        prev.map((row) =>
          row.id === batchId ? { ...row, generating: false, progress: undefined } : row,
        ),
      );
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
    }),
    [referenceImage, productImage, importedRefImage],
  );

  const requestGenerate = () => {
    void runWithAuth(async () => {
      if (accessLoading) return false;
      if (!hasImageStudioPlan(plan)) {
        setSubscribeModalOpen(true);
        return false;
      }
      await handleGenerate();
      return true;
    });
  };

  return (
    <div className="image-studio-shell flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
            Image <span className="text-[#2af598]">Studio</span>
          </h1>
          <p className="mt-0.5 text-xs text-white/40 sm:text-sm">
            Décrivez votre scène — l&apos;IA génère l&apos;image
          </p>
        </div>
        {hasImagePlan ? (
          <IndicateurCreditsImageStudio
            count={quotaCount}
            limit={quotaLimit}
            loading={quotaLoading}
          />
        ) : null}
      </div>

      {hasImagePlan ? <BandeauRenouvellementQuotaImageStudio limit={quotaLimit} /> : null}

      <div className="image-studio-main flex min-h-0 flex-1 flex-col">
        <div className="image-studio-workspace flex min-h-0 flex-1 flex-col gap-2 px-4 sm:px-6 lg:px-8">
          <div className="image-studio-canvas image-studio-canvas--feed relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl sm:min-h-[min(55vh,480px)] lg:min-h-[min(72vh,720px)]">
            <button
              type="button"
              className="image-studio-history-fab sm:hidden"
              onClick={() => setHistorySheetOpen(true)}
              aria-label={`Historique (${history.length} image${history.length !== 1 ? "s" : ""})`}
              title="Historique"
            >
              <Clock className="h-4 w-4" strokeWidth={2} aria-hidden />
              {history.length > 0 ? (
                <span className="image-studio-history-fab-badge" aria-hidden>
                  {history.length > 99 ? "99+" : history.length}
                </span>
              ) : null}
            </button>

            <ImageStudioFeedPanel
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
          </div>

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
                  onClear={clearImportedRef}
                />

                <input
                  ref={promptImportInputRef}
                  type="file"
                  accept="image/*"
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
                  onOpenAvatarPicker={openAvatarLibrary}
                  onOpenProductPicker={openProductLibrary}
                  onOpenImage1Upload={openPromptImport}
                  onResize={resizePromptTextarea}
                />
              </div>

              <div className="image-studio-settings-row">
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

                  <button
                    type="button"
                    className="image-studio-setting-pill image-studio-prompts-btn shrink-0"
                    onClick={() => setPromptsModalOpen(true)}
                    disabled={generating}
                    aria-label="Voir des idées de prompts pour ChatGPT, Claude ou Gemini"
                    title="Idées de prompts (ChatGPT, Claude, Gemini…)"
                  >
                    <BookOpen className="image-studio-setting-pill-icon" strokeWidth={2} aria-hidden />
                    <span className="image-studio-setting-pill-label">Prompts</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="image-studio-settings-mobile-btn"
                  onClick={() => setMobileSettingsOpen(true)}
                  disabled={generating}
                  aria-label="Ouvrir les réglages : modèle, format, générations et prompts"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                  <span>Réglages</span>
                </button>
              </div>

              <div className="image-studio-command-aside shrink-0">
                <div className="image-studio-ref-slots">
                  <ReferenceSlot
                    label="Avatar"
                    preview={referencePreview}
                    disabled={generating}
                    onPick={handleAvatarShortcut}
                    onClear={clearReference}
                    imageClassName="[object-position:16%_center]"
                  />

                  <ReferenceSlot
                    label="Produit"
                    preview={productPreview}
                    disabled={generating}
                    onPick={handleProductShortcut}
                    onClear={clearProduct}
                  />
                </div>

                <button
                  type="button"
                  onClick={requestGenerate}
                  disabled={!canGenerate}
                  className="image-studio-generate-btn btn-vws-primary"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    "Générer"
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
        onClose={closeQuotaAlert}
      />

      <ModalAbonnementImageStudio
        open={subscribeModalOpen}
        onClose={() => setSubscribeModalOpen(false)}
      />

      <ModalPromptsImageStudio
        open={promptsModalOpen}
        onClose={() => setPromptsModalOpen(false)}
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
        blockBackdropClose={promptsModalOpen}
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
        onOpenPrompts={() => setPromptsModalOpen(true)}
        disabled={generating}
      />
    </div>
  );
}
