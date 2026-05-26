import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConversations } from "./hooks";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import type { MessageRow } from "./hooks";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  message: MessageRow | null;
};

export function ForwardMessageDialog({ open, onOpenChange, message }: Props) {
  const { data: conversations = [] } = useConversations();
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return conversations.slice(0, 50);
    return conversations.filter((c) => {
      const name = (c.contacts?.name ?? "").toLowerCase();
      const phone = (c.contacts?.phone ?? "").toLowerCase();
      return name.includes(term) || phone.includes(term);
    }).slice(0, 50);
  }, [conversations, q]);

  const send = async () => {
    if (!target || !message) return;
    const conv = conversations.find((c) => c.id === target);
    if (!conv) return;
    setSending(true);
    try {
      const p = (message.payload ?? {}) as Record<string, unknown>;
      const body = (p.body as string | undefined) || (p.caption as string | undefined) || "";
      const mediaUrl = p.media_url as string | undefined;
      const isUazapi = conv.channels?.kind === "uazapi";
      const type = message.type;

      if (isUazapi) {
        const payload: Record<string, unknown> = { conversation_id: conv.id, type };
        if (type === "text") {
          payload.text = body;
        } else if (mediaUrl) {
          payload.media_url = mediaUrl;
          if (body) payload.text = body;
          if (type === "document") payload.filename = (p.filename as string) || "arquivo";
        } else {
          throw new Error("Mensagem sem mídia disponível para encaminhar");
        }
        const { error } = await supabase.functions.invoke("uazapi-send", { body: payload });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.rpc("enqueue_outbound", {
          p_workspace: conv.workspace_id,
          p_contact: conv.contact_id,
          p_channel: conv.channel_id,
          p_message_type: type,
          p_payload: mediaUrl ? { body, media_url: mediaUrl } : { body },
          p_context: "manual",
          p_conversation: conv.id,
        });
        if (error) throw error;
      }
      toast.success("Mensagem encaminhada");
      onOpenChange(false);
      setTarget(null);
      setQ("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Encaminhar mensagem</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Buscar contato..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ScrollArea className="h-72 rounded border">
          <div className="p-1">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setTarget(c.id)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent ${target === c.id ? "bg-accent" : ""}`}
              >
                <div className="truncate font-medium">{c.contacts?.name || c.contacts?.phone || "—"}</div>
                {c.contacts?.phone && (
                  <div className="truncate text-xs text-muted-foreground">{c.contacts.phone}</div>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada</div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={send} disabled={!target || sending}>
            {sending ? "Encaminhando..." : "Encaminhar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
