import { useState, useRef, type KeyboardEvent } from "react";
import { Send, Calendar, Clock, MessagesSquare } from "lucide-react";
import { ScheduleMessageDialog } from "./ScheduleMessageDialog";
import { useQuickReplies, useScheduledMessages } from "./inboxFeatureHooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ConversationRow } from "./hooks";

type Props = {
  conversation: ConversationRow;
};

export function Composer({ conversation }: Props) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const { data: pendings = [] } = useScheduledMessages(conversation.id);
  const { data: quickReplies = [] } = useQuickReplies();

  const isCloud = conversation.channels?.kind === "whatsapp_cloud";
  const isUazapi = conversation.channels?.kind === "uazapi";
  const windowExpired =
    isCloud && conversation.window_expires_at
      ? new Date(conversation.window_expires_at) < new Date()
      : false;

  const send = async () => {
    if (!text.trim() || !current) return;
    if (windowExpired) {
      toast.error("Janela 24h expirou. Envie um template HSM (em breve via UI).");
      return;
    }
    setSending(true);
    const body = text.trim();
    setText("");
    try {
      if (isUazapi) {
        const { error } = await supabase.functions.invoke("uazapi-send", {
          body: { conversation_id: conversation.id, text: body },
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.rpc("enqueue_outbound", {
          p_workspace: current.id,
          p_contact: conversation.contact_id,
          p_channel: conversation.channel_id,
          p_message_type: "text",
          p_payload: { body },
          p_context: "manual",
          p_conversation: conversation.id,
        });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["messages", conversation.id] });
    } catch (err) {
      toast.error((err as Error).message);
      setText(body);
    } finally {
      setSending(false);
      ref.current?.focus();
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="border-t bg-card p-3">
      {windowExpired && (
        <div className="mb-2 text-xs text-amber-600 dark:text-amber-400">
          Janela 24h da Cloud API expirou — apenas templates HSM são permitidos.
        </div>
      )}
      {pendings.length > 0 && (
        <button
          onClick={() => setScheduleOpen(true)}
          className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Clock className="h-3 w-3" />
          <Badge variant="secondary" className="h-5 px-1.5">{pendings.length}</Badge>
          mensagem(ns) agendada(s) — gerenciar
        </button>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={windowExpired ? "Selecione um template..." : "Digite uma mensagem..."}
          disabled={windowExpired}
          rows={1}
          className="resize-none min-h-[40px] max-h-32"
        />
        <Popover open={quickOpen} onOpenChange={setQuickOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              disabled={windowExpired}
              title="Respostas rápidas"
            >
              <MessagesSquare className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <Command>
              <CommandInput placeholder="Buscar resposta rápida..." />
              <CommandList>
                <CommandEmpty>Nenhuma resposta rápida.</CommandEmpty>
                <CommandGroup>
                  {quickReplies.map((reply) => (
                    <CommandItem
                      key={reply.id}
                      value={`${reply.shortcut ?? ""} ${reply.title} ${reply.payload?.body ?? ""}`}
                      onSelect={() => {
                        setText((currentText) => [currentText.trim(), reply.payload?.body ?? ""].filter(Boolean).join("\n"));
                        setQuickOpen(false);
                        setTimeout(() => ref.current?.focus(), 0);
                      }}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{reply.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {reply.shortcut ? `${reply.shortcut} · ` : ""}{reply.payload?.body ?? ""}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setScheduleOpen(true)}
          disabled={windowExpired}
          title="Agendar"
        >
          <Calendar className="h-4 w-4" />
        </Button>
        <Button onClick={() => void send()} disabled={sending || !text.trim() || windowExpired} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <ScheduleMessageDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        conversation={conversation}
        initialBody={text}
      />
    </div>
  );
}
