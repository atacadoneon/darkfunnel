import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Search, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

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
  created_at: string;
};

type Form = {
  name: string;
  sku: string;
  description: string;
  price: string;
  cost: string;
  stock: string;
  unidade: string;
  status: string;
};

const EMPTY: Form = {
  name: "",
  sku: "",
  description: "",
  price: "",
  cost: "",
  stock: "",
  unidade: "UN",
  status: "active",
};

function brl(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function Produtos() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [search, setSearch] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id,workspace_id,sku,name,description,price_cents,cost_cents,stock_qty,unidade,status,thumb_url,created_at",
        )
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `workspace_id=eq.${current.id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["products", current.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [current, qc]);

  const save = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("sem workspace");
      const payload = {
        workspace_id: current.id,
        name: form.name.trim() || "Sem nome",
        sku: form.sku.trim() || null,
        description: form.description.trim() || null,
        price_cents: Math.round(parseFloat(form.price.replace(",", ".") || "0") * 100),
        cost_cents: Math.round(parseFloat(form.cost.replace(",", ".") || "0") * 100),
        stock_qty: parseFloat(form.stock.replace(",", ".") || "0"),
        unidade: form.unidade || "UN",
        status: form.status || "active",
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", current?.id] });
      toast.success(editing ? "Produto atualizado" : "Produto criado");
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
    },
    onError: (err) => toast.error("Falha ao salvar", { description: String(err) }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name ?? "",
      sku: p.sku ?? "",
      description: p.description ?? "",
      price: ((p.price_cents ?? 0) / 100).toFixed(2),
      cost: ((p.cost_cents ?? 0) / 100).toFixed(2),
      stock: String(p.stock_qty ?? 0),
      unidade: p.unidade ?? "UN",
      status: p.status ?? "active",
    });
    setOpen(true);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q),
    );
  }, [products, search]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de produtos do seu workspace.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, SKU ou descrição…"
            className="pl-9"
          />
        </div>
        <Badge variant="outline">{filtered.length} produtos</Badge>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Package className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">
            {products.length === 0 ? "Nenhum produto ainda" : "Nada encontrado"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {products.length === 0
              ? 'Clique em "Novo Produto" para começar.'
              : "Ajuste a busca acima."}
          </p>
          {products.length === 0 && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Criar primeiro produto
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <Card
              key={p.id}
              className="p-4 hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => openEdit(p)}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {p.thumb_url ? (
                    <img src={p.thumb_url} alt={p.name ?? ""} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{p.name || "Sem nome"}</div>
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {p.sku && (
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      SKU: {p.sku}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold font-mono text-sm">{brl(p.price_cents)}</span>
                    <Badge variant={p.status === "active" ? "secondary" : "outline"} className="text-[10px]">
                      {p.status === "active" ? "Ativo" : p.status ?? "—"}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Estoque: {p.stock_qty ?? 0} {p.unidade ?? "UN"}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Camiseta Preta P"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>SKU</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="SKU-001"
                />
              </div>
              <div>
                <Label>Unidade</Label>
                <Input
                  value={form.unidade}
                  onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                  placeholder="UN"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Custo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Estoque</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição do produto…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>
              {save.isPending ? "Salvando…" : editing ? "Salvar" : "Criar produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
