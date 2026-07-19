import { memo, useCallback, useEffect, useRef } from "react";
import { Handle, Position, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import { Loader2 } from "lucide-react";
import {
  aspectRatioFromDimensions,
  getProjectNodeMediaSize,
  getProjectNodeMediaSizeFromPixels,
} from "@/bibliotheque/imageStudio/imageStudioProjectCanvas";

const HANDLE_POSITIONS = [
  { id: "left", position: Position.Left },
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
];

const SLOT_OPTIONS = [
  { kind: "Image1", token: "@Image1" },
  { kind: "Avatar", token: "@Avatar" },
  { kind: "Produit", token: "@Produit" },
];

function ImageStudioProjectNode({ id, data, selected }) {
  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const imgRef = useRef(null);

  const imageUrl = data?.imageUrl || "";
  const prompt = data?.prompt || "";
  const linkPending = Boolean(data?.linkPending);
  const isConnectTarget = Boolean(data?.isConnectTarget);
  const avatarAssigned = Boolean(data?.avatarAssigned);
  const generating = Boolean(data?.generating);

  const mediaSize =
    data?.naturalWidth && data?.naturalHeight
      ? getProjectNodeMediaSizeFromPixels(data.naturalWidth, data.naturalHeight)
      : getProjectNodeMediaSize(data?.aspectRatio || "1:1");

  const applyNaturalSize = useCallback(
    (naturalWidth, naturalHeight) => {
      if (!id || generating || !naturalWidth || !naturalHeight) return;
      if (
        data?.aspectSource === "natural" &&
        data?.naturalWidth === naturalWidth &&
        data?.naturalHeight === naturalHeight
      ) {
        return;
      }

      const nextRatio = aspectRatioFromDimensions(naturalWidth, naturalHeight);
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  aspectRatio: nextRatio,
                  aspectSource: "natural",
                  naturalWidth,
                  naturalHeight,
                },
              }
            : node,
        ),
      );
      window.requestAnimationFrame(() => {
        updateNodeInternals(id);
      });
    },
    [
      data?.aspectSource,
      data?.naturalHeight,
      data?.naturalWidth,
      generating,
      id,
      setNodes,
      updateNodeInternals,
    ],
  );

  const handleImageLoad = useCallback(
    (event) => {
      const img = event.currentTarget;
      applyNaturalSize(img.naturalWidth, img.naturalHeight);
    },
    [applyNaturalSize],
  );

  useEffect(() => {
    const img = imgRef.current;
    if (!img || generating || !imageUrl) return;
    if (img.complete && img.naturalWidth > 0) {
      applyNaturalSize(img.naturalWidth, img.naturalHeight);
    }
  }, [applyNaturalSize, generating, imageUrl]);

  return (
    <div
      className={[
        "image-studio-project-node",
        selected ? "is-selected" : "",
        linkPending ? "is-link-pending" : "",
        isConnectTarget ? "is-connect-target" : "",
        generating ? "is-generating" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: mediaSize.width }}
    >
      <div className="image-studio-project-node-frame">
        {HANDLE_POSITIONS.map(({ id: handleId, position }) => (
          <Handle
            key={handleId}
            type="source"
            position={position}
            id={handleId}
            className="image-studio-project-handle"
            title="Tirer vers une autre image pour relier"
          />
        ))}

        <div
          className="image-studio-project-node-media"
          style={{ width: mediaSize.width, height: mediaSize.height }}
        >
          {generating ? (
            <div
              className="image-studio-project-node-placeholder is-generating"
              style={{ width: mediaSize.width, height: mediaSize.height }}
              role="status"
              aria-label="Génération en cours"
            >
              <Loader2 className="image-studio-project-node-spinner" strokeWidth={2.25} aria-hidden />
            </div>
          ) : imageUrl ? (
            <img
              ref={imgRef}
              src={imageUrl}
              alt={prompt || ""}
              className="image-studio-project-node-img"
              style={{ width: mediaSize.width, height: mediaSize.height }}
              draggable={false}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onLoad={handleImageLoad}
            />
          ) : (
            <div
              className="image-studio-project-node-placeholder"
              style={{ width: mediaSize.width, height: mediaSize.height }}
            />
          )}
        </div>
      </div>

      {selected && data?.showAssignSlots && !generating ? (
        <div
          className="image-studio-project-node-slots nodrag nopan"
          role="group"
          aria-label="Assigner comme référence"
        >
          {SLOT_OPTIONS.map((opt, index) => (
            <span key={opt.kind} className="image-studio-project-node-slot-item">
              {index > 0 ? (
                <span className="image-studio-project-node-slot-sep" aria-hidden>
                  |
                </span>
              ) : null}
              <button
                type="button"
                className={`image-studio-project-node-slot-btn${
                  opt.kind === "Avatar" && avatarAssigned ? " is-active" : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  data?.onAssignSlot?.(opt.kind, {
                    nodeId: data?.raw?.id,
                    imageUrl,
                    prompt,
                    historyId: data?.historyId,
                    posX: data?.raw?.pos_x,
                    posY: data?.raw?.pos_y,
                  });
                }}
              >
                {opt.token}
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default memo(ImageStudioProjectNode);
