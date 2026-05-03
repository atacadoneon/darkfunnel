import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DealCard } from "./DealCard";
import { formatMoney, type Deal, type Stage } from "./hooks";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Props = {
  stage: Stage;
  deals: Deal[];
  totalDeals?: number;
  onAddDeal: (stageId: string) => void;
  onOpenDeal: (deal: Deal) => void;
  pageSize?: number;
};

export function StageColumn({ stage, deals, totalDeals, onAddDeal, onOpenDeal, pageSize = 50 }: Props) {
  const [shown, setShown] = useState(pageSize);
  const total = deals.reduce((s, d) => s + d.value_cents, 0);
  const count = totalDeals ?? deals.length;
  const visible = deals.slice(0, shown);
  const hasMore = deals.length > shown;
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { type: "stage", stage } });

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: stage.color }} />
        <div className="font-semibold text-sm truncate flex-1">{stage.name}</div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground tabular-nums">
          {visible.length}/{count}
        </span>
      </div>

      {total > 0 && (
        <div className="px-1 pb-2 text-[11px] text-muted-foreground tabular-nums">
          R$ {(total / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </div>
      )}

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 overflow-y-auto min-h-32 transition-colors rounded-lg p-1 bg-muted/20",
          isOver && "bg-primary/5 ring-1 ring-primary/30"
        )}
      >
        <SortableContext items={visible.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {visible.map((d) => (
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
        {hasMore && (
          <button
            onClick={() => setShown(s => s + pageSize)}
            className="w-full text-xs text-muted-foreground py-2 hover:bg-muted/40 rounded-md flex items-center justify-center gap-1"
          >
            <ChevronDown className="h-3 w-3" /> Carregar mais {pageSize} de {deals.length}
          </button>
        )}
        {!hasMore && shown > pageSize && (
          <button
            onClick={() => setShown(pageSize)}
            className="w-full text-xs text-muted-foreground py-2 hover:bg-muted/40 rounded-md flex items-center justify-center gap-1"
          >
            <ChevronUp className="h-3 w-3" /> Mostrar menos
          </button>
        )}
      </div>
    </div>
  );
}
