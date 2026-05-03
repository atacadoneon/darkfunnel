import { useEffect, useRef, useState } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  matches: string[]; // message ids
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
  onClose: () => void;
};

export function MessageSearchBar({
  query, onQueryChange, matches, activeIndex, onActiveIndexChange, onClose,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const total = matches.length;
  const next = () => total && onActiveIndexChange((activeIndex + 1) % total);
  const prev = () => total && onActiveIndexChange((activeIndex - 1 + total) % total);

  return (
    <div className="border-b bg-card flex items-center gap-2 px-4 py-2">
      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
      <Input
        ref={ref}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? prev() : next(); }
          if (e.key === "Escape") onClose();
        }}
        placeholder="Buscar nas mensagens..."
        className="h-8 border-none focus-visible:ring-0 shadow-none px-0"
      />
      {query.length >= 2 && (
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {total ? `${activeIndex + 1} de ${total}` : "0 resultados"}
        </span>
      )}
      <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!total} onClick={prev} aria-label="Anterior">
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!total} onClick={next} aria-label="Próxima">
        <ChevronDown className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose} aria-label="Fechar">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
