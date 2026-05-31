import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Plus, Play, Pause, Eye, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCampaigns, useSetCampaignStatus, useDeleteCampaign, type DialerCampaign } from "@/features/dialer/hooks";
import { useAuth } from "@/features/auth/AuthProvider";
import { usePermission } from "@/hooks/usePermissions";
import { NewCampaignDialog } from "@/features/dialer/NewCampaignDialog";

const FILTER_KEYS = ["all", "mine", "active", "paused", "completed"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
const FILTER_LABEL: Record<FilterKey, string> = {
  all: "Todas",
  mine: "Minhas",
  active: "Ativas",
  paused: "Pausadas",
  completed: "Concluídas",
};

function StatusBadge({ s }: { s: DialerCampaign["status"] }) {
  const map: Record<string, { c: string; t: string }> = {
    draft: { c: "bg-slate-500/15 text-slate-600 border-slate-500/30", t: "Rascunho" },
    active: { c: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", t: "Ativa" },
    paused: { c: "bg-amber-500/15 text-amber-600 border-amber-500/30", t: "Pausada" },
    completed: { c: "bg-blue-500/15 text-blue-600 border-blue-500/30", t: "Concluída" },
  };
  const m = map[s] ?? map.draft;
  return <Badge className={`${m.c} border`}>{m.t}</Badge>;
}

export default function Dialer() {
  const { data: campaigns = [] } = useCampaigns();
  const { user } = useAuth();
  const setStatus = useSetCampaignStatus();
  const deleteCampaign = useDeleteCampaign();
  const canDelete = usePermission("dialer.campaign_delete");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showNew, setShowNew] = useState(false);
  const [toDelete, setToDelete] = useState<DialerCampaign | null>(null);

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (filter === "mine") return c.created_by === user?.id;
      if (filter === "active") return c.status === "active";
      if (filter === "paused") return c.status === "paused";
      if (filter === "completed") return c.status === "completed";
      return true;
    });
  }, [campaigns, filter, user?.id]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" /> Discador Automático
          </h1>
          <p className="text-sm text-muted-foreground">
            Campanhas de ligações automatizadas com IA Coach
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Campanha
        </Button>
      </div>

      <div className="flex gap-1 border-b">
        {FILTER_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              filter === k ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {FILTER_LABEL[k]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Phone className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">Nenhuma campanha</h3>
          <p className="text-sm text-muted-foreground mt-1">Crie sua primeira campanha de discador automático.</p>
          <Button onClick={() => setShowNew(true)} className="mt-4 gap-2">
            <Plus className="h-4 w-4" /> Nova Campanha
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const target = c.target_count ?? 0;
            const done = c.completed_count ?? 0;
            const pct = target > 0 ? Math.round((done / target) * 100) : 0;
            return (
              <Card key={c.id} className="relative p-4 space-y-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2 pr-8">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    {c.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</div>
                    )}
                  </div>
                  <StatusBadge s={c.status} />
                </div>
                {canDelete && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-2 right-2 h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setToDelete(c)}
                        aria-label="Excluir campanha"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Excluir campanha</TooltipContent>
                  </Tooltip>
                )}

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progresso</span>
                    <span className="tabular-nums font-medium text-foreground">{done} / {target}</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded border p-1.5">
                    <div className="font-bold text-emerald-600">{c.atendeu_count ?? 0}</div>
                    <div className="text-muted-foreground">Atendeu</div>
                  </div>
                  <div className="rounded border p-1.5">
                    <div className="font-bold text-slate-500">{c.nao_atendeu_count ?? 0}</div>
                    <div className="text-muted-foreground">Não at.</div>
                  </div>
                  <div className="rounded border p-1.5">
                    <div className="font-bold text-blue-600">{c.convertido_count ?? 0}</div>
                    <div className="text-muted-foreground">Convertidos</div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  {(c.status === "draft" || c.status === "paused") && (
                    <Button asChild size="sm" className="flex-1 gap-1">
                      <Link to={`/discador/${c.id}`}>
                        <Play className="h-3.5 w-3.5" />
                        {c.status === "paused" ? "Continuar" : "Iniciar"}
                      </Link>
                    </Button>
                  )}
                  {c.status === "active" && (
                    <>
                      <Button asChild size="sm" className="flex-1 gap-1">
                        <Link to={`/discador/${c.id}`}>
                          <Play className="h-3.5 w-3.5" /> Operar
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus.mutate({ id: c.id, status: "paused" })}
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {c.status === "completed" && (
                    <Button asChild size="sm" variant="outline" className="flex-1 gap-1">
                      <Link to={`/discador/${c.id}`}>
                        <Eye className="h-3.5 w-3.5" /> Ver
                      </Link>
                    </Button>
                  )}
                  {c.status !== "active" && c.status !== "completed" && (
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/discador/${c.id}`}>
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>

                {c.status === "completed" && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Encerrada
                  </div>
                )}
                {c.status === "paused" && (
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <XCircle className="h-3.5 w-3.5" /> Pausada
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <NewCampaignDialog open={showNew} onOpenChange={setShowNew} />
    </div>
  );
}
