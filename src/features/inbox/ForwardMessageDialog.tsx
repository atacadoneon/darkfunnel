import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
  const { current } = useWorkspace();
  const [q, setQ] = useState("");
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return conversations.slice(0, 100);
    return conversations.filter((c) => {
      const name = (c.contacts?.display_name ?? "").toLowerCase();
      const phone = (c.contacts?.phone_e164 ?? "").toLowerCase();
      return name.includes(term) || phone.includes(term);
    }).slice(0, 100);
  }, [conversations, q]);

  const toggle = (id: string) => {
    setTargets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const close = () => {
    onOpenChange(false);
    setTargets(new Set());
    setQ("");
  };

  const send = async () => {
    if (targets.size === 0 || !message || !current) return;
    setSending(true);
    const p = (message.payload ?? {}) as Record<string, unknown>;
    const body = (p.body as string | undefined) || (p.caption as string | undefined) || "";
    const mediaUrl = p.media_url as string | undefined;
    const type = message.type;

    let okCount = 0;
    let failCount = 0;

    for (const id of targets) {
      const conv = conversations.find((c) => c.id === id);
      if (!conv) { failCount++; continue; }
      try {
        const isUazapi = conv.channels?.kind === "uazapi";
        if (isUazapi) {
          const payload: Record<string, unknown> = { conversation_id: conv.id, type };
          if (type === "text") {
            payload.text = body;
          } else if (mediaUrl) {
            payload.media_url = mediaUrl;
            if (body) payload.text = body;
            if (type === "document") payload.filename = (p.filename as string) || "arquivo";
          } else {
            throw new Error("sem mídia");
          }
          const { error } = await supabase.functions.invoke("uazapi-send", { body: payload });
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.rpc("enqueue_outbound", {
            p_workspace: current.id,
            p_contact: conv.contact_id,
            p_channel: conv.channel_id,
            p_message_type: type,
            p_payload: mediaUrl ? { body, media_url: mediaUrl } : { body },
            p_context: "manual",
            p_conversation: conv.id,
          });
          if (error) throw error;
        }
        okCount++;
      } catch {
        failCount++;
      }
    }

    setSending(false);
    if (okCount > 0) toast.success(`Encaminhada para ${okCount} conversa(s)${failCount ? ` · ${failCount} falha(s)` : ""}`);
    else toast.error("Não foi possível encaminhar");
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(true); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Encaminhar mensagem
            {targets.size > 0 && <Badge variant="secondary">{targets.size}</Badge>}
          </DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Buscar contato..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ScrollArea className="h-72 rounded border">
          <div className="p-1">
            {filtered.map((c) => {
              const checked = targets.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded text-sm hover:bg-accent ${checked ? "bg-accent" : ""}`}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(c.id)} onClick={(e) => e.stopPropagation()} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.contacts?.display_name || c.contacts?.phone_e164 || "—"}</div>
                    {c.contacts?.phone_e164 && (
                      <div className="truncate text-xs text-muted-foreground">{c.contacts.phone_e164}</div>
                    )}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada</div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancelar</Button>
          <Button onClick={send} disabled={targets.size === 0 || sending}>
            {sending ? "Encaminhando..." : `Encaminhar${targets.size > 0 ? ` (${targets.size})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
