import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, X, Check, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { usePipelines } from "@/features/pipeline/leadEditHooks";
import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";

type Opt = { value: string; label: string };

function MultiSelect({
  label, placeholder, options, value, onChange,
}: {
  label: string;
  placeholder: string;
  options: Opt[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const text =
    value.length === 0 ? placeholder
    : value.length === 1 ? options.find((o) => o.value === value[0])?.label ?? "1 selecionado"
    : `${value.length} selecionados`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 justify-between gap-2 min-w-[180px]">
          <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>{text}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{label}</div>
        <div className="max-h-64 overflow-y-auto">
          {options.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground">Sem opções</div>
          )}
          {options.map((o) => {
            const sel = value.includes(o.value);
            return (
              <button
                key={o.value}
                onClick={() => toggle(o.value)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
              >
                <div className={cn("h-4 w-4 rounded border flex items-center justify-center", sel && "bg-primary border-primary")}>
                  {sel && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
        {value.length > 0 && (
          <div className="border-t mt-1 pt-1 px-1">
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => onChange([])}>
              Limpar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function useSellersOptions(): Opt[] {
  const { current } = useWorkspace();
  const { data } = useQuery({
    queryKey: ["dash-sellers-opts", current?.id],
    enabled: !!current,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_sellers" as any)
        .select("id,name")
        .eq("workspace_id", current!.id)
        .order("name");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
  return (data ?? []).map((s) => ({ value: s.id, label: s.name ?? "—" }));
}

const CHANNEL_OPTS: Opt[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Telefone" },
  { value: "email", label: "Email" },
];

export function DashboardFiltersBar() {
  const { filters, setRange, setSellerIds, setPipelineIds, setChannels, reset } = useDashboardFilters();
  const sellers = useSellersOptions();
  const { data: pipelines } = usePipelines();
  const pipeOpts: Opt[] = (pipelines ?? []).map((p) => ({ value: p.id, label: p.name }));

  const hasAny =
    !!filters.sellerIds.length || !!filters.pipelineIds.length || !!filters.channels.length;

  const dateLabel =
    filters.range.from && filters.range.to
      ? `${format(filters.range.from, "dd MMM", { locale: ptBR })} – ${format(filters.range.to, "dd MMM", { locale: ptBR })}`
      : "Selecionar período";

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b bg-card/40">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 gap-2">
            <CalendarDays className="h-4 w-4" />
            <span>{dateLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={filters.range}
            onSelect={setRange}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>

      <MultiSelect
        label="Vendedores" placeholder="Todos os vendedores"
        options={sellers} value={filters.sellerIds} onChange={setSellerIds}
      />
      <MultiSelect
        label="Pipelines" placeholder="Todos os pipelines"
        options={pipeOpts} value={filters.pipelineIds} onChange={setPipelineIds}
      />
      <MultiSelect
        label="Canais" placeholder="Todos os canais"
        options={CHANNEL_OPTS} value={filters.channels} onChange={setChannels}
      />

      {hasAny && (
        <Badge variant="secondary" className="gap-1">
          {filters.sellerIds.length + filters.pipelineIds.length + filters.channels.length} filtros
        </Badge>
      )}

      <Button variant="ghost" size="sm" onClick={reset} className="ml-auto gap-1">
        <X className="h-4 w-4" /> Limpar filtros
      </Button>
    </div>
  );
}
