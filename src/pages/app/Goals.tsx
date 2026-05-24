import { useEffect, useMemo, useState } from "react";
import { format, getDay, getDaysInMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Target, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGoal, useGoalActuals, useGoalMutations } from "@/hooks/useGoals";
import { DAY_LABELS, type GoalScope } from "@/types/goal";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const YEARS = [2024, 2025, 2026, 2027];

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export default function Goals() {
  const { current } = useWorkspace();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [scope, setScope] = useState<GoalScope>("workspace");

  const { data: goal } = useGoal(year, month, scope, null);
  const { data: actuals = [] } = useGoalActuals(goal?.id ?? null);
  const { upsertGoal, upsertActual } = useGoalMutations();

  const [target, setTarget] = useState<number>(0);
  const [mask, setMask] = useState<number>(0b0111110); // Seg-Sex
  const [holidays, setHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setTarget(goal?.target_amount ?? 0);
    setMask(goal?.working_days_mask ?? 0b0111110);
    setHolidays(goal?.holidays ?? []);
  }, [goal?.id]);

  const toggleDay = (d: number) => setMask((m) => m ^ (1 << d));
  const dayChecked = (d: number) => (mask & (1 << d)) !== 0;

  const days = useMemo(() => {
    const total = getDaysInMonth(new Date(year, month - 1, 1));
    return Array.from({ length: total }, (_, i) => {
      const date = new Date(year, month - 1, i + 1);
      const iso = format(date, "yyyy-MM-dd");
      const dow = getDay(date);
      const isHoliday = holidays.includes(iso);
      const isWorking = dayChecked(dow) && !isHoliday;
      return { date, iso, dow, isWorking };
    });
  }, [year, month, mask, holidays]);

  const workingDays = days.filter((d) => d.isWorking).length;
  const baseTarget = workingDays > 0 ? target / workingDays : 0;

  const actualsMap = useMemo(() => {
    const m: Record<string, number> = {};
    actuals.forEach((a) => { m[a.date] = Number(a.amount); });
    return m;
  }, [actuals]);

  const totalRealizado = useMemo(
    () => Object.values(actualsMap).reduce((s, v) => s + v, 0),
    [actualsMap],
  );
  const faltaRealizar = Math.max(0, target - totalRealizado);

  const today = format(now, "yyyy-MM-dd");
  const remainingWorkingDays = days.filter((d) => d.isWorking && d.iso >= today).length;
  const ritmoNecessario = remainingWorkingDays > 0 ? faltaRealizar / remainingWorkingDays : 0;

  const handleSaveConfig = async () => {
    try {
      await upsertGoal.mutateAsync({
        year, month, scope, scope_ref_id: null,
        target_amount: target,
        working_days_mask: mask,
        holidays,
      });
      toast.success("Configurações salvas");
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleSaveActuals = async () => {
    if (!goal) return toast.error("Salve a configuração primeiro");
    try {
      const entries = Object.entries(drafts).filter(([, v]) => v !== "");
      await Promise.all(entries.map(([date, v]) =>
        upsertActual.mutateAsync({ goal_id: goal.id, date, amount: Number(v) || 0 }),
      ));
      setDrafts({});
      toast.success("Realizados salvos");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-blue-100 via-sky-50 to-cyan-50 dark:from-blue-950/40 dark:via-sky-950/30 dark:to-cyan-950/30 border p-6">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-300 flex items-center justify-center">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Metas de Faturamento</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {current?.name ?? "Workspace"} — Gerencie e acompanhe as metas da sua organização
            </p>
          </div>
        </div>
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as GoalScope)}>
        <TabsList>
          <TabsTrigger value="workspace">Geral</TabsTrigger>
          <TabsTrigger value="sector">Setoriais</TabsTrigger>
          <TabsTrigger value="user">Vendedores</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Configurações do Mês</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Mês</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ano</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Meta Mensal (R$)</Label>
            <Input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value) || 0)} />
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Dias trabalhados</Label>
          <div className="flex gap-3 mt-2 flex-wrap">
            {DAY_LABELS.map((d, i) => (
              <label key={d} className="flex items-center gap-2 text-sm">
                <Checkbox checked={dayChecked(i)} onCheckedChange={() => toggleDay(i)} />
                {d}
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Folgas e Feriados</Label>
          <div className="flex gap-2 mt-2">
            <Input type="date" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} className="max-w-[200px]" />
            <Button variant="outline" size="sm" onClick={() => {
              if (newHoliday && !holidays.includes(newHoliday)) {
                setHolidays([...holidays, newHoliday].sort());
                setNewHoliday("");
              }
            }}>Adicionar</Button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {holidays.map((h) => (
              <button
                key={h}
                onClick={() => setHolidays(holidays.filter((x) => x !== h))}
                className="text-xs rounded-md border bg-muted px-2 py-1 hover:bg-destructive/10 hover:text-destructive"
              >
                {format(parseISO(h), "dd/MM/yyyy")} ✕
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveConfig} disabled={upsertGoal.isPending}>
            <Save className="h-4 w-4 mr-2" /> Salvar Configurações
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Dias Úteis no Mês</div>
          <div className="text-2xl font-bold mt-1">{workingDays}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total Realizado</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{brl(totalRealizado)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Falta Realizar</div>
          <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">{brl(faltaRealizar)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Ritmo Necessário/dia</div>
          <div className="text-2xl font-bold mt-1">{brl(ritmoNecessario)}</div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Lançamento Diário — {MONTHS[month - 1]} {year}</h2>
          <Button size="sm" onClick={handleSaveActuals} disabled={upsertActual.isPending || Object.keys(drafts).length === 0}>
            <Save className="h-4 w-4 mr-2" /> Salvar Realizados
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Dia</TableHead>
              <TableHead className="text-right">Meta Base</TableHead>
              <TableHead className="text-right">Meta Ajustada</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead className="text-right">Déficit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.map((d, idx) => {
              const realizado = drafts[d.iso] !== undefined
                ? Number(drafts[d.iso]) || 0
                : actualsMap[d.iso] ?? 0;
              const metaAjustada = d.isWorking ? baseTarget : 0;
              const deficit = metaAjustada - realizado;
              return (
                <TableRow key={d.iso} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                  <TableCell className="font-mono text-xs">{format(d.date, "dd/MM/yyyy")}</TableCell>
                  <TableCell className="text-xs">
                    {format(d.date, "EEEE", { locale: ptBR })}
                    {!d.isWorking && <span className="ml-2 text-muted-foreground">(folga)</span>}
                  </TableCell>
                  <TableCell className="text-right text-xs">{brl(baseTarget)}</TableCell>
                  <TableCell className="text-right text-xs">{brl(metaAjustada)}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      className="h-8 w-32 ml-auto text-right"
                      value={drafts[d.iso] ?? (actualsMap[d.iso] ?? "")}
                      onChange={(e) => setDrafts({ ...drafts, [d.iso]: e.target.value })}
                      disabled={!d.isWorking}
                    />
                  </TableCell>
                  <TableCell className={`text-right text-xs ${deficit > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {brl(deficit)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
