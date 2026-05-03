import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { MoreVertical, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DealCard } from "./DealCard";
import { formatMoney, type Deal, type Stage } from "./hooks";
import { cn } from "@/lib/utils";

type Props = {
  stage: Stage;
  deals: Deal[];
  totalDeals?: number;
  onAddDeal: (stageId: string) => void;
  onOpenDeal: (deal: Deal) => void;
};

export function StageColumn({ stage, deals, totalDeals, onAddDeal, onOpenDeal }: Props) {
  const total = deals.reduce((s, d) => s + d.value_cents, 0);
  const count = totalDeals ?? deals.length;
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { type: "stage", stage },
  });

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Stage header */}
      <div className="flex items-center gap-2 px-1 pb-2">
        <Circle className="h-4 w-4 text-primary" strokeWidth={2} />
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ background: stage.color }}
        />
        <div className="font-semibold text-sm truncate flex-1">{stage.name}</div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-500 border border-orange-500/20">
          {deals.length}/{count}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddDeal(stage.id)}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      {count > 0 && (
        <div className="px-1 pb-2 text-[11px] text-muted-foreground">
          {formatMoney(total)}
        </div>
      )}

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 overflow-y-auto min-h-32 transition-colors rounded-lg p-1",
          isOver && "bg-primary/5 ring-1 ring-primary/30"
        )}
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((d) => (
            <DealCard key={d.id} deal={d} onClick={() => onOpenDeal(d)} />
          ))}
        </SortableContext>
        {deals.length === 0 && (
          <button
            onClick={() => onAddDeal(stage.id)}
            className="w-full text-center text-xs text-muted-foreground py-8 border border-dashed rounded-lg hover:bg-muted/40 transition-colors"
          >
            Solte aqui ou clique para adicionar
          </button>
        )}
      </div>
    </div>
  );
}
