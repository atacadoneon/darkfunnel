import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, X } from "lucide-react";
import type { Deal, Stage } from "./hooks";

export type SortKey = "position" | "value_desc" | "value_asc" | "newest" | "oldest" | "updated_desc" | "name_asc";
export type DealStatus = "open" | "won" | "lost";

export type Filters = {
  assignees: string[];      // user_ids; "none" = sem responsável
  origins: string[];        // origin_ids
  stages: string[];         // stage_ids
  status: DealStatus[];     // open|won|lost
  showArchived: boolean;
  minValue: string;
  maxValue: string;
  inactiveDays: string;     // "any" | "3" | "7" ...
  createdFrom: string;      // YYYY-MM-DD
  createdTo: string;
  sort: SortKey;
};

export const EMPTY_FILTERS: Filters = {
  assignees: [], origins: [], stages: [], status: [],
  showArchived: false, minValue: "", maxValue: "",
  inactiveDays: "any", createdFrom: "", createdTo: "", sort: "position",
};

export function countActive(f: Filters): number {
  let n = 0;
  if (f.assignees.length) n++;
  if (f.origins.length) n++;
  if (f.stages.length) n++;
  if (f.status.length) n++;
  if (f.showArchived) n++;
  if (f.minValue || f.maxValue) n++;
  if (f.inactiveDays !== "any") n++;
  if (f.createdFrom || f.createdTo) n++;
  if (f.sort !== "position") n++;
  return n;
}

