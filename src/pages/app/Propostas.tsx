import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Printer,
  Plus,
  MoreHorizontal,
  Search,
  Filter,
  Calendar as CalendarIcon,
  Settings,
  ChevronDown,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useProposals, type Proposal } from "@/hooks/useProposals";

type SortKey = "issue_date" | "next_contact_date" | "customer_name" | "total_cents";
type SortDir = "asc" | "desc";

const STATUS_META: Record<
  string,
  { label: string; dot: string; tone: string }
> = {
  rascunho: { label: "rascunho", dot: "bg-muted-foreground", tone: "text-muted-foreground" },
  em_aberto: { label: "em aberto", dot: "bg-amber-500", tone: "text-amber-600" },
  aguardando: { label: "aguardando", dot: "bg-orange-500", tone: "text-orange-600" },
  aprovada: { label: "aprovada", dot: "bg-emerald-500", tone: "text-emerald-600" },
  nao_aprovada: { label: "não aprovada", dot: "bg-rose-500", tone: "text-rose-600" },
  concluida: { label: "concluída", dot: "bg-blue-500", tone: "text-blue-600" },
  cancelada: { label: "cancelada", dot: "bg-muted-foreground", tone: "text-muted-foreground" },
  modelo: { label: "modelo", dot: "bg-violet-500", tone: "text-violet-600" },
};

const TABS: { key: string; label: string; match: (s: string) => boolean }[] = [
  { key: "todas", label: "todas", match: () => true },
  { key: "em_aberto", label: "em aberto", match: (s) => s === "em_aberto" },
  { key: "rascunho", label: "rascunhos", match: (s) => s === "rascunho" },
  { key: "pendentes", label: "pendentes", match: (s) => s === "em_aberto" || s === "aguardando" },
  { key: "aguardando", label: "aguardando", match: (s) => s === "aguardando" },
  { key: "aprovada", label: "aprovadas", match: (s) => s === "aprovada" },
  { key: "nao_aprovada", label: "não aprovadas", match: (s) => s === "nao_aprovada" },
  { key: "concluida", label: "concluídas", match: (s) => s === "concluida" },
  { key: "modelo", label: "modelos", match: (s) => s === "modelo" },
];

const PAGE_SIZE = 15;

function brl(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          active && "text-foreground font-semibold",
        )}
      >
        {label}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            active && sort.dir === "asc" && "rotate-180",
            !active && "opacity-30",
          )}
        />
      </button>
    </TableHead>
  );
}

