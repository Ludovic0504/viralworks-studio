import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
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
/** Largeur / hauteur visuelle de l'image sur le canvas (hors boutons @). */
const PROJECT_NODE_MEDIA_SIZE = 168;

const CONNECTION_LINE_STYLE = {
  stroke: "#8fc9b5",
  strokeWidth: 2.5,
  strokeDasharray: "6 4",
};

function dbNodesToFlow(nodes, selectedId, options = {}) {
  const { connectingFromId = null, onAssignSlot = null } = options;
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
      onAssignSlot,
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
  onAssignSlot,
  onBack,
  onCanvasChanged,
  onDropHistoryImage,
  onDropImageFile,
  canvasApiRef,
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
  const onAssignSlotRef = useRef(onAssignSlot);
  const styleMenuRef = useRef(null);
  const paneRef = useRef(null);
  const hasLoadedProjectRef = useRef(null);
  const handleAssignSlotStableRef = useRef(null);
  const edgeCallbacksStableRef = useRef(null);
  const { fitView, screenToFlowPosition, getViewport, setViewport } = useReactFlow();

  const handleAssignSlot = useCallback((kind, payload) => {
    onAssignSlotRef.current?.(kind, payload);
  }, []);

  useEffect(() => {
    edgeStyleRef.current = edgeStyle;
  }, [edgeStyle]);

  useEffect(() => {
    onAssignSlotRef.current = onAssignSlot;
  }, [onAssignSlot]);

  useEffect(() => {
    hasLoadedProjectRef.current = null;
  }, [project?.id]);

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

  useEffect(() => {
    handleAssignSlotStableRef.current = handleAssignSlot;
    edgeCallbacksStableRef.current = edgeCallbacks;
  }, [handleAssignSlot, edgeCallbacks]);

  useImperativeHandle(
    canvasApiRef,
    () => ({
      /** Centre du viewport visible → position top-left du nœud pour y centrer l'image. */
      getViewportCenterPosition() {
        const el = paneRef.current;
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        const flow = screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
        return {
          x: flow.x - PROJECT_NODE_MEDIA_SIZE / 2,
          y: flow.y - PROJECT_NODE_MEDIA_SIZE / 2,
        };
      },
      /** Ajoute des nœuds/liens sans recharger ni bouger le viewport. */
      appendNodes(dbNodes, dbEdges = []) {
        const nodesToAdd = Array.isArray(dbNodes) ? dbNodes.filter(Boolean) : [];
        if (nodesToAdd.length === 0 && (!dbEdges || dbEdges.length === 0)) return;

        if (nodesToAdd.length > 0) {
          const existingIds = new Set(dbNodesRef.current.map((n) => n.id));
          const fresh = nodesToAdd.filter((n) => n?.id && !existingIds.has(n.id));
          if (fresh.length > 0) {
            dbNodesRef.current = [...dbNodesRef.current, ...fresh];
            setNodes((prev) => {
              const prevIds = new Set(prev.map((n) => n.id));
              const flowNodes = dbNodesToFlow(fresh, null, {
                onAssignSlot: handleAssignSlotStableRef.current,
              }).filter((n) => !prevIds.has(n.id));
              return flowNodes.length ? [...prev, ...flowNodes] : prev;
            });
          }
        }

        if (Array.isArray(dbEdges) && dbEdges.length > 0) {
          setEdges((prev) => {
            const prevIds = new Set(prev.map((e) => e.id));
            const flowEdges = dbEdgesToFlow(
              dbEdges,
              edgeCallbacksStableRef.current || {},
            ).filter((e) => !prevIds.has(e.id));
            return flowEdges.length ? [...prev, ...flowEdges] : prev;
          });
        }
      },
    }),
    [screenToFlowPosition, setNodes, setEdges],
  );

  useEffect(() => {
    if (!styleMenuOpen) return;
    const onDown = (e) => {
      if (!styleMenuRef.current?.contains(e.target)) setStyleMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [styleMenuOpen]);

  const loadCanvas = useCallback(async () => {
    if (!project?.id) return;
    const isInitialLoad = hasLoadedProjectRef.current !== project.id;
    if (isInitialLoad) setLoading(true);
    const preservedViewport = isInitialLoad ? null : getViewport();
    try {
      const canvas = await loadImageStudioProjectCanvas(project.id);
      dbNodesRef.current = canvas.nodes;
      setNodes(
        dbNodesToFlow(canvas.nodes, null, {
          onAssignSlot: handleAssignSlotStableRef.current,
        }),
      );
      setEdges(
        dbEdgesToFlow(canvas.edges, edgeCallbacksStableRef.current || {}),
      );
      if (isInitialLoad) {
        hasLoadedProjectRef.current = project.id;
        window.requestAnimationFrame(() => {
          if (canvas.nodes.length > 0) {
            fitView({ padding: 0.2, duration: 200 });
          }
        });
      } else if (preservedViewport) {
        window.requestAnimationFrame(() => {
          setViewport(preservedViewport, { duration: 0 });
        });
      }
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }, [project?.id, setNodes, setEdges, fitView, getViewport, setViewport]);

  useEffect(() => {
    void loadCanvas();
  }, [loadCanvas, reloadToken]);

  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...n.data,
          linkPending: connectingFromId === n.id,
          isConnectTarget: Boolean(connectingFromId && connectingFromId !== n.id),
          onAssignSlot: handleAssignSlot,
        },
      })),
    );
  }, [connectingFromId, handleAssignSlot, setNodes]);

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

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }) => {
      const sel = Array.isArray(selectedNodes) ? selectedNodes : [];
      const single = sel.length === 1 ? sel[0] : null;

      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          data: {
            ...n.data,
            showAssignSlots: Boolean(single && single.id === n.id),
          },
        })),
      );

      if (single) {
        onSelectNode?.({
          nodeId: single.id,
          imageUrl: single.data?.imageUrl,
          prompt: single.data?.prompt,
          historyId: single.data?.historyId,
          posX: single.position?.x ?? 0,
          posY: single.position?.y ?? 0,
        });
        return;
      }
      onSelectNode?.(null);
    },
    [onSelectNode, setNodes],
  );

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
        ref={paneRef}
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
            multiSelectionKeyCode="Shift"
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            panOnDrag={[1, 2]}
            panOnScroll={false}
            zoomOnScroll
            zoomOnPinch
            zoomActivationKeyCode={null}
            onSelectionChange={handleSelectionChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
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

const ImageStudioProjectCanvas = forwardRef(function ImageStudioProjectCanvas(
  props,
  ref,
) {
  return (
    <ReactFlowProvider>
      <ProjectCanvasInner {...props} canvasApiRef={ref} />
    </ReactFlowProvider>
  );
});

export default ImageStudioProjectCanvas;
