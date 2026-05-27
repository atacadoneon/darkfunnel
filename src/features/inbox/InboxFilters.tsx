import { useMemo } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useChannels } from "@/features/channels/hooks";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { useTags } from "./filterHooks";

export type SortKey = "recent" | "awaiting" | "unread_first";

export const SORT_LABELS: Record<SortKey, string> = {
  recent: "Mais recentes primeiro",
  awaiting: "Aguardando resposta primeiro",
  unread_first: "Não lidas primeiro",
};


export const STATUS_OPTIONS = [
  { value: "open", label: "Aberto" },
  { value: "in_progress", label: "Em atendimento" },
  { value: "waiting", label: "Aguardando" },
  { value: "resolved", label: "Resolvido" },
  { value: "closed", label: "Fechado" },
  { value: "undefined", label: "Indefinido" },
];

export type InboxFilters = {
  text: string;
  message: string;
  channelId: string | null;
  channelKind: "all" | "whatsapp" | "instagram";
  assignee: string | null;
  tagId: string | null;
  status: string | null;
  sort: SortKey;
};

export const DEFAULT_FILTERS: InboxFilters = {
  text: "",
  message: "",
  channelId: null,
  channelKind: "all",
  assignee: null,
  tagId: null,
  status: null,
  sort: "recent",
};

type Props = {
  filters: InboxFilters;
  onChange: (f: InboxFilters) => void;
  resultCount: number;
};

export function InboxFilters({ filters, onChange, resultCount }: Props) {
  const { data: channels = [] } = useChannels();
  const { data: members = [] } = useWorkspaceMembers();
  const { data: tags = [] } = useTags();

  const update = <K extends keyof InboxFilters>(k: K, v: InboxFilters[K]) =>
    onChange({ ...filters, [k]: v });

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.message) n++;
    if (filters.channelId) n++;
    if (filters.assignee) n++;
    if (filters.tagId) n++;
    if (filters.status) n++;
    return n;
  }, [filters]);

  const clear = () =>
    onChange({ ...DEFAULT_FILTERS, text: filters.text, sort: filters.sort });

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou número..."
          value={filters.text}
          onChange={(e) => update("text", e.target.value)}
          className="pl-8 h-9"
        />
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar mensagem..."
          value={filters.message}
          onChange={(e) => update("message", e.target.value)}
          className="pl-8 h-9"
        />
      </div>

      <div className="flex items-center gap-1">
        {(["all","whatsapp","instagram"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => update("channelKind", k)}
            className={`h-6 px-2 rounded-full text-[10px] border transition-colors ${
              filters.channelKind === k
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-input hover:bg-muted"
            }`}
          >
            {k === "all" ? "Todos" : k === "whatsapp" ? "WhatsApp" : "Instagram"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 flex-1 justify-between text-xs">
              <span>Filtros</span>
              {activeCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 space-y-3" align="start">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Aparelho / Canal</label>
              <Select
                value={filters.channelId ?? "any"}
                onValueChange={(v) => update("channelId", v === "any" ? null : v)}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Responsável</label>
              <Select
                value={filters.assignee ?? "any"}
                onValueChange={(v) => update("assignee", v === "any" ? null : v)}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer</SelectItem>
                  <SelectItem value="unassigned">Sem responsável</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.display_name ?? m.email ?? m.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tag</label>
              <Select
                value={filters.tagId ?? "any"}
                onValueChange={(v) => update("tagId", v === "any" ? null : v)}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer</SelectItem>
                  <SelectItem value="none">Sem tag</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                        {t.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Situação</label>
              <Select
                value={filters.status ?? "any"}
                onValueChange={(v) => update("status", v === "any" ? null : v)}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeCount > 0 && (
              <Button variant="ghost" size="sm" className="w-full h-8" onClick={clear}>
                <X className="h-3 w-3 mr-1" /> Limpar filtros
              </Button>
            )}
          </PopoverContent>
        </Popover>

        <Select value={filters.sort} onValueChange={(v) => update("sort", v as SortKey)}>
          <SelectTrigger className="h-8 w-[44%] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <SelectItem key={k} value={k} className="text-xs">{SORT_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-[11px] text-muted-foreground italic">
        Exibindo <span className="font-semibold not-italic text-foreground">{resultCount}</span> resultado{resultCount === 1 ? "" : "s"}
      </div>
    </div>
  );
}
