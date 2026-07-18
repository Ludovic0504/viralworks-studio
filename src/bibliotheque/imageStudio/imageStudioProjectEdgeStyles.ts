import { MarkerType } from "@xyflow/react";

export const EDGE_STYLE_OPTIONS = [
  { id: "arrow", labelKey: "imageStudio.edgeStyleArrow" },
  { id: "solid", labelKey: "imageStudio.edgeStyleSolid" },
  { id: "dashed", labelKey: "imageStudio.edgeStyleDashed" },
];

const STROKE = "#7eb8a4";
const STROKE_SELECTED = "#9fd4c2";

export function getEdgeVisualProps(edgeStyle = "arrow", selected = false) {
  const stroke = selected ? STROKE_SELECTED : STROKE;
  const base = {
    stroke,
    strokeWidth: selected ? 3 : 2.5,
  };

  if (edgeStyle === "dashed") {
    return {
      style: { ...base, strokeDasharray: "8 6" },
      markerEnd: undefined,
    };
  }

  if (edgeStyle === "solid") {
    return {
      style: base,
      markerEnd: undefined,
    };
  }

  return {
    style: base,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: stroke,
      width: 18,
      height: 18,
    },
  };
}
