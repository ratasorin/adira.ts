import { expectSuccess } from "../../../services/api";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal, ModalBody, ModalContent, ModalHeader, Spinner, } from "@heroui/react";
import NorthEastRoundedIcon from "@mui/icons-material/NorthEastRounded";
import { api } from "../../../services/api";
import { displayError } from "../../../utils/handle-error";
import { useSearchParams } from "react-router-dom";
import ReactFlow, { Background, BackgroundVariant, BaseEdge, EdgeLabelRenderer, Handle, MarkerType, Position, getBezierPath, type Edge, type EdgeProps, type Node, type NodeProps, } from "reactflow";
import { INVOICE_ID_SEARCH_PARAMS_KEY } from "../../../constants";
type LanguageValue = string | {
    _id: string;
    code?: string;
    name?: string;
} | null | undefined;
type InvoiceGraphChange = {
    field: string;
    old_value?: unknown;
    new_value?: unknown;
    type: "modification" | "addition" | "removal";
};
type InvoiceGraphNode = {
    id: string;
    version: number;
    language?: LanguageValue;
    from_invoice?: string | null;
    emitted_date?: string | Date;
};
type InvoiceGraphEdge = {
    id?: string;
    source: string;
    target: string;
    version: number;
    changes: InvoiceGraphChange[];
    changed_at?: string | Date;
    changed_by?: string;
};
type GraphResponse = {
    nodes: Record<string, InvoiceGraphNode>;
    adjacency: Record<string, InvoiceGraphEdge[]>;
    root_ids: string[];
    current_invoice_id: string;
};
type PositionedNode = InvoiceGraphNode & {
    x: number;
    y: number;
    languageName: string;
    isCurrent: boolean;
    createdAtLabel: string;
    createdByLabel: string;
};
const GRAPH_SCALE = 1.5;
const NODE_WIDTH = 128 * GRAPH_SCALE;
const NODE_HEIGHT = 96 * GRAPH_SCALE;
const COLUMN_GAP = 160 * GRAPH_SCALE;
const ROW_GAP = 72 * GRAPH_SCALE;
const PADDING = 48 * GRAPH_SCALE;
const toDate = (value: string | Date | undefined) => {
    if (!value)
        return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};
const formatShortDate = (value: string | Date | undefined) => {
    const date = toDate(value);
    if (!date)
        return "—";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
};
const formatShortId = (value: string | undefined) => {
    if (!value)
        return "—";
    if (value.length <= 12)
        return value;
    return `${value.slice(0, 6)}…${value.slice(-4)}`;
};
const toLanguageName = (language: LanguageValue) => {
    if (!language || typeof language === "string")
        return "";
    return language.name || language.code || "";
};
const isStructuredValue = (value: unknown) => value != null && typeof value === "object";
const prettifyField = (field: string) => field
    .replace(/\[[^\]]+\]/g, "")
    .split(".")
    .filter(Boolean)
    .map((segment) => segment.length ? segment[0].toUpperCase() + segment.slice(1) : segment)
    .join(" / ");
