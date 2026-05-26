import { useEffect, useState, useRef, useCallback } from "react";
import { Edit2, Mail, Tag as TagIcon, DollarSign, User, RefreshCw, ListChecks, Bell, StickyNote, History, MessageSquare, Building2, Briefcase, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from "date-fns";
import { useStages, formatMoney } from "@/features/pipeline/hooks";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { useContactDeal } from "./inboxFeatureHooks";
import { DealDialog } from "@/features/pipeline/DealDialog";
import { LeadEditDialog } from "@/features/pipeline/LeadEditDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ContactAvatar } from "./ContactAvatar";
import { CallButton } from "@/features/voice/CallButton";

import type { ConversationRow } from "./hooks";

const ALL_SECTIONS = ["deal", "contato", "tags", "vendedor", "historico", "conversas", "notas"];

type ContactFull = {
  id: string;
  display_name: string | null;
  company_name: string | null;
  phone_e164: string | null;
  phone2_e164: string | null;
  email: string | null;
  niche: string | null;
  city: string | null;
};

export function ContactPanel({ conversation }: { conversation: ConversationRow }) {
  const c = conversation.contacts;
  const qc = useQueryClient();
  const { data: deal } = useContactDeal(conversation.contact_id);
  const { data: stages = [] } = useStages();
  const { data: members = [] } = useWorkspaceMembers();
  const [openDeal, setOpenDeal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: contactFull } = useQuery<ContactFull | null>({
    queryKey: ["contact-full", conversation.contact_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id,display_name,company_name,phone_e164,phone2_e164,email,niche,city")
        .eq("id", conversation.contact_id)
        .maybeSingle();
      return (data as ContactFull) ?? null;
    },
  });

  const refreshContact = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-instance", {
        body: { channel_id: conversation.channel_id, action: "refresh_contact", contact_id: conversation.contact_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Contato atualizado");
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["contact-full", conversation.contact_id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const saveContactField = useCallback(async (field: keyof ContactFull, value: string | null) => {
    const { error } = await supabase
      .from("contacts")
      .update({ [field]: value })
      .eq("id", conversation.contact_id);
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return false;
    }
    qc.invalidateQueries({ queryKey: ["contact-full", conversation.contact_id] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
    return true;
  }, [conversation.contact_id, qc]);

  const saveDealField = useCallback(async (field: string, value: unknown) => {
    if (!deal) return false;
    const { error } = await supabase.from("deals").update({ [field]: value }).eq("id", deal.id);
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return false;
    }
    qc.invalidateQueries({ queryKey: ["contact-deal", conversation.contact_id] });
    return true;
  }, [deal, conversation.contact_id, qc]);

  const stage = stages.find((s) => s.id === deal?.stage_id);
  const owner = members.find((m) => m.user_id === deal?.assigned_to);
  const ownerLabel = owner?.display_name || owner?.email || "—";

  return (
    <aside className="w-72 shrink-0 border-l flex-col overflow-y-auto overscroll-contain bg-card hidden min-h-0 lg:flex">
      <div className="px-3 h-10 border-b flex items-center justify-between shrink-0">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lead</h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 px-1.5 text-[10px]"
          onClick={refreshContact}
          disabled={refreshing}
          title="Atualizar do WhatsApp"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="p-3 flex flex-col items-center text-center border-b">
        <ContactAvatar contact={c} size={56} />
        <AutoInput
          value={contactFull?.display_name ?? c?.display_name ?? ""}
          onSave={(v) => saveContactField("display_name", v || null)}
          className="mt-1.5 h-7 text-xs text-center font-medium"
          placeholder="Sem nome"
        />
        <p className="text-[11px] text-muted-foreground mt-0.5">{c?.phone_e164 ?? "—"}</p>
        {c?.bio && <p className="text-[11px] text-muted-foreground mt-1 italic line-clamp-2">{c.bio}</p>}
        <Badge className="mt-1.5 text-[10px] h-4 capitalize" variant={conversation.status === "open" ? "default" : "secondary"}>
          Conversa {conversation.status}
        </Badge>
      </div>

      <div className="px-3 py-2 border-b flex items-center justify-around gap-1 shrink-0">
        <CallButton
          iconOnly variant="ghost"
          phone={c?.phone_e164 ?? null}
          contactId={conversation.contact_id}
          contactName={c?.display_name ?? null}
          contactAvatar={c?.profile_pic_preview_url ?? null}
          conversationId={conversation.id}
        />
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Tarefa"><ListChecks className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Email"><Mail className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Lembrete"><Bell className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Nota"><StickyNote className="h-3.5 w-3.5" /></Button>
      </div>

      <Accordion type="multiple" defaultValue={ALL_SECTIONS} className="px-1">
        <Section value="deal" icon={<DollarSign className="h-3 w-3" />} label="Deal">
          {!deal ? (
            <Button size="sm" variant="outline" className="w-full h-7 text-[11px]" onClick={() => setOpenDeal(true)}>
              + Criar lead vinculado
            </Button>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium truncate">{deal.title}</span>
                {stage && (
                  <Badge style={{ background: stage.color + "22", color: stage.color, borderColor: stage.color + "55" }} variant="outline" className="text-[10px] h-4">
                    {stage.name}
                  </Badge>
                )}
              </div>
              <ReadonlyField label="Valor" value={formatMoney(deal.value_cents, deal.currency)} />
              <ReadonlyField label="Status" value={deal.status} />
              <EditableField
                label="Observações"
                value={deal.notes ?? ""}
                onSave={(v) => saveDealField("notes", v || null)}
                multiline
                placeholder="Adicionar observações..."
              />
              <Button size="sm" variant="ghost" className="w-full h-6 text-[10px]" onClick={() => setOpenDeal(true)}>Editar completo</Button>
            </div>
          )}
        </Section>

        <Section value="contato" icon={<User className="h-3 w-3" />} label="Contato">
          <EditableField label="Telefone" value={contactFull?.phone_e164 ?? ""} onSave={(v) => saveContactField("phone_e164", v || null)} placeholder="+55..." />
          <EditableField label="Tel. 2" value={contactFull?.phone2_e164 ?? ""} onSave={(v) => saveContactField("phone2_e164", v || null)} placeholder="—" />
          <EditableField label="Email" value={contactFull?.email ?? ""} onSave={(v) => saveContactField("email", v || null)} type="email" placeholder="email@..." />
          <EditableField label="Empresa" value={contactFull?.company_name ?? ""} onSave={(v) => saveContactField("company_name", v || null)} placeholder="Nome da empresa" />
          <EditableField label="Nicho" value={contactFull?.niche ?? ""} onSave={(v) => saveContactField("niche", v || null)} placeholder="Segmento" />
          <EditableField label="Cidade" value={contactFull?.city ?? ""} onSave={(v) => saveContactField("city", v || null)} placeholder="—" />
        </Section>

        <Section value="tags" icon={<TagIcon className="h-3 w-3" />} label="Tags">
          {(c?.contact_tags?.length ?? 0) === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Nenhuma tag</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {c!.contact_tags!.map((t) => <Badge key={t.tag_id} variant="outline" className="text-[10px] h-4">{t.tag_id.slice(0, 6)}</Badge>)}
            </div>
          )}
        </Section>

        <Section value="vendedor" icon={<User className="h-3 w-3" />} label="Vendedor">
          <ReadonlyField label="Responsável" value={ownerLabel} />
          <ReadonlyField label="Entrada" value={format(new Date(conversation.created_at ?? Date.now()), "dd/MM/yyyy")} />
        </Section>

        <Section value="historico" icon={<History className="h-3 w-3" />} label="Histórico">
          <p className="text-[11px] text-muted-foreground italic">Sem eventos recentes</p>
        </Section>

        <Section value="conversas" icon={<MessageSquare className="h-3 w-3" />} label="Conversas">
          <p className="text-[11px] text-muted-foreground italic">Apenas esta conversa</p>
        </Section>

        <Section value="notas" icon={<StickyNote className="h-3 w-3" />} label="Notas">
          <p className="text-[11px] text-muted-foreground italic">Nenhuma nota</p>
        </Section>
      </Accordion>

      {openDeal && deal && (
        <LeadEditDialog open={openDeal} onOpenChange={setOpenDeal} dealId={deal.id} />
      )}
      {openDeal && !deal && (
        <DealDialog open={openDeal} onOpenChange={setOpenDeal} stages={stages} deal={null} defaultStageId={stages[0]?.id} />
      )}
    </aside>
  );
}

function Section({ value, icon, label, children }: { value: string; icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={value} className="border-b last:border-b-0">
      <AccordionTrigger className="py-2 px-2 hover:no-underline hover:bg-muted/40 rounded text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">{icon}{label}</span>
      </AccordionTrigger>
      <AccordionContent className="px-2 pb-2 pt-0 space-y-1.5">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="truncate text-right">{value}</div>
    </div>
  );
}

function EditableField({
  label, value, onSave, type = "text", placeholder, multiline = false,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<boolean> | void;
  type?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <AutoInput value={value} onSave={onSave} type={type} placeholder={placeholder} multiline={multiline} />
    </div>
  );
}

function AutoInput({
  value, onSave, type = "text", placeholder, className, multiline = false,
}: {
  value: string;
  onSave: (v: string) => Promise<boolean> | void;
  type?: string;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const lastSavedRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(value);
    lastSavedRef.current = value;
  }, [value]);

  const commit = useCallback(async () => {
    const v = local.trim();
    if (v === (lastSavedRef.current ?? "").trim()) return;
    setStatus("saving");
    const ok = await Promise.resolve(onSave(v));
    if (ok !== false) {
      lastSavedRef.current = v;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1200);
    } else {
      setStatus("idle");
    }
  }, [local, onSave]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setLocal(e.target.value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void commit(); }, 800);
  };

  const onBlur = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    void commit();
  };

  const baseCls = `h-7 text-[11px] px-2 ${className ?? ""}`;
  const ring = status === "saving" ? "ring-1 ring-amber-400/50" : status === "saved" ? "ring-1 ring-emerald-500/50" : "";

  if (multiline) {
    return (
      <Textarea
        value={local}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={2}
        className={`text-[11px] resize-none min-h-[40px] ${ring}`}
      />
    );
  }

  return (
    <Input
      value={local}
      onChange={onChange}
      onBlur={onBlur}
      type={type}
      placeholder={placeholder}
      className={`${baseCls} ${ring}`}
    />
  );
}
