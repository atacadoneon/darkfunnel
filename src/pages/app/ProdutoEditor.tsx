import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Package, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Form = Record<string, any>;

const EMPTY: Form = {
  kind: "produto",
  tipo_produto: "simples",
  tipo_item_sped: "",
  name: "",
  gtin: "",
  origem_icms: "0",
  unidade: "UN",
  ncm: "",
  sku: "",
  cest: "",
  categoria: "",
  marca: "",
  tabela_medidas: "",
  descricao_complementar: "",
  description: "",
  peso_liquido: "",
  peso_bruto: "",
  tipo_embalagem: "",
  embalagem: "",
  largura: "",
  altura: "",
  comprimento: "",
  controlar_estoque: false,
  stock_qty: "",
  localizacao: "",
  dias_preparacao: "",
  estoque_minimo: "",
  estoque_maximo: "",
  price: "",
  preco_promocional: "",
  cost: "",
  margem_lucro: "",
  status: "active",
  thumb_url: "",
  garantia: "",
  observacoes: "",
  sob_encomenda: false,
};

function num(v: any) {
  if (v === "" || v == null) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function cents(v: any) {
  const n = num(v);
  return n == null ? null : Math.round(n * 100);
}

export default function ProdutoEditor() {
  const { current } = useWorkspace();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "novo";
  const nav = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(EMPTY);

  const { data: produto } = useQuery({
    queryKey: ["product", id],
    enabled: !isNew && !!current,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!produto) return;
    setForm({
      ...EMPTY,
      ...produto,
      price: ((produto.price_cents ?? 0) / 100).toFixed(2),
      cost: ((produto.cost_cents ?? 0) / 100).toFixed(2),
      preco_promocional: produto.preco_promocional_cents
        ? (produto.preco_promocional_cents / 100).toFixed(2)
        : "",
      stock_qty: produto.stock_qty ?? "",
    });
  }, [produto]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("sem workspace");
      const payload: any = {
        workspace_id: current.id,
        kind: form.kind || "produto",
        tipo_produto: form.tipo_produto || "simples",
        tipo_item_sped: form.tipo_item_sped || null,
        name: (form.name ?? "").trim() || "Sem nome",
        gtin: form.gtin || null,
        origem_icms: form.origem_icms || null,
        unidade: form.unidade || "UN",
        ncm: form.ncm || null,
        sku: form.sku || null,
        cest: form.cest || null,
        categoria: form.categoria || null,
        marca: form.marca || null,
        tabela_medidas: form.tabela_medidas || null,
        descricao_complementar: form.descricao_complementar || null,
        description: form.description || null,
        peso_liquido: num(form.peso_liquido),
        peso_bruto: num(form.peso_bruto),
        tipo_embalagem: form.tipo_embalagem || null,
        embalagem: form.embalagem || null,
        largura: num(form.largura),
        altura: num(form.altura),
        comprimento: num(form.comprimento),
        controlar_estoque: !!form.controlar_estoque,
        stock_qty: num(form.stock_qty) ?? 0,
        localizacao: form.localizacao || null,
        dias_preparacao: form.dias_preparacao ? parseInt(form.dias_preparacao) : null,
        estoque_minimo: num(form.estoque_minimo),
        estoque_maximo: num(form.estoque_maximo),
        price_cents: cents(form.price) ?? 0,
        preco_promocional_cents: cents(form.preco_promocional),
        cost_cents: cents(form.cost) ?? 0,
        margem_lucro: num(form.margem_lucro),
        status: form.status || "active",
        thumb_url: form.thumb_url || null,
        garantia: form.garantia || null,
        observacoes: form.observacoes || null,
        sob_encomenda: !!form.sob_encomenda,
      };
      if (isNew) {
        const { data, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        return data.id as string;
      } else {
        const { error } = await supabase.from("products").update(payload).eq("id", id!);
        if (error) throw error;
        return id!;
      }
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ["products", current?.id] });
      qc.invalidateQueries({ queryKey: ["product", newId] });
      toast.success("Produto salvo");
      if (isNew) nav(`/produtos/${newId}`, { replace: true });
    },
    onError: (e) => toast.error("Falha ao salvar", { description: String(e) }),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => nav("/produtos")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="text-xs text-muted-foreground">início › cadastros › produtos</div>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden">
          {form.thumb_url ? (
            <img src={form.thumb_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Package className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <h1 className="text-lg font-semibold">{form.name || "Novo produto"}</h1>
      </div>

      <Tabs defaultValue="gerais">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="gerais">dados gerais</TabsTrigger>
          <TabsTrigger value="complementares">dados complementares</TabsTrigger>
          <TabsTrigger value="ficha">ficha técnica</TabsTrigger>
          <TabsTrigger value="anuncios">anúncios</TabsTrigger>
          <TabsTrigger value="kits">kits</TabsTrigger>
          {(form.kind || "produto") === "produto" && <TabsTrigger value="variacoes">variações</TabsTrigger>}
          <TabsTrigger value="precos">preços</TabsTrigger>
          <TabsTrigger value="custos">custos</TabsTrigger>
          <TabsTrigger value="outros">outros</TabsTrigger>
        </TabsList>

        <TabsContent value="gerais" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.kind || "produto"} onValueChange={(v) => set("kind", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="produto">Produto</SelectItem>
                  <SelectItem value="servico">Serviço</SelectItem>
                  <SelectItem value="assinatura">Assinatura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo do Produto</Label>
              <Select value={form.tipo_produto} onValueChange={(v) => set("tipo_produto", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples">Simples</SelectItem>
                  <SelectItem value="kit">Kit</SelectItem>
                  <SelectItem value="variacoes">Com Variações</SelectItem>
                  <SelectItem value="fabricado">Fabricado</SelectItem>
                  <SelectItem value="materia_prima">Matéria-Prima</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo do item SPED</Label>
              <Input value={form.tipo_item_sped} onChange={(e) => set("tipo_item_sped", e.target.value)} placeholder="Selecione" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Nome do produto *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Necessário para emissão de Nota Fiscal</p>
            </div>
            <div>
              <Label>Código de barras (GTIN)</Label>
              <Input value={form.gtin} onChange={(e) => set("gtin", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Origem do produto (ICMS)</Label>
              <Select value={form.origem_icms} onValueChange={(v) => set("origem_icms", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 - Nacional</SelectItem>
                  <SelectItem value="1">1 - Estrangeira (importação direta)</SelectItem>
                  <SelectItem value="2">2 - Estrangeira (mercado interno)</SelectItem>
                  <SelectItem value="3">3 - Nacional &gt;40% conteúdo importado</SelectItem>
                  <SelectItem value="4">4 - Nacional (processos básicos)</SelectItem>
                  <SelectItem value="5">5 - Nacional &lt;40% conteúdo importado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unidade de medida</Label>
              <Input value={form.unidade} onChange={(e) => set("unidade", e.target.value)} />
            </div>
            <div>
              <Label>NCM</Label>
              <Input value={form.ncm} onChange={(e) => set("ncm", e.target.value)} placeholder="0000.00.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Código (SKU)</Label>
              <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} />
            </div>
            <div>
              <Label>Código CEST</Label>
              <Input value={form.cest} onChange={(e) => set("cest", e.target.value)} placeholder="00.000.00" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="complementares" className="space-y-4 mt-4">
          <div className="font-semibold">Categorização</div>
          <div>
            <Label>Categoria</Label>
            <Input value={form.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Categoria > Subcategoria" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Marca</Label>
              <Input value={form.marca} onChange={(e) => set("marca", e.target.value)} />
            </div>
            <div>
              <Label>Tabela de medidas</Label>
              <Input value={form.tabela_medidas} onChange={(e) => set("tabela_medidas", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Descrição complementar</Label>
            <Textarea rows={6} value={form.descricao_complementar} onChange={(e) => set("descricao_complementar", e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Exibido em propostas, pedidos e e-commerce.</p>
          </div>
          <div>
            <Label>Descrição curta</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div>
            <Label>URL da imagem principal</Label>
            <Input value={form.thumb_url} onChange={(e) => set("thumb_url", e.target.value)} placeholder="https://..." />
          </div>
        </TabsContent>

        <TabsContent value="ficha" className="space-y-4 mt-4">
          <div className="font-semibold">Dimensões e peso</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Peso Líquido (kg)</Label>
              <Input type="number" step="0.001" value={form.peso_liquido} onChange={(e) => set("peso_liquido", e.target.value)} />
            </div>
            <div>
              <Label>Peso Bruto (kg)</Label>
              <Input type="number" step="0.001" value={form.peso_bruto} onChange={(e) => set("peso_bruto", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo da embalagem</Label>
              <Select value={form.tipo_embalagem || ""} onValueChange={(v) => set("tipo_embalagem", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pacote">Pacote / Caixa</SelectItem>
                  <SelectItem value="envelope">Envelope</SelectItem>
                  <SelectItem value="rolo">Rolo / Cilindro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Embalagem</Label>
              <Input value={form.embalagem} onChange={(e) => set("embalagem", e.target.value)} placeholder="Embalagem customizada" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Largura (cm)</Label>
              <Input type="number" step="0.1" value={form.largura} onChange={(e) => set("largura", e.target.value)} />
            </div>
            <div>
              <Label>Altura (cm)</Label>
              <Input type="number" step="0.1" value={form.altura} onChange={(e) => set("altura", e.target.value)} />
            </div>
            <div>
              <Label>Comprimento (cm)</Label>
              <Input type="number" step="0.1" value={form.comprimento} onChange={(e) => set("comprimento", e.target.value)} />
            </div>
          </div>

          <div className="font-semibold pt-4">Estoque</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Controlar estoque</Label>
              <Select value={form.controlar_estoque ? "sim" : "nao"} onValueChange={(v) => set("controlar_estoque", v === "sim")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estoque atual</Label>
              <Input type="number" step="0.01" value={form.stock_qty} onChange={(e) => set("stock_qty", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Localização</Label>
              <Input value={form.localizacao} onChange={(e) => set("localizacao", e.target.value)} placeholder="Ex: corredor A" />
            </div>
            <div>
              <Label>Estoque mínimo</Label>
              <Input type="number" step="0.01" value={form.estoque_minimo} onChange={(e) => set("estoque_minimo", e.target.value)} />
            </div>
            <div>
              <Label>Estoque máximo</Label>
              <Input type="number" step="0.01" value={form.estoque_maximo} onChange={(e) => set("estoque_maximo", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Dias para preparação</Label>
            <Input type="number" value={form.dias_preparacao} onChange={(e) => set("dias_preparacao", e.target.value)} className="max-w-[160px]" />
          </div>
        </TabsContent>

        <TabsContent value="anuncios" className="mt-4">
          <p className="text-sm text-muted-foreground">Integrações de anúncios (e-commerce/marketplaces) — em breve.</p>
        </TabsContent>

        <TabsContent value="kits" className="mt-4">
          <p className="text-sm text-muted-foreground">Componentes do kit — disponível para produtos do tipo Kit.</p>
        </TabsContent>

        {(form.kind || "produto") === "produto" && (
          <TabsContent value="variacoes" className="mt-4">
            <VariationsSection parentId={isNew ? null : id!} workspaceId={current?.id ?? null} />
          </TabsContent>
        )}

        <TabsContent value="precos" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} />
            </div>
            <div>
              <Label>Preço promocional (R$)</Label>
              <Input type="number" step="0.01" value={form.preco_promocional} onChange={(e) => set("preco_promocional", e.target.value)} />
            </div>
            <div>
              <Label>Margem de lucro (%)</Label>
              <Input type="number" step="0.01" value={form.margem_lucro} onChange={(e) => set("margem_lucro", e.target.value)} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="custos" className="space-y-4 mt-4">
          <div>
            <Label>Custo (R$)</Label>
            <Input type="number" step="0.01" className="max-w-[260px]" value={form.cost} onChange={(e) => set("cost", e.target.value)} />
          </div>
        </TabsContent>

        <TabsContent value="outros" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sob encomenda</Label>
              <Select value={form.sob_encomenda ? "sim" : "nao"} onValueChange={(v) => set("sob_encomenda", v === "sim")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Garantia</Label>
            <Input value={form.garantia} onChange={(e) => set("garantia", e.target.value)} placeholder="Ex: 12 meses" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={4} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-3 pt-4 border-t sticky bottom-0 bg-background py-3">
        <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name?.trim()}>
          {save.isPending ? "Salvando…" : "salvar"}
        </Button>
        <Button variant="ghost" onClick={() => nav("/produtos")}>cancelar</Button>
      </div>
    </div>
  );
}

function VariationsSection({ parentId, workspaceId }: { parentId: string | null; workspaceId: string | null }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");

  const { data: variations = [], isLoading } = useQuery({
    queryKey: ["product-variations", parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,sku,price_cents,stock_qty,thumb_url,image_url")
        .eq("base_product_id", parentId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!parentId || !workspaceId) throw new Error("Salve o produto antes de adicionar variações");
      const price_cents = price ? Math.round(parseFloat(price.replace(",", ".")) * 100) : 0;
      const { error } = await supabase.from("products").insert({
        workspace_id: workspaceId,
        base_product_id: parentId,
        kind: "produto",
        name: name.trim() || "Variação",
        sku: sku || null,
        price_cents,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName(""); setSku(""); setPrice("");
      qc.invalidateQueries({ queryKey: ["product-variations", parentId] });
      toast.success("Variação adicionada");
    },
    onError: (e) => toast.error("Falha ao adicionar variação", { description: String(e) }),
  });

  const remove = useMutation({
    mutationFn: async (vid: string) => {
      const { error } = await supabase.from("products").delete().eq("id", vid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-variations", parentId] }),
  });

  if (!parentId) {
    return <p className="text-sm text-muted-foreground">Salve o produto para começar a adicionar variações.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold">Variações</div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : variations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma variação cadastrada.</p>
      ) : (
        <div className="border rounded-md divide-y">
          {variations.map((v: any) => (
            <div key={v.id} className="flex items-center gap-3 p-3">
              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                {(v.image_url || v.thumb_url) ? (
                  <img src={v.image_url || v.thumb_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{v.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{v.sku || "—"}</div>
              </div>
              <div className="text-sm tabular-nums">
                R$ {((v.price_cents ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <Button size="sm" variant="ghost" onClick={() => nav(`/produtos/${v.id}`)}>editar</Button>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(v.id)} title="remover">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-md p-3 space-y-2 bg-muted/30">
        <div className="text-xs font-medium text-muted-foreground">Adicionar variação</div>
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Nome (ex: Tamanho M)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
          <Input placeholder="Preço" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending || !name.trim()}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar variação
        </Button>
      </div>
    </div>
  );
}

