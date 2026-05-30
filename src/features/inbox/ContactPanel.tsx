import { useEffect, useState, useRef, useCallback } from "react";
import { RefreshCw, User, History, ShoppingCart, Paperclip, Calendar, Box, Megaphone, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useStages } from "@/features/pipeline/hooks";
import { useContactDeal } from "./inboxFeatureHooks";
import { DealDialog } from "@/features/pipeline/DealDialog";
import {
  InfoTab, HistoryTab, PurchasesTab, AttachmentsTab,
  ActivitiesTab, CustomFieldsTab, AdsTab, ProposalsTab,
} from "@/features/pipeline/LeadEditDialog";
import { Timeline } from "@/components/leads/Timeline";

import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ContactAvatar } from "./ContactAvatar";


import type { ConversationRow } from "./hooks";

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

type TabKey = "info" | "history" | "purchases" | "proposals" | "attachments" | "activities" | "custom" | "ads";

export function ContactPanel({ conversation }: { conversation: ConversationRow }) {
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const c = conversation.contacts;
  const qc = useQueryClient();
  const { data: deal } = useContactDeal(conversation.contact_id);
  const { data: stages = [] } = useStages();
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
        body: { channel_id: conversation.channel_id, action: "refresh_profile", contact_id: conversation.contact_id },
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

  const tabs: { key: TabKey; icon: React.ReactNode; label: string }[] = [
    { key: "info", icon: <User className="h-3.5 w-3.5" />, label: "Informações" },
    { key: "history", icon: <History className="h-3.5 w-3.5" />, label: "Histórico" },
    { key: "purchases", icon: <ShoppingCart className="h-3.5 w-3.5" />, label: "Compras" },
    { key: "proposals", icon: <FileText className="h-3.5 w-3.5" />, label: "Propostas" },
    { key: "attachments", icon: <Paperclip className="h-3.5 w-3.5" />, label: "Anexos" },
    { key: "activities", icon: <Calendar className="h-3.5 w-3.5" />, label: "Atividades" },
    { key: "custom", icon: <Box className="h-3.5 w-3.5" />, label: "Extras" },
    { key: "ads", icon: <Megaphone className="h-3.5 w-3.5" />, label: "ADS" },
  ];

  const renderTab = () => {
    if (activeTab === "history") {
      return <Timeline contactId={conversation.contact_id} />;
    }
    if (!deal) {
      return (
        <div className="text-center py-8 space-y-3">
          <p className="text-[11px] text-muted-foreground italic">Nenhum lead vinculado a este contato.</p>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setOpenDeal(true)}>
            + Criar lead vinculado
          </Button>
        </div>
      );
    }
    switch (activeTab) {
      case "info": return <InfoTab dealId={deal.id} onClose={() => { /* inline mode */ }} />;
      case "purchases": return <PurchasesTab dealId={deal.id} />;
      case "proposals": return <ProposalsTab dealId={deal.id} />;
      case "attachments": return <AttachmentsTab dealId={deal.id} />;
      case "activities": return <ActivitiesTab dealId={deal.id} />;
      case "custom": return <CustomFieldsTab dealId={deal.id} />;
      case "ads": return <AdsTab dealId={deal.id} />;
    }
  };


  return (
    <aside className="w-[374px] shrink-0 border-l flex-col overflow-y-auto overscroll-contain bg-card hidden min-h-0 lg:flex">
      <div className="p-3 flex flex-col items-center text-center border-b">
        <ContactAvatar contact={c} size={56} />
        <AutoInput
          value={contactFull?.display_name ?? c?.display_name ?? ""}
          onSave={(v) => saveContactField("display_name", v || null)}
          className="mt-1.5 h-7 text-xs text-center font-medium"
          placeholder="Sem nome"
        />
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-[11px] text-muted-foreground">{c?.phone_e164 ?? "—"}</p>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            onClick={refreshContact}
            disabled={refreshing}
            title="Atualizar do WhatsApp"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {c?.bio && <p className="text-[11px] text-muted-foreground mt-1 italic line-clamp-2">{c.bio}</p>}
        <Badge className="mt-1.5 text-[10px] h-4 capitalize" variant={conversation.status === "open" ? "default" : "secondary"}>
          Conversa {conversation.status}
        </Badge>
      </div>

      <div className="px-2 py-2 border-b flex items-center justify-around gap-0.5 shrink-0">
        {tabs.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveTab(s.key)}
            title={s.label}
            className={cn(
              "h-8 w-8 inline-flex items-center justify-center rounded transition-colors",
              activeTab === s.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {s.icon}
          </button>
        ))}
      </div>

      <div className="px-3 py-2 lead-compact">
        {renderTab()}
      </div>


      {openDeal && !deal && (
        <DealDialog open={openDeal} onOpenChange={setOpenDeal} stages={stages} deal={null} defaultStageId={stages[0]?.id} />
      )}
    </aside>
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
