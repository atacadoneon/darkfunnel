import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Play, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NodeCounters } from "../NodeCounters";

export const StartNode = memo(({ data }: NodeProps) => {
  const d: any = data ?? {};
  const triggerLabel: string | null = d.triggerLabel ?? null;
  return (
    <div className="w-[280px] rounded-lg border-2 border-primary/40 bg-card shadow-md">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-primary/5">
        <div className="h-7 w-7 rounded bg-primary/15 text-primary flex items-center justify-center">
          <Play className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold flex-1">Início</span>
      </div>
      <div className="p-3 space-y-2">
        {triggerLabel ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate font-medium">{triggerLabel}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                d.onPickTrigger?.();
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground leading-snug">
              O gatilho é responsável por acionar a automação. Clique para adicionar um gatilho:
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                d.onPickTrigger?.();
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Adicionar gatilho
            </Button>
          </>
        )}
      </div>
      <div className="px-3 pb-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Quando o evento ocorrer, então
        </div>
        <NodeCounters success={d.success_count} warning={d.warning_count} error={d.error_count} />
      </div>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-primary" />
    </div>
  );
});
StartNode.displayName = "StartNode";
