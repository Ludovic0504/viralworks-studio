import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Crop,
  ImageIcon,
  Loader2,
  Plus,
  Wand2,
  X,
} from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { useBoutiqueModal } from "@/contexte/ContexteModalBoutique";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { hasImageStudioPlan } from "@/bibliotheque/supabase/premiumAccess";
import {
  fetchImageStudioQuota,
  IMAGE_STUDIO_MONTHLY_LIMIT,
} from "@/bibliotheque/supabase/imageStudioQuota";
import {
  fetchImageStudioModels,
  generateImageStudio,
} from "@/bibliotheque/imageStudio/generateImageStudio";
import {
  getImageUrlFromHistory,
  listImageStudioHistory,
  saveImageStudioHistory,
} from "@/bibliotheque/imageStudio/imageStudioHistory";
import ModalBibliothequeAvatars from "@/composants/studio/avatar/ModalBibliothequeAvatars";
import ModalBibliothequeProduits from "@/composants/studio/product/ModalBibliothequeProduits";
import { capturePostHog, trackPostHogError } from "@/bibliotheque/posthog/client";

const ASPECT_RATIOS = ["1:1", "9:16", "16:9"];

const MODEL_OPTIONS = [
  { id: "nano_banana_pro", label: "NanaBanana Pro" },
  { id: "hailuo", label: "Hailuo Image" },
  { id: "gpt_image_2", label: "GPT Image 2.0" },
];

const DEFAULT_MODELS = {
  nano_banana_pro: false,
  hailuo: false,
  gpt_image_2: false,
};

const PROMPT_MAX_ROWS = 10;
const NBPRO_THROTTLE_THRESHOLD = 150;
const NBPRO_MIN_LOADER_MS = 30_000;

