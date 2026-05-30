import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Search, MoreHorizontal, ChevronDown, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useInfinitePaginated, flattenPages } from "@/components/lists/useInfinitePaginated";
import { LoadMoreSentinel } from "@/components/lists/LoadMoreSentinel";
import { ListFooter } from "@/components/lists/ListFooter";

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
  tipo_produto: string | null;
  gtin: string | null;
  created_at: string;
};

type Category = "simples" | "kit" | "variacoes" | "fabricado" | "materia_prima";

type Filters = {
  categories: Category[];
  price_range: [number, number];
  status: "all" | "ativo" | "inativo";
  has_stock: boolean;
};

const CHIPS: { key: Category; label: string }[] = [
  { key: "simples", label: "simples" },
  { key: "kit", label: "kits" },
  { key: "variacoes", label: "variações" },
  { key: "fabricado", label: "fabricado" },
  { key: "materia_prima", label: "matéria-prima" },
];

const DEFAULT_FILTERS: Filters = {
  categories: [],
  price_range: [0, 100000],
  status: "all",
  has_stock: false,
};

function brNum(v: number | null | undefined) {
  return (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useFilteredProducts(products: Product[], search: string, filters: Filters) {
  return useMemo(() => {
    const q = search.trim().toLowerCase();
    const [minP, maxP] = filters.price_range;
    return products.filter((p) => {
      const cat = (p.tipo_produto || "simples") as Category;
      if (filters.categories.length > 0 && !filters.categories.includes(cat)) return false;
      const priceReais = (p.price_cents ?? 0) / 100;
      if (priceReais < minP || priceReais > maxP) return false;
      if (filters.status !== "all" && (p.status || "ativo") !== filters.status) return false;
      if (filters.has_stock && (p.stock_qty ?? 0) <= 0) return false;
      if (q && !(
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.gtin?.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [products, search, filters]);
}

export default function Produtos() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<"name" | "status" | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const query = useInfinitePaginated<Product>({
    queryKey: ["products-infinite", current?.id],
    table: "products",
    select: "id,workspace_id,sku,name,description,price_cents,cost_cents,stock_qty,unidade,status,thumb_url,image_url,tipo_produto,gtin,created_at",
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

  const counts = useMemo(() => {
    const c: Record<Category | "todos", number> = { todos: products.length, simples: 0, kit: 0, variacoes: 0, fabricado: 0, materia_prima: 0 };
    for (const p of products) {
      const t = (p.tipo_produto || "simples") as Category;
      if (t in c) c[t]++;
    }
    return c;
  }, [products]);

  const filteredBase = useFilteredProducts(products, search, filters);
  const filtered = useMemo(() => {
    if (!sortBy) return filteredBase;
    const arr = [...filteredBase];
    arr.sort((a, b) => {
      const av = sortBy === "name" ? (a.name ?? "") : (a.status ?? "");
      const bv = sortBy === "name" ? (b.name ?? "") : (b.status ?? "");
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return arr;
  }, [filteredBase, sortBy, sortAsc]);

  const toggleCategory = (cat: Category) => {
    setFilters((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }));
  };

  const toggleSort = (key: "name" | "status") => {
    if (sortBy === key) {
      if (sortAsc) setSortAsc(false);
      else { setSortBy(null); setSortAsc(true); }
    } else {
      setSortBy(key);
      setSortAsc(true);
    }
  };

  const openFilters = () => {
    setDraft(filters);
    setFiltersOpen(true);
  };
  const applyFilters = () => {
    setFilters(draft);
    setFiltersOpen(false);
  };
  const resetFilters = () => {
    setDraft(DEFAULT_FILTERS);
  };


  const allActive = filters.categories.length === 0;

  return (
    <div className="px-8 py-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1">início › cadastros › produtos</div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => nav("/produtos/novo")} className="rounded-full">
            <Plus className="w-4 h-4 mr-1" /> incluir produto
          </Button>
          <Button variant="outline" className="rounded-full">
            mais ações <MoreHorizontal className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-xl">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquise por nome, código (SKU) ou GTIN/EAN"
            className="pl-9 rounded-full"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => toggleSort("name")}
        >
          nome {sortBy === "name" ? (sortAsc ? "↑" : "↓") : ""}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => toggleSort("status")}
        >
          por situação {sortBy === "status" ? (sortAsc ? "↑" : "↓") : ""}
        </Button>

        <Popover open={filtersOpen} onOpenChange={(o) => (o ? openFilters() : setFiltersOpen(false))}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="rounded-full" size="sm">
              <Filter className="w-4 h-4 mr-1" /> filtros
              {(filters.status !== "all" || filters.has_stock || filters.price_range[0] > 0 || filters.price_range[1] < 100000) && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px]">•</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-4" align="end">
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <div className="flex gap-2">
                {(["all", "ativo", "inativo"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={draft.status === s ? "default" : "outline"}
                    className="rounded-full flex-1 capitalize"
                    onClick={() => setDraft((d) => ({ ...d, status: s }))}
                  >
                    {s === "all" ? "todos" : s}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="has_stock" className="text-xs">Com estoque</Label>
              <Switch
                id="has_stock"
                checked={draft.has_stock}
                onCheckedChange={(c) => setDraft((d) => ({ ...d, has_stock: c }))}
              />
            </div>
            <div className="flex justify-between pt-2 border-t">
              <Button size="sm" variant="ghost" onClick={resetFilters}>limpar</Button>
              <Button size="sm" onClick={applyFilters}>aplicar</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-end gap-8 border-b mb-2 flex-wrap">
        <button
          onClick={() => setFilters((f) => ({ ...f, categories: [] }))}
          aria-pressed={allActive}
          className={`pb-2 text-sm transition-colors ${
            allActive ? "border-b-2 border-foreground text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div>todos</div>
          <div className="text-xs tabular-nums">{String(counts.todos).padStart(2, "0")}</div>
        </button>
        {CHIPS.map((t) => {
          const active = filters.categories.includes(t.key);
          return (
            <button
              key={t.key}
              onClick={() => toggleCategory(t.key)}
              aria-pressed={active}
              className={`pb-2 text-sm transition-colors ${
                active ? "border-b-2 border-foreground text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div>{t.label}</div>
              <div className="text-xs tabular-nums">{String(counts[t.key]).padStart(2, "0")}</div>
            </button>
          );

        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="py-3 w-8"><Checkbox /></th>
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
              <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center">
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
            {filtered.map((p) => (
              <tr
                key={p.id}
                onClick={() => nav(`/produtos/${p.id}`)}
                className="border-b hover:bg-muted/40 cursor-pointer"
              >
                <td className="py-3" onClick={(e) => e.stopPropagation()}><Checkbox /></td>
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <button className="text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {p.thumb_url ? (
                        <img src={p.thumb_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <span className="truncate max-w-[420px]">{p.name || "Sem nome"}</span>
                  </div>
                </td>
                <td className="py-3 font-mono">{p.sku || "—"}</td>
                <td className="py-3">{p.unidade || "UN"}</td>
                <td className="py-3 text-right tabular-nums">{brNum((p.price_cents ?? 0) / 100)}</td>
                <td className="py-3 text-right tabular-nums">{brNum(p.stock_qty)}</td>
                <td className="py-3 text-right tabular-nums">{brNum(p.stock_qty)}</td>
                <td className="py-3"></td>
                <td className="py-3 text-muted-foreground"><ChevronDown className="w-4 h-4" /></td>
              </tr>
            ))}
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
    </div>
  );
}
