import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  getAvatarUrlFromHistory,
  listStudioAvatars,
} from "@/bibliotheque/studio/studioAvatars";
import { useAuth } from "@/contexte/FournisseurAuth";

const SCROLLBAR_CLASSES = "studio-subtle-scrollbar";

function metierLabel(item) {
  const m = item?.metadata?.config?.metier;
  return typeof m === "string" && m.trim() ? m.trim() : null;
}

function ModalAvatarPickerCard({ url, metier, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(url)}
      className="group flex w-[140px] cursor-pointer flex-col gap-1.5 rounded-lg transition duration-150 hover:ring-2 hover:ring-[#00FF87] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF87]"
      aria-label={metier ? `Avatar ${metier}` : "Sélectionner cet avatar"}
    >
      <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-[#161d2e]">
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover [object-position:16%_center]"
          loading="lazy"
        />
      </div>
      {metier ? (
        <p className="truncate text-center text-xs text-gray-400">{metier}</p>
      ) : null}
    </button>
  );
}

export default function ModalBibliothequeAvatars({ open, onClose, onSelect }) {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;

    if (!session?.user?.id) {
      setItems([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    listStudioAvatars(10)
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch(() => {
        if (active) setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, session?.user?.id]);

  const dismiss = () => onClose?.();

  const handleSelect = (url) => {
    onSelect?.(url);
    dismiss();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 px-5 py-4 backdrop-blur-sm sm:p-4"
      onClick={dismiss}
      role="presentation"
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-gray-900 p-5 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-biblio-avatars-title"
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>

        <header className="pr-8">
          <h2 id="modal-biblio-avatars-title" className="text-lg font-semibold text-gray-100">
            Mes avatars
          </h2>
          <p className="mt-1 text-sm text-gray-400">Sélectionnez un avatar</p>
        </header>

        <div className="mt-5">
          {!session?.user?.id ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Connectez-vous pour accéder à vos avatars.
            </p>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00FF87]/30 border-t-[#00FF87]" />
            </div>
          ) : !items.length ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Aucun avatar enregistré. Créez-en un dans Avatar IA.
            </p>
          ) : (
            <div
              className={`max-h-[420px] overflow-y-auto ${SCROLLBAR_CLASSES}`}
              role="list"
            >
              <div className="grid grid-cols-3 justify-items-center gap-3 pb-1">
                {items.map((item) => {
                  const url = getAvatarUrlFromHistory(item);
                  if (!url) return null;
                  return (
                    <ModalAvatarPickerCard
                      key={item.id}
                      url={url}
                      metier={metierLabel(item)}
                      onSelect={handleSelect}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
