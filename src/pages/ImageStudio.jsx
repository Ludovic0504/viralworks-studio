import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ImageIcon, ImagePlus, Loader2, X } from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
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
import { capturePostHog, trackPostHogError } from "@/bibliotheque/posthog/client";

const ASPECT_RATIOS = ["1:1", "9:16", "16:9"];

const MODEL_OPTIONS = [
  { id: "nano_banana_pro", label: "NanaBanana Pro" },
  { id: "hailuo", label: "Hailuo Image" },
  { id: "gpt_image_2", label: "GPT Image 2.0" },
];

const DEFAULT_MODELS = {
  nano_banana_pro: true,
  hailuo: false,
  gpt_image_2: false,
};

function pickDefaultModel(availability) {
  for (const opt of MODEL_OPTIONS) {
    if (availability[opt.id]) return opt.id;
  }
  return "nano_banana_pro";
}

function CompactRatioPills({ value, onChange, disabled }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {ASPECT_RATIOS.map((ratio) => (
        <button
          key={ratio}
          type="button"
          disabled={disabled}
          onClick={() => onChange(ratio)}
          className={`image-studio-pill image-studio-pill-compact font-medium ${
            value === ratio ? "is-active" : ""
          }`}
        >
          {ratio}
        </button>
      ))}
    </div>
  );
}

function ModelDropdown({ value, onChange, availability, disabled, loading }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = MODEL_OPTIONS.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  return (
    <div ref={rootRef} className="image-studio-model-dropdown shrink-0">
      <button
        type="button"
        disabled={disabled || loading}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="image-studio-model-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="max-w-[7.5rem] truncate sm:max-w-[9rem]">
          {loading ? "…" : selected?.label ?? "Modèle"}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2.25}
        />
      </button>

      {open ? (
        <div className="image-studio-model-menu" role="listbox">
          {MODEL_OPTIONS.map((opt) => {
            const available = availability[opt.id];
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={value === opt.id}
                disabled={!available}
                className={`image-studio-model-option ${value === opt.id ? "is-selected" : ""}`}
                onClick={() => {
                  if (!available) return;
                  onChange(opt.id);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {!available ? <span className="image-studio-model-soon">Bientôt</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function ImageStudio() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { session } = useAuth();
  const { runWithAuth } = useRequireAuthAction();
  const { plan, loading: accessLoading } = usePremiumAccess();
  const [prompt, setPrompt] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [referenceImage, setReferenceImage] = useState(null);
  const [referencePreview, setReferencePreview] = useState(null);
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
      navigate("/boutique?section=subscription&highlight=image_9", { replace: true });
    }
  }, [accessLoading, plan, navigate]);

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

  const quotaReached = quotaCount >= IMAGE_STUDIO_MONTHLY_LIMIT;
  const modelAvailable = modelsAvailability[model];
  const canGenerate =
    Boolean(prompt.trim()) && !generating && !quotaReached && modelAvailable;

  const handleReferenceFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("L'image de référence ne doit pas dépasser 10 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) return;
      setReferenceImage(dataUrl);
      setReferencePreview(dataUrl);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const clearReference = () => {
    setReferenceImage(null);
    setReferencePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
    try {
      const result = await generateImageStudio(
        prompt,
        aspectRatio,
        model,
        referenceImage,
      );
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

  if (accessLoading || !hasImageStudioPlan(plan)) {
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

      {/* Barre du bas — style Hailuo */}
      <div className="image-studio-command-bar sticky bottom-0 z-30 shrink-0 px-3 sm:px-6 lg:px-8">
        <div className="image-studio-command-bar-inner mx-auto flex max-w-[1400px] items-center gap-2 sm:gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleReferenceFile(file);
            }}
          />

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={generating}
              className={`image-studio-ref-btn inline-flex items-center disabled:opacity-40 ${
                referencePreview ? "has-ref" : ""
              }`}
              title="Image de référence"
              aria-label="Image de référence"
            >
              {referencePreview ? (
                <img src={referencePreview} alt="" />
              ) : (
                <ImagePlus className="h-5 w-5 shrink-0" strokeWidth={1.75} />
              )}
            </button>
            {referencePreview ? (
              <button
                type="button"
                onClick={clearReference}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/15 text-white/70 hover:bg-white/25"
                aria-label="Retirer l'image de référence"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            ) : null}
          </div>

          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onPromptKeyDown}
            disabled={generating || quotaReached}
            placeholder="Décrivez l'image à générer…"
            aria-label="Prompt de génération"
            className="image-studio-prompt-input h-11 min-w-0 flex-1 px-1 text-sm disabled:opacity-50 sm:h-12 sm:text-[15px]"
          />

          <div className="image-studio-bar-scroll flex shrink-0 items-center gap-2 overflow-x-auto sm:gap-2.5">
            <ModelDropdown
              value={model}
              onChange={setModel}
              availability={modelsAvailability}
              disabled={generating}
              loading={modelsLoading}
            />

            <CompactRatioPills
              value={aspectRatio}
              onChange={setAspectRatio}
              disabled={generating}
            />

            <span className="image-studio-quota hidden sm:inline" aria-live="polite">
              {quotaLoading ? "…" : `${quotaCount}/${IMAGE_STUDIO_MONTHLY_LIMIT}`}
            </span>

            <button
              type="button"
              onClick={requestGenerate}
              disabled={!canGenerate}
              className="image-studio-generate-btn inline-flex h-11 shrink-0 items-center justify-center gap-1.5 text-sm font-semibold text-[#0d1117] transition-opacity disabled:cursor-not-allowed disabled:opacity-40 sm:h-12"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Générer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
