import { useState } from "react";
import { Edit2, Mail, Building2, Tag as TagIcon, MapPin, DollarSign, User, Calendar, RefreshCw, ListChecks, Bell, StickyNote, History, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from "date-fns";
import { useStages, formatMoney } from "@/features/pipeline/hooks";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { useContactDeal } from "./inboxFeatureHooks";
import { DealDialog } from "@/features/pipeline/DealDialog";
import { LeadEditDialog } from "@/features/pipeline/LeadEditDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ContactAvatar } from "./ContactAvatar";
import { CallButton } from "@/features/voice/CallButton";

import type { ConversationRow } from "./hooks";

export function ContactPanel({ conversation }: { conversation: ConversationRow }) {
  const c = conversation.contacts;
  const qc = useQueryClient();
  const { data: deal } = useContactDeal(conversation.contact_id);
  const { data: stages = [] } = useStages();
  const { data: members = [] } = useWorkspaceMembers();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(c?.display_name ?? "");
  const [openDeal, setOpenDeal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const saveName = async () => {
    if (!name.trim() || name === c?.display_name) { setEditingName(false); return; }
    const { error } = await supabase.from("contacts").update({ display_name: name.trim() }).eq("id", conversation.contact_id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["conversations"] });
    setEditingName(false);
  };

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
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

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
        {editingName ? (
          <Input
            autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onBlur={saveName} onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="mt-1.5 h-7 text-xs text-center"
          />
        ) : (
          <button className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium hover:text-primary" onClick={() => setEditingName(true)}>
            {c?.display_name ?? "Sem nome"} <Edit2 className="h-3 w-3 opacity-60" />
          </button>
        )}
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

      <Accordion type="multiple" defaultValue={["deal", "contato"]} className="px-1">
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
              <Field label="Valor" value={formatMoney(deal.value_cents, deal.currency)} />
              <Field label="Status" value={deal.status} />
              <Button size="sm" variant="ghost" className="w-full h-6 text-[10px]" onClick={() => setOpenDeal(true)}>Editar Lead</Button>
            </div>
          )}
        </Section>

        <Section value="contato" icon={<User className="h-3 w-3" />} label="Contato">
          <Field label="Telefone" value={c?.phone_e164 ?? "—"} />
          <Field label="Email" value="—" />
          <Field label="Empresa" value="—" />
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
          <Field label="Responsável" value={ownerLabel} />
          <Field label="Entrada" value={format(new Date(conversation.created_at ?? Date.now()), "dd/MM/yyyy")} />
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="truncate text-right">{value}</div>
    </div>
  );
}
