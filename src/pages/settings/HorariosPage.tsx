import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Copy, Loader2 } from "lucide-react";
import { useBusinessHours, useUpsertBusinessHours, type BusinessHour } from "@/features/settings/settingsHooks";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES: Record<number, string> = {
  1: "Segunda-feira", 2: "Terça-feira", 3: "Quarta-feira", 4: "Quinta-feira",
  5: "Sexta-feira", 6: "Sábado", 0: "Domingo",
};

function timeShort(t?: string | null) {
  if (!t) return "08:00";
  return t.slice(0, 5);
}

export default function HorariosPage() {
  const { data: rows = [], isLoading } = useBusinessHours();
  const save = useUpsertBusinessHours();
  const canEdit = useIsManagerOrAdmin();
  const [draft, setDraft] = useState<BusinessHour[]>([]);

  useEffect(() => { setDraft(rows); }, [rows]);

  const byDay = (d: number) => draft.find((r) => r.day_of_week === d);

  const update = (day: number, patch: Partial<BusinessHour>) => {
    setDraft((p) => p.map((r) => r.day_of_week === day ? { ...r, ...patch } : r));
  };

  const copyMonday = () => {
    const mon = byDay(1);
    if (!mon) return;
    const WEEKDAYS = [2, 3, 4, 5]; // ter, qua, qui, sex — não tocar sábado(6) e domingo(0)
    setDraft((p) => p.map((r) => WEEKDAYS.includes(r.day_of_week)
      ? { ...r, opens_at: mon.opens_at, closes_at: mon.closes_at, is_closed: mon.is_closed }
      : r));
  };

  const submit = () => save.mutate(draft.map((r) => ({
    id: r.id,
    opens_at: timeShort(r.opens_at) + ":00",
    closes_at: timeShort(r.closes_at) + ":00",
    is_closed: r.is_closed,
  })));

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Horários de trabalho</h1>
        <p className="text-sm text-muted-foreground">Define quando seu time está disponível para atender clientes e disparar automações.</p>
      </header>

      <Card className="p-4 space-y-2">
        {DAY_ORDER.map((day) => {
          const row = byDay(day);
          if (!row) return null;
          return (
            <div key={day} className="flex items-center gap-3 py-2 border-b last:border-0">
              <div className="w-40 text-sm font-medium">{DAY_NAMES[day]}</div>
              <Switch checked={!row.is_closed} disabled={!canEdit} onCheckedChange={(v) => update(day, { is_closed: !v })} />
              <span className="text-xs text-muted-foreground w-16">{row.is_closed ? "Fechado" : "Aberto"}</span>
              <Input type="time" disabled={!canEdit || row.is_closed} value={timeShort(row.opens_at)} onChange={(e) => update(day, { opens_at: e.target.value + ":00" })} className="w-32" />
              <span className="text-muted-foreground">às</span>
              <Input type="time" disabled={!canEdit || row.is_closed} value={timeShort(row.closes_at)} onChange={(e) => update(day, { closes_at: e.target.value + ":00" })} className="w-32" />
            </div>
          );
        })}
      </Card>

      {canEdit && (
        <div className="flex justify-between">
          <Button variant="outline" onClick={copyMonday}><Copy className="h-4 w-4" /> Copiar segunda para os outros</Button>
          <Button onClick={submit} disabled={save.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </div>
      )}
    </div>
  );
}
