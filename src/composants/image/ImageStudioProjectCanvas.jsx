import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  SelectionMode,
  ConnectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Loader2,
  Minus,
  MoreHorizontal,
} from "lucide-react";
import ImageStudioProjectNode from "@/composants/image/ImageStudioProjectNode";
import ImageStudioProjectEdge from "@/composants/image/ImageStudioProjectEdge";
import {
  EDGE_STYLE_OPTIONS,
  getEdgeVisualProps,
} from "@/bibliotheque/imageStudio/imageStudioProjectEdgeStyles";
import { parseHistoryDragPayload } from "@/bibliotheque/imageStudio/imageStudioHistoryDrag";
import {
  loadImageStudioProjectCanvas,
  updateImageStudioProjectNodePosition,
  deleteImageStudioProjectNode,
  createImageStudioProjectEdge,
  updateImageStudioProjectEdgeStyle,
  deleteImageStudioProjectEdge,
} from "@/bibliotheque/imageStudio/imageStudioProjectCanvas";

const NODE_TYPES = { projectImage: ImageStudioProjectNode };
const EDGE_TYPES = { projectLink: ImageStudioProjectEdge };

const CONNECTION_LINE_STYLE = {
  stroke: "#8fc9b5",
  strokeWidth: 2.5,
  strokeDasharray: "6 4",
};

function dbNodesToFlow(nodes, selectedId, options = {}) {
  const { connectingFromId = null } = options;
  return nodes.map((n) => ({
    id: n.id,
    type: "projectImage",
    position: { x: n.pos_x, y: n.pos_y },
    selected: n.id === selectedId,
    data: {
      imageUrl: n.image_url,
      prompt: n.prompt || "",
      historyId: n.history_id,
      linkPending: connectingFromId === n.id,
      isConnectTarget: Boolean(connectingFromId && connectingFromId !== n.id),
      raw: n,
    },
  }));
}

function dbEdgesToFlow(edges, edgeCallbacks = {}) {
  return edges.map((e) => {
    const edgeStyle = e.edge_style || "arrow";
    const visual = getEdgeVisualProps(edgeStyle, false);
    return {
      id: e.id,
      type: "projectLink",
      source: e.source_node_id,
      target: e.target_node_id,
      // Anciens liens sans handle : droite → gauche (liaison naturelle)
      sourceHandle: e.source_handle || "right",
      targetHandle: e.target_handle || "left",
      ...visual,
      data: {
        edgeStyle,
        onDelete: edgeCallbacks.onDelete,
        deleteLabel: edgeCallbacks.deleteLabel,
      },
    };
  });
}

function EdgeStyleIcon({ styleId }) {
  if (styleId === "dashed") {
    return <MoreHorizontal className="h-4 w-4" aria-hidden />;
  }
  if (styleId === "solid") {
    return <Minus className="h-4 w-4" aria-hidden />;
  }
  return <ArrowRight className="h-4 w-4" aria-hidden />;
}

