import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

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

function ImageStudioProjectNode({ data, selected }) {
  const imageUrl = data?.imageUrl || "";
  const prompt = data?.prompt || "";
  const linkPending = Boolean(data?.linkPending);
  const isConnectTarget = Boolean(data?.isConnectTarget);

  return (
    <div
      className={[
        "image-studio-project-node",
        selected ? "is-selected" : "",
        linkPending ? "is-link-pending" : "",
        isConnectTarget ? "is-connect-target" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="image-studio-project-node-frame">
        {HANDLE_POSITIONS.map(({ id, position }) => (
          <Handle
            key={id}
            type="source"
            position={position}
            id={id}
            className="image-studio-project-handle"
            title="Tirer vers une autre image pour relier"
          />
        ))}

        <div className="image-studio-project-node-media">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={prompt || ""}
              className="image-studio-project-node-img"
              draggable={false}
            />
          ) : (
            <div className="image-studio-project-node-placeholder" />
          )}
        </div>
      </div>

      {selected && data?.showAssignSlots ? (
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
                className="image-studio-project-node-slot-btn"
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
