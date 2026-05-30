import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Pause, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePlaybookRuns, usePlaybooksList, useRunSteps, useUpdateRun, useUpdateRunStep,
} from "@/features/playbook/hooks";
import { toast } from "sonner";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  running: "default",
  paused: "secondary",
  completed: "outline",
  abandoned: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  running: "Em andamento",
  paused: "Pausado",
  completed: "Concluído",
  abandoned: "Abandonado",
};

export default function PlaybookRunsPage() {
  const [status, setStatus] = useState<string>("all");
  const [pbId, setPbId] = useState<string>("all");
  const [openRun, setOpenRun] = useState<any | null>(null);

  const { data: playbooks = [] } = usePlaybooksList();
  const { data: runs = [], isLoading } = usePlaybookRuns({
    status: status === "all" ? undefined : status,
    playbookId: pbId === "all" ? undefined : pbId,
  });
  const updateRun = useUpdateRun();

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/playbook"><ArrowLeft className="h-4 w-4 mr-2" /> Playbooks</Link></Button>
        <h1 className="text-xl font-semibold ml-2">Execuções</h1>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={pbId} onValueChange={setPbId}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos playbooks</SelectItem>
            {playbooks.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-6 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !runs.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma execução ainda.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Playbook</TableHead>
                <TableHead>Deal / Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Iniciado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenRun(r)}>
                  <TableCell>
                    <Badge variant="outline" style={{ borderColor: r.playbooks?.color }}>{r.playbooks?.name ?? "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.deals?.title ?? r.contacts?.name ?? "—"}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>{STATUS_LABEL[r.status] ?? r.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.started_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {r.status === "running" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => updateRun.mutate({ id: r.id, patch: { status: "paused" } }, { onSuccess: () => toast.success("Pausado") })}>
                          <Pause className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive"
                          onClick={() => { if (confirm("Abandonar execução?")) updateRun.mutate({ id: r.id, patch: { status: "abandoned" } }); }}>
                          <XIcon className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <RunDetailSheet run={openRun} onClose={() => setOpenRun(null)} />
    </div>
  );
}

function RunDetailSheet({ run, onClose }: { run: any | null; onClose: () => void }) {
  const { data: steps = [] } = useRunSteps(run?.id);
  const updateStep = useUpdateRunStep();
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  return (
    <Sheet open={!!run} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader><SheetTitle>{run?.playbooks?.name ?? "Execução"}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-3">
          {steps.map((s) => (
            <Card key={s.id} className="p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">{s.playbook_steps?.position + 1}</Badge>
                <span className="font-medium flex-1 truncate text-sm">{s.playbook_steps?.title ?? "—"}</span>
                <Badge variant={s.status === "done" ? "default" : s.status === "skipped" ? "secondary" : s.status === "failed" ? "destructive" : "outline"}>
                  {s.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {s.due_at ? `Vence em ${new Date(s.due_at).toLocaleString("pt-BR")}` : "Sem prazo"}
                {s.completed_at && ` • feito em ${new Date(s.completed_at).toLocaleString("pt-BR")}`}
              </div>
              {s.status === "pending" && (
                <div className="mt-2 space-y-2">
                  <Textarea
                    placeholder="Notas..."
                    rows={2}
                    value={notesById[s.id] ?? s.notes ?? ""}
                    onChange={(e) => setNotesById((m) => ({ ...m, [s.id]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateStep.mutate({
                      id: s.id, runId: run.id,
                      patch: { status: "done", completed_at: new Date().toISOString(), notes: notesById[s.id] ?? null },
                    }, { onSuccess: () => toast.success("Concluído") })}>Marcar feito</Button>
                    <Button size="sm" variant="outline" onClick={() => updateStep.mutate({
                      id: s.id, runId: run.id, patch: { status: "skipped" },
                    })}>Pular</Button>
                  </div>
                </div>
              )}
              {s.notes && s.status !== "pending" && (
                <p className="text-xs text-muted-foreground mt-2 italic">"{s.notes}"</p>
              )}
            </Card>
          ))}
          {!steps.length && <div className="text-sm text-muted-foreground">Sem passos.</div>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
