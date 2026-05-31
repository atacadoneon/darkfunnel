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
  ChevronUp,
  ChevronsUpDown,
  FileText,
  X,
  Tag as TagIcon,
  UserCog,
  CircleDot,
  Trash2,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useProposals,
  useProposalMutations,
  useTagsProposal,
  useProposalTagsFor,
  useProposalTagMutations,
  type Proposal,
} from "@/hooks/useProposals";
import { SellerSelect } from "@/components/sellers/SellerSelect";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";

type SortKey =
  | "number"
  | "issue_date"
  | "next_contact_date"
  | "customer_name"
  | "total_cents"
  | "status"
  | "deal_id";
type SortDir = "asc" | "desc" | null;

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

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "rascunho", label: "rascunho" },
  { value: "em_aberto", label: "em aberto" },
  { value: "aguardando", label: "aguardando" },
  { value: "aprovada", label: "aprovada" },
  { value: "nao_aprovada", label: "não aprovada" },
  { value: "concluida", label: "concluída" },
  { value: "cancelada", label: "cancelada" },
  { value: "modelo", label: "modelo" },
];

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

type PeriodKey = "all" | "today" | "month" | "interval" | "next_contact";

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

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
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
  sort: { key: SortKey | null; dir: SortDir };
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey && sort.dir !== null;
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
        {!active && <ChevronsUpDown className="h-3 w-3 opacity-40" />}
        {active && sort.dir === "asc" && <ChevronUp className="h-3 w-3" />}
        {active && sort.dir === "desc" && <ChevronDown className="h-3 w-3" />}
      </button>
    </TableHead>
  );
}