const formatChangeValue = (value: unknown) => {
    if (value == null)
        return "None";
    if (typeof value === "string")
        return value;
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    if (typeof value === "object") {
        const candidate = value as {
            name?: string;
            code?: string;
            _id?: string;
        };
        return candidate.name || candidate.code || candidate._id || "Open details";
    }
    return "Open details";
};
const formatStructuredValue = (value: unknown) => JSON.stringify(value, null, 2) || "null";
const getChangeMeta = (type: InvoiceGraphChange["type"]) => {
    if (type === "addition") {
        return {
            label: "Added",
            symbol: "+",
            badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
            panelClass: "border-emerald-200/80 bg-emerald-50/60",
            valueClass: "text-emerald-700",
        };
    }
    if (type === "removal") {
        return {
            label: "Removed",
            symbol: "−",
            badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
            panelClass: "border-rose-200/80 bg-rose-50/60",
            valueClass: "text-rose-700",
        };
    }
    return {
        label: "Modified",
        symbol: "+/−",
        badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
        panelClass: "border-amber-200/80 bg-amber-50/60",
        valueClass: "text-amber-700",
    };
};
const buildGraphLayout = (graph: GraphResponse) => {
    const levels = new Map<string, number>();
    const incomingByTarget = new Map<string, InvoiceGraphEdge>();
    for (const connections of Object.values(graph.adjacency)) {
        for (const edge of connections) {
            incomingByTarget.set(edge.target, edge);
        }
    }
    const walk = (nodeId: string, depth: number) => {
        const existing = levels.get(nodeId);
        if (existing !== undefined && existing >= depth)
            return;
        levels.set(nodeId, depth);
        for (const edge of graph.adjacency[nodeId] || []) {
            walk(edge.target, depth + 1);
        }
    };
    for (const rootId of graph.root_ids) {
        walk(rootId, 0);
    }
    const grouped = new Map<number, string[]>();
    for (const [nodeId, depth] of levels.entries()) {
        const rows = grouped.get(depth) || [];
        rows.push(nodeId);
        grouped.set(depth, rows);
    }
    const nodes = new Map<string, PositionedNode>();
    let maxX = 0;
    let maxY = 0;
    for (const [depth, ids] of Array.from(grouped.entries()).sort(([left], [right]) => left - right)) {
        ids
            .sort((left, right) => graph.nodes[left]!.version - graph.nodes[right]!.version)
            .forEach((nodeId, index) => {
            const row = graph.nodes[nodeId]!;
            const incomingEdge = incomingByTarget.get(nodeId);
            const createdAtLabel = formatShortDate(incomingEdge?.changed_at ?? row.emitted_date);
            const createdByLabel = formatShortId(incomingEdge?.changed_by);
            const x = PADDING + depth * (NODE_WIDTH + COLUMN_GAP);
            const y = PADDING + index * (NODE_HEIGHT + ROW_GAP);
            nodes.set(nodeId, {
                ...row,
                x,
                y,
                languageName: toLanguageName(row.language),
                isCurrent: nodeId === graph.current_invoice_id,
                createdAtLabel,
                createdByLabel,
            });
            maxX = Math.max(maxX, x + NODE_WIDTH + PADDING);
            maxY = Math.max(maxY, y + NODE_HEIGHT + PADDING);
        });
    }
    const edges: InvoiceGraphEdge[] = [];
    for (const connections of Object.values(graph.adjacency)) {
        for (const connection of connections) {
            edges.push({
                ...connection,
                id: `${connection.source}-${connection.target}`,
            });
        }
    }
    return {
        nodes: Array.from(nodes.values()),
        edges,
        width: Math.max(maxX, 1140),
        height: Math.max(maxY, 180),
    };
};
type FlowNodeData = {
    id: string;
    version: number;
    isCurrent: boolean;
    isFocused: boolean;
    createdAtLabel: string;
    createdByLabel: string;
    onOpen: (invoiceId: string) => void;
};
type HoverHandlers = {
    onEnter: (edgeId: string, edge: InvoiceGraphEdge, event: React.MouseEvent) => void;
    onMove: (edgeId: string, edge: InvoiceGraphEdge, event: React.MouseEvent) => void;
    onLeave: (edgeId: string) => void;
    onTogglePin: (edgeId: string, edge: InvoiceGraphEdge) => void;
};
type FlowEdgeData = {
    edge: InvoiceGraphEdge;
    hover: HoverHandlers;
    isHovered: boolean;
    isPinned: boolean;
};
const InvoiceVersionNode = memo(function InvoiceVersionNode({ data, }: NodeProps<FlowNodeData>) {
    return (<div className={[
            "relative w-[192px] select-none rounded-[22px] border bg-white px-4 py-3 shadow-sm transition",
            data.isCurrent ? "border-blue-400 bg-blue-50" : "border-zinc-300",
            data.isFocused ? "ring-2 ring-primary-300 shadow-md" : "",
        ].join(" ")}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 8, height: 8 }}/>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 8, height: 8 }}/>
      <div className="text-center text-lg font-semibold text-foreground">
        v{data.version}
      </div>
      <div className="mt-1 text-center text-xs font-medium text-default-500">
        Created {data.createdAtLabel}
      </div>
      <div className="mt-0.5 text-center text-xs font-medium text-default-500">
        By {data.createdByLabel}
      </div>
      {data.isFocused ? (<button type="button" aria-label={`Open invoice version ${data.version}`} onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.onOpen(data.id);
            }} className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-600 shadow-sm transition hover:bg-primary-50">
          <NorthEastRoundedIcon fontSize="inherit"/>
        </button>) : null}
    </div>);
});
const InvoiceVersionEdge = memo(function InvoiceVersionEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, data, }: EdgeProps<FlowEdgeData>) {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
    });
    const changes = data?.edge.changes ?? [];
    const hasAddition = changes.some((c) => c.type === "addition");
    const hasRemoval = changes.some((c) => c.type === "removal");
    const hasModification = changes.some((c) => c.type === "modification");
    const showPlus = hasAddition || hasModification;
    const showMinus = hasRemoval || hasModification;
    const stroke = data?.isHovered || data?.isPinned ? "#2563eb" : "#64748b";
    return (<>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ stroke, strokeWidth: 1.5 }}/>

      <EdgeLabelRenderer>
        <div className="nodrag nopan pointer-events-auto absolute" style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
        }} onMouseEnter={(event) => data?.hover.onEnter(id, data.edge, event)} onMouseMove={(event) => data?.hover.onMove(id, data.edge, event)} onMouseLeave={() => data?.hover.onLeave(id)} onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            data?.hover.onTogglePin(id, data.edge);
        }} data-edge-pill-id={id}>
          <div className={[
            "flex h-10 w-[96px] cursor-pointer items-center justify-center gap-2 rounded-2xl border bg-white/95 px-2 shadow-sm backdrop-blur",
            data?.isPinned
                ? "border-blue-300 shadow-blue-100"
                : "border-divider",
        ].join(" ")}>
            <span className={[
            "flex h-6 w-6 items-center justify-center rounded-full text-[15px] font-black leading-none",
            showPlus
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-300",
        ].join(" ")}>
              +
            </span>
            <span className="text-[15px] font-black leading-none text-foreground">
              /
            </span>
            <span className={[
            "flex h-6 w-6 items-center justify-center rounded-full text-[15px] font-black leading-none",
            showMinus
                ? "bg-rose-100 text-rose-700"
                : "bg-slate-100 text-slate-300",
        ].join(" ")}>
              −
            </span>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>);
});
export const InvoiceSaveVersionGraph = memo(function InvoiceSaveVersionGraph({ invoiceId, }: {
    invoiceId?: string;
}) {
    const [graph, setGraph] = useState<GraphResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
    const [hoveredEdge, setHoveredEdge] = useState<InvoiceGraphEdge | null>(null);
    const [pinnedEdgeId, setPinnedEdgeId] = useState<string | null>(null);
    const [focusedNodeId, setFocusedNodeId] = useState<string | null>(invoiceId || null);
    const [selectedChange, setSelectedChange] = useState<InvoiceGraphChange | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        setFocusedNodeId(invoiceId || null);
    }, [invoiceId]);
    useEffect(() => {
        if (!hoveredEdgeId)
            return;
        const clear = () => {
            setHoveredEdgeId(null);
            setHoveredEdge(null);
        };
        const onMove = (event: MouseEvent) => {
            const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
            const pill = target?.closest?.("[data-edge-pill-id]") as HTMLElement | null;
            if (!pill) {
                clear();
                return;
            }
            if (pill.getAttribute("data-edge-pill-id") !== hoveredEdgeId) {
                clear();
            }
        };
        window.addEventListener("mousemove", onMove, true);
        window.addEventListener("blur", clear);
        window.addEventListener("wheel", onMove, { capture: true });
        return () => {
            window.removeEventListener("mousemove", onMove, true);
            window.removeEventListener("blur", clear);
            window.removeEventListener("wheel", onMove, true);
        };
    }, [hoveredEdgeId]);
    useEffect(() => {
        if (!invoiceId) {
            setGraph(null);
            return;
        }
        setLoading(true);
        api("/invoices/:id/version-graph", "GET")({query: {}, 
            path: { id: invoiceId },
        })
            .run().then(expectSuccess).then((res) => res).then((data) => {
            setGraph(data);
        })
            .catch((error) => {
            setGraph(null);
            displayError(error, "[Error] Cannot load invoice version graph!");
        })
            .finally(() => setLoading(false));
    }, [invoiceId]);
    const layout = useMemo(() => {
        if (!graph)
            return null;
        return buildGraphLayout(graph);
    }, [graph]);
    const hoverHandlers = useMemo<HoverHandlers>(() => {
        return {
            onEnter: (edgeId, edge) => {
                setHoveredEdgeId(edgeId);
                setHoveredEdge(edge);
            },
            onMove: (edgeId, edge) => {
                setHoveredEdgeId(edgeId);
                setHoveredEdge(edge);
            },
            onLeave: (edgeId) => {
                setHoveredEdgeId((current) => (current === edgeId ? null : current));
                setHoveredEdge((current) => current && `${current.source}-${current.target}` === edgeId
                    ? null
                    : current);
            },
            onTogglePin: (edgeId) => {
                setPinnedEdgeId((current) => (current === edgeId ? null : edgeId));
            },
        };
    }, []);
    const pinnedEdge = useMemo(() => {
        if (!layout || !pinnedEdgeId)
            return null;
        return (layout.edges.find((edge) => `${edge.source}-${edge.target}` === pinnedEdgeId) || null);
    }, [layout, pinnedEdgeId]);
    const activeEdge = pinnedEdge ?? hoveredEdge;
    const activeChangeModalTitle = selectedChange
        ? `${getChangeMeta(selectedChange.type).label} ${prettifyField(selectedChange.field)}`
        : "";
    const openInvoiceVersion = useCallback((targetInvoiceId: string) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set(INVOICE_ID_SEARCH_PARAMS_KEY, targetInvoiceId);
        setSearchParams(nextParams);
    }, [searchParams, setSearchParams]);
    const nodes = useMemo<Node<FlowNodeData>[]>(() => {
        if (!layout)
            return [];
        return layout.nodes.map((node) => ({
            id: node.id,
            type: "invoiceNode",
            position: { x: node.x, y: node.y },
            data: {
                id: node.id,
                version: node.version,
                isCurrent: node.isCurrent,
                isFocused: node.id === focusedNodeId,
                createdAtLabel: node.createdAtLabel,
                createdByLabel: node.createdByLabel,
                onOpen: openInvoiceVersion,
            },
            draggable: false,
            selectable: false,
        }));
    }, [focusedNodeId, layout, openInvoiceVersion]);
    const edges = useMemo<Edge<FlowEdgeData>[]>(() => {
        if (!layout)
            return [];
        return layout.edges.map((edge) => {
            const id = `${edge.source}-${edge.target}`;
            return {
                id,
                source: edge.source,
                target: edge.target,
                type: "invoiceEdge",
                selectable: false,
                data: {
                    edge,
                    hover: hoverHandlers,
                    isHovered: id === hoveredEdgeId,
                    isPinned: id === pinnedEdgeId,
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: "#64748b",
                },
            };
        });
    }, [hoverHandlers, hoveredEdgeId, layout, pinnedEdgeId]);
    if (!invoiceId) {
        return (<div className="flex h-[210px] items-center justify-center rounded-xl border border-divider bg-background/60 px-4 text-sm text-foreground-500">
        Save the invoice to unlock the version graph.
      </div>);
    }
    if (loading) {
        return (<div className="flex h-[210px] items-center justify-center rounded-xl border border-divider bg-background/60">
        <Spinner size="sm"/>
      </div>);
    }
    if (!layout) {
        return (<div className="flex h-[210px] items-center justify-center rounded-xl border border-divider bg-background/60 px-4 text-sm text-foreground-500">
        Version graph unavailable.
      </div>);
    }
    return (<div ref={containerRef} className="relative w-full">
      <div className="relative h-[210px] w-full overflow-hidden rounded-xl border border-divider bg-background/60">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={{ invoiceNode: InvoiceVersionNode }} edgeTypes={{ invoiceEdge: InvoiceVersionEdge }} defaultViewport={{ x: 16, y: 12, zoom: 0.65 }} minZoom={0.45} maxZoom={1.6} panOnDrag={[0]} zoomOnScroll zoomOnPinch zoomOnDoubleClick={false} nodesConnectable={false} nodesDraggable={false} elementsSelectable={false} proOptions={{ hideAttribution: true }} fitView={false} onNodeClick={(_event, node) => {
            setFocusedNodeId(node.id);
        }} onNodeDoubleClick={(_event, node) => {
            setFocusedNodeId(node.id);
            openInvoiceVersion(node.id);
        }} onPaneClick={() => {
            setFocusedNodeId(null);
        }}>
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="rgba(148,163,184,0.35)"/>
        </ReactFlow>
      </div>

      {activeEdge ? (<div className="mt-3 w-full rounded-2xl border border-divider bg-background p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-foreground-500">
              {activeEdge.changes.length} changes {pinnedEdge ? "(pinned)" : ""}
            </div>
            <div className="text-[11px] text-foreground-400">
              Click a row to inspect details
            </div>
          </div>
          <div className="mt-3 flex max-h-52 flex-col gap-2 overflow-auto pr-1">
            {activeEdge.changes.length ? (activeEdge.changes.map((change, index) => {
                const meta = getChangeMeta(change.type);
                const currentValue = change.type === "addition"
                    ? change.new_value
                    : change.old_value;
                const showViewerButton = change.type === "modification" ||
                    isStructuredValue(currentValue);
                return (<button key={`${change.field}-${index}`} type="button" onClick={() => {
                        if (showViewerButton)
                            setSelectedChange(change);
                    }} className={[
                        "w-full rounded-2xl border p-3 text-left transition",
                        meta.panelClass,
                        showViewerButton
                            ? "hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                            : "",
                    ].join(" ")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={[
                        "inline-flex min-w-14 items-center justify-center rounded-full border px-2 py-1 text-[11px] font-semibold",
                        meta.badgeClass,
                    ].join(" ")}>
                            {meta.symbol} {meta.label}
                          </span>
                          <span className="truncate text-sm font-semibold text-foreground">
                            {prettifyField(change.field)}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-foreground-600">
                          {change.type === "modification" ? (<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              <div className="min-w-0">
                                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground-400">
                                  Previous
                                </div>
                                <div className="truncate">
                                  {formatChangeValue(change.old_value)}
                                </div>
                              </div>
                              <div className="min-w-0">
                                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground-400">
                                  New
                                </div>
                                <div className={`truncate ${meta.valueClass}`}>
                                  {formatChangeValue(change.new_value)}
                                </div>
                              </div>
                            </div>) : (<div className={`truncate ${meta.valueClass}`}>
                              {formatChangeValue(currentValue)}
                            </div>)}
                        </div>
                      </div>
                      {showViewerButton ? (<span className="shrink-0 rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold text-foreground-600">
                          {change.type === "modification" ? "Compare" : "View"}
                        </span>) : null}
                    </div>
                  </button>);
            })) : (<div className="text-xs text-foreground-500">
                No tracked field changes.
              </div>)}
          </div>
        </div>) : null}

      <Modal isOpen={Boolean(selectedChange)} onClose={() => setSelectedChange(null)} size="3xl" classNames={{
            wrapper: "z-[1000000] absolute",
            backdrop: "z-[1000000] absolute",
        }} scrollBehavior="inside">
        <ModalContent className="z-[2201] absolute">
          <ModalHeader>{activeChangeModalTitle}</ModalHeader>
          <ModalBody className="pb-6">
            {selectedChange ? (selectedChange.type === "modification" ? (<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-divider bg-default-50/60 p-4">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-foreground-500">
                      Previous
                    </div>
                    <pre className="whitespace-pre-wrap break-words text-xs text-foreground">
                      {formatStructuredValue(selectedChange.old_value)}
                    </pre>
                  </div>
                  <div className="rounded-2xl border border-divider bg-default-50/60 p-4">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-foreground-500">
                      New
                    </div>
                    <pre className="whitespace-pre-wrap break-words text-xs text-foreground">
                      {formatStructuredValue(selectedChange.new_value)}
                    </pre>
                  </div>
                </div>) : (<div className="rounded-2xl border border-divider bg-default-50/60 p-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-foreground-500">
                    {selectedChange.type === "addition"
                ? "Added value"
                : "Removed value"}
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-xs text-foreground">
                    {formatStructuredValue(selectedChange.type === "addition"
                ? selectedChange.new_value
                : selectedChange.old_value)}
                  </pre>
                </div>)) : null}
            <div className="flex justify-end">
              <Button variant="light" onPress={() => setSelectedChange(null)}>
                Close
              </Button>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>);
});