function pickDefaultModel(availability) {
  for (const opt of MODEL_OPTIONS) {
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

function CommandBarDropdownMenu({ open, anchorRef, menuRef, children, role = "listbox" }) {
  const { menuStyle, useFixedMenu } = useCommandBarDropdownMenu(open, anchorRef, menuRef);

  if (!open) return null;

  const menu = (
    <div
      ref={menuRef}
      className={`image-studio-dropdown-menu${useFixedMenu ? " is-fixed" : ""}`}
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
  const selected = MODEL_OPTIONS.find((o) => o.id === value);

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
        <Wand2 className="image-studio-setting-pill-icon" strokeWidth={2} aria-hidden />
        <span className="image-studio-setting-pill-label max-w-[6.5rem] truncate sm:max-w-[8rem]">
          {loading ? "…" : selected?.label ?? "Modèle"}
        </span>
        <ChevronDown
          className={`image-studio-setting-pill-chevron h-3.5 w-3.5 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2.25}
        />
      </button>

      <CommandBarDropdownMenu open={open} anchorRef={rootRef} menuRef={menuRef}>
        {MODEL_OPTIONS.map((opt) => {
          const available = availability[opt.id];
          return (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={value === opt.id}
              disabled={!available}
              className={`image-studio-dropdown-option ${value === opt.id ? "is-selected" : ""}`}
              onClick={() => {
                if (!available) return;
                onChange(opt.id);
                setOpen(false);
              }}
            >
              <span>{opt.label}</span>
              {!available ? <span className="image-studio-dropdown-soon">Bientôt</span> : null}
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

function PromptImportSlot({ preview, disabled, onPick, onClear }) {
  return (
    <div className="image-studio-prompt-import shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={onPick}
        className={`image-studio-add-btn ${preview ? "has-ref" : ""}`}
        title={preview ? "Image importée — cliquer pour remplacer" : "Importer une image depuis l'appareil"}
        aria-label={
          preview ? "Image importée — cliquer pour remplacer" : "Importer une image depuis l'appareil"
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
  const navigate = useNavigate();
  const { openBoutiqueModal } = useBoutiqueModal();
  const promptInputRef = useRef(null);
  const promptImportInputRef = useRef(null);
  const { session } = useAuth();
  const { runWithAuth } = useRequireAuthAction();
  const { plan, loading: accessLoading } = usePremiumAccess();
  const [prompt, setPrompt] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
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
  const [model, setModel] = useState("nano_banana_pro");
  const [modelsAvailability, setModelsAvailability] = useState(DEFAULT_MODELS);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [quotaCount, setQuotaCount] = useState(0);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    capturePostHog("image_studio_opened");
  }, []);

  useEffect(() => {
    if (accessLoading) return;
    if (!hasImageStudioPlan(plan)) {
      openBoutiqueModal("subscription");
      navigate("/", { replace: true });
    }
  }, [accessLoading, plan, navigate, openBoutiqueModal]);

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
    if (!session?.user?.id) {
      setQuotaCount(0);
      setQuotaLoading(false);
      return;
    }
    setQuotaLoading(true);
    try {
      const quota = await fetchImageStudioQuota();
      setQuotaCount(quota.count);
    } catch {
      setQuotaCount(0);
    } finally {
      setQuotaLoading(false);
    }
  }, [session?.user?.id]);

  const loadHistory = useCallback(async () => {
    if (!session?.user?.id) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const rows = await listImageStudioHistory();
      setHistory(rows);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    void loadQuota();
    void loadHistory();
  }, [loadQuota, loadHistory]);

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

  const quotaReached = quotaCount >= IMAGE_STUDIO_MONTHLY_LIMIT;
  const modelAvailable = modelsAvailability[model];
  const canGenerate =
    Boolean(prompt.trim()) &&
    !generating &&
    !quotaReached &&
    modelAvailable &&
    !accessLoading &&
    hasImageStudioPlan(plan);

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

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) return;
      setImportedRefImage(dataUrl);
      setImportedRefPreview(dataUrl);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

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

  const selectHistoryItem = (item) => {
    const url = getImageUrlFromHistory(item);
    if (!url) return;
    setPreviewUrl(url);
    setActiveHistoryId(item.id);
    if (item.input) setPrompt(item.input);
    const ratio = item.metadata?.aspectRatio;
    if (ratio === "1:1" || ratio === "9:16" || ratio === "16:9") {
      setAspectRatio(ratio);
    }
    const histModel = item.metadata?.imageStudioModel;
    if (histModel && modelsAvailability[histModel]) {
      setModel(histModel);
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setError(null);
    setGenerating(true);
    const shouldThrottleNbPro =
      model === "nano_banana_pro" && quotaCount >= NBPRO_THROTTLE_THRESHOLD;
    try {
      const [result] = await Promise.all([
        generateImageStudio(
          prompt,
          aspectRatio,
          model,
          importedRefImage || referenceImage,
        ),
        shouldThrottleNbPro
          ? new Promise((resolve) => setTimeout(resolve, NBPRO_MIN_LOADER_MS))
          : Promise.resolve(),
      ]);
      setPreviewUrl(result.url);
      setActiveHistoryId(null);
      setQuotaCount(result.count);
      await saveImageStudioHistory(prompt, result.url, aspectRatio, model);
      void loadHistory();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de la génération.";
      setError(message);
      trackPostHogError(message, "/image-studio", "generation");
      if (message.includes("Quota mensuel")) {
        setQuotaCount(IMAGE_STUDIO_MONTHLY_LIMIT);
      }
    } finally {
      setGenerating(false);
    }
  };

  const requestGenerate = () => {
    void runWithAuth(handleGenerate);
  };

  const onPromptKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      requestGenerate();
    }
  };

  if (!accessLoading && !hasImageStudioPlan(plan)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2af598]" aria-hidden />
      </div>
    );
  }

  return (
    <div className="image-studio-shell flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
            Image <span className="text-[#2af598]">Studio</span>
          </h1>
          <p className="mt-0.5 text-xs text-white/40 sm:text-sm">
            Décrivez votre scène — l&apos;IA génère l&apos;image
          </p>
        </div>
        {quotaReached ? (
          <span className="hidden rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200 sm:inline">
            Quota mensuel atteint
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3 sm:px-6 lg:flex-row lg:gap-4 lg:px-8">
        {/* Canvas — colonne gauche ~72% */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 lg:w-[72%] lg:flex-none">
          <div className="image-studio-canvas relative flex min-h-[min(55vh,480px)] flex-1 items-center justify-center overflow-hidden rounded-2xl lg:min-h-[min(72vh,720px)]">
            {generating && !previewUrl ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="h-11 w-11 animate-spin rounded-full border-2 border-[#2af598]/20 border-t-[#2af598]" />
                <p className="text-sm text-white/45">Génération en cours…</p>
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Image générée"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-center opacity-50">
                <ImageIcon className="h-10 w-10 text-white/15" strokeWidth={1} />
                <p className="text-sm text-white/30">Votre image apparaîtra ici</p>
              </div>
            )}

            {generating && previewUrl ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#2af598]/20 border-t-[#2af598]" />
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="shrink-0 text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {/* Historique — colonne droite ~28% */}
        <aside className="image-studio-history-panel flex min-h-0 flex-col lg:w-[28%] lg:shrink-0 lg:self-stretch">
          <p className="shrink-0 px-3 pt-3 text-[11px] font-medium tracking-wide text-white/35">
            Historique
          </p>
          <div className="studio-subtle-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-2">
            {historyLoading && history.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-xs text-white/30">
                Chargement…
              </div>
            ) : history.length === 0 ? (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-white/10 px-3 text-center text-xs text-white/30">
                Aucune génération pour l&apos;instant
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {history.map((item) => {
                  const thumbUrl = getImageUrlFromHistory(item);
                  if (!thumbUrl) return null;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectHistoryItem(item)}
                      className={`image-studio-history-thumb aspect-[4/3] w-full ${
                        activeHistoryId === item.id ? "is-active" : ""
                      }`}
                      title={item.input || "Image générée"}
                    >
                      <img
                        src={thumbUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Barre de commande — layout type prompt studio */}
      <div className="image-studio-command-bar sticky bottom-0 z-30 shrink-0 px-3 sm:px-6 lg:px-8">
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

              <textarea
                ref={promptInputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={onPromptKeyDown}
                disabled={generating || quotaReached}
                placeholder="Décrivez l'image à générer…"
                aria-label="Prompt de génération"
                rows={1}
                className="image-studio-prompt-input min-w-0 flex-1 resize-none py-1 text-sm leading-relaxed disabled:opacity-50 sm:text-[15px]"
              />
            </div>

            <div className="image-studio-settings-row">
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
            </div>

            <div className="image-studio-command-aside shrink-0">
              <div className="image-studio-ref-slots">
                <ReferenceSlot
                  label="Avatar"
                  preview={referencePreview}
                  disabled={generating}
                  onPick={openAvatarLibrary}
                  onClear={clearReference}
                  imageClassName="[object-position:16%_center]"
                />

                <ReferenceSlot
                  label="Produit"
                  preview={productPreview}
                  disabled={generating}
                  onPick={openProductLibrary}
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
    </div>
  );
}
