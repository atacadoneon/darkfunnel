import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { CalendarKind } from "@/hooks/useUnifiedCalendar";

export const KIND_META: Record<CalendarKind, { label: string; color: string; dot: string }> = {
  meeting:  { label: "Reuniões",  color: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30", dot: "bg-blue-500" },
  event:    { label: "Eventos",   color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dot: "bg-emerald-500" },
  task:     { label: "Tarefas",   color: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30", dot: "bg-amber-500" },
  activity: { label: "Atividades", color: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30", dot: "bg-purple-500" },
};

export function CalendarFilters({
  enabledKinds, onChange, owners, selectedOwners, onOwnersChange,
}: {
  enabledKinds: Set<CalendarKind>;
  onChange: (next: Set<CalendarKind>) => void;
  owners: { id: string; name: string }[];
  selectedOwners: Set<string>;
  onOwnersChange: (next: Set<string>) => void;
}) {
  const toggleKind = (k: CalendarKind) => {
    const next = new Set(enabledKinds);
    next.has(k) ? next.delete(k) : next.add(k);
    onChange(next);
  };
  const toggleOwner = (id: string) => {
    const next = new Set(selectedOwners);
    next.has(id) ? next.delete(id) : next.add(id);
    onOwnersChange(next);
  };
  return (
    <Card className="p-3 space-y-3">
      <div>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Tipos</h4>
        <div className="space-y-1.5">
          {(Object.keys(KIND_META) as CalendarKind[]).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={enabledKinds.has(k)} onCheckedChange={() => toggleKind(k)} />
              <span className={`h-2 w-2 rounded-full ${KIND_META[k].dot}`} />
              {KIND_META[k].label}
            </label>
          ))}
        </div>
      </div>
      {owners.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Responsável</h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {owners.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={selectedOwners.has(o.id)} onCheckedChange={() => toggleOwner(o.id)} />
                <span className="truncate">{o.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
