import { useCallback, useEffect, useState } from "react";
import { Box, Link2, Loader2, Trash2, X } from "lucide-react";
import {
  deleteStudioProduct,
  getProductCoverUrl,
  getProductName,
  listStudioProducts,
} from "@/bibliotheque/studio/studioProducts";
import { useAuth } from "@/contexte/FournisseurAuth";
import ModalCreateProduct from "@/composants/studio/product/ModalCreateProduct";

const SCROLLBAR_CLASSES = "studio-subtle-scrollbar";

function ProductLibraryCard({ item, onSelect, onDelete, deleting }) {
  const url = getProductCoverUrl(item);
  const name = getProductName(item);
  if (!url) return null;

  const handleDelete = (event) => {
    event.preventDefault();
    event.stopPropagation();
    void onDelete?.(item);
  };

  return (
    <div className="group flex flex-col gap-2 rounded-xl border border-white/8 bg-[#0a0e14] p-2 transition hover:border-[#00c896]/35 hover:bg-white/[0.03]">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-[#161d2e]">
        <button
          type="button"
          disabled={deleting}
          onClick={() => onSelect(item)}
          className="flex h-full w-full items-center justify-center disabled:cursor-not-allowed disabled:opacity-60"
        >
          <img src={url} alt="" className="h-full w-full object-contain" loading="lazy" />
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-white/75 opacity-0 shadow-sm transition hover:bg-black/85 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Supprimer ${name || "produit"}`}
        >
          <Trash2 className="h-3 w-3" strokeWidth={2.25} />
        </button>
      </div>
      <button
        type="button"
        disabled={deleting}
        onClick={() => onSelect(item)}
        className="truncate px-0.5 text-left text-xs font-medium text-white/80 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {name || "Produit"}
      </button>
    </div>
  );
}

export default function ModalBibliothequeProduits({ open, onClose, onSelect, onDeleted }) {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [productUrl, setProductUrl] = useState("");
  const [urlNotice, setUrlNotice] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const reload = useCallback(async () => {
    if (!session?.user?.id) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await listStudioProducts(24);
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!open) return undefined;
    setUrlNotice("");
    setProductUrl("");
    void reload();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !createOpen) onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, reload, createOpen]);

  const dismiss = () => onClose?.();

  const handleSelectItem = (item) => {
    const url = getProductCoverUrl(item);
    if (!url) return;
    onSelect?.(url, item);
    dismiss();
  };

  const handleUrlSubmit = (event) => {
    event.preventDefault();
    const trimmed = productUrl.trim();
    if (!trimmed) return;
    setUrlNotice("L'import par lien sera disponible prochainement. Utilisez « Créer manuellement ».");
  };

  const handleCreated = (item) => {
    setCreateOpen(false);
    void reload();
    handleSelectItem(item);
  };

  const handleDeleteItem = async (item) => {
    const coverUrl = getProductCoverUrl(item);
    setDeletingId(item.id);
    try {
      const result = await deleteStudioProduct(item);
      if (!result.success) return;
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      if (coverUrl) onDeleted?.(coverUrl);
    } finally {
      setDeletingId(null);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm sm:px-5"
        onClick={dismiss}
        role="presentation"
      >
        <div
          className="relative flex max-h-[min(92vh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12151c] shadow-2xl"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-biblio-products-title"
        >
          <button
            type="button"
            onClick={dismiss}
            className="absolute right-3 top-3 z-10 rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="studio-subtle-scrollbar min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black">
                <Box className="h-3.5 w-3.5" strokeWidth={2.25} />
                Produit
              </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <h2
                  id="modal-biblio-products-title"
                  className="text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl"
                >
                  Ajouter votre produit
                </h2>
                <p className="mt-2 max-w-xl text-sm text-white/45">
                  Importez des images pour réutiliser votre produit dans vos générations.
                </p>

                <form onSubmit={handleUrlSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1">
                    <Link2
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                      aria-hidden
                    />
                    <input
                      type="url"
                      value={productUrl}
                      onChange={(e) => {
                        setProductUrl(e.target.value);
                        setUrlNotice("");
                      }}
                      placeholder="www.votreproduit.com"
                      className="w-full rounded-xl border border-white/10 bg-[#0a0e14] py-3 pl-10 pr-3 text-sm text-white placeholder:text-white/30 focus:border-[#00c896]/35 focus:outline-none"
                    />
                  </div>
                  <span className="hidden shrink-0 text-sm text-white/35 sm:block">ou</span>
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-gray-100"
                  >
                    Créer manuellement
                  </button>
                </form>
                {urlNotice ? (
                  <p className="mt-2 text-xs text-amber-300/90" role="status">
                    {urlNotice}
                  </p>
                ) : null}
              </div>

              <div className="hidden w-[min(100%,220px)] shrink-0 lg:block">
                <div className="relative h-36 w-full">
                  <div className="absolute left-8 top-0 h-24 w-20 rotate-[-8deg] overflow-hidden rounded-xl border border-white/10 bg-[#161d2e] shadow-lg">
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a2236] to-[#0f1420] text-[10px] text-white/25">
                      Produit
                    </div>
                  </div>
                  <div className="absolute left-16 top-4 h-28 w-24 rotate-[6deg] overflow-hidden rounded-xl border border-white/10 bg-[#161d2e] shadow-lg">
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#243049] to-[#121820] text-[10px] text-white/25">
                      Packshot
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/8 bg-[#0a0e14]/80 p-4 sm:p-5">
              {!session?.user?.id ? (
                <p className="py-10 text-center text-sm text-white/45">
                  Connectez-vous pour accéder à vos produits enregistrés.
                </p>
              ) : loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[#00c896]" aria-hidden />
                </div>
              ) : !items.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex items-end gap-1 opacity-35">
                    <div className="h-16 w-12 rounded-lg border border-white/15 bg-white/[0.04]" />
                    <div className="h-20 w-14 rounded-lg border border-white/15 bg-white/[0.06]" />
                    <div className="h-14 w-12 rounded-lg border border-white/15 bg-white/[0.04]" />
                  </div>
                  <p className="text-sm font-semibold text-white/75">Aucun produit ajouté</p>
                  <p className="mt-1 max-w-sm text-xs text-white/40">
                    Collez un lien ou importez des images pour commencer
                  </p>
                </div>
              ) : (
                <div className={`max-h-[320px] overflow-y-auto ${SCROLLBAR_CLASSES}`}>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {items.map((item) => (
                      <ProductLibraryCard
                        key={item.id}
                        item={item}
                        onSelect={handleSelectItem}
                        onDelete={handleDeleteItem}
                        deleting={deletingId === item.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ModalCreateProduct
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
