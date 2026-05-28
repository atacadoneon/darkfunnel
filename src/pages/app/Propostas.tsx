import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { FileText, Plus, Eye, Send, CheckCircle2, XCircle, FileEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  useProposalMutations,
  useProposals,
  type Proposal,
  type ProposalStatus,
} from "@/hooks/useProposals";

const COLUMNS: { id: ProposalStatus; label: string; icon: typeof FileEdit; tone: string }[] = [
  { id: "rascunho", label: "Rascunho", icon: FileEdit, tone: "bg-muted text-foreground" },
  { id: "enviada", label: "Enviada", icon: Send, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { id: "vista", label: "Vista", icon: Eye, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { id: "aprovada", label: "Aprovada", icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { id: "rejeitada", label: "Rejeitada", icon: XCircle, tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
];

function brl(cents: number | null | undefined) {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: proposal.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-3 cursor-grab active:cursor-grabbing space-y-2 hover:border-primary/50 transition-colors ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono">
          {(proposal.series ?? "P")}-{String(proposal.number).padStart(4, "0")}
        </span>
        <span>{new Date(proposal.created_at).toLocaleDateString("pt-BR")}</span>
      </div>
      <div className="font-medium text-sm truncate">
        {proposal.customer_name || "Sem cliente"}
      </div>
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="font-mono">
          {brl(proposal.total_cents)}
        </Badge>
        {proposal.valid_until && (
          <span className="text-[10px] text-muted-foreground">
            Vál.: {new Date(proposal.valid_until).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>
    </Card>
  );
}

function Column({
  status,
  proposals,
}: {
  status: (typeof COLUMNS)[number];
  proposals: Proposal[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  const Icon = status.icon;
  const total = proposals.reduce((s, p) => s + (p.total_cents ?? 0), 0);
  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className={`p-1.5 rounded ${status.tone}`}>
            <Icon className="w-3.5 h-3.5" />
          </span>
          <span className="font-semibold text-sm">{status.label}</span>
          <Badge variant="outline" className="text-[10px]">
            {proposals.length}
          </Badge>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">{brl(total)}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] rounded-lg border border-dashed p-2 space-y-2 transition-colors ${
          isOver ? "border-primary bg-primary/5" : "border-border bg-muted/30"
        }`}
      >
        {proposals.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-8">
            Vazio
          </div>
        ) : (
          proposals.map((p) => <ProposalCard key={p.id} proposal={p} />)
        )}
      </div>
    </div>
  );
}

export default function Propostas() {
  const { data: proposals = [], isLoading } = useProposals();
  const { create, updateStatus } = useProposalMutations();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [creating, setCreating] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, Proposal[]>();
    COLUMNS.forEach((c) => map.set(c.id, []));
    for (const p of proposals) {
      const key = COLUMNS.find((c) => c.id === p.status) ? p.status : "rascunho";
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [proposals]);

  const handleDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const target = e.over?.id as ProposalStatus | undefined;
    if (!target) return;
    const current = proposals.find((p) => p.id === id);
    if (!current || current.status === target) return;
    updateStatus.mutate(
      { id, status: target },
      {
        onError: (err) => toast.error("Falha ao atualizar", { description: String(err) }),
      },
    );
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const p = await create.mutateAsync({});
      toast.success(`Proposta ${p.series ?? "P"}-${String(p.number).padStart(4, "0")} criada`);
    } catch (err) {
      toast.error("Falha ao criar proposta", { description: String(err) });
    } finally {
      setCreating(false);
    }
  };

  const totals = useMemo(() => {
    const sum = (st: ProposalStatus) =>
      (grouped.get(st) ?? []).reduce((s, p) => s + (p.total_cents ?? 0), 0);
    return {
      total: proposals.reduce((s, p) => s + (p.total_cents ?? 0), 0),
      aprovada: sum("aprovada"),
      enviadas: sum("enviada") + sum("vista"),
    };
  }, [proposals, grouped]);

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Propostas Comerciais</h1>
          <p className="text-sm text-muted-foreground">
            Kanban de propostas — arraste entre colunas para mudar o status.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Proposta
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total em pipeline</div>
          <div className="text-lg font-bold font-mono">{brl(totals.total)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Em negociação</div>
          <div className="text-lg font-bold font-mono">{brl(totals.enviadas)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Aprovadas</div>
          <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {brl(totals.aprovada)}
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Carregando…
        </div>
      ) : proposals.length === 0 ? (
        <Card className="p-12 text-center border-dashed flex-1 flex flex-col items-center justify-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">Nenhuma proposta ainda</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Clique em "Nova Proposta" para começar.
          </p>
          <Button onClick={handleCreate} disabled={creating}>
            <Plus className="w-4 h-4 mr-2" />
            Criar primeira proposta
          </Button>
        </Card>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-4 h-full pb-4">
              {COLUMNS.map((col) => (
                <Column key={col.id} status={col} proposals={grouped.get(col.id) ?? []} />
              ))}
            </div>
          </div>
        </DndContext>
      )}
    </div>
  );
}
