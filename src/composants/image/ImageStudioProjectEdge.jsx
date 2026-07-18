import { memo, useCallback } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from "@xyflow/react";
import { Trash2 } from "lucide-react";

function ImageStudioProjectEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  data,
}) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const onDelete = useCallback(
    (e) => {
      e.stopPropagation();
      data?.onDelete?.(id);
    },
    [data, id],
  );

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {selected ? (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="image-studio-project-edge-delete nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onClick={onDelete}
            title={data?.deleteLabel || "Supprimer"}
            aria-label={data?.deleteLabel || "Supprimer"}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export default memo(ImageStudioProjectEdge);
