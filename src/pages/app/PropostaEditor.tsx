import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Search, Trash2, Upload, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type PaymentTerm = { dias: number | string; valor: number | string; observacao: string };
type PaymentType = "parcelas" | "avista" | "entrada_parcelas";

type Item = {
  id?: string;
  ordem: number;
  product_id?: string | null;
  descricao: string;
  sku: string;
  qtde: number;
  unidade: string;
  preco_un_cents: number;
  preco_total_cents: number;
};

function brl(c: number) {
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function num(v: any) {
  if (v === "" || v == null) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function cents(v: any) {
  return Math.round(num(v) * 100);
}

const emptyItem = (n: number): Item => ({
  ordem: n, descricao: "", sku: "", qtde: 1, unidade: "UN", preco_un_cents: 0, preco_total_cents: 0,
});

export default function PropostaEditor() {
  const { current } = useWorkspace();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "novo";
  const nav = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<any>({
    customer_name: "",
    customer_type: "pj",
    cnpj_cpf: "",
    contribuinte: "nao_informado",
    inscricao_estadual: "",
    aos_cuidados_de: "",
    lista_preco: "padrao",
    cep: "", cidade: "", uf: "", endereco: "", bairro: "", numero: "", complemento: "",
    telefone: "", celular: "", email: "",
    endereco_entrega_diferente: false,
    intro: "",
    issue_date: new Date().toISOString().slice(0, 10),
    next_contact_date: "",
    other_items_html: "",
    total_outros: "0",
    discount: "0",
    freight: "0",
    peso_bruto: "",
    peso_liquido: "",
    forma_envio: "nao_definida",
    transportador_nome: "",
    condicoes_comerciais: "nenhuma",
    condicoes_gerais: "",
    assinatura_saudacao: "Atenciosamente,",
    assinatura_departamento: "Departamento de vendas",
    anexo_url: "",
    number: null as number | null,
    series: "P",
    status: "rascunho",
  });
  const [items, setItems] = useState<Item[]>([emptyItem(1)]);
  const [showCustomer, setShowCustomer] = useState(false);
  const [showConditions, setShowConditions] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>("parcelas");
  const [paymentInput, setPaymentInput] = useState<string>("");
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);

  const { data: prop } = useQuery({
    queryKey: ["proposal", id],
    enabled: !isNew && !!current,
    queryFn: async () => {
      const { data, error } = await supabase.from("proposals").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: dbItems } = useQuery({
    queryKey: ["proposal_items", id],
    enabled: !isNew && !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_items").select("*")
        .eq("proposal_id", id!).order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!prop) return;
    setForm((f: any) => ({
      ...f,
      ...prop,
      issue_date: prop.issue_date ?? f.issue_date,
      next_contact_date: prop.next_contact_date ?? "",
      total_outros: ((prop.total_outros_cents ?? 0) / 100).toFixed(2),
      discount: ((prop.discount_cents ?? 0) / 100).toFixed(2),
      freight: ((prop.freight_cents ?? 0) / 100).toFixed(2),
    }));
    if ((prop as any).payment_type) setPaymentType((prop as any).payment_type);
    if (Array.isArray((prop as any).payment_terms)) {
      setPaymentTerms((prop as any).payment_terms as PaymentTerm[]);
    }
    if (typeof (prop as any).payment_input === "string") {
      setPaymentInput((prop as any).payment_input);
    }
  }, [prop]);
  useEffect(() => {
    if (!dbItems) return;
    if (dbItems.length === 0) { setItems([emptyItem(1)]); return; }
    setItems(dbItems.map((it: any) => ({
      id: it.id, ordem: it.ordem, product_id: it.product_id,
      descricao: it.descricao ?? "", sku: it.sku ?? "",
      qtde: Number(it.qtde ?? 1), unidade: it.unidade ?? "UN",
      preco_un_cents: it.preco_un_cents ?? 0, preco_total_cents: it.preco_total_cents ?? 0,
    })));
  }, [dbItems]);

  const setF = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const setItem = (idx: number, patch: Partial<Item>) => {
    setItems((arr) => arr.map((it, i) => {
      if (i !== idx) return it;
      const merged = { ...it, ...patch };
      merged.preco_total_cents = Math.round(merged.qtde * merged.preco_un_cents);
      return merged;
    }));
  };
  const addItem = () => setItems((a) => [...a, emptyItem(a.length + 1)]);
  const removeItem = (i: number) =>
    setItems((a) => (a.length === 1 ? [emptyItem(1)] : a.filter((_, j) => j !== i)));

  const totals = useMemo(() => {
    const itensCents = items.reduce((s, it) => s + (it.preco_total_cents ?? 0), 0);
    const desc = cents(form.discount);
    const frete = cents(form.freight);
    const total = Math.max(0, itensCents - desc + frete);
    return { itensCents, total };
  }, [items, form.discount, form.freight]);

  const gerarParcelas = () => {
    const raw = paymentInput.trim();
    if (!raw) {
      toast.error("Informe uma condição (ex: 30 60 90 ou 6x)");
      return;
    }
    const totalReais = totals.total / 100;
    const novo: PaymentTerm[] = [];
    const mx = raw.toLowerCase().match(/^(\d+)x$/);
    if (mx) {
      const n = parseInt(mx[1], 10);
      if (!n) return;
      const valor = +(totalReais / n).toFixed(2);
      for (let i = 1; i <= n; i++) {
        novo.push({ dias: i * 30, valor, observacao: `Parcela ${i}/${n}` });
      }
    } else {
      const dias = raw.split(/\s+/).map((d) => parseInt(d, 10)).filter((n) => !isNaN(n));
      if (dias.length === 0) {
        toast.error("Formato inválido");
        return;
      }
      const valor = +(totalReais / dias.length).toFixed(2);
      dias.forEach((d, i) => {
        novo.push({
          dias: d,
          valor,
          observacao: dias.length === 1 ? "Parcela única" : `Parcela ${i + 1}/${dias.length}`,
        });
      });
    }
    setPaymentTerms(novo);
  };

  const setParcela = (i: number, patch: Partial<PaymentTerm>) =>
    setPaymentTerms((arr) => arr.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const addParcela = () =>
    setPaymentTerms((arr) => [...arr, { dias: 30, valor: 0, observacao: "" }]);
  const removeParcela = (i: number) =>
    setPaymentTerms((arr) => arr.filter((_, j) => j !== i));

  const save = useMutation({
    mutationFn: async () => {
      if (!current || !user) throw new Error("sem workspace");
      if (!form.customer_name?.trim()) throw new Error("Informe o cliente");
      const vendedor = form.vendedor_user_id?.trim?.() || form.vendedor_user_id;
      if (!vendedor) throw new Error("Informe o vendedor");
      const hasProduct = items.some(
        (it) => (it.product_id || it.descricao?.trim() || it.sku?.trim()) && it.qtde > 0
      );
      if (!hasProduct) throw new Error("Adicione ao menos um produto");
      let nextNumber = form.number;
      if (isNew) {
        const { data: maxRow } = await supabase
          .from("proposals").select("number")
          .eq("workspace_id", current.id)
          .order("number", { ascending: false }).limit(1).maybeSingle();
        nextNumber = ((maxRow?.number as number | undefined) ?? 0) + 1;
      }
      const payload: any = {
        workspace_id: current.id,
        number: nextNumber,
        series: form.series || "P",
        status: form.status || "rascunho",
        customer_type: form.customer_type || "pj",
        customer_name: form.customer_name || null,
        cnpj_cpf: form.cnpj_cpf || null,
        contribuinte: form.contribuinte,
        inscricao_estadual: form.inscricao_estadual || null,
        aos_cuidados_de: form.aos_cuidados_de || null,
        lista_preco: form.lista_preco || "padrao",
        cep: form.cep || null, cidade: form.cidade || null, uf: form.uf || null,
        endereco: form.endereco || null, bairro: form.bairro || null,
        numero: form.numero || null, complemento: form.complemento || null,
        telefone: form.telefone || null, celular: form.celular || null, email: form.email || null,
        endereco_entrega_diferente: !!form.endereco_entrega_diferente,
        intro: form.intro || null,
        issue_date: form.issue_date || null,
        next_contact_date: form.next_contact_date || null,
        other_items_html: form.other_items_html || null,
        total_outros_cents: cents(form.total_outros),
        discount_cents: cents(form.discount),
        freight_cents: cents(form.freight),
        peso_bruto: num(form.peso_bruto) || null,
        peso_liquido: num(form.peso_liquido) || null,
        forma_envio: form.forma_envio,
        transportador_nome: form.transportador_nome || null,
        condicoes_comerciais: form.condicoes_comerciais,
        condicoes_gerais: form.condicoes_gerais || null,
        assinatura_saudacao: form.assinatura_saudacao || null,
        assinatura_departamento: form.assinatura_departamento || null,
        anexo_url: form.anexo_url || null,
        subtotal_cents: totals.itensCents,
        total_cents: totals.total,
        payment_type: paymentType,
        payment_input: paymentInput || null,
        payment_terms: paymentTerms,
      };
      let propId = id;
      if (isNew) {
        payload.created_by_user_id = user.id;
        payload.owner_user_id = user.id;
        const { data, error } = await supabase.from("proposals").insert(payload).select("id").single();
        if (error) throw error;
        propId = data.id;
      } else {
        const { error } = await supabase.from("proposals").update(payload).eq("id", id!);
        if (error) throw error;
      }
      // sync items: simplest — delete all then insert
      await supabase.from("proposal_items").delete().eq("proposal_id", propId!);
      const validItems = items.filter((it) => (it.descricao || it.sku || it.preco_un_cents > 0));
      if (validItems.length) {
        const rows = validItems.map((it, i) => ({
          proposal_id: propId!,
          workspace_id: current.id,
          ordem: i + 1,
          product_id: it.product_id ?? null,
          descricao: it.descricao || null,
          sku: it.sku || null,
          qtde: it.qtde,
          unidade: it.unidade || "UN",
          preco_un_cents: it.preco_un_cents,
          preco_total_cents: it.preco_total_cents,
        }));
        const { error } = await supabase.from("proposal_items").insert(rows);
        if (error) throw error;
      }
      return propId!;
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ["proposals", current?.id] });
      qc.invalidateQueries({ queryKey: ["proposal", newId] });
      qc.invalidateQueries({ queryKey: ["proposal_items", newId] });
      toast.success("Proposta salva");
      if (isNew) nav(`/propostas/${newId}`, { replace: true });
    },
    onError: (e) => toast.error("Falha ao salvar", { description: String(e) }),
  });

  return (
    <div className="bg-[hsl(var(--background))] min-h-screen">
      <div className="px-6 py-4">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => nav("/propostas")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> voltar
          </Button>
          <div className="text-xs text-muted-foreground">início › vendas › propostas comerciais</div>
        </div>

        <div className="max-w-4xl mx-auto py-6 space-y-6">
          <h1 className="text-xl font-bold border-b pb-3">Proposta Comercial</h1>

          {/* Cliente */}
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-7">
              <Label>Cliente</Label>
              <div className="relative">
                <Input
                  value={form.customer_name}
                  onChange={(e) => setF("customer_name", e.target.value)}
                  placeholder="Pesquise pelas iniciais do nome do cliente, pelo cpf/cnpj ou pelo e-mail"
                  className="pr-9"
                />
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="col-span-2">
              <Label>Aos cuidados de</Label>
              <Input value={form.aos_cuidados_de} onChange={(e) => setF("aos_cuidados_de", e.target.value)} />
            </div>
            <div className="col-span-3">
              <Label>Lista de preço</Label>
              <Select value={form.lista_preco} onValueChange={(v) => setF("lista_preco", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="padrao">Padrão</SelectItem>
                  <SelectItem value="atacado">Atacado</SelectItem>
                  <SelectItem value="varejo">Varejo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-4 text-sm text-primary -mt-2">
            <button onClick={() => setShowCustomer((v) => !v)} className="hover:underline">
              dados do cliente
            </button>
            <button className="hover:underline">ver últimas vendas</button>
            <button className="hover:underline">pessoas de contato</button>
          </div>

          {showCustomer && (
            <div className="space-y-4 border-t border-b py-4">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label>Tipo de Pessoa</Label>
                  <Select value={form.customer_type} onValueChange={(v) => setF("customer_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pj">Jurídica</SelectItem>
                      <SelectItem value="pf">Física</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{form.customer_type === "pf" ? "CPF" : "CNPJ"}</Label>
                  <Input value={form.cnpj_cpf} onChange={(e) => setF("cnpj_cpf", e.target.value)} />
                </div>
                <div>
                  <Label>Contribuinte</Label>
                  <Select value={form.contribuinte} onValueChange={(v) => setF("contribuinte", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao_informado">Não informado</SelectItem>
                      <SelectItem value="contribuinte">Contribuinte ICMS</SelectItem>
                      <SelectItem value="isento">Contribuinte isento</SelectItem>
                      <SelectItem value="nao_contribuinte">Não contribuinte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Inscrição Estadual</Label>
                  <Input value={form.inscricao_estadual} onChange={(e) => setF("inscricao_estadual", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label>CEP</Label>
                  <Input value={form.cep} onChange={(e) => setF("cep", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Cidade</Label>
                  <Input value={form.cidade} onChange={(e) => setF("cidade", e.target.value)} />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input maxLength={2} value={form.uf} onChange={(e) => setF("uf", e.target.value.toUpperCase())} />
                </div>
              </div>
              <div>
                <Label>Endereço</Label>
                <Input value={form.endereco} onChange={(e) => setF("endereco", e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Bairro</Label>
                  <Input value={form.bairro} onChange={(e) => setF("bairro", e.target.value)} />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={form.numero} onChange={(e) => setF("numero", e.target.value)} />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input value={form.complemento} onChange={(e) => setF("complemento", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => setF("telefone", e.target.value)} />
                </div>
                <div>
                  <Label>Celular</Label>
                  <Input value={form.celular} onChange={(e) => setF("celular", e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={form.email} onChange={(e) => setF("email", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="entrega-dif"
              checked={form.endereco_entrega_diferente}
              onCheckedChange={(v) => setF("endereco_entrega_diferente", !!v)}
            />
            <Label htmlFor="entrega-dif" className="font-normal cursor-pointer">
              O endereço de entrega do cliente é diferente do endereço de cobrança
            </Label>
          </div>

          {/* Introdução */}
          <div>
            <Label>Introdução</Label>
            <Textarea rows={3} value={form.intro} onChange={(e) => setF("intro", e.target.value)} />
          </div>

          {/* Cabeçalho meta */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label>N° Proposta</Label>
              <Input disabled value={form.number ?? "auto"} className="bg-muted/40" />
            </div>
            <div>
              <Label>Vendedor</Label>
              <Input value={form.vendedor_user_id ?? ""} onChange={(e) => setF("vendedor_user_id", e.target.value)} placeholder="—" />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.issue_date} onChange={(e) => setF("issue_date", e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">(dd/mm/aaaa)</p>
            </div>
            <div>
              <Label>Data do Próximo Contato</Label>
              <Input type="date" value={form.next_contact_date} onChange={(e) => setF("next_contact_date", e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">(dd/mm/aaaa)</p>
            </div>
          </div>

          {/* Itens */}
          <Tabs defaultValue="itens">
            <TabsList>
              <TabsTrigger value="itens">Itens de produto ou serviço</TabsTrigger>
              <TabsTrigger value="desc">Descrições complementares</TabsTrigger>
            </TabsList>
            <TabsContent value="itens" className="mt-4">
              <div className="border rounded overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left w-12">N°</th>
                      <th className="px-2 py-2 text-left">Item</th>
                      <th className="px-2 py-2 text-left w-28">Código (SKU)</th>
                      <th className="px-2 py-2 text-right w-20">Qtde</th>
                      <th className="px-2 py-2 text-left w-16">UN</th>
                      <th className="px-2 py-2 text-right w-28">Preço un</th>
                      <th className="px-2 py-2 text-right w-28">Preço total</th>
                      <th className="px-2 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-1">
                          <Input
                            value={it.descricao}
                            onChange={(e) => setItem(i, { descricao: e.target.value })}
                            placeholder="Pesquise por descrição, código (SKU) ou GTIN"
                            className="h-8 border-0 focus-visible:ring-1"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input value={it.sku} onChange={(e) => setItem(i, { sku: e.target.value })} className="h-8 border-0 focus-visible:ring-1" />
                        </td>
                        <td className="px-2 py-1">
                          <Input type="number" step="0.01" value={it.qtde}
                            onChange={(e) => setItem(i, { qtde: num(e.target.value) })}
                            className="h-8 text-right border-0 focus-visible:ring-1" />
                        </td>
                        <td className="px-2 py-1">
                          <Input value={it.unidade} onChange={(e) => setItem(i, { unidade: e.target.value })} className="h-8 border-0 focus-visible:ring-1" />
                        </td>
                        <td className="px-2 py-1">
                          <Input type="number" step="0.01" value={(it.preco_un_cents / 100).toFixed(2)}
                            onChange={(e) => setItem(i, { preco_un_cents: cents(e.target.value) })}
                            className="h-8 text-right border-0 focus-visible:ring-1" />
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums font-mono">
                          {brl(it.preco_total_cents)}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-4 mt-2 text-sm text-primary">
                <button onClick={addItem} className="flex items-center gap-1 hover:underline">
                  <Plus className="w-3.5 h-3.5" /> adicionar item
                </button>
                <button className="flex items-center gap-1 hover:underline">
                  <Search className="w-3.5 h-3.5" /> busca avançada de itens
                </button>
              </div>
            </TabsContent>
            <TabsContent value="desc" className="mt-4">
              <Textarea rows={4} value={form.other_items_html} onChange={(e) => setF("other_items_html", e.target.value)} placeholder="Descrições complementares dos itens…" />
            </TabsContent>
          </Tabs>

          {/* Outros itens */}
          <div>
            <Label>Outros itens ou serviços</Label>
            <Textarea rows={4} value={form.other_items_html} onChange={(e) => setF("other_items_html", e.target.value)} />
          </div>

          {/* Totais */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Total outros</Label>
              <Input value={form.total_outros} onChange={(e) => setF("total_outros", e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">Não considerado no pedido</p>
            </div>
            <div>
              <Label>Desconto</Label>
              <Input value={form.discount} onChange={(e) => setF("discount", e.target.value)} />
            </div>
            <div>
              <Label>Frete</Label>
              <Input value={form.freight} onChange={(e) => setF("freight", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label>Peso Bruto</Label>
              <Input value={form.peso_bruto} onChange={(e) => setF("peso_bruto", e.target.value)} className="bg-muted/40" />
            </div>
            <div>
              <Label>Peso Líquido</Label>
              <Input value={form.peso_liquido} onChange={(e) => setF("peso_liquido", e.target.value)} className="bg-muted/40" />
            </div>
            <div>
              <Label>Total dos itens</Label>
              <Input disabled value={brl(totals.itensCents)} className="bg-muted/40 font-mono" />
            </div>
            <div>
              <Label>Total proposta</Label>
              <Input disabled value={brl(totals.total)} className="bg-muted/40 font-mono font-bold" />
            </div>
          </div>

          {/* Transportador */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Transportador</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Forma de envio</Label>
                <Select value={form.forma_envio} onValueChange={(v) => setF("forma_envio", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_definida">Não definida</SelectItem>
                    <SelectItem value="correios">Correios</SelectItem>
                    <SelectItem value="transportadora">Transportadora</SelectItem>
                    <SelectItem value="retirada">Retirada</SelectItem>
                    <SelectItem value="entrega_propria">Entrega própria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome</Label>
                <Input value={form.transportador_nome} onChange={(e) => setF("transportador_nome", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Condições comerciais */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Condições comerciais</h3>
            <Select value={form.condicoes_comerciais} onValueChange={(v) => setF("condicoes_comerciais", v)}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Nenhuma</SelectItem>
                <SelectItem value="a_vista">À vista</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="30_60">30/60 dias</SelectItem>
                <SelectItem value="30_60_90">30/60/90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Condições gerais */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">Condições gerais</h3>
              <button onClick={() => setShowConditions((v) => !v)} className="text-sm text-primary hover:underline">
                {showConditions ? "ocultar" : "exibir"}
              </button>
            </div>
            {showConditions && (
              <Textarea
                rows={5}
                className="mt-3"
                value={form.condicoes_gerais}
                onChange={(e) => setF("condicoes_gerais", e.target.value)}
                placeholder="Condições gerais da proposta…"
              />
            )}
          </div>

          {/* Assinatura */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Assinatura</h3>
            <div className="space-y-2 max-w-md">
              <Input value={form.assinatura_saudacao} onChange={(e) => setF("assinatura_saudacao", e.target.value)} />
              <Input value={form.assinatura_departamento} onChange={(e) => setF("assinatura_departamento", e.target.value)} />
            </div>
          </div>

          {/* Anexo */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Anexo</h3>
            <Button variant="default" className="rounded-full" size="sm" type="button">
              <Upload className="w-4 h-4 mr-1" /> procurar arquivo
            </Button>
            {form.anexo_url && (
              <Input className="mt-2 max-w-md" value={form.anexo_url} onChange={(e) => setF("anexo_url", e.target.value)} />
            )}
            <p className="text-xs text-muted-foreground mt-2">O tamanho do arquivo não deve ultrapassar 2Mb</p>
          </div>

          {/* Footer */}
          <div className="border-t pt-4 sticky bottom-0 bg-background flex items-center gap-3 pb-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="rounded-full">
              {save.isPending ? "Salvando…" : "salvar"}
            </Button>
            <Button variant="ghost" onClick={() => nav("/propostas")}>cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
