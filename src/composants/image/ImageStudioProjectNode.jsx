import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

const HANDLE_POSITIONS = [
  { id: "left", position: Position.Left },
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
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

      <div className="image-studio-project-node-frame">
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
    </div>
  );
}

export default memo(ImageStudioProjectNode);