export function applyFilters(deals: Deal[], f: Filters, search: string): Deal[] {
  const q = search.trim().toLowerCase();
  let out = deals.filter((d) => {
    if (q) {
      const hay = `${d.title} ${d.contact?.display_name ?? ""} ${d.contact?.phone_e164 ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.assignees.length) {
      const wantNone = f.assignees.includes("none");
      const matches = (wantNone && !d.assigned_to) || (d.assigned_to && f.assignees.includes(d.assigned_to));
      if (!matches) return false;
    }
    if (f.origins.length && !f.origins.includes((d as any).origin_id)) return false;
    if (f.stages.length && !f.stages.includes(d.stage_id)) return false;
    if (f.status.length && !f.status.includes(d.status)) return false;
    if (f.minValue && d.value_cents < Number(f.minValue) * 100) return false;
    if (f.maxValue && d.value_cents > Number(f.maxValue) * 100) return false;
    if (f.inactiveDays !== "any") {
      const days = Number(f.inactiveDays);
      const last = (d as any).last_interaction_at ?? d.updated_at;
      const diff = (Date.now() - new Date(last).getTime()) / 86400000;
      if (diff < days) return false;
    }
    if (f.createdFrom && new Date(d.created_at) < new Date(f.createdFrom)) return false;
    if (f.createdTo) {
      const to = new Date(f.createdTo); to.setHours(23, 59, 59, 999);
      if (new Date(d.created_at) > to) return false;
    }
    return true;
  });

  switch (f.sort) {
    case "value_desc": out = [...out].sort((a, b) => b.value_cents - a.value_cents); break;
    case "value_asc":  out = [...out].sort((a, b) => a.value_cents - b.value_cents); break;
    case "newest":     out = [...out].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)); break;
    case "oldest":     out = [...out].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)); break;
    case "updated_desc": out = [...out].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)); break;
    case "name_asc":   out = [...out].sort((a, b) => a.title.localeCompare(b.title, "pt-BR")); break;
  }
  return out;
}

function MultiSelect({ label, options, value, onChange, placeholder = "Todos" }: {
  label: string;
  options: { value: string; label: string; color?: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const summary = value.length === 0 ? placeholder
    : value.length === 1
      ? options.find(o => o.value === value[0])?.label ?? value[0]
      : `${value.length} selecionados`;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);

  return (
    <div>
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between font-normal">
            <span className="truncate">{summary}</span>
            <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-2 max-h-72 overflow-y-auto" align="start">
          {options.length === 0 && <div className="text-xs text-muted-foreground p-2">Nada cadastrado</div>}
          {options.map(o => (
            <label key={o.value} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer">
              <Checkbox checked={value.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
              {o.color && <span className="h-2 w-2 rounded-full" style={{ background: o.color }} />}
              <span className="text-sm flex-1">{o.label}</span>
            </label>
          ))}
          {value.length > 0 && (
            <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => onChange([])}>
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function FiltersSheet({
  open, onOpenChange, filters, onChange, members, origins, stages,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filters: Filters;
  onChange: (f: Filters) => void;
  members: any[];
  origins: { id: string; name: string; color: string }[];
  stages: Stage[];
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const active = countActive(filters);

  const memberOpts = useMemo(() => [
    { value: "none", label: "Sem vendedor" },
    ...members.map((m: any) => ({ value: m.user_id, label: m.display_name ?? m.email })),
  ], [members]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[380px] sm:w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Filtros {active > 0 && <Badge variant="secondary">{active}</Badge>}
          </SheetTitle>
          <SheetDescription>Refine a visualização do seu funil.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <MultiSelect label="Responsáveis" placeholder="Todos os responsáveis"
            options={memberOpts} value={filters.assignees} onChange={(v) => set("assignees", v)} />

          <MultiSelect label="Origens" placeholder="Todas as origens"
            options={origins.map(o => ({ value: o.id, label: o.name, color: o.color }))}
            value={filters.origins} onChange={(v) => set("origins", v)} />

          <MultiSelect label="Etapas" placeholder="Todas as etapas"
            options={stages.map(s => ({ value: s.id, label: s.name, color: s.color }))}
            value={filters.stages} onChange={(v) => set("stages", v)} />

          <MultiSelect label="Status" placeholder="Todos"
            options={[
              { value: "open", label: "Em aberto" },
              { value: "won", label: "Ganho" },
              { value: "lost", label: "Perdido" },
            ]}
            value={filters.status} onChange={(v) => set("status", v as DealStatus[])} />

          <div className="flex items-center justify-between border rounded-md p-3">
            <div>
              <div className="text-sm font-medium">Ver arquivados</div>
              <div className="text-xs text-muted-foreground">Mostrar leads que foram arquivados</div>
            </div>
            <Switch checked={filters.showArchived} onCheckedChange={(v) => set("showArchived", v)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Valor mín. (R$)</Label>
              <Input type="number" placeholder="Mín" value={filters.minValue}
                onChange={(e) => set("minValue", e.target.value)} />
            </div>
            <div>
              <Label>Valor máx. (R$)</Label>
              <Input type="number" placeholder="Máx" value={filters.maxValue}
                onChange={(e) => set("maxValue", e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Dias sem interação</Label>
            <Select value={filters.inactiveDays} onValueChange={(v) => set("inactiveDays", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer</SelectItem>
                <SelectItem value="3">+ de 3 dias</SelectItem>
                <SelectItem value="7">+ de 7 dias</SelectItem>
                <SelectItem value="15">+ de 15 dias</SelectItem>
                <SelectItem value="30">+ de 30 dias</SelectItem>
                <SelectItem value="60">+ de 60 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Criado de</Label>
              <Input type="date" value={filters.createdFrom} onChange={(e) => set("createdFrom", e.target.value)} />
            </div>
            <div>
              <Label>Criado até</Label>
              <Input type="date" value={filters.createdTo} onChange={(e) => set("createdTo", e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Ordenar por</Label>
            <Select value={filters.sort} onValueChange={(v) => set("sort", v as SortKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="position">Padrão (posição manual)</SelectItem>
                <SelectItem value="value_desc">Maior valor</SelectItem>
                <SelectItem value="value_asc">Menor valor</SelectItem>
                <SelectItem value="newest">Mais recentes</SelectItem>
                <SelectItem value="oldest">Mais antigos</SelectItem>
                <SelectItem value="updated_desc">Atualizados recentemente</SelectItem>
                <SelectItem value="name_asc">Nome (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" className="w-full" onClick={() => onChange(EMPTY_FILTERS)}>
            Limpar filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
