import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Globe, MessageCircle, Bell, Pencil, MoreHorizontal, User, ExternalLink } from "lucide-react";
import { formatMoney, type Deal } from "./hooks";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { cn } from "@/lib/utils";
import { ConversationPopup } from "@/features/inbox/ConversationPopup";
import { CallButton } from "@/features/voice/CallButton";

type Props = {
  deal: Deal & { last_interaction_at?: string | null; has_proposal?: boolean; origin_id?: string | null };
  onClick?: () => void;
  overlay?: boolean;
};

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days >= 1) return `${days}d`;
  const h = Math.floor(diff / 3600000);
  if (h >= 1) return `${h}h`;
  return `${Math.max(1, Math.floor(diff / 60000))}m`;
}

function colorFromName(name: string): string {
  const palette = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#6366f1","#a855f7","#ec4899"];
  let hash = 0; for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

export function DealCard({ deal, onClick, overlay }: Props) {
  const { user } = useAuth();
  const { data: members = [] } = useWorkspaceMembers();
  const [chatOpen, setChatOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id, data: { type: "deal", deal } });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const contactLabel = deal.contact?.display_name || deal.contact?.phone_e164 || deal.title;
  const ago = timeAgo(deal.updated_at ?? deal.created_at);
  const lastAgo = timeAgo(deal.last_interaction_at ?? deal.updated_at);

  const assignee = members.find((m: any) => m.user_id === deal.assigned_to);
  const assigneeName = assignee?.display_name ?? assignee?.email ?? null;
  const assigneeInitial = (assigneeName ?? "?").charAt(0).toUpperCase();

  return (
    <>
    <Card
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      {...attributes}
      {...listeners}
      className={cn(
        "p-3 cursor-pointer hover:border-primary/50 transition-colors space-y-2 bg-card",
        isDragging && "opacity-40",
        overlay && "shadow-lg ring-2 ring-primary"
      )}
    >
      <div className="flex items-start gap-2">
        <h4 className="font-semibold text-sm flex-1 truncate">{contactLabel}</h4>
        <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          <CallButton
            iconOnly
            phone={deal.contact?.phone_e164 ?? null}
            contactId={deal.contact_id ?? null}
            contactName={deal.contact?.display_name ?? null}
            dealId={deal.id}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          />
          <button
            className="text-muted-foreground hover:text-foreground"
            title="Abrir conversa"
            onClick={(e) => {
              e.stopPropagation();
              setChatOpen(true);
            }}
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
          <button className="text-muted-foreground hover:text-foreground" title="Detalhes">
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{ago}</span>
        </div>
      </div>

      {assigneeName ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-4 w-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center shrink-0"
            style={{ background: colorFromName(assigneeName) }}>{assigneeInitial}</span>
          <span className="truncate">{assigneeName}</span>
        </div>
      ) : (
        <div className="text-[11px]">
          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">Sem vendedor</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        Última interação {lastAgo || "—"}
      </div>

      <div className="flex items-center gap-1.5 text-xs">
        <User className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground truncate">{contactLabel}</span>
        {deal.value_cents > 0 && (
          <span className="ml-auto font-semibold text-foreground text-xs">{formatMoney(deal.value_cents, deal.currency)}</span>
        )}
      </div>

      {deal.has_proposal && (
        <div>
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20 tracking-wide">
            Proposta enviada
          </span>
        </div>
      )}
    </Card>
    <ConversationPopup
      open={chatOpen}
      onOpenChange={setChatOpen}
      contactId={deal.contact_id ?? null}
      contactLabel={contactLabel}
    />
    </>
  );
}
