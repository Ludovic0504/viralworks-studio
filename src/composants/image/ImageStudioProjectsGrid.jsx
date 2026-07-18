import { useCallback, useEffect, useRef, useState } from "react";
import { FolderPlus, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { parseHistoryDragPayload } from "@/bibliotheque/imageStudio/imageStudioHistoryDrag";

function formatProjectDate(iso, locale = "fr") {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function FolderIcon({ coverUrl }) {
  return (
    <div className={`image-studio-folder-icon${coverUrl ? " has-cover" : ""}`} aria-hidden>
      <svg viewBox="0 0 96 80" className="image-studio-folder-svg image-studio-folder-layer-back">
        <path
          className="image-studio-folder-back"
          d="M8 18c0-3.3 2.7-6 6-6h22l8 8h38c3.3 0 6 2.7 6 6v40c0 3.3-2.7 6-6 6H14c-3.3 0-6-2.7-6-6V18z"
        />
        <path
          className="image-studio-folder-tab"
          d="M14 12h22l8 8H14c-3.3 0-6-2.7-6-6s2.7-6 6-6z"
        />
      </svg>

      {coverUrl ? (
        <div className="image-studio-folder-cover-slot">
          <img src={coverUrl} alt="" className="image-studio-folder-cover" draggable={false} />
        </div>
      ) : null}

      <svg viewBox="0 0 96 80" className="image-studio-folder-svg image-studio-folder-layer-front">
        <path
          className="image-studio-folder-front"
          d="M8 30h80v32c0 3.3-2.7 6-6 6H14c-3.3 0-6-2.7-6-6V30z"
        />
      </svg>
    </div>
  );
}

export default function ImageStudioProjectsGrid({
  projects,
  loading,
  onOpen,
  onCreate,
  onRename,
  onDelete,
  onDropHistoryImage,
  onDropImageFile,
  t,
}) {
  const [menuId, setMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [dropTargetId, setDropTargetId] = useState(null);
  const menuRef = useRef(null);
  const renameInputRef = useRef(null);

  useEffect(() => {
    if (!menuId) return;
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuId(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [menuId]);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  const handleCreate = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const created = await onCreate();
      if (created?.id) {
        setMenuId(null);
        setRenamingId(created.id);
        setRenameValue(created.name || "");
      }
    } finally {
      setCreating(false);
    }
  }, [creating, onCreate]);

  const startRename = useCallback((project) => {
    setMenuId(null);
    setRenamingId(project.id);
    setRenameValue(project.name);
  }, []);

  const commitRename = useCallback(async () => {
    if (!renamingId) return;
    const next = renameValue.trim();
    const id = renamingId;
    setRenamingId(null);
    if (!next) return;
    await onRename(id, next);
  }, [renamingId, renameValue, onRename]);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
  }, []);

  const handleDelete = useCallback(
    async (project) => {
      setMenuId(null);
      const ok = window.confirm(
        t("imageStudio.projectDeleteConfirm").replace("{name}", project.name),
      );
      if (!ok) return;
      await onDelete(project.id);
    },
    [onDelete, t],
  );

  const handleFolderDragOver = useCallback((e, projectId) => {
    const types = Array.from(e.dataTransfer?.types || []);
    if (
      !types.includes("application/x-vw-image-studio-history") &&
      !types.includes("application/json") &&
      !types.includes("Files") &&
      !types.includes("text/plain")
    ) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropTargetId(projectId);
  }, []);

  const handleFolderDragLeave = useCallback((e, projectId) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDropTargetId((cur) => (cur === projectId ? null : cur));
    }
  }, []);

  const handleFolderDrop = useCallback(
    async (e, project) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTargetId(null);

      const payload = parseHistoryDragPayload(e.dataTransfer);
      if (payload?.imageUrl) {
        await onDropHistoryImage?.(project, payload);
        return;
      }

      const file = Array.from(e.dataTransfer?.files || []).find((f) =>
        f.type?.startsWith("image/"),
      );
      if (file) {
        await onDropImageFile?.(project, file);
      }
    },
    [onDropHistoryImage, onDropImageFile],
  );

  return (
    <div className="image-studio-projects-grid-wrap">
      <div className="image-studio-projects-toolbar">
        <p className="image-studio-projects-hint">{t("imageStudio.projectsHint")}</p>
        <button
          type="button"
          className="image-studio-projects-new-btn"
          onClick={() => void handleCreate()}
          disabled={creating}
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FolderPlus className="h-4 w-4" aria-hidden />
          )}
          <span>{t("imageStudio.newProject")}</span>
        </button>
      </div>

      {loading ? (
        <div className="image-studio-projects-loading">
          <Loader2 className="h-5 w-5 animate-spin text-white/40" aria-hidden />
        </div>
      ) : projects.length === 0 ? (
        <div className="image-studio-projects-empty">
          <FolderIcon />
          <p className="image-studio-projects-empty-title">{t("imageStudio.projectsEmptyTitle")}</p>
          <p className="image-studio-projects-empty-sub">{t("imageStudio.projectsEmptySub")}</p>
          <button
            type="button"
            className="image-studio-projects-new-btn"
            onClick={() => void handleCreate()}
            disabled={creating}
          >
            <FolderPlus className="h-4 w-4" aria-hidden />
            <span>{t("imageStudio.newProject")}</span>
          </button>
        </div>
      ) : (
        <ul className="image-studio-projects-grid">
          {projects.map((project) => (
            <li
              key={project.id}
              className={`image-studio-folder-item${dropTargetId === project.id ? " is-drop-target" : ""}`}
              onDragOver={(e) => handleFolderDragOver(e, project.id)}
              onDragLeave={(e) => handleFolderDragLeave(e, project.id)}
              onDrop={(e) => void handleFolderDrop(e, project)}
            >
              {renamingId === project.id ? (
                <div className="image-studio-folder-open is-renaming">
                  <FolderIcon coverUrl={project.cover_url} />
                  <input
                    ref={renameInputRef}
                    className="image-studio-folder-rename"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => void commitRename()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void commitRename();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelRename();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyUp={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                  <span className="image-studio-folder-date">
                    {formatProjectDate(project.updated_at)}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  className="image-studio-folder-open"
                  onDoubleClick={() => onOpen(project)}
                  onClick={() => onOpen(project)}
                  aria-label={t("imageStudio.openProjectAria").replace("{name}", project.name)}
                >
                  <FolderIcon coverUrl={project.cover_url} />
                  <span className="image-studio-folder-name">{project.name}</span>
                  <span className="image-studio-folder-date">
                    {formatProjectDate(project.updated_at)}
                  </span>
                </button>
              )}

              <div className="image-studio-folder-menu-wrap" ref={menuId === project.id ? menuRef : null}>
                <button
                  type="button"
                  className="image-studio-folder-menu-btn"
                  aria-label={t("imageStudio.projectMenuAria")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuId((cur) => (cur === project.id ? null : project.id));
                  }}
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </button>
                {menuId === project.id ? (
                  <div className="image-studio-folder-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => startRename(project)}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      {t("imageStudio.renameProject")}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="is-danger"
                      onClick={() => void handleDelete(project)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      {t("imageStudio.deleteProject")}
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