function ProjectCanvasInner({
  project,
  reloadToken,
  selectedNodeId,
  onSelectNode,
  onBack,
  onCanvasChanged,
  onDropHistoryImage,
  onDropImageFile,
  t,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [edgeStyle, setEdgeStyle] = useState("arrow");
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [connectingFromId, setConnectingFromId] = useState(null);
  const positionTimers = useRef(new Map());
  const dbNodesRef = useRef([]);
  const edgeStyleRef = useRef(edgeStyle);
  const styleMenuRef = useRef(null);
  const { fitView, screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    edgeStyleRef.current = edgeStyle;
  }, [edgeStyle]);

  useEffect(() => {
    if (!styleMenuOpen) return;
    const onDown = (e) => {
      if (!styleMenuRef.current?.contains(e.target)) setStyleMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [styleMenuOpen]);

  const handleDeleteEdge = useCallback(
    async (edgeId) => {
      if (!edgeId) return;
      try {
        await deleteImageStudioProjectEdge(edgeId);
        setEdges((prev) => prev.filter((e) => e.id !== edgeId));
        onCanvasChanged?.();
      } catch (err) {
        console.error(err);
      }
    },
    [setEdges, onCanvasChanged],
  );

  const edgeCallbacks = useMemo(
    () => ({
      onDelete: handleDeleteEdge,
      deleteLabel: t("imageStudio.deleteLink"),
    }),
    [handleDeleteEdge, t],
  );

  const loadCanvas = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const canvas = await loadImageStudioProjectCanvas(project.id);
      dbNodesRef.current = canvas.nodes;
      setNodes(
        dbNodesToFlow(canvas.nodes, null),
      );
      setEdges(dbEdgesToFlow(canvas.edges, edgeCallbacks));
      window.requestAnimationFrame(() => {
        if (canvas.nodes.length > 0) {
          fitView({ padding: 0.2, duration: 200 });
        }
      });
    } finally {
      setLoading(false);
    }
  }, [project?.id, setNodes, setEdges, fitView, edgeCallbacks]);

  useEffect(() => {
    void loadCanvas();
  }, [loadCanvas, reloadToken]);

  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        selected: n.id === selectedNodeId,
        data: {
          ...n.data,
          linkPending: connectingFromId === n.id,
          isConnectTarget: Boolean(connectingFromId && connectingFromId !== n.id),
        },
      })),
    );
  }, [selectedNodeId, connectingFromId, setNodes]);

  useEffect(() => {
    setEdges((prev) =>
      prev.map((e) => ({
        ...e,
        data: {
          ...e.data,
          onDelete: edgeCallbacks.onDelete,
          deleteLabel: edgeCallbacks.deleteLabel,
        },
      })),
    );
  }, [edgeCallbacks, setEdges]);

  useEffect(() => {
    const timers = positionTimers.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const schedulePositionSave = useCallback((nodeId, x, y) => {
    const prev = positionTimers.current.get(nodeId);
    if (prev) window.clearTimeout(prev);
    const timer = window.setTimeout(() => {
      void updateImageStudioProjectNodePosition(nodeId, x, y);
      positionTimers.current.delete(nodeId);
      const idx = dbNodesRef.current.findIndex((n) => n.id === nodeId);
      if (idx >= 0) {
        dbNodesRef.current[idx] = {
          ...dbNodesRef.current[idx],
          pos_x: x,
          pos_y: y,
        };
      }
    }, 400);
    positionTimers.current.set(nodeId, timer);
  }, []);

  const handleNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      for (const change of changes) {
        if (change.type === "position" && change.position && change.dragging === false) {
          schedulePositionSave(change.id, change.position.x, change.position.y);
        }
      }
    },
    [onNodesChange, schedulePositionSave],
  );

  const persistEdge = useCallback(
    async ({ source, target, sourceHandle, targetHandle }) => {
      if (!project?.id || !source || !target || source === target) return;
      try {
        const style = edgeStyleRef.current || "arrow";
        const edge = await createImageStudioProjectEdge({
          projectId: project.id,
          sourceNodeId: source,
          targetNodeId: target,
          sourceHandle: sourceHandle || null,
          targetHandle: targetHandle || null,
          edgeStyle: style,
        });
        if (edge) {
          setEdges((prev) => {
            if (prev.some((e) => e.id === edge.id)) return prev;
            return [...prev, ...dbEdgesToFlow([edge], edgeCallbacks)];
          });
          onCanvasChanged?.();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setConnectingFromId(null);
      }
    },
    [project?.id, setEdges, onCanvasChanged, edgeCallbacks],
  );

  const handleConnect = useCallback(
    (connection) => {
      if (!connection?.source || !connection?.target) return;
      void persistEdge({
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      });
    },
    [persistEdge],
  );

  const handleConnectStart = useCallback((_event, params) => {
    setConnectingFromId(params?.nodeId || null);
  }, []);

  const handleConnectEnd = useCallback(() => {
    setConnectingFromId(null);
  }, []);

  const isValidConnection = useCallback((connection) => {
    if (!connection?.source || !connection?.target) return false;
    if (connection.source === connection.target) return false;
    return true;
  }, []);

  const handleNodeClick = useCallback(
    (_event, node) => {
      onSelectNode?.({
        nodeId: node.id,
        imageUrl: node.data?.imageUrl,
        prompt: node.data?.prompt,
        historyId: node.data?.historyId,
        posX: node.position?.x ?? 0,
        posY: node.position?.y ?? 0,
      });
    },
    [onSelectNode],
  );

  const handlePaneClick = useCallback(() => {
    onSelectNode?.(null);
  }, [onSelectNode]);

  const handleEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
      const hasSelect = changes.some((c) => c.type === "select");
      if (!hasSelect) return;
      queueMicrotask(() => {
        setEdges((prev) => {
          const next = prev.map((e) => {
            const styleKey = e.data?.edgeStyle || "arrow";
            return {
              ...e,
              ...getEdgeVisualProps(styleKey, Boolean(e.selected)),
            };
          });
          const selected = next.find((e) => e.selected);
          if (selected?.data?.edgeStyle) {
            setEdgeStyle(selected.data.edgeStyle);
          }
          return next;
        });
      });
    },
    [onEdgesChange, setEdges],
  );

  const applyEdgeStyleChoice = useCallback(
    async (nextStyle) => {
      setEdgeStyle(nextStyle);
      setStyleMenuOpen(false);

      const selectedEdges = edges.filter((e) => e.selected);
      if (selectedEdges.length === 0) return;

      try {
        await Promise.all(
          selectedEdges.map((e) => updateImageStudioProjectEdgeStyle(e.id, nextStyle)),
        );
        setEdges((prev) =>
          prev.map((e) => {
            if (!e.selected) return e;
            const visual = getEdgeVisualProps(nextStyle, true);
            return {
              ...e,
              ...visual,
              data: {
                ...e.data,
                edgeStyle: nextStyle,
              },
            };
          }),
        );
        onCanvasChanged?.();
      } catch (err) {
        console.error(err);
      }
    },
    [edges, setEdges, onCanvasChanged],
  );

  const canAcceptDrop = useCallback((dataTransfer) => {
    const types = Array.from(dataTransfer?.types || []);
    return (
      types.includes("application/x-vw-image-studio-history") ||
      types.includes("application/json") ||
      types.includes("Files") ||
      Boolean(parseHistoryDragPayload(dataTransfer))
    );
  }, []);

  const handleCanvasDragOver = useCallback(
    (e) => {
      if (!canAcceptDrop(e.dataTransfer)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    },
    [canAcceptDrop],
  );

  const handleCanvasDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleCanvasDrop = useCallback(
    async (e) => {
      e.preventDefault();
      setIsDragOver(false);
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      const payload = parseHistoryDragPayload(e.dataTransfer);
      if (payload?.imageUrl) {
        await onDropHistoryImage?.(payload, flowPos);
        return;
      }

      const file = Array.from(e.dataTransfer?.files || []).find((f) =>
        f.type?.startsWith("image/"),
      );
      if (file) {
        await onDropImageFile?.(file, flowPos);
      }
    },
    [screenToFlowPosition, onDropHistoryImage, onDropImageFile],
  );

  const nodeTypes = useMemo(() => NODE_TYPES, []);
  const edgeTypes = useMemo(() => EDGE_TYPES, []);
  const activeStyleLabel = t(
    EDGE_STYLE_OPTIONS.find((o) => o.id === edgeStyle)?.labelKey ||
      "imageStudio.edgeStyleArrow",
  );

  return (
    <div className="image-studio-project-canvas-wrap">
      <div className="image-studio-project-canvas-toolbar">
        <button
          type="button"
          className="image-studio-project-back-btn"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span>{t("imageStudio.backToProjects")}</span>
        </button>
        <h2 className="image-studio-project-canvas-title">{project?.name}</h2>
        <div className="image-studio-project-canvas-actions">
          <div className="image-studio-edge-style-wrap" ref={styleMenuRef}>
            <button
              type="button"
              className={`image-studio-project-tool-btn${styleMenuOpen ? " is-active" : ""}`}
              onClick={() => setStyleMenuOpen((v) => !v)}
              title={t("imageStudio.edgeStyleHelp")}
              aria-haspopup="menu"
              aria-expanded={styleMenuOpen}
            >
              <EdgeStyleIcon styleId={edgeStyle} />
              <span className="hidden sm:inline">{activeStyleLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </button>
            {styleMenuOpen ? (
              <div className="image-studio-edge-style-menu" role="menu">
                {EDGE_STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={edgeStyle === opt.id}
                    className={edgeStyle === opt.id ? "is-active" : ""}
                    onClick={() => void applyEdgeStyleChoice(opt.id)}
                  >
                    <EdgeStyleIcon styleId={opt.id} />
                    <span>{t(opt.labelKey)}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={`image-studio-project-canvas${isDragOver ? " is-drop-target" : ""}`}
        onDragOver={handleCanvasDragOver}
        onDragLeave={handleCanvasDragLeave}
        onDrop={(e) => void handleCanvasDrop(e)}
      >
        {loading ? (
          <div className="image-studio-project-canvas-loading">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" aria-hidden />
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onConnectStart={handleConnectStart}
            onConnectEnd={handleConnectEnd}
            isValidConnection={isValidConnection}
            connectionLineStyle={CONNECTION_LINE_STYLE}
            connectionRadius={44}
            connectionMode={ConnectionMode.Loose}
            nodesConnectable
            edgesFocusable
            elementsSelectable
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            selectionMode={SelectionMode.Partial}
            fitView
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={["Backspace", "Delete"]}
            onEdgesDelete={(deleted) => {
              for (const edge of deleted) {
                void handleDeleteEdge(edge.id);
              }
            }}
            onNodesDelete={(deleted) => {
              for (const node of deleted) {
                void deleteImageStudioProjectNode(node.id);
              }
              if (deleted.some((n) => n.id === selectedNodeId)) {
                onSelectNode?.(null);
              }
              onCanvasChanged?.();
            }}
          >
            <Background color="rgba(255,255,255,0.06)" gap={20} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}

        {!loading && nodes.length === 0 ? (
          <div className="image-studio-project-canvas-empty" aria-hidden={false}>
            <p>{t("imageStudio.projectCanvasEmpty")}</p>
          </div>
        ) : null}

        {isDragOver ? (
          <div className="image-studio-project-canvas-drop-hint" aria-hidden>
            {t("imageStudio.projectDropHint")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ImageStudioProjectCanvas(props) {
  return (
    <ReactFlowProvider>
      <ProjectCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
