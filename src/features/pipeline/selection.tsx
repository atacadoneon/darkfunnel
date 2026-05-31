import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface SelectionValue {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  add: (ids: string[]) => void;
  remove: (ids: string[]) => void;
  clear: () => void;
  size: number;
}

const Ctx = createContext<SelectionValue | null>(null);

export function DealSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelected] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const add = useCallback((ids: string[]) => {
    setSelected((cur) => {
      const next = new Set(cur);
      ids.forEach((i) => next.add(i));
      return next;
    });
  }, []);
  const remove = useCallback((ids: string[]) => {
    setSelected((cur) => {
      const next = new Set(cur);
      ids.forEach((i) => next.delete(i));
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);
  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const value = useMemo<SelectionValue>(() => ({
    selectedIds, isSelected, toggle, add, remove, clear, size: selectedIds.size,
  }), [selectedIds, isSelected, toggle, add, remove, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDealSelection() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDealSelection outside provider");
  return c;
}