export default function Propostas() {
  const nav = useNavigate();
  const { data: proposals = [], isLoading } = useProposals();
  const { bulkUpdate, bulkSoftDelete } = useProposalMutations();
  const { data: allTags = [] } = useTagsProposal();
  const { addTags, removeTags } = useProposalTagMutations();

  const [tab, setTab] = useState("todas");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey | null; dir: SortDir }>({
    key: "issue_date",
    dir: "desc",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Period filter
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [periodFrom, setPeriodFrom] = useState<string>("");
  const [periodTo, setPeriodTo] = useState<string>("");

  // Filters popover (draft + applied)
  const [filterTagDraft, setFilterTagDraft] = useState<string>("__all__");
  const [filterSellerDraft, setFilterSellerDraft] = useState<string>("");
  const [filterTag, setFilterTag] = useState<string>("__all__");
  const [filterSeller, setFilterSeller] = useState<string>("");

  // Confirm aprovada dialog
  const [approveDialog, setApproveDialog] = useState<{
    open: boolean;
    ids: string[];
  }>({ open: false, ids: [] });
  // Confirm delete
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    ids: string[];
  }>({ open: false, ids: [] });

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const { data: selectedTagsRows = [] } = useProposalTagsFor(selectedIds);

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

    // Period filter
    if (period !== "all") {
      const now = new Date();
      if (period === "today") {
        const s = startOfDay(now).getTime();
        const e = endOfDay(now).getTime();
        arr = arr.filter((p) => {
          const d = p.issue_date ? new Date(p.issue_date).getTime() : 0;
          return d >= s && d <= e;
        });
      } else if (period === "month") {
        const s = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
        arr = arr.filter((p) => {
          const d = p.issue_date ? new Date(p.issue_date).getTime() : 0;
          return d >= s && d <= e;
        });
      } else if (period === "interval" && (periodFrom || periodTo)) {
        const s = periodFrom ? startOfDay(new Date(periodFrom)).getTime() : -Infinity;
        const e = periodTo ? endOfDay(new Date(periodTo)).getTime() : Infinity;
        arr = arr.filter((p) => {
          const d = p.issue_date ? new Date(p.issue_date).getTime() : 0;
          return d >= s && d <= e;
        });
      } else if (period === "next_contact") {
        const s = startOfDay(now).getTime();
        arr = arr.filter((p) => {
          const v = (p as any).next_contact_date;
          if (!v) return false;
          return new Date(v).getTime() >= s;
        });
      }
    }

    if (filterSeller) {
      arr = arr.filter((p) => p.owner_user_id === filterSeller);
    }

    if (q) {
      arr = arr.filter(
        (p) =>
          String(p.number).includes(q) ||
          (p.customer_name ?? "").toLowerCase().includes(q),
      );
    }

    if (sort.key && sort.dir) {
      const k = sort.key;
      const dir = sort.dir;
      arr = [...arr].sort((a, b) => {
        const av = (a as any)[k];
        const bv = (b as any)[k];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp =
          typeof av === "number"
            ? av - bv
            : String(av).localeCompare(String(bv), "pt-BR");
        return dir === "asc" ? cmp : -cmp;
      });
    }
    return arr;
  }, [proposals, tab, search, sort, period, periodFrom, periodTo, filterSeller]);

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
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const onSort = (k: SortKey) => {
    setSort((s) => {
      if (s.key !== k) return { key: k, dir: "asc" };
      if (s.dir === "asc") return { key: k, dir: "desc" };
      if (s.dir === "desc") return { key: null, dir: null };
      return { key: k, dir: "asc" };
    });
  };

  const clearSelection = () => setSelected(new Set());

  const applyStatus = async (status: string) => {
    if (status === "aprovada") {
      setApproveDialog({ open: true, ids: selectedIds });
      return;
    }
    try {
      await bulkUpdate.mutateAsync({ ids: selectedIds, patch: { status } });
      toast.success(`Status atualizado em ${selectedIds.length} proposta(s)`);
      clearSelection();
    } catch (e: any) {
      toast.error("Falha ao atualizar status", { description: e?.message });
    }
  };

  const applySeller = async (sellerId: string) => {
    if (!sellerId) return;
    try {
      await bulkUpdate.mutateAsync({
        ids: selectedIds,
        patch: { owner_user_id: sellerId },
      });
      toast.success(`Vendedor atualizado em ${selectedIds.length} proposta(s)`);
      clearSelection();
    } catch (e: any) {
      toast.error("Falha ao atualizar vendedor", { description: e?.message });
    }
  };

  const applyAddTag = async (tagId: string) => {
    try {
      await addTags.mutateAsync({ proposalIds: selectedIds, tagIds: [tagId] });
      toast.success("Marcador incluído");
    } catch (e: any) {
      toast.error("Falha ao incluir marcador", { description: e?.message });
    }
  };
  const applyRemoveTag = async (tagId: string) => {
    try {
      await removeTags.mutateAsync({ proposalIds: selectedIds, tagIds: [tagId] });
      toast.success("Marcador removido");
    } catch (e: any) {
      toast.error("Falha ao remover marcador", { description: e?.message });
    }
  };

  const confirmDelete = async () => {
    try {
      await bulkSoftDelete.mutateAsync(deleteDialog.ids);
      toast.success(`${deleteDialog.ids.length} proposta(s) excluída(s)`);
      setDeleteDialog({ open: false, ids: [] });
      clearSelection();
    } catch (e: any) {
      toast.error("Falha ao excluir", { description: e?.message });
    }
  };

  const confirmApprove = async () => {
    try {
      await bulkUpdate.mutateAsync({
        ids: approveDialog.ids,
        patch: { status: "aprovada", approved_at: new Date().toISOString() },
      });
      toast.success("Proposta aprovada — venda contabilizada");
      setApproveDialog({ open: false, ids: [] });
      clearSelection();
    } catch (e: any) {
      toast.error("Falha ao aprovar", { description: e?.message });
    }
  };

  // tags currently used by selected proposals (for "remover" popover)
  const currentSelectedTagIds = useMemo(() => {
    const s = new Set<string>();
    selectedTagsRows.forEach((r) => s.add(r.tag_id));
    return s;
  }, [selectedTagsRows]);

  // Period chip label
  const periodLabel =
    period === "all"
      ? "por período"
      : period === "today"
        ? "do dia"
        : period === "month"
          ? "do mês"
          : period === "interval"
            ? `${periodFrom || "?"} → ${periodTo || "?"}`
            : "próximos contatos";

  const activeFilterCount =
    (filterTag !== "__all__" ? 1 : 0) + (filterSeller ? 1 : 0);

  return (
    <div className="p-6 space-y-5 pb-24">
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
              <DropdownMenuItem onClick={() => setImportOpen(true)}>
                importar propostas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportProposalsCsv(filtered)}>
                exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setTab("modelo"); setPage(1); }}>
                configurar modelos
              </DropdownMenuItem>
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

        {/* Período Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <CalendarIcon className="w-4 h-4" /> {periodLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Período</div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { k: "all", label: "sem filtro" },
                  { k: "today", label: "do dia" },
                  { k: "month", label: "do mês" },
                  { k: "interval", label: "do intervalo" },
                  { k: "next_contact", label: "próximos contatos" },
                ].map((opt) => (
                  <button
                    key={opt.k}
                    onClick={() => setPeriod(opt.k as PeriodKey)}
                    className={cn(
                      "text-xs rounded-full px-2.5 py-1 border transition-colors",
                      period === opt.k
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-background hover:bg-muted border-border",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {period === "interval" && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">De</label>
                    <Input
                      type="date"
                      value={periodFrom}
                      onChange={(e) => setPeriodFrom(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Até</label>
                    <Input
                      type="date"
                      value={periodTo}
                      onChange={(e) => setPeriodTo(e.target.value)}
                      className="h-8"
                    />
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Filtros Popover */}
        <Popover
          onOpenChange={(o) => {
            if (o) {
              setFilterTagDraft(filterTag);
              setFilterSellerDraft(filterSeller);
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Filter className="w-4 h-4" /> filtros
              {activeFilterCount > 0 && (
                <Badge className="ml-1 h-4 px-1 text-[10px] bg-violet-600">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Marcador
                </label>
                <Select
                  value={filterTagDraft}
                  onValueChange={setFilterTagDraft}
                >
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue placeholder="Sem filtro por marcador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Sem filtro por marcador</SelectItem>
                    {allTags.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Vendedor
                </label>
                <SellerSelect
                  value={filterSellerDraft}
                  onValueChange={setFilterSellerDraft}
                  placeholder="Nome do vendedor"
                  includeUnassigned
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterTagDraft("__all__");
                    setFilterSellerDraft("");
                  }}
                >
                  limpar
                </Button>
                <Button
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={() => {
                    setFilterTag(filterTagDraft);
                    setFilterSeller(filterSellerDraft);
                    setPage(1);
                  }}
                >
                  aplicar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

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
              <SortableHead label="Número" sortKey="number" sort={sort} onSort={onSort} className="w-28" />
              <SortableHead label="Data" sortKey="issue_date" sort={sort} onSort={onSort} className="w-32" />
              <SortableHead label="Próx. Contato" sortKey="next_contact_date" sort={sort} onSort={onSort} className="w-36" />
              <SortableHead label="Cliente" sortKey="customer_name" sort={sort} onSort={onSort} />
              <SortableHead label="Valor" sortKey="total_cents" sort={sort} onSort={onSort} className="w-32 text-right" />
              <SortableHead label="Marcadores" sortKey="status" sort={sort} onSort={onSort} />
              <SortableHead label="Integrações" sortKey="deal_id" sort={sort} onSort={onSort} />
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

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pointer-events-none">
          <div className="mx-auto max-w-5xl bg-card border shadow-lg rounded-lg px-4 py-3 flex items-center gap-2 flex-wrap pointer-events-auto">
            <div className="text-sm font-medium flex items-center gap-1.5 mr-2">
              <span className="text-violet-600">↑ {selected.size}</span>
              <span className="text-muted-foreground">selecionada(s)</span>
            </div>

            {/* Alterar status */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <CircleDot className="h-3.5 w-3.5" /> Alterar status
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-1">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => applyStatus(s.value)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        STATUS_META[s.value]?.dot,
                      )}
                    />
                    {s.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Alterar vendedor */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <UserCog className="h-3.5 w-3.5" /> Alterar vendedor
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64">
                <div className="text-xs text-muted-foreground mb-2">
                  Atribuir a:
                </div>
                <SellerSelect
                  value=""
                  onValueChange={(v) => applySeller(v)}
                  placeholder="Selecione um vendedor"
                />
              </PopoverContent>
            </Popover>

            {/* Incluir marcador */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <TagIcon className="h-3.5 w-3.5" /> Incluir marcador
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-1 max-h-72 overflow-auto">
                {allTags.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                    Nenhum marcador cadastrado.
                  </div>
                ) : (
                  allTags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyAddTag(t.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: t.color ?? "#888" }}
                      />
                      {t.name}
                    </button>
                  ))
                )}
              </PopoverContent>
            </Popover>

            {/* Excluir marcador */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <X className="h-3.5 w-3.5" /> Excluir marcador
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-1 max-h-72 overflow-auto">
                {(() => {
                  const tags = allTags.filter((t) => currentSelectedTagIds.has(t.id));
                  if (tags.length === 0) {
                    return (
                      <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                        Nenhum marcador nas propostas selecionadas.
                      </div>
                    );
                  }
                  return tags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyRemoveTag(t.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: t.color ?? "#888" }}
                      />
                      {t.name}
                    </button>
                  ));
                })()}
              </PopoverContent>
            </Popover>

            {/* Excluir propostas */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setDeleteDialog({ open: true, ids: selectedIds })}
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir propostas
            </Button>

            <div className="flex-1" />

            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-3.5 w-3.5 mr-1" /> Limpar seleção
            </Button>
          </div>
        </div>
      )}

      {/* Approve confirm */}
      <AlertDialog
        open={approveDialog.open}
        onOpenChange={(o) => !o && setApproveDialog({ open: false, ids: [] })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como ganho?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta proposta vai ser registrada como uma VENDA do lead e contabilizada nos relatórios. Tem certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmApprove}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Confirmar e marcar como ganho
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(o) => !o && setDeleteDialog({ open: false, ids: [] })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {deleteDialog.ids.length} proposta(s)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso pode ser desfeito posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
