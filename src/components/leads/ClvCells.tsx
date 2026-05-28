import { cn } from "@/lib/utils";
import type { ClvStat } from "@/hooks/useClvStats";

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Chip({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", className)}>
      <span className="text-[9px] uppercase tracking-wide opacity-70">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

export function ClvCells({ stat }: { stat: ClvStat | undefined }) {
  if (!stat) {
    return (
      <div className="flex flex-wrap gap-1 text-muted-foreground">
        <Chip label="Total" value="R$ 0" />
      </div>
    );
  }
  const lastDays = stat.days_since_last_purchase ?? null;
  const lastCls =
    lastDays == null ? "bg-muted text-muted-foreground" :
    lastDays > 30 ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30" :
    lastDays > 7  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" :
                    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";

  return (
    <div className="flex flex-wrap gap-1">
      <Chip label="Total" value={fmtBRL(stat.total_revenue_cents)} className="bg-muted/40" />
      <Chip
        label="Compras"
        value={String(stat.purchases_count)}
        className={stat.purchases_count > 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" : "bg-muted/40 text-muted-foreground"}
      />
      <Chip
        label="Ciclo"
        value={stat.avg_purchase_cycle_days ? `${Math.round(stat.avg_purchase_cycle_days)}d` : "—"}
        className="bg-muted/40 text-muted-foreground"
      />
      <Chip
        label="Última"
        value={lastDays == null ? "—" : `${lastDays}d`}
        className={lastCls}
      />
    </div>
  );
}
