import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { Check, CheckCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MessageRow } from "./hooks";

function StatusIcon({ status }: { status: string }) {
  // Padrão WhatsApp:
  // pending  → relógio
  // sent     → 1 risquinho cinza
  // delivered→ 2 risquinhos cinza (entregue ao lead)
  // read     → 2 risquinhos azuis (lido pelo lead)
  // failed   → !
  if (status === "read")
    return <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" strokeWidth={2.5} />;
  if (status === "delivered")
    return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.5} />;
  if (status === "sent")
    return <Check className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.5} />;
  if (status === "failed")
    return <span className="text-destructive text-[10px] font-bold">!</span>;
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
    <div
      ref={ref}
      className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#efeae2] dark:bg-[#0b141a]"
    >
      {messages.map((m, idx) => {
        const out = m.direction === "out";
        const prev = messages[idx - 1];
        const grouped = prev && prev.direction === m.direction;
        return (
          <div
            key={m.id}
            className={cn(
              "flex",
              out ? "justify-end" : "justify-start",
              grouped ? "mt-0.5" : "mt-2"
            )}
          >
            <div
              className={cn(
                "relative max-w-[75%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm",
                out
                  ? "bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-white"
                  : "bg-white text-[#111b21] dark:bg-[#202c33] dark:text-white"
              )}
            >
              <div className="pr-14">{renderBody(m)}</div>
              <div
                className={cn(
                  "float-right -mb-0.5 ml-2 mt-1 flex items-center gap-1 text-[10px]",
                  out ? "text-[#667781] dark:text-white/60" : "text-[#667781] dark:text-white/50"
                )}
              >
                <span>{format(new Date(m.created_at), "HH:mm")}</span>
                {out && <StatusIcon status={m.status} />}
              </div>
            </div>
          </div>
        );
      })}
      {messages.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">
          Sem mensagens nesta conversa.
        </div>
      )}
    </div>
  );
}
