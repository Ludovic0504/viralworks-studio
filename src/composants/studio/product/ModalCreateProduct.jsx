import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { persistStudioProduct } from "@/bibliotheque/studio/studioProducts";

function isImageFile(file) {
  if (!file) return false;
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(String(file.name || ""));
}

function readImageFile(file, onDone) {
  if (!isImageFile(file)) {
    onDone(null, "Le fichier sélectionné n'est pas une image supportée.");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    onDone(null, "Chaque image ne doit pas dépasser 10 Mo.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = typeof reader.result === "string" ? reader.result : null;
    onDone(dataUrl, dataUrl ? null : "Impossible de lire l'image.");
  };
  reader.onerror = () => onDone(null, "Impossible de lire l'image.");
  reader.readAsDataURL(file);
}

export default function ModalCreateProduct({ open, onClose, onCreated }) {
  const fileInputRef = useRef(null);
  const wasOpenRef = useRef(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const resetForm = useCallback(() => {
    setName("");
    setDescription("");
    setImages([]);
    setSelectedIndex(0);
    setSaving(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      resetForm();
    }
    wasOpenRef.current = open;
  }, [open, resetForm]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, saving]);

  const openFilePicker = useCallback(() => {
    if (saving || images.length >= 8) return;
    fileInputRef.current?.click();
  }, [images.length, saving]);

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []).slice(0, 8 - images.length);
    files.forEach((file) => {
      readImageFile(file, (dataUrl, err) => {
        if (err) {
          setError(err);
          return;
        }
        if (!dataUrl) return;
        setImages((prev) => {
          const next = [...prev, { id: `${Date.now()}-${Math.random()}`, dataUrl }];
          if (prev.length === 0) setSelectedIndex(0);
          return next;
        });
        setError(null);
      });
    });
  };

  const canCreate = Boolean(name.trim()) && images.length > 0 && !saving;
  const previewUrl = images[selectedIndex]?.dataUrl ?? null;
  const missingImages = images.length === 0;
  const missingName = !name.trim();
  const createHint = missingImages
    ? "Ajoutez au moins une photo pour continuer."
    : missingName
      ? "Indiquez un nom de produit pour activer la création."
      : null;

  const handleCreate = async () => {
    if (!canCreate) return;
    setSaving(true);
    setError(null);
    try {
      const item = await persistStudioProduct({
        name: name.trim(),
        description: description.trim(),
        imageDataUrls: images.map((img) => img.dataUrl),
      });
      if (!item) throw new Error("Enregistrement impossible.");
      onCreated?.(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/85 px-4 py-6 backdrop-blur-sm"
      onClick={() => {
        if (!saving) onClose?.();
      }}
      role="presentation"
    >
      <div
        className="relative flex max-h-[min(92vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12151c] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-create-product-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-5 py-4">
          <h2 id="modal-create-product-title" className="text-base font-semibold text-white">
            Créer un produit
          </h2>
          <button
            type="button"
            onClick={() => {
              if (!saving) onClose?.();
            }}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="studio-subtle-scrollbar grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 sm:grid-cols-[1.1fr_0.9fr]">
          <div className="flex min-w-0 flex-col gap-3">
            <button
              type="button"
              disabled={saving || images.length >= 8}
              onClick={openFilePicker}
              className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#0a0e14] transition hover:border-[#00c896]/35 hover:bg-white/[0.02] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="" className="h-full w-full object-contain" />
              ) : (
                <p className="px-6 text-center text-sm text-white/35">
                  Cliquez pour ajouter une ou plusieurs photos de votre produit
                </p>
              )}
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={saving || images.length >= 8}
                onClick={openFilePicker}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 bg-white/[0.03] text-white/70 transition hover:border-[#00c896]/40 hover:bg-white/[0.06] disabled:opacity-40"
                aria-label="Ajouter une image"
              >
                <Plus className="h-5 w-5" />
              </button>
              {images.map((img, index) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                    selectedIndex === index ? "border-white" : "border-transparent opacity-80 hover:opacity-100"
                  }`}
                >
                  <img src={img.dataUrl} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div>
              <label htmlFor="product-name" className="mb-1.5 block text-sm text-white/70">
                Nom du produit <span className="text-[#00c896]">*</span>
              </label>
              <input
                id="product-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                placeholder="Ex. Crème visage, Montre sport…"
                className="w-full rounded-xl border border-white/10 bg-[#0a0e14] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#00c896]/40 focus:outline-none"
              />
            </div>
            <div className="min-h-0 flex-1">
              <label htmlFor="product-description" className="mb-1.5 block text-sm text-white/70">
                Description
              </label>
              <textarea
                id="product-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
                placeholder="Décrivez votre produit (optionnel)"
                rows={6}
                className="min-h-[8.5rem] w-full resize-none rounded-xl border border-white/10 bg-[#0a0e14] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#00c896]/40 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/8 px-5 py-4">
          {error ? (
            <p className="mb-3 text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : createHint && !saving ? (
            <p className="mb-3 text-sm text-white/45" role="status">
              {createHint}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => void handleCreate()}
            className="btn-vws-primary ml-auto flex h-11 min-w-[10rem] items-center justify-center rounded-xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 sm:ml-0 sm:w-full"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Créer le produit"}
          </button>
        </div>
      </div>
    </div>
  );
}
