import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { subDays } from "date-fns";
import type { DateRange } from "react-day-picker";

export type DashboardFilters = {
  range: DateRange;
  sellerIds: string[];
  pipelineIds: string[];
  channels: string[]; // whatsapp / phone / email
};

type Ctx = {
  filters: DashboardFilters;
  setRange: (r: DateRange | undefined) => void;
  setSellerIds: (v: string[]) => void;
  setPipelineIds: (v: string[]) => void;
  setChannels: (v: string[]) => void;
  reset: () => void;
};

const defaultRange = (): DateRange => ({ from: subDays(new Date(), 30), to: new Date() });
const defaultFilters = (): DashboardFilters => ({
  range: defaultRange(),
  sellerIds: [],
  pipelineIds: [],
  channels: [],
});

const DashboardFiltersContext = createContext<Ctx | null>(null);

export function DashboardFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const value = useMemo<Ctx>(() => ({
    filters,
    setRange: (r) => setFilters((f) => ({ ...f, range: r ?? defaultRange() })),
    setSellerIds: (v) => setFilters((f) => ({ ...f, sellerIds: v })),
    setPipelineIds: (v) => setFilters((f) => ({ ...f, pipelineIds: v })),
    setChannels: (v) => setFilters((f) => ({ ...f, channels: v })),
    reset: () => setFilters(defaultFilters()),
  }), [filters]);
  return <DashboardFiltersContext.Provider value={value}>{children}</DashboardFiltersContext.Provider>;
}

export function useDashboardFilters() {
  const ctx = useContext(DashboardFiltersContext);
  if (!ctx) throw new Error("useDashboardFilters must be used inside DashboardFiltersProvider");
  return ctx;
}
