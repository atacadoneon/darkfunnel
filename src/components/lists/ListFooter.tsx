import { CheckCircle2 } from "lucide-react";

type Props = {
  loaded: number;
  total: number;
  hasMore: boolean;
  singular?: string;
  plural?: string;
  className?: string;
};

export function ListFooter({
  loaded,
  total,
  hasMore,
  singular = "registro exibido",
  plural = "registros exibidos",
  className = "",
}: Props) {
  if (total === 0 && loaded === 0) return null;
  const allLoaded = !hasMore && total > 0;
  const fmt = (n: number) => n.toLocaleString("pt-BR");
  const noun = loaded === 1 ? singular : plural;
  return (
    <div
      className={
        "sticky bottom-0 bg-background border-t px-4 py-2 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5 " +
        className
      }
    >
      <span>Mostrando</span>
      <span className="font-medium tabular-nums text-foreground">{fmt(loaded)}</span>
      <span>de</span>
      <span className="font-medium tabular-nums text-foreground">{fmt(total)}</span>
      <span>{noun}</span>
      {allLoaded && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
    </div>
  );
}
