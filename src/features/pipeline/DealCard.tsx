import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Circle, Clock, MessageCircle, Bell, Pencil, MoreHorizontal } from "lucide-react";
import { type Deal } from "./hooks";
import { cn } from "@/lib/utils";

type Props = {
  deal: Deal;
  onClick?: () => void;
  overlay?: boolean;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days >= 1) return `${days}d`;
  const h = Math.floor(diff / 3600000);
  if (h >= 1) return `${h}h`;
  const m = Math.max(1, Math.floor(diff / 60000));
  return `${m}m`;
}

export function DealCard({ deal, onClick, overlay }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id, data: { type: "deal", deal } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const initial = deal.title.trim().charAt(0).toUpperCase() || "?";
  const ago = timeAgo(deal.updated_at ?? deal.created_at);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      {...attributes}
      {...listeners}
      className={cn(
        "p-3 cursor-pointer hover:border-primary/50 transition-colors space-y-2 bg-card/60",
        isDragging && "opacity-40",
        overlay && "shadow-lg ring-2 ring-primary"
      )}
    >
      <div className="flex items-start gap-2">
        <Circle className="h-4 w-4 text-primary mt-0.5 shrink-0" strokeWidth={2} />
        <h4 className="font-semibold text-sm flex-1 truncate">{deal.title}</h4>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 shrink-0">
          {ago}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-6">
        <span className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-foreground">
          {initial}
        </span>
        <span className="truncate">{deal.title}</span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-6">
        <Clock className="h-3 w-3" />
        Última interação {ago}
      </div>

      {!deal.assigned_to && (
        <div className="pl-6">
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-500 border border-amber-500/20">
            Sem vendedor
          </span>
        </div>
      )}

      <div
        className="flex items-center gap-1 pt-1 border-t border-border/40 -mx-1 px-1"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted text-emerald-500" aria-label="Mensagem">
          <MessageCircle className="h-4 w-4" />
        </button>
        <button className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground" aria-label="Notificar">
          <Bell className="h-4 w-4" />
        </button>
        <button className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground" aria-label="Editar">
          <Pencil className="h-4 w-4" />
        </button>
        <button className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground ml-auto" aria-label="Mais">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
