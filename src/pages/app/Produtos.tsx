import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Search, MoreHorizontal, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

type Tab = "todos" | "simples" | "kit" | "variacoes" | "fabricado" | "materia_prima";

const TABS: { key: Tab; label: string }[] = [
  { key: "todos", label: "todos" },
  { key: "simples", label: "simples" },
  { key: "kit", label: "kits" },
  { key: "variacoes", label: "variações" },
  { key: "fabricado", label: "fabricado" },
  { key: "materia_prima", label: "matéria-prima" },
];

function brNum(v: number | null | undefined) {
  return (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Produtos() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("todos");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id,workspace_id,sku,name,description,price_cents,cost_cents,stock_qty,unidade,status,thumb_url,tipo_produto,gtin,created_at")
        .eq("workspace_id", current!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`products:${current.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["products", current.id] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { todos: products.length, simples: 0, kit: 0, variacoes: 0, fabricado: 0, materia_prima: 0 };
    for (const p of products) {
      const t = (p.tipo_produto || "simples") as Tab;
      if (t in c && t !== "todos") c[t]++;
    }
    return c;
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (tab !== "todos" && (p.tipo_produto || "simples") !== tab) return false;
      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.gtin?.toLowerCase().includes(q)
      );
    });
  }, [products, search, tab]);

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

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-xl">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquise por nome, código (SKU) ou GTIN/EAN"
            className="pl-9 rounded-full"
          />
        </div>
        <Button variant="outline" className="rounded-full" size="sm">
          ↓ nome
        </Button>
        <Button variant="outline" className="rounded-full" size="sm">
          por situação
        </Button>
        <Button variant="outline" className="rounded-full" size="sm">
          filtros
        </Button>
      </div>

      <div className="flex items-end gap-8 border-b mb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-2 text-sm transition-colors ${
              tab === t.key
                ? "border-b-2 border-primary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div>{t.label}</div>
            <div className="text-xs tabular-nums">{String(counts[t.key]).padStart(2, "0")}</div>
          </button>
        ))}
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
      </div>
    </div>
  );
}
