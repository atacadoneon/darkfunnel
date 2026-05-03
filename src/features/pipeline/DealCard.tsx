import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { GripVertical } from "lucide-react";
import { formatMoney, type Deal } from "./hooks";
import { cn } from "@/lib/utils";

type Props = {
  deal: Deal;
  onClick?: () => void;
  overlay?: boolean;
};

export function DealCard({ deal, onClick, overlay }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id, data: { type: "deal", deal } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={cn(
        "p-3 cursor-pointer hover:border-primary/50 transition-colors group",
        isDragging && "opacity-40",
        overlay && "shadow-lg ring-2 ring-primary"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing -ml-1 mt-0.5 text-muted-foreground"
          aria-label="Arrastar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{deal.title}</h4>
          <div className="text-sm font-semibold text-primary mt-1">
            {formatMoney(deal.value_cents, deal.currency)}
          </div>
        </div>
      </div>
    </Card>
  );
}
