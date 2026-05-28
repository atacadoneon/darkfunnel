import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export function NodeCounters({
  success = 0,
  warning = 0,
  error = 0,
}: {
  success?: number;
  warning?: number;
  error?: number;
}) {
  return (
    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        {success}
      </div>
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        {warning}
      </div>
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-600 dark:text-red-400">
        <XCircle className="h-3 w-3" />
        {error}
      </div>
    </div>
  );
}
