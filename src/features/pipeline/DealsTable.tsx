import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, Archive, ArchiveRestore, ChevronLeft, ChevronRight, User, Layers } from "lucide-react";
import { formatMoney, type Deal, type Stage } from "./hooks";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { useLeadOrigins } from "./configHooks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SortKey = "title" | "value" | "stage" | "assignee" | "created" | "updated" | "status";
type SortDir = "asc" | "desc";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function DealsTable({
  deals, stages, onOpenDeal, includeArchived,
}: {
  deals: Deal[];
  stages: Stage[];
  onOpenDeal: (d: Deal) => void;
  includeArchived: boolean;
}) {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const { data: members = [] } = useWorkspaceMembers();
  const { data: origins = [] } = useLeadOrigins();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "updated", dir: "desc" });
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const stageMap = useMemo(() => Object.fromEntries(stages.map(s => [s.id, s])), [stages]);
  const memberMap = useMemo(() => Object.fromEntries(members.map((m: any) => [m.user_id, m])), [members]);
  const originMap = useMemo(() => Object.fromEntries(origins.map(o => [o.id, o])), [origins]);

  const sorted = useMemo(() => {
    const arr = [...deals];
    const dir = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sort.key) {
        case "title": return a.title.localeCompare(b.title, "pt-BR") * dir;
        case "value": return (a.value_cents - b.value_cents) * dir;
        case "stage": return (stageMap[a.stage_id]?.position ?? 0 - (stageMap[b.stage_id]?.position ?? 0)) * dir;
        case "assignee": {
          const an = memberMap[a.assigned_to ?? ""]?.display_name ?? "";
          const bn = memberMap[b.assigned_to ?? ""]?.display_name ?? "";
          return an.localeCompare(bn, "pt-BR") * dir;
        }
        case "created": return (+new Date(a.created_at) - +new Date(b.created_at)) * dir;
        case "updated": return (+new Date(a.updated_at) - +new Date(b.updated_at)) * dir;
        case "status": return a.status.localeCompare(b.status) * dir;
      }
    });
    return arr;
  }, [deals, sort, stageMap, memberMap]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageDeals = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const allOnPageSelected = pageDeals.length > 0 && pageDeals.every(d => selected.has(d.id));

  const toggleAllOnPage = () => {
    const next = new Set(selected);
    if (allOnPageSelected) pageDeals.forEach(d => next.delete(d.id));
    else pageDeals.forEach(d => next.add(d.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const SortHead = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <TableHead className={className}>
      <button
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => setSort(s => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" })}
      >
        {label}
        {sort.key === k
          ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
          : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </TableHead>
  );

  // Bulk actions
  const ids = Array.from(selected);
  const refetch = () => qc.invalidateQueries({ queryKey: ["deals", current?.id] });

  const bulkAssign = async (userId: string | null) => {
    if (!ids.length) return;
    const { error } = await supabase.from("deals").update({ assigned_to: userId }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} lead(s) atribuído(s)`); setSelected(new Set()); refetch();
  };
  const bulkMoveStage = async (stageId: string) => {
    if (!ids.length) return;
    const { error } = await supabase.from("deals").update({ stage_id: stageId }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} lead(s) movido(s)`); setSelected(new Set()); refetch();
  };
  const bulkArchive = async (archive: boolean) => {
    if (!ids.length) return;
    const { error } = await supabase.from("deals")
      .update({ archived_at: archive ? new Date().toISOString() : null })
      .in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} lead(s) ${archive ? "arquivado(s)" : "restaurado(s)"}`);
    setSelected(new Set()); refetch();
  };

  const totalValue = sorted.reduce((s, d) => s + d.value_cents, 0);
  const selectedValue = sorted.filter(d => selected.has(d.id)).reduce((s, d) => s + d.value_cents, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="px-4 md:px-6 py-2 border-b bg-primary/5 flex items-center gap-3 text-sm">
          <Badge variant="secondary">{selected.size} selecionado(s)</Badge>
          <span className="text-xs text-muted-foreground">{formatMoney(selectedValue)}</span>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1"><Layers className="h-3.5 w-3.5" /> Mover etapa</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                {stages.map(s => (
                  <DropdownMenuItem key={s.id} onClick={() => bulkMoveStage(s.id)}>
                    <span className="h-2 w-2 rounded-full mr-2" style={{ background: s.color }} />
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1"><User className="h-3.5 w-3.5" /> Atribuir</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                <DropdownMenuItem onClick={() => bulkAssign(null)}>Sem responsável</DropdownMenuItem>
                <DropdownMenuSeparator />
                {members.map((m: any) => (
                  <DropdownMenuItem key={m.user_id} onClick={() => bulkAssign(m.user_id)}>
                    {m.display_name ?? m.email}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {includeArchived
              ? <Button variant="outline" size="sm" className="gap-1" onClick={() => bulkArchive(false)}>
                  <ArchiveRestore className="h-3.5 w-3.5" /> Restaurar
                </Button>
              : <Button variant="outline" size="sm" className="gap-1" onClick={() => bulkArchive(true)}>
                  <Archive className="h-3.5 w-3.5" /> Arquivar
                </Button>}
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Limpar</Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto px-4 md:px-6 pb-3">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAllOnPage} />
                </TableHead>
                <SortHead k="title" label="Lead" />
                <TableHead>Contato</TableHead>
                <SortHead k="stage" label="Etapa" />
                <SortHead k="value" label="Valor" className="text-right" />
                <SortHead k="assignee" label="Responsável" />
                <TableHead>Origem</TableHead>
                <SortHead k="status" label="Status" />
                <SortHead k="created" label="Criado" />
                <SortHead k="updated" label="Atualizado" />
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageDeals.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center py-12 text-sm text-muted-foreground">Nenhum lead encontrado.</TableCell></TableRow>
              )}
              {pageDeals.map(d => {
                const stage = stageMap[d.stage_id];
                const member = memberMap[d.assigned_to ?? ""];
                const origin = originMap[(d as any).origin_id ?? ""];
                const isSel = selected.has(d.id);
                return (
                  <TableRow key={d.id} className={cn("group", isSel && "bg-muted/40")}>
                    <TableCell>
                      <Checkbox checked={isSel} onCheckedChange={() => toggleOne(d.id)} />
                    </TableCell>
                    <TableCell className="font-medium max-w-[220px]">
                      <button onClick={() => onOpenDeal(d)} className="hover:underline text-left truncate block w-full">
                        {d.title}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                      {d.contact?.display_name ?? "—"}
                      {d.contact?.phone_e164 && <div className="text-xs">{d.contact.phone_e164}</div>}
                    </TableCell>
                    <TableCell>
                      {stage && (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
                          {stage.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(d.value_cents, d.currency)}</TableCell>
                    <TableCell className="text-sm">{member?.display_name ?? member?.email ?? <span className="text-muted-foreground italic">—</span>}</TableCell>
                    <TableCell>
                      {origin
                        ? <Badge variant="outline" className="text-xs"><span className="h-1.5 w-1.5 rounded-full mr-1" style={{ background: origin.color }} />{origin.name}</Badge>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      {d.status === "won" && <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Ganho</Badge>}
                      {d.status === "lost" && <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Perdido</Badge>}
                      {d.status === "open" && <Badge variant="secondary">Aberto</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(d.created_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(d.updated_at)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onOpenDeal(d)}>Abrir</DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Mover para etapa</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                              {stages.map(s => (
                                <DropdownMenuItem key={s.id} onClick={async () => {
                                  await supabase.from("deals").update({ stage_id: s.id }).eq("id", d.id);
                                  refetch();
                                }}>
                                  <span className="h-2 w-2 rounded-full mr-2" style={{ background: s.color }} />{s.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          {d.archived_at
                            ? <DropdownMenuItem onClick={async () => {
                                await supabase.from("deals").update({ archived_at: null }).eq("id", d.id);
                                refetch();
                              }}>Restaurar</DropdownMenuItem>
                            : <DropdownMenuItem onClick={async () => {
                                await supabase.from("deals").update({ archived_at: new Date().toISOString() }).eq("id", d.id);
                                refetch();
                              }}>Arquivar</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Footer / pagination */}
      <div className="px-4 md:px-6 py-3 border-t flex items-center gap-3 text-xs text-muted-foreground">
        <span>{sorted.length} {sorted.length === 1 ? "lead" : "leads"} · Total {formatMoney(totalValue)}</span>
        <div className="ml-auto flex items-center gap-2">
          <span>Página {page + 1} de {totalPages}</span>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
