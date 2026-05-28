import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  User, Tag as TagIcon, ShoppingCart, Paperclip, Calendar,
  Box, Megaphone, Plus, Trash2, Download, Loader2, History,
  ArrowRight, Phone, Mail, Building2, MapPin, MessageSquare, CreditCard,
} from "lucide-react";
import { PaymentLinkDialog } from "@/features/payments/PaymentLinkDialog";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Timeline } from "@/components/leads/Timeline";

import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { toast } from "sonner";
import { normalizePhoneE164, isValidE164, PHONE_INVALID_MSG, PHONE_REQUIRED_MSG } from "@/lib/phone";
import { useStages, formatMoney, type Deal } from "./hooks";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import {
  usePipelines, useProducts, useDealHistory,
  usePurchases, useAddPurchase,
  useAttachments, useUploadAttachment, useDeleteAttachment, downloadAttachment,
  useActivities, useAddActivity,
  useCustomFields, useUpsertCustomField, useDeleteCustomField,
  useAdsAttribution,
} from "./leadEditHooks";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dealId: string;
};

export function LeadEditDialog({ open, onOpenChange, dealId }: Props) {
  const navigate = useNavigate();
  const [payOpen, setPayOpen] = useState(false);
  const openConversation = async () => {
    // tenta achar conversation pelo deal_id; fallback contact_id+channel_id
    const { data: deal } = await supabase
      .from("deals")
      .select("contact_id, channel_id, workspace_id")
      .eq("id", dealId)
      .maybeSingle();
    let convId: string | null = null;
    const { data: c1 } = await supabase
      .from("conversations")
      .select("id")
      .eq("deal_id", dealId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    convId = (c1 as any)?.id ?? null;
    if (!convId && deal?.contact_id) {
      let q = supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", deal.contact_id);
      if ((deal as any).channel_id) q = q.eq("channel_id", (deal as any).channel_id);
      const { data: c2 } = await q
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      convId = (c2 as any)?.id ?? null;
    }
    if (!convId) {
      toast.error("Nenhuma conversa vinculada a este Lead.");
      return;
    }
    onOpenChange(false);
    navigate(`/chats?conversation=${convId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>Editar Lead</DialogTitle>
              <DialogDescription className="text-primary/80">
                Organizado por seções para preenchimento mais rápido.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPayOpen(true)}>
                <CreditCard className="h-3.5 w-3.5" /> Link de Pagamento
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={openConversation}>
                <MessageSquare className="h-3.5 w-3.5" /> Abrir conversa
              </Button>
            </div>
          </div>
        </DialogHeader>
        <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-3 grid grid-cols-7 h-auto bg-transparent p-1 gap-1 rounded-lg border">
            <TabsTrigger value="info" title="Informações" className="flex-col gap-1 py-2"><User className="h-4 w-4" /><span className="text-[10px]">Informações</span></TabsTrigger>
            <TabsTrigger value="history" title="Histórico" className="flex-col gap-1 py-2"><History className="h-4 w-4" /><span className="text-[10px]">Histórico</span></TabsTrigger>
            <TabsTrigger value="purchases" title="Compras" className="flex-col gap-1 py-2"><ShoppingCart className="h-4 w-4" /><span className="text-[10px]">Compras</span></TabsTrigger>
            <TabsTrigger value="attachments" title="Anexos" className="flex-col gap-1 py-2"><Paperclip className="h-4 w-4" /><span className="text-[10px]">Anexos</span></TabsTrigger>
            <TabsTrigger value="activities" title="Atividades" className="flex-col gap-1 py-2"><Calendar className="h-4 w-4" /><span className="text-[10px]">Atividades</span></TabsTrigger>
            <TabsTrigger value="custom" title="Campos Extra" className="flex-col gap-1 py-2"><Box className="h-4 w-4" /><span className="text-[10px]">Extras</span></TabsTrigger>
            <TabsTrigger value="ads" title="ADS" className="flex-col gap-1 py-2"><Megaphone className="h-4 w-4" /><span className="text-[10px]">ADS</span></TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="info" className="m-0"><InfoTab dealId={dealId} onClose={() => onOpenChange(false)} /></TabsContent>
            <TabsContent value="history" className="m-0"><HistoryTab dealId={dealId} /></TabsContent>
            <TabsContent value="purchases" className="m-0"><PurchasesTab dealId={dealId} /></TabsContent>
            <TabsContent value="attachments" className="m-0"><AttachmentsTab dealId={dealId} /></TabsContent>
            <TabsContent value="activities" className="m-0"><ActivitiesTab dealId={dealId} /></TabsContent>
            <TabsContent value="custom" className="m-0"><CustomFieldsTab dealId={dealId} /></TabsContent>
            <TabsContent value="ads" className="m-0"><AdsTab dealId={dealId} /></TabsContent>
          </div>
        </Tabs>
      </DialogContent>
      {payOpen && <PaymentLinkDialog open={payOpen} onOpenChange={setPayOpen} dealId={dealId} />}
    </Dialog>
  );
}

/* =============== INFO TAB =============== */
export function InfoTab({ dealId, onClose }: { dealId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const { user } = useAuth();
  const { data: stagesAll = [] } = useStages();
  const { data: pipelines = [] } = usePipelines();
  const { data: members = [] } = useWorkspaceMembers();
  const { data: products = [] } = useProducts();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // contact
  const [contactId, setContactId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [phone2, setPhone2] = useState("");
  const [initialPhone, setInitialPhone] = useState("");
  const [email, setEmail] = useState("");
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");

  // deal
  const [pipelineId, setPipelineId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [adSource, setAdSource] = useState<string>("");
  const [entryDate, setEntryDate] = useState<string>("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [primaryAssignee, setPrimaryAssignee] = useState<string | null>(null);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [valueProposal, setValueProposal] = useState("");
  const [valueSold, setValueSold] = useState("");
  const [notes, setNotes] = useState("");

  const stages = useMemo(() => stagesAll.filter((s) => !pipelineId || (s as any).pipeline_id === pipelineId || !((s as any).pipeline_id)), [stagesAll, pipelineId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: deal } = await supabase.from("deals")
        .select("*, contact:contacts(*)")
        .eq("id", dealId).maybeSingle();
      if (!deal || cancelled) return;
      const c = (deal as any).contact;
      setContactId(c?.id ?? null);
      setName(c?.display_name ?? "");
      setCompanyName(c?.company_name ?? "");
      setPhone(c?.phone_e164 ?? "");
      setInitialPhone(c?.phone_e164 ?? "");
      setPhone2(c?.phone2_e164 ?? "");
      setEmail(c?.email ?? "");
      setNiche(c?.niche ?? "");
      setCity(c?.city ?? "");
      setPipelineId((deal as any).pipeline_id ?? "");
      setStageId(deal.stage_id);
      setAdSource((deal as any).ad_source ?? "");
      setEntryDate((deal as any).entry_date ?? format(new Date(deal.created_at), "yyyy-MM-dd"));
      setValueProposal(((deal.value_cents ?? 0) / 100).toFixed(2));
      setValueSold((((deal as any).value_sold_cents ?? 0) / 100).toFixed(2));
      setNotes(deal.notes ?? "");

      const { data: dAss } = await supabase.from("deal_assignees")
        .select("user_id,is_primary").eq("deal_id", dealId);
      const list = (dAss ?? []).map((x: any) => x.user_id);
      const primary = (dAss ?? []).find((x: any) => x.is_primary)?.user_id ?? deal.assigned_to ?? null;
      setAssignees(list.length ? list : (deal.assigned_to ? [deal.assigned_to] : []));
      setPrimaryAssignee(primary);

      const { data: dProd } = await supabase.from("deal_products")
        .select("product_id").eq("deal_id", dealId);
      setProductIds((dProd ?? []).map((x: any) => x.product_id).filter(Boolean));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  const save = async () => {
    if (!current || !user || !contactId) return;

    // Lead = Contato = Conversa: telefone obrigatório + E.164
    const phoneNorm = normalizePhoneE164(phone);
    if (!phoneNorm) { toast.error(PHONE_REQUIRED_MSG); return; }
    if (!isValidE164(phoneNorm)) { toast.error(PHONE_INVALID_MSG); return; }
    const phone2Norm = phone2.trim() ? normalizePhoneE164(phone2) : "";
    if (phone2Norm && !isValidE164(phone2Norm)) { toast.error(`Telefone 2: ${PHONE_INVALID_MSG}`); return; }

    setSaving(true);
    try {
      // contact (trigger do DB preserva histórico do telefone antigo em contact_identities)
      await supabase.from("contacts").update({
        display_name: name.trim(), company_name: companyName.trim() || null,
        phone_e164: phoneNorm, phone2_e164: phone2Norm || null,
        email: email.trim() || null, niche: niche.trim() || null, city: city.trim() || null,
      }).eq("id", contactId);

      // deal
      await supabase.from("deals").update({
        pipeline_id: pipelineId || null,
        stage_id: stageId,
        ad_source: adSource || null,
        entry_date: entryDate || null,
        assigned_to: primaryAssignee,
        value_cents: Math.round(parseFloat(valueProposal || "0") * 100),
        value_sold_cents: Math.round(parseFloat(valueSold || "0") * 100),
        notes: notes.trim() || null,
      }).eq("id", dealId);

      // assignees: replace all
      await supabase.from("deal_assignees").delete().eq("deal_id", dealId);
      if (assignees.length) {
        await supabase.from("deal_assignees").insert(assignees.map((uid) => ({
          deal_id: dealId, user_id: uid, workspace_id: current.id,
          is_primary: uid === primaryAssignee,
        })));
      }

      // products: replace all
      await supabase.from("deal_products").delete().eq("deal_id", dealId);
      if (productIds.length) {
        const rows = productIds.map((pid) => {
          const p = products.find((x) => x.id === pid);
          return { deal_id: dealId, workspace_id: current.id, product_id: pid, name_snapshot: p?.name ?? "" };
        });
        await supabase.from("deal_products").insert(rows);
      }

      toast.success("Lead atualizado");
      qc.invalidateQueries({ queryKey: ["deals", current.id] });
      qc.invalidateQueries({ queryKey: ["contacts", current.id] });
      qc.invalidateQueries({ queryKey: ["contact-deal", contactId] });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Section icon={<User className="h-4 w-4" />} title="Dados principais" subtitle="Identificação do contato e empresa">
        <Grid2>
          <Field label="Nome" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Nome da Empresa">
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </Field>
          <Field label="Telefone" required icon={<Phone className="h-3 w-3" />}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11 99999-9999" />
            {phone && !isValidE164(normalizePhoneE164(phone)) && (
              <p className="text-[10px] text-destructive mt-1">{PHONE_INVALID_MSG}</p>
            )}
            {normalizePhoneE164(phone) !== initialPhone && initialPhone && phone && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                ⚠ Alterar o telefone mantém o histórico de conversas, mensagens e o deal vinculado.
                O número antigo fica salvo como referência.
              </p>
            )}
          </Field>
          <Field label="Telefone 2" icon={<Phone className="h-3 w-3" />}>
            <Input value={phone2} onChange={(e) => setPhone2(e.target.value)} placeholder="(11) 99999-9999" />
          </Field>
          <Field label="Email" icon={<Mail className="h-3 w-3" />} colSpan={2}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </Field>
        </Grid2>
      </Section>

      <Section icon={<TagIcon className="h-4 w-4" />} title="Qualificação" subtitle="Contexto do lead e classificação no funil">
        <Grid2>
          <Field label="Nicho">
            <Input value={niche} onChange={(e) => setNiche(e.target.value)} />
          </Field>
          <Field label="Cidade/Unidade" icon={<MapPin className="h-3 w-3" />}>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="Data de Entrada">
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </Field>
          <Field label="Anúncio / ADS">
            <Select value={adSource} onValueChange={setAdSource}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="google_ads">Google Ads Site</SelectItem>
                <SelectItem value="meta_ads">Meta Ads</SelectItem>
                <SelectItem value="organic">Orgânico</SelectItem>
                <SelectItem value="referral">Indicação</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Etapa do Funil">
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pipeline">
            <Select value={pipelineId} onValueChange={setPipelineId}>
              <SelectTrigger><SelectValue placeholder="Padrão" /></SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}{p.is_default ? " (Padrão)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Grid2>
      </Section>

      <Section icon={<Box className="h-4 w-4" />} title="Comercial" subtitle="Responsáveis, produtos e valores">
        <Field label="Responsáveis">
          <MultiSelectChips
            options={members.map((m) => ({ value: m.user_id, label: m.display_name || m.email || m.user_id.slice(0, 6) }))}
            values={assignees}
            primary={primaryAssignee}
            onChange={setAssignees}
            onPrimary={setPrimaryAssignee}
          />
        </Field>
        <Grid3>
          <Field label="Serviços/Produtos">
            <MultiSelectSimple
              options={products.map((p) => ({ value: p.id, label: p.name }))}
              values={productIds}
              onChange={setProductIds}
              placeholder="Selecione serviços..."
            />
          </Field>
          <Field label="Valor da Proposta">
            <Input type="number" step="0.01" value={valueProposal} onChange={(e) => setValueProposal(e.target.value)} placeholder="R$ 0,00" />
          </Field>
          <Field label="Valor da Venda">
            <Input type="number" step="0.01" value={valueSold} onChange={(e) => setValueSold(e.target.value)} placeholder="R$ 0,00" />
          </Field>
        </Grid3>
      </Section>

      <Section title="Observações" subtitle="Contexto comercial e anotações internas">
        <Textarea rows={4} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: Lead pediu retorno amanhã às 14h..." />
        <div className="text-[10px] text-right text-muted-foreground mt-1">{notes.length}/1000</div>
      </Section>

      <DialogFooter className="px-0 pb-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Alterações"}</Button>
      </DialogFooter>
    </div>
  );
}

/* =============== HISTORY TAB =============== */
export function HistoryTab({ dealId }: { dealId: string }) {
  const { data: rows = [], isLoading } = useDealHistory(dealId);
  const { data: stages = [] } = useStages();
  const { data: members = [] } = useWorkspaceMembers();
  const { data: dealRow } = useQuery({
    queryKey: ["deal-contact", dealId],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("contact_id").eq("id", dealId).maybeSingle();
      return data as { contact_id: string | null } | null;
    },
    enabled: !!dealId,
  });
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name ?? "—";
  const memberName = (id: string | null) => {
    const m = members.find((x) => x.user_id === id);
    return m?.display_name || m?.email || (id ? id.slice(0, 6) : "—");
  };
  const fmt = (field: string, v: string | null) => {
    if (v === null) return "—";
    if (field === "stage_id") return stageName(v);
    if (field === "value_cents") return formatMoney(parseInt(v, 10));
    if (field === "assigned_to") return memberName(v);
    return v;
  };
  const fieldLabel = (f: string) => ({ stage_id: "Etapa do Funil", title: "Título", value_cents: "Valor", status: "Status", assigned_to: "Responsável" } as any)[f] ?? f;

  return (
    <div className="space-y-4">
      {dealRow?.contact_id && (
        <Card className="p-5">
          <Timeline contactId={dealRow.contact_id} />
        </Card>
      )}
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><History className="h-4 w-4" /> Alterações do card</h3>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto my-4" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
        ) : (
          <ul className="space-y-3 border-l-2 pl-4">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start justify-between text-sm">
                <div>
                  <div className="font-medium">{fieldLabel(r.field)}</div>
                  <div className="text-muted-foreground inline-flex items-center gap-1.5 text-xs mt-0.5">
                    {fmt(r.field, r.old_value)} <ArrowRight className="h-3 w-3" /> <span className="text-foreground">{fmt(r.field, r.new_value)}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}


/* =============== PURCHASES TAB =============== */
export function PurchasesTab({ dealId }: { dealId: string }) {
  const { data: list = [] } = usePurchases(dealId);
  const { data: products = [] } = useProducts();
  const add = useAddPurchase(dealId);
  const [showForm, setShowForm] = useState(false);
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [obs, setObs] = useState("");

  const total = list.reduce((acc, p) => acc + p.value_cents, 0);

  const submit = async () => {
    if (!productName.trim() || !value) return;
    await add.mutateAsync({
      product_name: productName, description, value_cents: Math.round(parseFloat(value) * 100),
      purchased_at: date, notes: obs,
    });
    setShowForm(false); setProductName(""); setDescription(""); setValue(""); setObs("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" /> {list.length} compra{list.length !== 1 ? "s" : ""}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">$ Total: {formatMoney(total)}</Badge>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Nova Compra</Button>
          )}
        </div>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <Field label="Serviço / Produto">
            <Select value={productName} onValueChange={setProductName}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Grid2>
            <Field label="Descrição" required><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <Field label="Valor" required><Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="R$ 0,00" /></Field>
            <Field label="Data da compra"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Observação"><Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Nota opcional" /></Field>
          </Grid2>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={add.isPending}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</Button>
          </div>
        </Card>
      )}

      {list.length === 0 && !showForm && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <ShoppingCart className="h-8 w-8 mx-auto opacity-40 mb-2" />
          Nenhuma compra registrada<br />
          <span className="text-xs">Clique em "Nova Compra" para adicionar</span>
        </div>
      )}

      <div className="space-y-2">
        {list.map((p) => (
          <Card key={p.id} className="p-3 flex items-center gap-3 text-sm">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{p.product_name}</div>
              {p.description && <div className="text-xs text-muted-foreground truncate">{p.description}</div>}
              <div className="text-xs text-muted-foreground mt-0.5">{format(new Date(p.purchased_at), "dd/MM/yyyy")}</div>
            </div>
            <div className="font-semibold">{formatMoney(p.value_cents)}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* =============== ATTACHMENTS TAB =============== */
export function AttachmentsTab({ dealId }: { dealId: string }) {
  const { data: list = [] } = useAttachments(dealId);
  const upload = useUploadAttachment(dealId);
  const del = useDeleteAttachment(dealId);
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = "";
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold inline-flex items-center gap-2"><Paperclip className="h-4 w-4" /> Anexos ({list.length})</h3>
        <Button size="sm" asChild>
          <label>
            <input type="file" className="hidden" onChange={onPick} />
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</>}
          </label>
        </Button>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum anexo.</p>
      ) : (
        <ul className="divide-y border rounded-md">
          {list.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-3 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{a.file_name}</div>
                <div className="text-xs text-muted-foreground">{((a.size_bytes ?? 0) / 1024).toFixed(1)} KB</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => downloadAttachment(a)}><Download className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => del.mutate(a)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* =============== ACTIVITIES TAB =============== */
export function ActivitiesTab({ dealId }: { dealId: string }) {
  const { data: list = [] } = useActivities(dealId);
  const add = useAddActivity(dealId);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("meeting");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(format(new Date(), "HH:mm"));
  const [duration, setDuration] = useState("");
  const [desc, setDesc] = useState("");
  const submit = async () => {
    if (!title.trim()) return;
    await add.mutateAsync({
      kind, title,
      scheduled_at: new Date(`${date}T${time}`).toISOString(),
      duration_minutes: duration ? parseInt(duration, 10) : null,
      description: desc,
    });
    setOpen(false); setTitle(""); setDuration(""); setDesc("");
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Timeline de Atividades ({list.length})</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</Button>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade registrada.</p>
      ) : (
        <ul className="space-y-3 border-l-2 pl-4">
          {list.map((a) => (
            <li key={a.id} className="text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="font-medium inline-flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-primary" /> {a.title}</div>
                  <div className="text-xs text-muted-foreground capitalize">{a.kind}</div>
                  {a.description && <div className="text-xs mt-1">{a.description}</div>}
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {a.scheduled_at ? format(new Date(a.scheduled_at), "dd/MM/yyyy 'às' HH:mm") : "—"}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Atividade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Tipo de Atividade">
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">Reunião</SelectItem>
                  <SelectItem value="call">Ligação</SelectItem>
                  <SelectItem value="task">Tarefa</SelectItem>
                  <SelectItem value="note">Nota</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Título"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Grid2>
              <Field label="Data"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Hora"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
            </Grid2>
            <Field label="Duração (minutos)"><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Ex: 30" /></Field>
            <Field label="Descrição"><Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Detalhes da atividade..." /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={submit} disabled={add.isPending}>Adicionar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* =============== CUSTOM FIELDS TAB =============== */
export function CustomFieldsTab({ dealId }: { dealId: string }) {
  const { data: list = [] } = useCustomFields(dealId);
  const upsert = useUpsertCustomField(dealId);
  const del = useDeleteCustomField(dealId);
  const [name, setName] = useState("");
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold inline-flex items-center gap-2"><Box className="h-4 w-4" /> Campos Personalizados</h3>
        <div className="flex items-center gap-2">
          <Input placeholder="Nome do novo campo" value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-48" />
          <Button size="sm" disabled={!name.trim()} onClick={async () => { await upsert.mutateAsync({ field_name: name.trim(), field_value: "" }); setName(""); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Campo
          </Button>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum campo personalizado.</p>
      ) : (
        <div className="space-y-2">
          {list.map((cf) => (
            <CustomFieldRow key={cf.id} cf={cf} onSave={(v) => upsert.mutate({ id: cf.id, field_name: cf.field_name, field_value: v })} onDelete={() => del.mutate(cf.id)} />
          ))}
        </div>
      )}
    </Card>
  );
}
function CustomFieldRow({ cf, onSave, onDelete }: { cf: { id: string; field_name: string; field_value: string | null }; onSave: (v: string) => void; onDelete: () => void }) {
  const [v, setV] = useState(cf.field_value ?? "");
  return (
    <div>
      <Label className="text-xs">{cf.field_name}</Label>
      <div className="flex items-center gap-2">
        <Input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== (cf.field_value ?? "") && onSave(v)} />
        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

/* =============== ADS TAB =============== */
export function AdsTab({ dealId }: { dealId: string }) {
  const { data: ads, isLoading } = useAdsAttribution(dealId);
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin mx-auto my-8" />;
  if (!ads) return (
    <Card className="p-5 text-center text-sm text-muted-foreground">
      <Megaphone className="h-8 w-8 mx-auto opacity-40 mb-2" />
      Nenhuma atribuição de anúncios para este lead.
    </Card>
  );
  const labelMap: Record<string, string> = { google_ads: "Google Ads", meta_ads: "Meta Ads" };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold inline-flex items-center gap-2"><Megaphone className="h-4 w-4 text-amber-500" /> {labelMap[ads.source ?? ""] ?? ads.source ?? "—"}</div>
          <div className="text-xs text-muted-foreground">Lead capturado via campanha</div>
        </div>
        <Badge variant="outline" className="text-amber-600 border-amber-500/30">{labelMap[ads.source ?? ""] ?? ads.source}</Badge>
      </div>
      <Card className="p-4 space-y-2 bg-amber-50/30 dark:bg-amber-950/10 border-amber-200/50">
        <Row label="Campanha" value={ads.campaign} />
        <Row label="Mídia" value={ads.medium} />
        <Row label="Landing Page" value={ads.landing_page} />
      </Card>
      <Card className="p-4 space-y-2">
        <Row label="Atribuído em" value={ads.attributed_at ? format(new Date(ads.attributed_at), "dd/MM/yyyy 'às' HH:mm") : null} />
        <Row label="GCLID" value={ads.gclid} mono />
        <Row label="FBCLID" value={ads.fbclid} mono />
      </Card>
    </div>
  );
}
function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={"text-sm " + (mono ? "font-mono text-xs break-all" : "")}>{value ?? "—"}</div>
    </div>
  );
}

/* =============== UI helpers =============== */
function Section({ icon, title, subtitle, children }: { icon?: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-2">
        {icon && <div className="mt-0.5 text-primary">{icon}</div>}
        <div>
          <div className="font-semibold text-sm">{title}</div>
          {subtitle && <div className="text-xs text-primary/70">{subtitle}</div>}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}
function Grid2({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-2 gap-3">{children}</div>; }
function Grid3({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-3 gap-3">{children}</div>; }
function Field({ label, required, icon, colSpan, children }: { label: string; required?: boolean; icon?: React.ReactNode; colSpan?: number; children: React.ReactNode }) {
  return (
    <div className={colSpan === 2 ? "col-span-2" : ""}>
      <Label className="text-xs inline-flex items-center gap-1">{icon}{label}{required && <span className="text-destructive">*</span>}</Label>
      {children}
    </div>
  );
}

function MultiSelectChips({ options, values, primary, onChange, onPrimary }: {
  options: { value: string; label: string }[]; values: string[]; primary: string | null;
  onChange: (v: string[]) => void; onPrimary: (id: string | null) => void;
}) {
  const remaining = options.filter((o) => !values.includes(o.value));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[2.25rem] rounded-md border px-2 py-1.5">
        {values.length === 0 && <span className="text-xs text-muted-foreground self-center">Nenhum responsável</span>}
        {values.map((v) => {
          const o = options.find((x) => x.value === v);
          const isPrimary = primary === v;
          return (
            <button key={v} type="button" onClick={() => onPrimary(v)}
              className={"inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs " + (isPrimary ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {o?.label ?? v} {isPrimary && "★"}
              <span onClick={(e) => { e.stopPropagation(); const next = values.filter((x) => x !== v); onChange(next); if (primary === v) onPrimary(next[0] ?? null); }} className="ml-1 opacity-70 hover:opacity-100 cursor-pointer">×</span>
            </button>
          );
        })}
      </div>
      {remaining.length > 0 && (
        <Select value="" onValueChange={(v) => { const next = [...values, v]; onChange(next); if (!primary) onPrimary(v); }}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Adicionar responsável..." /></SelectTrigger>
          <SelectContent>{remaining.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      )}
    </div>
  );
}

function MultiSelectSimple({ options, values, onChange, placeholder }: {
  options: { value: string; label: string }[]; values: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const remaining = options.filter((o) => !values.includes(o.value));
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {values.map((v) => {
          const o = options.find((x) => x.value === v);
          return (
            <Badge key={v} variant="secondary" className="gap-1">
              {o?.label ?? v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="opacity-70 hover:opacity-100">×</button>
            </Badge>
          );
        })}
      </div>
      {remaining.length > 0 && (
        <Select value="" onValueChange={(v) => onChange([...values, v])}>
          <SelectTrigger className="h-8"><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent>{remaining.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      )}
    </div>
  );
}
