import { ArrowLeftRight, Trophy, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStages, type Stage } from "@/features/pipeline/hooks";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function StageMovePopover({
  dealId,
  currentStageId,
}: {
  dealId: string;
  currentStageId: string;
}) {
  const { data: stages = [] } = useStages();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const current = stages.find((s) => s.id === currentStageId);
  const label = current?.name ?? "Mover etapa";

  const move = async (s: Stage) => {
    const status = s.is_won ? "won" : s.is_lost ? "lost" : "open";
    const { error } = await supabase.from("deals").update({ stage_id: s.id, status }).eq("id", dealId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["deals"] });
    qc.invalidateQueries({ queryKey: ["contact-deal"] });
    setOpen(false);
    toast.success(`Movido para "${s.name}"`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span className="text-xs max-w-[140px] truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="px-2 pt-1 pb-2 text-[10px] uppercase font-semibold text-muted-foreground tracking-wide flex items-center gap-1">
          <ArrowLeftRight className="h-3 w-3" /> Mover para etapa
        </div>
        <div className="max-h-80 overflow-y-auto space-y-0.5">
          {stages.map((s) => {
            const active = s.id === currentStageId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => !active && void move(s)}
                disabled={active}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left",
                  active ? "opacity-60 cursor-default" : "hover:bg-muted/60"
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color || "#94a3b8" }} />
                <span className="flex-1 truncate">{s.name}</span>
                {s.is_won && <Trophy className="h-3.5 w-3.5 text-emerald-600" />}
                {s.is_lost && <Ban className="h-3.5 w-3.5 text-rose-600" />}
                {active && <Badge variant="secondary" className="text-[9px] h-4 px-1.5">atual</Badge>}
              </button>
            );
          })}
          {stages.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhuma etapa cadastrada</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
