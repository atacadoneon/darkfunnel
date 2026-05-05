import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search, MessageCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useContacts } from "@/features/contacts/hooks";
import { useChannels } from "@/features/channels/hooks";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (conversationId: string) => void;
};

export function NewConversationDialog({ open, onOpenChange, onCreated }: Props) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: contacts = [] } = useContacts(search);
  const { data: channels = [] } = useChannels();

  const activeChannels = useMemo(
    () => channels.filter((c) => c.status === "connected" || c.status === "qr_pending" || c.status === "pending"),
    [channels]
  );

  const submit = async () => {
    if (!current || !contactId || !channelId) return;
    setSaving(true);
    try {
      // try to find existing conversation for contact+channel
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("workspace_id", current.id)
        .eq("contact_id", contactId)
        .eq("channel_id", channelId)
        .maybeSingle();

      let convId = existing?.id ?? null;
      if (!convId) {
        const { data: created, error } = await supabase
          .from("conversations")
          .insert({
            workspace_id: current.id,
            contact_id: contactId,
            channel_id: channelId,
            status: "open",
            unread_count: 0,
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw error;
        convId = created.id;
      }

      qc.invalidateQueries({ queryKey: ["conversations", current.id] });
      toast.success(existing ? "Conversa aberta" : "Conversa criada");
      onCreated(convId!);
      onOpenChange(false);
      setSearch(""); setContactId(null); setChannelId(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" /> Nova conversa
          </DialogTitle>
          <DialogDescription>
            Escolha um contato e o canal para iniciar a conversa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Canal</label>
            <Select value={channelId ?? ""} onValueChange={setChannelId}>
              <SelectTrigger><SelectValue placeholder="Selecione o canal" /></SelectTrigger>
              <SelectContent>
                {activeChannels.length === 0 && (
                  <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum canal disponível</div>
                )}
                {activeChannels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.display_name} {c.phone_e164 ? `· ${c.phone_e164}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Contato</label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
              {contacts.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Nenhum contato encontrado.
                </div>
              ) : (
                contacts.slice(0, 50).map((c) => {
                  const selected = contactId === c.id;
                  const name = c.display_name ?? c.phone_e164 ?? "Sem nome";
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setContactId(c.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors ${selected ? "bg-muted" : ""}`}
                    >
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{name}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.phone_e164 ?? ""}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!contactId || !channelId || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar conversa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
