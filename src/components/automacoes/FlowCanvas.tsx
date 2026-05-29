import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, useReactFlow,
  type Connection, type Node, type Edge, type NodeChange, type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useFlowNodes, useFlowNodeMutations, type FlowNode } from "@/hooks/useFlowNodes";
import { useFlowMutations, type Flow } from "@/hooks/useFlow";
import { useTriggerCatalog } from "@/hooks/useTriggerCatalog";
import { StartNode } from "./nodes/StartNode";
import { MessageNode } from "./nodes/MessageNode";
import { ActionNode } from "./nodes/ActionNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { WaitNode } from "./nodes/WaitNode";
import { RandomNode } from "./nodes/RandomNode";
import { ApiNode } from "./nodes/ApiNode";
import { FieldsNode } from "./nodes/FieldsNode";
import { AiNode } from "./nodes/AiNode";
import { JavascriptNode } from "./nodes/JavascriptNode";
import { toast } from "sonner";

const NODE_TYPES = {
  start: StartNode,
  message: MessageNode,
  action: ActionNode,
  condition: ConditionNode,
  wait: WaitNode,
  random: RandomNode,
  api: ApiNode,
  fields: FieldsNode,
  ai: AiNode,
  javascript: JavascriptNode,
};

type Props = {
  flow: Flow;
  onEditNode: (node: FlowNode) => void;
  onPickTrigger: () => void;
};

function CanvasInner({ flow, onEditNode, onPickTrigger }: Props) {
  const { nodes: dbNodes, edges: dbEdges } = useFlowNodes(flow.id);
  const { createNode, updateNode, deleteNode, createEdge, deleteEdge } = useFlowNodeMutations(flow.id);
  const { update: updateFlow } = useFlowMutations();
  const { data: triggers = [] } = useTriggerCatalog();
  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const triggerLabel = useMemo(() => {
    if (!flow.trigger_type) return null;
    return triggers.find((t) => t.slug === flow.trigger_type)?.display_name ?? flow.trigger_type;
  }, [flow.trigger_type, triggers]);

  const initialNodes: Node[] = useMemo(() =>
    dbNodes.map((n) => ({
      id: n.id,
      type: n.node_type,
      position: { x: n.position_x, y: n.position_y },
      data: {
        node_type: n.node_type,
        config: n.config,
        success_count: n.success_count,
        warning_count: n.warning_count,
        error_count: n.error_count,
        triggerLabel: n.node_type === "start" ? triggerLabel : undefined,
        onPickTrigger: n.node_type === "start" ? onPickTrigger : undefined,
        onEdit: () => onEditNode(n),
        onDelete: () => {
          if (n.node_type === "start") {
            toast.error("Não é possível excluir o nó de Início");
            return;
          }
          if (confirm("Excluir este nó?")) deleteNode.mutate(n.id);
        },
      },
    })), [dbNodes, triggerLabel, onPickTrigger, onEditNode, deleteNode]);

  const initialEdges: Edge[] = useMemo(() =>
    dbEdges.map((e) => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      sourceHandle: e.source_handle ?? undefined,
      targetHandle: e.target_handle ?? undefined,
      type: "default",
    })), [dbEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => { setNodes(initialNodes); }, [initialNodes, setNodes]);
  useEffect(() => { setEdges(initialEdges); }, [initialEdges, setEdges]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    for (const c of changes) {
      if (c.type === "position" && !c.dragging && c.position) {
        updateNode.mutate({ id: c.id, patch: { position_x: c.position.x, position_y: c.position.y } });
      }
    }
  }, [onNodesChange, updateNode]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
  }, [onEdgesChange]);

  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return;
    setEdges((es) => addEdge(conn, es));
    createEdge.mutate({
      source_node_id: conn.source,
      target_node_id: conn.target,
      source_handle: conn.sourceHandle ?? null,
      target_handle: conn.targetHandle ?? null,
    });
  }, [createEdge, setEdges]);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    if (confirm("Remover esta conexão?")) deleteEdge.mutate(edge.id);
  }, [deleteEdge]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    const dbNode = dbNodes.find((n) => n.id === node.id);
    if (!dbNode || dbNode.node_type === "start") return;
    onEditNode(dbNode);
  }, [dbNodes, onEditNode]);


  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/flow-block");
    if (!type) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    createNode.mutate({
      node_type: type as FlowNode["node_type"],
      position_x: pos.x,
      position_y: pos.y,
      config: {},
    });
  }, [createNode, screenToFlowPosition]);

  const onMoveEnd = useCallback((_: any, vp: { x: number; y: number; zoom: number }) => {
    updateFlow.mutate({ id: flow.id, patch: { viewport: vp } });
  }, [flow.id, updateFlow]);

  return (
    <div ref={wrapperRef} className="flex-1 h-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onNodeClick={onNodeClick}
        onMoveEnd={onMoveEnd}
        defaultViewport={flow.viewport ?? { x: 0, y: 0, zoom: 1 }}
        snapToGrid
        snapGrid={[20, 20]}
        fitViewOptions={{ padding: 0.3 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}

export function FlowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
