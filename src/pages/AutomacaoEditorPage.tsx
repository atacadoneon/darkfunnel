import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  History, Pencil, Copy, Download, Upload, Trash2, ArrowLeft, FileText, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { AutomacoesSidebar } from "@/components/automacoes/AutomacoesSidebar";
import { BlocksSidebar } from "@/components/automacoes/BlocksSidebar";
import { FlowCanvas } from "@/components/automacoes/FlowCanvas";
import { CreateFlowDialog } from "@/components/automacoes/CreateFlowDialog";
import { TriggerPickerDialog } from "@/components/automacoes/TriggerPickerDialog";
import { NodeEditorDrawer } from "@/components/automacoes/NodeEditorDrawer";
import { ExecutionHistoryDrawer } from "@/components/automacoes/ExecutionHistoryDrawer";
import { useFlow, useFlowMutations } from "@/hooks/useFlow";
import { useFlowNodes, type FlowNode } from "@/hooks/useFlowNodes";
import { toast } from "sonner";

export default function AutomacaoEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: flow, isLoading } = useFlow(id);
  const { update, remove } = useFlowMutations();
  const { nodes, edges } = useFlowNodes(id);

  const [createOpen, setCreateOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<FlowNode | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (flow) { setName(flow.name); setDescription(flow.description ?? ""); }
  }, [flow]);

  if (!isLoading && !flow) {
    return (
      <div className="p-8">
        <p className="text-sm">Automação não encontrada.</p>
        <Button variant="link" onClick={() => navigate("/automacoes")}>Voltar</Button>
      </div>
    );
  }
  if (!flow) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando editor…</div>;
  }

  const handleSaveName = () => {
    if (name !== flow.name || description !== (flow.description ?? "")) {
      update.mutate({ id: flow.id, patch: { name, description } });
    }
  };

  const handleExport = () => {
    const json = {
      trigger: { type: flow.trigger_type, config: flow.trigger_config },
      nodes: nodes.map((n) => ({
        node_id: n.node_id, node_type: n.node_type,
        position_x: n.position_x, position_y: n.position_y, config: n.config,
      })),
      edges: edges.map((e) => ({
        edge_id: e.edge_id,
        source_node_id: e.source_node_id, source_handle: e.source_handle,
        target_node_id: e.target_node_id, target_handle: e.target_handle,
      })),
    };
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flow.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = () => {
    if (!confirm(`Excluir automação "${flow.name}"?`)) return;
    remove.mutate(flow.id, {
      onSuccess: () => { toast.success("Excluída"); navigate("/automacoes"); },
    });
  };

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      <AutomacoesSidebar activeFlowId={flow.id} onCreateClick={() => setCreateOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b flex items-center gap-2 px-4 bg-card/50">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/automacoes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveName}
              className="h-7 text-sm font-semibold border-transparent hover:border-input focus:border-input"
            />
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveName}
              placeholder="Descrição..."
              className="h-6 text-xs text-muted-foreground border-transparent hover:border-input focus:border-input"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">
              {flow.is_active ? "Ativa" : "Inativa"}
            </span>
            <Switch
              checked={flow.is_active}
              onCheckedChange={(v) => update.mutate({ id: flow.id, patch: { is_active: v } })}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHistoryOpen(true)} title="Histórico">
              <History className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSaveName} title="Salvar">
              <Save className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar detalhes">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicar">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExport} title="Exportar JSON">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Importar JSON">
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Copiar link"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copiado");
              }}
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleDelete} title="Excluir">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 flex min-h-0">
          <FlowCanvas
            flow={flow}
            onEditNode={(n) => setEditingNode(n)}
            onPickTrigger={() => setTriggerOpen(true)}
          />
          <BlocksSidebar />
        </div>
      </div>

      <CreateFlowDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <TriggerPickerDialog open={triggerOpen} onClose={() => setTriggerOpen(false)} flow={flow} />
      <NodeEditorDrawer
        open={!!editingNode}
        onClose={() => setEditingNode(null)}
        node={editingNode}
        flowId={flow.id}
      />
      <ExecutionHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} flowId={flow.id} />
    </div>
  );
}
