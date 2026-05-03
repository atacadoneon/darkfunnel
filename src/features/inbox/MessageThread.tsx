import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { Check, CheckCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MessageRow } from "./hooks";

function StatusIcon({ status }: { status: string }) {
  if (status === "read") return <CheckCheck className="h-3 w-3 text-blue-500" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3" />;
  if (status === "sent") return <Check className="h-3 w-3" />;
  if (status === "failed") return <span className="text-destructive text-[10px]">!</span>;
  return <Clock className="h-3 w-3 opacity-60" />;
}

function renderBody(m: MessageRow) {
  const p = m.payload as Record<string, unknown>;
  if (m.type === "text") return <span className="whitespace-pre-wrap break-words">{String(p.body ?? "")}</span>;
  if (m.type === "image") return <span className="italic opacity-80">📷 imagem {p.caption ? `— ${p.caption}` : ""}</span>;
  if (m.type === "audio") return <span className="italic opacity-80">🎙 áudio</span>;
  if (m.type === "document") return <span className="italic opacity-80">📎 documento</span>;
  if (m.type === "template") return <span className="italic opacity-80">📋 template ({String(p.name ?? "")})</span>;
  return <span className="italic opacity-60">[{m.type}]</span>;
}

export function MessageThread({ messages }: { messages: MessageRow[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div ref={ref} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
      {messages.map((m) => {
        const out = m.direction === "out";
        return (
          <div key={m.id} className={cn("flex", out ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm",
                out ? "bg-primary text-primary-foreground" : "bg-card border"
              )}
            >
              <div>{renderBody(m)}</div>
              <div className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", out ? "opacity-80" : "text-muted-foreground")}>
                <span>{format(new Date(m.created_at), "HH:mm")}</span>
                {out && <StatusIcon status={m.status} />}
              </div>
            </div>
          </div>
        );
      })}
      {messages.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">Sem mensagens nesta conversa.</div>
      )}
    </div>
  );
}
