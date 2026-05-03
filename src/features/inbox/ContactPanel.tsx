import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { ConversationRow } from "./hooks";

export function ContactPanel({ conversation }: { conversation: ConversationRow }) {
  const c = conversation.contacts;
  return (
    <aside className="w-72 border-l p-4 space-y-4 overflow-y-auto bg-card hidden lg:block">
      <div>
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-2xl font-medium mx-auto">
          {(c?.display_name ?? c?.phone_e164 ?? "?").charAt(0).toUpperCase()}
        </div>
        <h3 className="mt-3 text-center font-semibold">{c?.display_name ?? "Sem nome"}</h3>
        <p className="text-center text-sm text-muted-foreground">{c?.phone_e164 ?? "—"}</p>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Canal</span>
          <Badge variant="outline">
            {conversation.channels?.kind === "whatsapp_cloud" ? "Cloud" : "UAZAPI"}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status</span>
          <span className="capitalize">{conversation.status}</span>
        </div>
        {conversation.window_expires_at && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Janela 24h</span>
            <span className="text-xs">
              {format(new Date(conversation.window_expires_at), "dd/MM HH:mm")}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
