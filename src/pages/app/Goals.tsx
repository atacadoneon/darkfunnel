import { useEffect, useMemo, useState } from "react";
import { format, parseISO, getDaysInMonth } from "date-fns";
import {
  Target, Save, BarChart3, Trophy, Building2, Calendar as CalIcon,
  DollarSign, TrendingUp, Users, Plus, Info,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useGoal, useGoalActuals, useGoalMutations } from "@/hooks/useGoals";
import { DAY_LABELS, type GoalDailyActual, type GoalScope } from "@/types/goal";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useWorkspaceMembers, useIsManagerOrAdmin } from "@/features/workspace/permissions";
import { useSectors } from "@/features/channels/configHooks";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const YEARS = [2024, 2025, 2026, 2027];
const DAY_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ============= HEADER =============
function PageHeader({ workspace }: { workspace?: string }) {
  return (
    <div
      className="rounded-2xl p-6 flex items-center gap-4 text-white shadow-md"
      style={{ background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)" }}
    >
      <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
        <Target className="h-7 w-7" />
      </div>
      <div>
        <h1 className="text-2xl font-bold leading-tight">Metas de Faturamento</h1>
        <p className="text-sm text-white/80 mt-0.5">
          {workspace ?? "Workspace"} — Gerencie e acompanhe as metas da sua organização
        </p>
      </div>
    </div>
  );
}

function TabBar({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void }) {
  const items: { key: TabKey; label: string; icon: any }[] = [
    { key: "geral", label: "Geral", icon: Target },
    { key: "setoriais", label: "Setoriais", icon: BarChart3 },
    { key: "vendedores", label: "Vendedores", icon: Trophy },
  ];
  return (
    <div className="bg-white dark:bg-card rounded-xl shadow-sm border p-1.5 inline-flex gap-1">
      {items.map(({ key, label, icon: Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
              active
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

type TabKey = "geral" | "setoriais" | "vendedores";

// ============= ABA GERAL =============
type DailyRow = {
  date: Date; iso: string; dayLabel: string; isWorkingDay: boolean;
  metaBase: number | null; metaAjustada: number | null; realizado: number | null;
  deficit: number | null; isToday: boolean;
};

function buildDailyRows(
  goal: { year: number; month: number; target_amount: number; working_days_mask: number; holidays: string[] | null },
  actuals: GoalDailyActual[],
): DailyRow[] {
  const { year, month, target_amount, working_days_mask, holidays } = goal;
  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const holidaysSet = new Set((holidays || []).map((h) => String(h).slice(0, 10)));
  const isWD = (d: Date) => {
    const mask = 1 << d.getDay();
    if ((working_days_mask & mask) === 0) return false;
    return !holidaysSet.has(isoLocal(d));
  };
  const allDays = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month - 1, i + 1));
  const workingDays = allDays.filter(isWD);
  const metaBase = workingDays.length > 0 ? Number(target_amount) / workingDays.length : 0;
  const actualByDate = new Map(
    (actuals || []).map((a) => {
      const amt = (a as any).actual_amount ?? (a as any).amount ?? 0;
      return [a.date, Number(amt)] as const;
    }),
  );
  let acum = 0;
  const today = new Date(); today.setHours(0,0,0,0);

  return allDays.map((date) => {
    const iso = isoLocal(date);
    const dayLabel = DAY_SHORT[date.getDay()];
    const isToday = +date === +today;
    if (!isWD(date)) {
      return { date, iso, dayLabel, isWorkingDay: false, metaBase: null, metaAjustada: null, realizado: null, deficit: null, isToday };
    }
    const remaining = workingDays.filter((d) => d >= date).length;
    const metaAjustada = metaBase + (remaining > 0 ? acum / remaining : 0);
    const realizado = actualByDate.get(iso) ?? 0;
    const deficit = metaAjustada - realizado;
    if (date <= today) acum += Math.max(0, deficit);
    return { date, iso, dayLabel, isWorkingDay: true, metaBase, metaAjustada, realizado, deficit, isToday };
  });
}

function GeralTab({ year, month, setYear, setMonth }: {
  year: number; month: number; setYear: (n: number) => void; setMonth: (n: number) => void;
}) {
  const canEdit = useIsManagerOrAdmin();
  const { data: goal } = useGoal(year, month, "workspace", null);
  const { data: actuals = [] } = useGoalActuals(goal?.id ?? null);
  const { upsertGoal, upsertActual } = useGoalMutations();

  const [target, setTarget] = useState<number>(0);
  const [mask, setMask] = useState<number>(0b0111110);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setTarget(Number(goal?.target_amount ?? 0));
    setMask(goal?.working_days_mask ?? 0b0111110);
    setHolidays(goal?.holidays ?? []);
    setDrafts({});
  }, [goal?.id]);

  const toggleDay = (d: number) => setMask((m) => m ^ (1 << d));
  const dayChecked = (d: number) => (mask & (1 << d)) !== 0;

  const rows = useMemo(() => {
    const eff = {
      year, month,
      target_amount: goal?.target_amount ?? target,
      working_days_mask: goal?.working_days_mask ?? mask,
      holidays: goal?.holidays ?? holidays,
    };
    const merged: GoalDailyActual[] = [...actuals];
    Object.entries(drafts).forEach(([date, v]) => {
      if (v === "") return;
      const amount = Number(v); if (Number.isNaN(amount)) return;
      const i = merged.findIndex((a) => a.date === date);
      const row = { id: "draft", goal_id: goal?.id ?? "", date, amount, created_at: "", updated_at: "" } as any;
      row.actual_amount = amount;
      if (i >= 0) merged[i] = row; else merged.push(row);
    });
    return buildDailyRows(eff, merged);
  }, [year, month, goal, target, mask, holidays, actuals, drafts]);

  const workingDays = rows.filter((r) => r.isWorkingDay).length;
  const totalRealizado = rows.reduce((s, r) => s + (r.realizado ?? 0), 0);
  const totalTarget = Number(goal?.target_amount ?? target ?? 0);
  const faltaRealizar = Math.max(0, totalTarget - totalRealizado);
  const todayIso = isoLocal(new Date());
  const remainingWD = rows.filter((r) => r.isWorkingDay && r.iso >= todayIso).length;
  const ritmo = remainingWD > 0 ? faltaRealizar / remainingWD : 0;

  const saveConfig = async () => {
    try {
      await upsertGoal.mutateAsync({ year, month, scope: "workspace", scope_ref_id: null,
        target_amount: target, working_days_mask: mask, holidays });
      toast.success("Configurações salvas");
    } catch (e) { toast.error((e as Error).message); }
  };

  const saveRealized = async (date: string, value: string) => {
    if (!goal) return toast.error("Salve a configuração primeiro");
    if (value === "" || value === undefined) return;
    const amount = Number(value) || 0;
    try {
      await upsertActual.mutateAsync({ goal_id: goal.id, date, amount });
      setDrafts((d) => { const c = { ...d }; delete c[date]; return c; });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      {!canEdit && (
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-3 flex items-start gap-2 text-sm text-blue-900 dark:text-blue-200">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium">Visualização apenas:</span>{" "}
            Apenas Proprietários e Gerentes podem configurar metas.
          </div>
        </div>
      )}

      <Card className="rounded-2xl p-6 space-y-5 shadow-sm">
        <div>
          <h2 className="font-semibold text-lg">Configurações do Mês</h2>
          <p className="text-xs text-muted-foreground">Defina meta, dias trabalhados e folgas para o cálculo automático</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Mês</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ano</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Meta Mensal (R$)</Label>
            <Input type="number" value={target} disabled={!canEdit}
              onChange={(e) => setTarget(Number(e.target.value) || 0)} />
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Dias da semana trabalhados</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {DAY_LABELS.map((d, i) => {
              const checked = dayChecked(i);
              return (
                <label key={d} className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors",
                  checked
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
                    : "bg-background border-input text-muted-foreground hover:bg-muted/40",
                  !canEdit && "opacity-60 cursor-not-allowed",
                )}>
                  <Checkbox checked={checked} disabled={!canEdit} onCheckedChange={() => canEdit && toggleDay(i)} />
                  {d}
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Folgas e Feriados</Label>
          <div className="flex gap-2 mt-2">
            <Input type="date" disabled={!canEdit} value={newHoliday}
              onChange={(e) => setNewHoliday(e.target.value)} className="max-w-[200px]" />
            <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => {
              if (newHoliday && !holidays.includes(newHoliday)) {
                setHolidays([...holidays, newHoliday].sort()); setNewHoliday("");
              }
            }}>Adicionar</Button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {holidays.map((h) => (
              <button key={h} disabled={!canEdit}
                onClick={() => setHolidays(holidays.filter((x) => x !== h))}
                className="text-xs rounded-md border bg-muted px-2 py-1 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                {format(parseISO(h), "dd/MM/yyyy")} ✕
              </button>
            ))}
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={saveConfig} disabled={upsertGoal.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Save className="h-4 w-4 mr-2" /> Salvar Configurações
            </Button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <MetricCard label="Dias Úteis no Mês" value={String(workingDays)} icon={<CalIcon className="h-5 w-5" />} color="indigo" />
        <MetricCard label="Total Realizado" value={brl(totalRealizado)} icon={<DollarSign className="h-5 w-5" />} color="blue" />
        <MetricCard label="Falta Realizar" value={brl(faltaRealizar)} icon={<Target className="h-5 w-5" />} color="red" />
        <MetricCard label="Ritmo Necessário/dia" value={brl(ritmo)} icon={<TrendingUp className="h-5 w-5" />} color="green" />
      </div>

      <Card className="rounded-2xl p-0 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-semibold text-lg">Lançamento Diário — {MONTHS[month-1]} {year}</h2>
            <p className="text-xs text-muted-foreground">Registre o realizado de cada dia para acompanhar o déficit</p>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Data</TableHead>
              <TableHead>Dia</TableHead>
              <TableHead className="text-right">Meta Base</TableHead>
              <TableHead className="text-right">Meta Ajustada</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead className="text-right">Déficit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.iso} className={cn(
                "transition-colors",
                r.isToday && "bg-indigo-50/60 dark:bg-indigo-950/20",
                !r.isWorkingDay && "bg-muted/20",
              )}>
                <TableCell className="font-mono text-xs">{format(r.date, "dd/MM/yyyy")}</TableCell>
                <TableCell className={cn("text-xs", !r.isWorkingDay && "text-muted-foreground")}>
                  {r.dayLabel}
                </TableCell>
                <TableCell className="text-right text-xs">
                  {r.isWorkingDay ? brl(r.metaBase!) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right text-xs">
                  {r.isWorkingDay ? brl(r.metaAjustada!) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  {r.isWorkingDay ? (
                    <Input
                      type="number"
                      disabled={!canEdit || !goal}
                      className={cn(
                        "h-8 w-32 ml-auto text-right text-xs",
                        (drafts[r.iso] ?? (r.realizado ? String(r.realizado) : "")) === "" && "bg-muted/40",
                      )}
                      placeholder="R$ 0,00"
                      value={drafts[r.iso] ?? (r.realizado ? String(r.realizado) : "")}
                      onChange={(e) => setDrafts({ ...drafts, [r.iso]: e.target.value })}
                      onBlur={(e) => {
                        if (drafts[r.iso] !== undefined) saveRealized(r.iso, e.target.value);
                      }}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className={cn(
                  "text-right text-xs font-medium",
                  r.isWorkingDay && (r.deficit! > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"),
                )}>
                  {r.isWorkingDay ? brl(r.deficit!) : <span className="text-muted-foreground font-normal">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, icon, color }: {
  label: string; value: string; icon: React.ReactNode;
  color: "indigo" | "blue" | "red" | "green";
}) {
  const colorMap = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
    red: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  };
  const valueColor = {
    indigo: "text-indigo-700 dark:text-indigo-300",
    blue: "text-blue-700 dark:text-blue-300",
    red: "text-red-600 dark:text-red-400",
    green: "text-emerald-600 dark:text-emerald-400",
  };
  return (
    <Card className="rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={cn("text-2xl font-bold mt-2", valueColor[color])}>{value}</div>
        </div>
        <div className={cn("rounded-xl p-2.5", colorMap[color])}>{icon}</div>
      </div>
    </Card>
  );
}

// ============= ABA SETORIAIS =============
function SetoresTab({ year, month }: { year: number; month: number }) {
  const { current } = useWorkspace();
  const { data: sectors = [] } = useSectors();
  const { upsertGoal } = useGoalMutations();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: goals = [] } = useQuery({
    queryKey: ["goals-sector", current?.id, year, month],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*")
        .eq("workspace_id", current!.id).eq("year", year).eq("month", month).eq("scope", "sector");
      if (error) throw error;
      return data as any[];
    },
  });

  const goalsBySector = new Map(goals.map((g) => [g.scope_ref_id, g]));
  const workspaceGoalAmount = useGoal(year, month, "workspace", null).data?.target_amount ?? 0;
  const totalSectorTarget = goals.reduce((s, g) => s + Number(g.target_amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Metas por Setores</h2>
          <p className="text-sm text-muted-foreground">Distribua a meta da empresa entre os setores</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Meta de Setor
        </Button>
      </div>

      <Card className="rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Meta Global da Empresa</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold">{brl(totalSectorTarget)}</span>
              <span className="text-sm text-muted-foreground">de {brl(Number(workspaceGoalAmount))}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{MONTHS[month-1]} de {year}</div>
            <div className="text-2xl font-bold text-indigo-600 mt-1">
              {workspaceGoalAmount > 0 ? ((totalSectorTarget / Number(workspaceGoalAmount)) * 100).toFixed(1) : "0.0"}%
            </div>
          </div>
        </div>
        <div className="h-2 bg-muted rounded-full mt-4 overflow-hidden">
          <div className="h-full bg-indigo-600 transition-all"
            style={{ width: `${workspaceGoalAmount > 0 ? Math.min(100, (totalSectorTarget / Number(workspaceGoalAmount)) * 100) : 0}%` }} />
        </div>
      </Card>

      {sectors.length === 0 ? (
        <Card className="rounded-2xl p-12 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Nenhum setor configurado</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Crie setores em Configurações &gt; Usuários para gerenciar metas individualizadas
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sectors.map((s) => {
            const g = goalsBySector.get(s.id);
            const target = Number(g?.target_amount ?? 0);
            return (
              <Card key={s.id} className="rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="font-medium">{s.name}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>Editar</Button>
                </div>
                <div className="text-xs text-muted-foreground">Meta</div>
                <div className="text-xl font-bold">{brl(target)}</div>
              </Card>
            );
          })}
        </div>
      )}

      <NewSectorGoalDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        sectors={sectors}
        year={year}
        month={month}
        onSave={async ({ sectorId, amount }) => {
          await upsertGoal.mutateAsync({
            year, month, scope: "sector", scope_ref_id: sectorId,
            target_amount: amount, working_days_mask: 0b0111110, holidays: [],
          });
          toast.success("Meta salva");
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

function NewSectorGoalDialog({ open, onOpenChange, sectors, year, month, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  sectors: { id: string; name: string }[]; year: number; month: number;
  onSave: (v: { sectorId: string; amount: number }) => Promise<void>;
}) {
  const [sectorId, setSectorId] = useState("");
  const [amount, setAmount] = useState(0);
  useEffect(() => { if (open) { setSectorId(""); setAmount(0); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meta de Setor — {MONTHS[month-1]} {year}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Setor</Label>
            <Select value={sectorId} onValueChange={setSectorId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Meta Mensal (R$)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700" disabled={!sectorId || amount <= 0}
            onClick={() => onSave({ sectorId, amount })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= ABA VENDEDORES =============
function VendedoresTab({ year, month }: { year: number; month: number }) {
  const { current } = useWorkspace();
  const { data: members = [] } = useWorkspaceMembers();
  const { upsertGoal } = useGoalMutations();
  const [createFor, setCreateFor] = useState<{ id: string; name: string } | null>(null);

  const { data: goals = [] } = useQuery({
    queryKey: ["goals-user", current?.id, year, month],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*")
        .eq("workspace_id", current!.id).eq("year", year).eq("month", month).eq("scope", "user");
      if (error) throw error;
      return data as any[];
    },
  });

  const goalIds = goals.map((g) => g.id);
  const { data: actuals = [] } = useQuery({
    queryKey: ["goals-user-actuals", goalIds.join(",")],
    enabled: goalIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("goals_daily_actuals").select("*").in("goal_id", goalIds);
      if (error) throw error;
      return data as any[];
    },
  });

  const realizedByGoal = new Map<string, number>();
  for (const a of actuals) {
    const amt = (a as any).actual_amount ?? (a as any).amount ?? 0;
    realizedByGoal.set(a.goal_id, (realizedByGoal.get(a.goal_id) ?? 0) + Number(amt));
  }

  const goalByUser = new Map(goals.map((g) => [g.scope_ref_id, g]));
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount || 0), 0);
  const totalRealized = goals.reduce((s, g) => s + (realizedByGoal.get(g.id) ?? 0), 0);
  const pctTotal = totalTarget > 0 ? (totalRealized / totalTarget) * 100 : 0;

  const ranking = goals
    .map((g) => {
      const m = members.find((x) => x.user_id === g.scope_ref_id);
      const realizado = realizedByGoal.get(g.id) ?? 0;
      return {
        userId: g.scope_ref_id, goalId: g.id,
        name: m?.display_name ?? m?.email ?? "Usuário",
        avatar: m?.avatar_url ?? null,
        target: Number(g.target_amount || 0), realizado,
        pct: g.target_amount > 0 ? (realizado / Number(g.target_amount)) * 100 : 0,
      };
    })
    .sort((a, b) => b.realizado - a.realizado);

  const semMeta = members.filter((m) => !goalByUser.has(m.user_id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Metas por Vendedor</h2>
          <p className="text-sm text-muted-foreground">Acompanhe o desempenho individual da equipe</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <MetricCard label="Meta Total" value={brl(totalTarget)} icon={<Target className="h-5 w-5" />} color="indigo" />
        <MetricCard label="Realizado" value={brl(totalRealized)} icon={<TrendingUp className="h-5 w-5" />} color="green" />
        <MetricCard label="Vendedores" value={String(goals.length)} icon={<Users className="h-5 w-5" />} color="blue" />
        <MetricCard label="% Atingido" value={`${pctTotal.toFixed(1)}%`} icon={<Trophy className="h-5 w-5" />} color="indigo" />
      </div>

      <Card className="rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold">Ranking de Vendedores — {MONTHS[month-1]} {year}</h3>
        </div>
        {ranking.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma meta definida para este período.
          </div>
        ) : (
          <div className="space-y-3">
            {ranking.map((r, i) => (
              <div key={r.goalId} className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
                  i === 0 && "bg-amber-100 text-amber-700",
                  i === 1 && "bg-slate-100 text-slate-700",
                  i === 2 && "bg-orange-100 text-orange-700",
                  i > 2 && "bg-muted text-muted-foreground",
                )}>{i+1}</div>
                <Avatar className="h-9 w-9">
                  {r.avatar && <AvatarImage src={r.avatar} />}
                  <AvatarFallback>{r.name.slice(0,2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm truncate">{r.name}</div>
                    <div className="text-sm font-semibold tabular-nums">{r.pct.toFixed(0)}%</div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                    <span>{brl(r.realizado)} <span className="opacity-60">de {brl(r.target)}</span></span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full bg-indigo-600" style={{ width: `${Math.min(100, r.pct)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {semMeta.length > 0 && (
        <Card className="rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-sm mb-3">Vendedores sem meta definida</h3>
          <div className="flex flex-wrap gap-2">
            {semMeta.map((m) => (
              <button key={m.user_id}
                onClick={() => setCreateFor({ id: m.user_id, name: m.display_name ?? m.email ?? "Usuário" })}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors">
                <Plus className="h-3 w-3" />
                {m.display_name ?? m.email}
              </button>
            ))}
          </div>
        </Card>
      )}

      <NewUserGoalDialog
        target={createFor}
        year={year} month={month}
        onClose={() => setCreateFor(null)}
        onSave={async (amount) => {
          if (!createFor) return;
          await upsertGoal.mutateAsync({
            year, month, scope: "user", scope_ref_id: createFor.id,
            target_amount: amount, working_days_mask: 0b0111110, holidays: [],
          });
          toast.success("Meta criada");
          setCreateFor(null);
        }}
      />
    </div>
  );
}

function NewUserGoalDialog({ target, year, month, onClose, onSave }: {
  target: { id: string; name: string } | null; year: number; month: number;
  onClose: () => void; onSave: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState(0);
  useEffect(() => { setAmount(0); }, [target?.id]);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meta para {target?.name} — {MONTHS[month-1]} {year}</DialogTitle>
        </DialogHeader>
        <div>
          <Label>Meta Mensal (R$)</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700" disabled={amount <= 0}
            onClick={() => onSave(amount)}>Criar Meta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= PAGE =============
export default function Goals() {
  const { current } = useWorkspace();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<TabKey>("geral");

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <PageHeader workspace={current?.name} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <TabBar tab={tab} onChange={setTab} />
        {tab !== "geral" && (
          <div className="flex gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
      </div>

      {tab === "geral" && <GeralTab year={year} month={month} setYear={setYear} setMonth={setMonth} />}
      {tab === "setoriais" && <SetoresTab year={year} month={month} />}
      {tab === "vendedores" && <VendedoresTab year={year} month={month} />}
    </div>
  );
}
