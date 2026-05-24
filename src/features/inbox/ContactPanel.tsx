import { useState } from "react";
import { Edit2, Mail, Building2, Tag as TagIcon, MapPin, DollarSign, User, Calendar, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { useStages, formatMoney } from "@/features/pipeline/hooks";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { useContactDeal } from "./inboxFeatureHooks";
import { DealDialog } from "@/features/pipeline/DealDialog";
import { LeadEditDialog } from "@/features/pipeline/LeadEditDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
    <aside className="w-80 shrink-0 border-l flex-col overflow-y-auto overscroll-contain bg-card hidden min-h-0 lg:flex">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">Lead</h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          onClick={refreshContact}
          disabled={refreshing}
          title="Buscar nome, foto e status atualizados no WhatsApp"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="p-4 flex flex-col items-center text-center border-b">
        <ContactAvatar contact={c} size={64} />

        {editingName ? (
          <Input
            autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onBlur={saveName} onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="mt-2 h-8 text-sm text-center"
          />
        ) : (
          <button className="mt-2 inline-flex items-center gap-1 font-semibold hover:text-primary" onClick={() => setEditingName(true)}>
            {c?.display_name ?? "Sem nome"} <Edit2 className="h-3 w-3 opacity-60" />
          </button>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">{c?.phone_e164 ?? "—"}</p>
        {c?.bio && (
          <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2" title={c.bio}>{c.bio}</p>
        )}
        <Badge className="mt-2 capitalize" variant={conversation.status === "open" ? "default" : "secondary"}>
          Conversa {conversation.status}
        </Badge>
      </div>

      <div className="p-4 border-b space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <TagIcon className="h-3.5 w-3.5" /> Tags
        </div>
        {(c?.contact_tags?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhuma tag</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {c!.contact_tags!.map((t) => <Badge key={t.tag_id} variant="outline" className="text-[10px]">{t.tag_id.slice(0, 6)}</Badge>)}
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <User className="h-3.5 w-3.5" /> Lead Vinculado
          </div>
          {deal && (
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setOpenDeal(true)}>
              Editar
            </Button>
          )}
        </div>

        {!deal ? (
          <Button size="sm" variant="outline" className="w-full" onClick={() => setOpenDeal(true)}>
            + Criar lead vinculado
          </Button>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{deal.title}</span>
              {stage && (
                <Badge style={{ background: stage.color + "22", color: stage.color, borderColor: stage.color + "55" }} variant="outline" className="text-[10px]">
                  {stage.name}
                </Badge>
              )}
            </div>

            <Field icon={<Mail className="h-3 w-3" />} label="Email" value="—" />
            <Field icon={<Building2 className="h-3 w-3" />} label="Empresa" value="—" />
            <Field icon={<DollarSign className="h-3 w-3" />} label="Valor" value={formatMoney(deal.value_cents, deal.currency)} />
            <Field icon={<MapPin className="h-3 w-3" />} label="Status" value={deal.status} />
            <Field icon={<User className="h-3 w-3" />} label="Responsável" value={ownerLabel} />
            <Field icon={<Calendar className="h-3 w-3" />} label="Entrada" value={format(new Date(conversation.created_at ?? Date.now()), "dd/MM/yyyy")} />

            <Button size="sm" className="w-full mt-2" onClick={() => setOpenDeal(true)}>
              Editar Lead Completo
            </Button>
          </div>
        )}
      </div>

      {openDeal && deal && (
        <LeadEditDialog open={openDeal} onOpenChange={setOpenDeal} dealId={deal.id} />
      )}
      {openDeal && !deal && (
        <DealDialog
          open={openDeal} onOpenChange={setOpenDeal} stages={stages}
          deal={null}
          defaultStageId={stages[0]?.id}
        />
      )}
    </aside>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground inline-flex items-center gap-1">{icon} {label}</Label>
      <div className="text-sm truncate">{value}</div>
    </div>
  );
}