export default function Propostas() {
  const nav = useNavigate();
  const { data: proposals = [], isLoading } = useProposals();
  const [tab, setTab] = useState("todas");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "issue_date",
    dir: "desc",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS) {
      c[t.key] = proposals.filter((p) => t.match(String(p.status))).length;
    }
    return c;
  }, [proposals]);

  const filtered = useMemo(() => {
    const tabDef = TABS.find((t) => t.key === tab) ?? TABS[0];
    const q = search.trim().toLowerCase();
    let arr = proposals.filter((p) => tabDef.match(String(p.status)));
    if (q) {
      arr = arr.filter(
        (p) =>
          String(p.number).includes(q) ||
          (p.customer_name ?? "").toLowerCase().includes(q),
      );
    }
    arr = [...arr].sort((a, b) => {
      const k = sort.key;
      const av = (a as any)[k];
      const bv = (b as any)[k];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "pt-BR");
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [proposals, tab, search, sort]);

  const totalCount = filtered.length;
  const totalValue = filtered.reduce((s, p) => s + (p.total_cents ?? 0), 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const allChecked =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) pageRows.forEach((r) => next.delete(r.id));
    else pageRows.forEach((r) => next.add(r.id));
    setSelected(next);
  };

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const onSort = (k: SortKey) => {
    setSort((s) =>
      s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" },
    );
  };

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb + top actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">início</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <span className="text-muted-foreground">vendas</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>propostas comerciais</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> imprimir
          </Button>
          <Button
            size="sm"
            className="bg-violet-600 hover:bg-violet-700 text-white"
            onClick={() => nav("/propostas/novo")}
          >
            <Plus className="h-4 w-4 mr-1" /> incluir proposta
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>importar propostas</DropdownMenuItem>
              <DropdownMenuItem disabled>exportar CSV</DropdownMenuItem>
              <DropdownMenuItem disabled>configurar modelos</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Propostas Comerciais</h1>
      </div>

      {/* Search + filters bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-xl">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Pesquise por cliente ou número"
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-1">
          <CalendarIcon className="w-4 h-4" /> por período
        </Button>
        <Button variant="outline" size="sm" className="gap-1">
          <Filter className="w-4 h-4" /> filtros
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="icon" title="Configurar colunas">
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.key;
          const meta = STATUS_META[t.key];
          return (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
              className={cn(
                "px-3 pb-2 pt-1 border-b-2 -mb-px transition-colors whitespace-nowrap flex flex-col items-start",
                active
                  ? "border-violet-600 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    meta?.dot ?? "bg-muted-foreground",
                  )}
                />
                {t.label}
              </span>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  active ? "text-violet-600 font-semibold" : "text-muted-foreground",
                )}
              >
                {isLoading ? "—" : counts[t.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead className="w-28">Número</TableHead>
              <SortableHead label="Data" sortKey="issue_date" sort={sort} onSort={onSort} className="w-32" />
              <SortableHead label="Próx. Contato" sortKey="next_contact_date" sort={sort} onSort={onSort} className="w-36" />
              <SortableHead label="Cliente" sortKey="customer_name" sort={sort} onSort={onSort} />
              <SortableHead label="Valor" sortKey="total_cents" sort={sort} onSort={onSort} className="w-32 text-right" />
              <TableHead>Marcadores</TableHead>
              <TableHead>Integrações</TableHead>
              <TableHead className="w-20 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : pageRows.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-12">
                        <div className="flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
                          <FileText className="h-8 w-8 opacity-50" />
                          <p className="text-sm">Nenhuma proposta encontrada</p>
                          <Button
                            size="sm"
                            className="bg-violet-600 hover:bg-violet-700 text-white mt-2"
                            onClick={() => nav("/propostas/novo")}
                          >
                            <Plus className="h-4 w-4 mr-1" /> incluir proposta
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                : pageRows.map((p) => {
                    const meta = STATUS_META[String(p.status)] ?? STATUS_META.rascunho;
                    const isSelected = selected.has(p.id);
                    const isExpanded = expanded.has(p.id);
                    return (
                      <ProposalRow
                        key={p.id}
                        p={p}
                        meta={meta}
                        isSelected={isSelected}
                        isExpanded={isExpanded}
                        onToggle={() => toggleRow(p.id)}
                        onExpand={() => toggleExpand(p.id)}
                        onOpen={() => nav(`/propostas/${p.id}`)}
                      />
                    );
                  })}
          </TableBody>
        </Table>
      </Card>

      {/* Footer: pagination + totals */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
            const n = i + 1;
            const active = n === safePage;
            return (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={cn(
                  "min-w-[32px] h-8 px-2 rounded text-sm tabular-nums transition-colors",
                  active
                    ? "bg-violet-600 text-white font-semibold"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {String(n).padStart(2, "0")}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="h-8 px-2 rounded text-sm text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            →
          </button>
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-4">
          <span><span className="font-semibold text-foreground">{totalCount}</span> propostas</span>
          <span className="font-mono">
            <span className="font-semibold text-foreground">{brl(totalValue)}</span> valor total
          </span>
        </div>
      </div>
    </div>
  );
}

function ProposalRow({
  p,
  meta,
  isSelected,
  isExpanded,
  onToggle,
  onExpand,
  onOpen,
}: {
  p: Proposal;
  meta: { label: string; dot: string; tone: string };
  isSelected: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onOpen: () => void;
}) {
  return (
    <>
      <TableRow className={cn(isSelected && "bg-violet-500/5")}>
        <TableCell>
          <Checkbox checked={isSelected} onCheckedChange={onToggle} />
        </TableCell>
        <TableCell>
          <button
            onClick={onOpen}
            className="font-mono text-sm hover:text-violet-600 hover:underline flex items-center gap-1.5"
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
            {(p.series ?? "P")}-{String(p.number).padStart(4, "0")}
          </button>
        </TableCell>
        <TableCell className="text-sm">{fmtDate(p.issue_date ?? p.created_at)}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {fmtDate((p as any).next_contact_date)}
        </TableCell>
        <TableCell className="text-sm">
          <div className="font-medium">{p.customer_name ?? "—"}</div>
          {p.customer_email && (
            <div className="text-xs text-muted-foreground">{p.customer_email}</div>
          )}
        </TableCell>
        <TableCell className="text-right font-mono text-sm">{brl(p.total_cents)}</TableCell>
        <TableCell>
          <Badge variant="outline" className={cn("text-[10px]", meta.tone)}>
            {meta.label}
          </Badge>
        </TableCell>
        <TableCell>
          {p.deal_id ? (
            <Badge variant="outline" className="text-[10px]">CRM</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="inline-flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onOpen}>abrir</DropdownMenuItem>
                <DropdownMenuItem disabled>duplicar</DropdownMenuItem>
                <DropdownMenuItem disabled>imprimir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onExpand}
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  isExpanded && "rotate-180",
                )}
              />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={9} className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-muted-foreground">Subtotal</div>
                <div className="font-mono">{brl(p.subtotal_cents)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Desconto</div>
                <div className="font-mono">{brl(p.discount_cents)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Total</div>
                <div className="font-mono font-semibold">{brl(p.total_cents)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Validade</div>
                <div>{fmtDate(p.valid_until)}</div>
              </div>
            </div>
            <div className="mt-3">
              <Button variant="link" size="sm" onClick={onOpen} className="h-auto p-0 text-violet-600">
                abrir proposta completa →
              </Button>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
