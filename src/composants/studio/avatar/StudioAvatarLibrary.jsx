import { useCallback, useRef, useState } from "react";
import { Download, MoreVertical, Trash2 } from "lucide-react";
import { getAvatarUrlFromHistory } from "@/bibliotheque/studio/studioAvatars";

const HOVER_LEAVE_MS = 200;

function slugMetier(metier) {
  const raw = String(metier || "avatar")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const slug = raw.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return slug || "avatar";
}

async function downloadAvatarAsPng(url, metier) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Impossible de télécharger l'image");
  const blob = await res.blob();
  const pngBlob =
    blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });
  const filename = `${slugMetier(metier)}_${Date.now()}.png`;
  const objectUrl = URL.createObjectURL(pngBlob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function isHistoryRowId(id) {
  const s = String(id || "");
  return s.length > 0 && !s.startsWith("storage-");
}

function AvatarCard({ item, url, isActive, metier, onSelect, onDelete }) {
  const canDelete = isHistoryRowId(item.id);
  const [cardHovered, setCardHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const cardLeaveTimerRef = useRef(null);
  const menuLeaveTimerRef = useRef(null);

  const clearCardLeaveTimer = useCallback(() => {
    if (cardLeaveTimerRef.current) {
      clearTimeout(cardLeaveTimerRef.current);
      cardLeaveTimerRef.current = null;
    }
  }, []);

  const clearMenuLeaveTimer = useCallback(() => {
    if (menuLeaveTimerRef.current) {
      clearTimeout(menuLeaveTimerRef.current);
      menuLeaveTimerRef.current = null;
    }
  }, []);

  const handleCardEnter = () => {
    clearCardLeaveTimer();
    setCardHovered(true);
  };

  const handleCardLeave = () => {
    clearCardLeaveTimer();
    cardLeaveTimerRef.current = setTimeout(() => {
      setCardHovered(false);
      setMenuOpen(false);
      cardLeaveTimerRef.current = null;
    }, HOVER_LEAVE_MS);
  };

  const handleMenuZoneEnter = () => {
    clearMenuLeaveTimer();
    clearCardLeaveTimer();
    setCardHovered(true);
    if (canDelete) setMenuOpen(true);
  };

  const handleMenuZoneLeave = () => {
    clearMenuLeaveTimer();
    menuLeaveTimerRef.current = setTimeout(() => {
      setMenuOpen(false);
      menuLeaveTimerRef.current = null;
    }, HOVER_LEAVE_MS);
  };

  const handleDownload = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await downloadAvatarAsPng(url, metier);
    } catch (err) {
      console.error("Téléchargement avatar:", err);
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    if (!canDelete) return;
    await onDelete?.(item);
  };

  const overlayClass = cardHovered
    ? "pointer-events-auto opacity-100"
    : "pointer-events-none opacity-0 transition-opacity duration-200";

  return (
    <div
      role="listitem"
      onMouseEnter={handleCardEnter}
      onMouseLeave={handleCardLeave}
      className={`relative h-[160px] overflow-hidden rounded-lg border bg-[#161d2e] ${
        isActive
          ? "border-emerald-400 ring-2 ring-emerald-400/50"
          : "border-white/15 hover:border-emerald-400/40"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect?.(url, item)}
        className="absolute inset-0 z-0 flex h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-inset"
        aria-label={metier ? `Avatar ${metier}` : "Avatar enregistré"}
        aria-pressed={isActive}
      >
        <img
          src={url}
          alt=""
          className="pointer-events-none h-full w-full object-cover object-top"
          loading="lazy"
        />
      </button>

      {metier ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] truncate bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-4 text-[9px] text-gray-200">
          {metier}
        </span>
      ) : null}

      <div
        className={`absolute right-1 top-1 z-20 flex items-center gap-0.5 ${overlayClass}`}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={handleCardEnter}
      >
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center justify-center rounded-md bg-black/60 p-1 text-white/90 backdrop-blur-sm hover:bg-black/75 hover:text-white"
          aria-label="Télécharger l'avatar"
        >
          <Download className="h-4 w-4 max-h-4 max-w-4" strokeWidth={2} />
        </button>

        {canDelete ? (
          <div
            className="relative"
            onMouseEnter={handleMenuZoneEnter}
            onMouseLeave={handleMenuZoneLeave}
          >
            <button
              type="button"
              tabIndex={-1}
              className="flex items-center justify-center rounded-md bg-black/60 p-1 text-white/90 backdrop-blur-sm hover:bg-black/75 hover:text-white"
              aria-label="Options"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <MoreVertical className="h-4 w-4 max-h-4 max-w-4" strokeWidth={2} />
            </button>
          </div>
        ) : null}
      </div>

      {canDelete && menuOpen ? (
        <div
          role="menu"
          className="absolute left-1 right-1 top-8 z-30 overflow-hidden rounded-md border border-white/10 bg-[#1a2236] py-0.5 shadow-lg"
          onMouseEnter={handleMenuZoneEnter}
          onMouseLeave={handleMenuZoneLeave}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleDelete}
            className="flex w-full items-center gap-1 px-2 py-1 text-left text-[10px] leading-tight text-red-400 hover:bg-white/5"
          >
            <Trash2 className="h-3 w-3 shrink-0" strokeWidth={2} />
            <span className="truncate">Supprimer</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function StudioAvatarLibrary({
  items = [],
  activeUrl = null,
  onSelect,
  onDelete,
  loading = false,
  emptyMessage = "Aucun avatar enregistré",
  className = "",
}) {
  if (loading) {
    return (
      <div className={`flex items-center justify-center py-6 ${className}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <p className={`py-4 text-center text-xs text-gray-500 ${className}`}>{emptyMessage}</p>
    );
  }

  const normalizedActive =
    typeof activeUrl === "string" && activeUrl.trim()
      ? activeUrl.replace("http://", "https://")
      : null;

  const scrollClasses =
    "max-h-[145px] overflow-y-auto [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-white/25";

  return (
    <div
      className={`grid grid-cols-3 auto-rows-[160px] gap-2 sm:grid-cols-4 sm:gap-2.5 ${scrollClasses} ${className}`}
      role="list"
    >
      {items.map((item) => {
        const url = getAvatarUrlFromHistory(item);
        if (!url) return null;
        const isActive = normalizedActive && url === normalizedActive;
        const metier =
          typeof item?.metadata?.config?.metier === "string"
            ? item.metadata.config.metier
            : null;

        return (
          <AvatarCard
            key={item.id}
            item={item}
            url={url}
            isActive={isActive}
            metier={metier}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
}
