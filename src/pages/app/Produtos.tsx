import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Search, MoreHorizontal, ChevronDown, Filter, Sliders, Download, Printer, Calendar as CalIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useInfinitePaginated, flattenPages } from "@/components/lists/useInfinitePaginated";
import { LoadMoreSentinel } from "@/components/lists/LoadMoreSentinel";
import { ListFooter } from "@/components/lists/ListFooter";
import { useTagsProduto } from "@/hooks/useTagsProduto";

type Product = {
  id: string;
  workspace_id: string;
  sku: string | null;
  name: string | null;
  description: string | null;
  price_cents: number | null;
  cost_cents: number | null;
  stock_qty: number | null;
  unidade: string | null;
  status: string | null;
  thumb_url: string | null;
  image_url: string | null;
  tipo_produto: string | null;
  kind: string | null;
  base_product_id: string | null;
  gtin: string | null;
  marca: string | null;
  categoria: string | null;
  ncm: string | null;
  created_at: string;
  updated_at?: string | null;
};

type KindTab = "todos" | "produto" | "servico" | "assinatura";
type RefineKey = "none" | "codigo" | "codigo_parcial" | "codigo_fornecedor" | "gtin" | "descricao" | "palavras";
type StatusKey = "all" | "ativos" | "inativos" | "excluidos";
type SortKey = "name" | "recent" | "updated" | "sku";

type Filters = {
  price_range: [number, number];
  has_stock: boolean;
  ecom_in: string;
  ecom_out: string;
  category: string;
  supplier: string;
  brand: string;
  ncm: string;
  no_ncm: boolean;
  tags: string;
  updated_from: string;
};

const DEFAULT_FILTERS: Filters = {
  price_range: [0, 100000],
  has_stock: false,
  ecom_in: "",
  ecom_out: "",
  category: "",
  supplier: "",
  brand: "",
  ncm: "",
  no_ncm: false,
  tags: "todas",
  updated_from: "",
};

const REFINE_OPTIONS: { key: Exclude<RefineKey, "none">; label: string }[] = [
  { key: "codigo", label: "Código" },
  { key: "codigo_parcial", label: "Código (parcial)" },
  { key: "codigo_fornecedor", label: "Código no fornecedor" },
  { key: "gtin", label: "GTIN/EAN" },
  { key: "descricao", label: "Descrição" },
  { key: "palavras", label: "Palavras-chave" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "nome" },
  { key: "recent", label: "mais recentes" },
  { key: "updated", label: "data de atualização" },
  { key: "sku", label: "código (sku)" },
];

const STATUS_OPTIONS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "sem filtro" },
  { key: "ativos", label: "ativos" },
  { key: "inativos", label: "inativos" },
  { key: "excluidos", label: "excluídos" },
];

