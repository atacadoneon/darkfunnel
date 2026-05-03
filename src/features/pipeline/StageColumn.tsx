import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DealCard } from "./DealCard";
import { formatMoney, type Deal, type Stage } from "./hooks";
import { cn } from "@/lib/utils";

type Props = {
  stage: Stage;
  deals: Deal[];
  onAddDeal: (stageId: string) => void;
  onOpenDeal: (deal: Deal) => void;
};

export function StageColumn({ stage, deals, onAddDeal, onOpenDeal }: Props) {
  const total = deals.reduce((s, d) => s + d.value_cents, 0);
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { type: "stage", stage },
  });

  return (
    <div className="flex flex-col w-72 shrink-0 bg-muted/40 rounded-lg border">
      <div className="p-3 border-b flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: stage.color }} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{stage.name}</div>
          <div className="text-xs text-muted-foreground">
            {deals.length} {deals.length === 1 ? "negócio" : "negócios"} · {formatMoney(total)}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddDeal(stage.id)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 space-y-2 overflow-y-auto min-h-32 transition-colors",
          isOver && "bg-primary/5"
        )}
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((d) => (
            <DealCard key={d.id} deal={d} onClick={() => onOpenDeal(d)} />
          ))}
        </SortableContext>
        {deals.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-md">
            Solte aqui ou clique em +
          </div>
        )}
      </div>
    </div>
  );
}