function brNum(v: number | null | undefined) {
  return (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function matchRefine(p: Product, q: string, refine: RefineKey) {
  if (!q) return true;
  const t = q.toLowerCase();
  switch (refine) {
    case "codigo":
      return (p.sku ?? "").toLowerCase() === t;
    case "codigo_parcial":
      return (p.sku ?? "").toLowerCase().includes(t);
    case "codigo_fornecedor":
      return (p.sku ?? "").toLowerCase().includes(t);
    case "gtin":
      return (p.gtin ?? "").toLowerCase().includes(t);
    case "descricao":
      return (p.description ?? "").toLowerCase().includes(t) || (p.name ?? "").toLowerCase().includes(t);
    case "palavras":
      return (p.name ?? "").toLowerCase().includes(t) || (p.description ?? "").toLowerCase().includes(t);
    default:
      return (
        (p.name ?? "").toLowerCase().includes(t) ||
        (p.sku ?? "").toLowerCase().includes(t) ||
        (p.gtin ?? "").toLowerCase().includes(t)
      );
  }
}

export default function Produtos() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [refine, setRefine] = useState<RefineKey>("none");
  const [status, setStatus] = useState<StatusKey>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [kindTab, setKindTab] = useState<KindTab>("todos");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [integrationImportOpen, setIntegrationImportOpen] = useState(false);
  const { data: tagsProduto = [] } = useTagsProduto();

  const query = useInfinitePaginated<Product>({
    queryKey: ["products-infinite", current?.id],
    table: "products",
    select: "id,workspace_id,sku,name,description,price_cents,cost_cents,stock_qty,unidade,status,thumb_url,image_url,tipo_produto,kind,base_product_id,gtin,marca,categoria,ncm,created_at,updated_at",
    filters: { workspace_id: current?.id },
    order: { col: "created_at", asc: false },
    pageSize: 100,
    enabled: !!current,
  });
  const { isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const { items: products, total } = flattenPages<Product>(query.data as any);

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`products:${current.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["products-infinite", current.id] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  // Hide variations from main list
  const baseProducts = useMemo(() => products.filter((p) => !p.base_product_id), [products]);

  const kindCounts = useMemo(() => {
    const c: Record<KindTab, number> = { todos: baseProducts.length, produto: 0, servico: 0, assinatura: 0 };
    for (const p of baseProducts) {
      const k = (p.kind || "produto") as Exclude<KindTab, "todos">;
      if (k in c) c[k]++;
    }
    return c;
  }, [baseProducts]);

  const filtered = useMemo(() => {
    const [minP, maxP] = filters.price_range;
    const q = search.trim();
    const updatedFrom = filters.updated_from ? new Date(filters.updated_from).getTime() : 0;
    let arr = baseProducts.filter((p) => {
      if (kindTab !== "todos" && (p.kind || "produto") !== kindTab) return false;
      const priceReais = (p.price_cents ?? 0) / 100;
      if (priceReais < minP || priceReais > maxP) return false;
      if (filters.has_stock && (p.stock_qty ?? 0) <= 0) return false;
      if (filters.brand && !(p.marca ?? "").toLowerCase().includes(filters.brand.toLowerCase())) return false;
      if (filters.category && !(p.categoria ?? "").toLowerCase().includes(filters.category.toLowerCase())) return false;
      if (filters.ncm && !(p.ncm ?? "").includes(filters.ncm)) return false;
      if (filters.no_ncm && p.ncm) return false;
      if (updatedFrom) {
        const u = p.updated_at ? new Date(p.updated_at).getTime() : 0;
        if (u < updatedFrom) return false;
      }
      // status
      if (status !== "all") {
        const s = (p.status || "active").toLowerCase();
        if (status === "ativos" && s !== "active" && s !== "ativo") return false;
        if (status === "inativos" && s !== "inactive" && s !== "inativo") return false;
        if (status === "excluidos" && s !== "archived" && s !== "excluido") return false;
      }
      if (!matchRefine(p, q, refine)) return false;
      return true;
    });
    arr = [...arr].sort((a, b) => {
      if (sort === "name") return (a.name ?? "").localeCompare(b.name ?? "");
      if (sort === "sku") return (a.sku ?? "").localeCompare(b.sku ?? "");
      if (sort === "updated") return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
    return arr;
  }, [baseProducts, kindTab, filters, search, refine, status, sort]);

  const openFilters = () => { setDraft(filters); setFiltersOpen(true); };
  const applyFilters = () => { setFilters(draft); setFiltersOpen(false); };
  const resetFilters = () => setDraft(DEFAULT_FILTERS);

  const hasActiveFilters =
    filters.has_stock ||
    filters.brand || filters.category || filters.ncm || filters.no_ncm ||
    filters.ecom_in || filters.ecom_out || filters.supplier || filters.updated_from ||
    filters.price_range[0] > 0 || filters.price_range[1] < 100000;

  const KIND_TABS: { key: KindTab; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "produto", label: "Produto" },
    { key: "servico", label: "Serviço" },
    { key: "assinatura", label: "Assinatura" },
  ];

  return (
    <div className="px-8 py-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-full">
            <Download className="w-4 h-4 mr-1" /> receber do e-commerce
          </Button>
          <Button onClick={() => nav("/produtos/novo")} className="rounded-full bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> incluir produto
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Mais ações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" /> Imprimir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIntegrationImportOpen(true)}>
                <Download className="w-4 h-4 mr-2" /> Importar produtos da integração
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCsvImportOpen(true)}>
                Importar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportProductsCsv(filtered)}>
                Exportar lista
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[280px] max-w-xl">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquise por nome, código (SKU) ou GTIN/EAN"
            className="pl-9 pr-10 rounded-full"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground" title="refinar">
                <Sliders className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Refinar busca</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {REFINE_OPTIONS.map((o) => (
                <DropdownMenuCheckboxItem
                  key={o.key}
                  checked={refine === o.key}
                  onCheckedChange={() => setRefine(o.key)}
                >
                  {o.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setRefine("none")}>Não refinar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-full">
              {SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "nome"}
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-48 p-2">
            <div className="flex flex-wrap gap-1">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setSort(o.key)}
                  className={`px-2.5 py-1 rounded-full text-xs ${
                    sort === o.key ? "bg-violet-600 text-white" : "bg-muted hover:bg-muted/70"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-full">
              {status === "all" ? "por situação" : STATUS_OPTIONS.find((o) => o.key === status)?.label}
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-48 p-2">
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setStatus(o.key)}
                  className={`px-2.5 py-1 rounded-full text-xs ${
                    status === o.key ? "bg-violet-600 text-white" : "bg-muted hover:bg-muted/70"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={filtersOpen} onOpenChange={(o) => (o ? openFilters() : setFiltersOpen(false))}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="rounded-full" size="sm">
              <Filter className="w-4 h-4 mr-1" /> filtros
              {hasActiveFilters && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-600 text-white text-[10px]">•</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[420px] space-y-3" align="end">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Input value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} placeholder="escolher categoria" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fornecedor</Label>
                <Input value={draft.supplier} onChange={(e) => setDraft((d) => ({ ...d, supplier: e.target.value }))} placeholder="razão social ou nome fantasia" />
              </div>
              <div>
                <Label className="text-xs">Marca</Label>
                <Input value={draft.brand} onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Buscar por NCM</Label>
              <Input value={draft.ncm} onChange={(e) => setDraft((d) => ({ ...d, ncm: e.target.value }))} placeholder="0000.00.00" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="no_ncm" checked={draft.no_ncm} onCheckedChange={(c) => setDraft((d) => ({ ...d, no_ncm: !!c }))} />
              <Label htmlFor="no_ncm" className="text-xs">Buscar por produtos sem NCM</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tags de produtos</Label>
                <Select value={draft.tags} onValueChange={(v) => setDraft((d) => ({ ...d, tags: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {tagsProduto.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Atualizados a partir de</Label>
                <div className="relative">
                  <Input type="date" value={draft.updated_from} onChange={(e) => setDraft((d) => ({ ...d, updated_from: e.target.value }))} />
                  <CalIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Faixa de preço (R$)</Label>
              <Slider
                min={0}
                max={100000}
                step={50}
                value={draft.price_range}
                onValueChange={(v) => setDraft((d) => ({ ...d, price_range: [v[0], v[1]] as [number, number] }))}
              />
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>R$ {brNum(draft.price_range[0])}</span>
                <span>R$ {brNum(draft.price_range[1])}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="has_stock" className="text-xs">Com estoque</Label>
              <Switch id="has_stock" checked={draft.has_stock} onCheckedChange={(c) => setDraft((d) => ({ ...d, has_stock: c }))} />
            </div>
            <div className="flex justify-between pt-2 border-t">
              <Button size="sm" variant="ghost" onClick={resetFilters}>cancelar</Button>
              <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={applyFilters}>aplicar</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-end gap-8 border-b mb-2 flex-wrap">
        {KIND_TABS.map((t) => {
          const active = kindTab === t.key;
          const count = kindCounts[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setKindTab(t.key)}
              aria-pressed={active}
              className={`pb-2 text-sm transition-colors ${
                active ? "border-b-2 border-foreground text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div>{t.label}</div>
              <div className="text-xs tabular-nums">
                {isLoading ? "—" : String(count).padStart(2, "0")}
              </div>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="py-3 w-8"><Checkbox /></th>
              <th className="py-3 w-8"></th>
              <th className="py-3 w-20 text-left font-normal">Foto</th>
              <th className="py-3 text-left font-normal">Descrição</th>
              <th className="py-3 text-left font-normal">Código (SKU)</th>
              <th className="py-3 text-left font-normal">Unidade</th>
              <th className="py-3 text-right font-normal">Preço</th>
              <th className="py-3 text-right font-normal">Estoque físico</th>
              <th className="py-3 text-right font-normal">Estoque disponível</th>
              <th className="py-3 text-left font-normal">Integrações</th>
              <th className="py-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={11} className="py-8 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="py-12 text-center">
                  <Package className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <div className="text-sm text-muted-foreground mb-3">
                    {products.length === 0 ? "Nenhum produto cadastrado" : "Nada encontrado"}
                  </div>
                  {products.length === 0 && (
                    <Button onClick={() => nav("/produtos/novo")}>
                      <Plus className="w-4 h-4 mr-1" /> incluir primeiro produto
                    </Button>
                  )}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const photo = p.image_url || p.thumb_url;
              return (
              <tr
                key={p.id}
                onClick={() => nav(`/produtos/${p.id}`)}
                className="border-b hover:bg-muted/40 cursor-pointer"
              >
                <td className="py-3" onClick={(e) => e.stopPropagation()}><Checkbox /></td>
                <td className="py-3" onClick={(e) => e.stopPropagation()}>
                  <button className="text-muted-foreground">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </td>
                <td className="py-3">
                  {photo ? (
                    <img src={photo} alt="" className="h-12 w-12 rounded-md object-cover border border-border" />
                  ) : (
                    <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center border border-border">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </td>
                <td className="py-3">
                  <span className="truncate max-w-[420px] block">{p.name || "Sem nome"}</span>
                </td>
                <td className="py-3 font-mono">{p.sku || "—"}</td>
                <td className="py-3">{p.unidade || "UN"}</td>
                <td className="py-3 text-right tabular-nums">{brNum((p.price_cents ?? 0) / 100)}</td>
                <td className="py-3 text-right tabular-nums">{brNum(p.stock_qty)}</td>
                <td className="py-3 text-right tabular-nums">{brNum(p.stock_qty)}</td>
                <td className="py-3"></td>
                <td className="py-3 text-muted-foreground"><ChevronDown className="w-4 h-4" /></td>
              </tr>
              );
            })}
          </tbody>
        </table>
        <LoadMoreSentinel
          hasMore={!!hasNextPage}
          isFetching={isFetchingNextPage}
          onIntersect={() => fetchNextPage()}
        />
      </div>
      <ListFooter
        loaded={products.length}
        total={total}
        hasMore={!!hasNextPage}
        singular="produto exibido"
        plural="produtos exibidos"
      />

      <CsvImportProductsDialog open={csvImportOpen} onOpenChange={setCsvImportOpen} />
      <IntegrationImportDialog open={integrationImportOpen} onOpenChange={setIntegrationImportOpen} />

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print\\:visible, .print\\:visible * { visibility: visible !important; }
          table, table * { visibility: visible !important; }
          table { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

function csvEscape(v: any): string {
  const s = v == null ? "" : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const split = (l: string) => l.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
  const headers = split(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map((l) => {
    const vals = split(l);
    const o: Record<string, string> = {};
    headers.forEach((h, i) => (o[h] = vals[i] ?? ""));
    return o;
  });
  return { headers, rows };
}

function exportProductsCsv(rows: Product[]) {
  const header = ["nome", "sku", "preco", "unidade", "tipo", "estoque_fisico", "estoque_disponivel"];
  const lines = [header.join(",")];
  for (const p of rows) {
    lines.push([
      p.name ?? "",
      p.sku ?? "",
      ((p.price_cents ?? 0) / 100).toFixed(2),
      p.unidade ?? "UN",
      p.kind ?? "produto",
      p.stock_qty ?? 0,
      p.stock_qty ?? 0,
    ].map(csvEscape).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `produtos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast({ title: `${rows.length} produto(s) exportado(s)` });
}

function CsvImportProductsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [parsed, setParsed] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => { if (!open) setParsed(null); }, [open]);

  const onFile = async (f: File | null) => {
    if (!f) { setParsed(null); return; }
    const text = await f.text();
    setParsed(parseCsv(text));
  };

  const doImport = async () => {
    if (!parsed || !current) return;
    setImporting(true);
    try {
      const rows = parsed.rows.map((r) => {
        const priceRaw = r["price"] || r["preco"] || "0";
        const priceCents = /[.,]/.test(priceRaw)
          ? Math.round(parseFloat(priceRaw.replace(/\./g, "").replace(",", ".")) * 100)
          : (parseInt(priceRaw, 10) || 0);
        return {
          workspace_id: current.id,
          name: r["name"] || r["nome"] || null,
          sku: r["sku"] || null,
          price_cents: priceCents,
          unidade: r["unidade"] || "UN",
          kind: r["kind"] || r["tipo"] || "produto",
          status: "active",
        };
      }).filter((r) => r.name);
      if (rows.length === 0) {
        toast({ title: "Nenhuma linha válida" });
        setImporting(false);
        return;
      }
      const { error } = await (supabase as any).from("products").insert(rows);
      if (error) throw error;
      toast({ title: `${rows.length} produto(s) importado(s)` });
      qc.invalidateQueries({ queryKey: ["products-infinite"] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Falha ao importar", description: e?.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar produtos via CSV</DialogTitle>
          <DialogDescription>
            Colunas suportadas: name, sku, price (R$ ou cents), unidade, kind (produto/servico/assinatura).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input type="file" accept=".csv,.xlsx" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          {parsed && (
            <div className="rounded border p-3 text-xs space-y-2 max-h-64 overflow-auto">
              <div className="font-medium">
                {parsed.rows.length} linha(s) — colunas: {parsed.headers.join(", ")}
              </div>
              {parsed.rows.slice(0, 5).map((r, i) => (
                <div key={i} className="border-t pt-1 font-mono">
                  {parsed.headers.map((h) => `${h}=${r[h]}`).join(" | ")}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={doImport}
            disabled={!parsed || importing}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {importing ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IntegrationImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { current } = useWorkspace();
  const [connections, setConnections] = useState<Array<{ id: string; slug: string; api_version: string | null; status: string }>>([]);
  const [selected, setSelected] = useState<string>("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!open || !current) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("integration_connections")
        .select("id,slug,api_version,status")
        .eq("workspace_id", current.id)
        .eq("status", "active")
        .in("slug", ["tiny_erp", "bling", "olist"]);
      setConnections((data ?? []) as any);
      if (data?.[0]) setSelected(data[0].id);
    })();
  }, [open, current]);

  const doImport = async () => {
    const conn = connections.find((c) => c.id === selected);
    if (!conn || !current) return;
    setRunning(true);
    try {
      const fn = conn.slug === "bling"
        ? "bling-v3-sync"
        : conn.slug === "tiny_erp" && conn.api_version === "v2"
          ? "tiny-v2-import"
          : "tiny-v3-sync";
      const { error } = await (supabase as any).functions.invoke(fn, {
        body: { workspace_id: current.id, connection_id: conn.id, entity: "products" },
      });
      if (error) throw error;
      toast({ title: "Importação iniciada — acompanhe nas integrações" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Falha ao iniciar importação", description: e?.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar produtos da integração</DialogTitle>
          <DialogDescription>
            Selecione uma integração ativa para iniciar a importação de produtos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {connections.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 text-center border rounded">
              Nenhuma integração ativa. Configure uma em /settings/integracoes.
            </div>
          ) : (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {connections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.slug} {c.api_version ? `(${c.api_version})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={doImport}
            disabled={!selected || running}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {running ? "Iniciando..." : "Importar agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

