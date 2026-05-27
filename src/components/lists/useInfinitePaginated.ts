import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_PAGE_SIZE = 100;

type Order = { col: string; asc?: boolean };

type Options<TRow> = {
  queryKey: QueryKey;
  table: string;
  select?: string;
  filters?: Record<string, unknown>;
  order?: Order;
  pageSize?: number;
  enabled?: boolean;
  countMode?: "exact" | "estimated" | "planned";
  staleTime?: number;
  /** Optional post-processor to map rows */
  mapRow?: (row: any) => TRow;
};

export function useInfinitePaginated<TRow = any>({
  queryKey,
  table,
  select = "*",
  filters = {},
  order = { col: "created_at", asc: false },
  pageSize = DEFAULT_PAGE_SIZE,
  enabled = true,
  countMode = "exact",
  staleTime = 5 * 60_000,
  mapRow,
}: Options<TRow>) {
  return useInfiniteQuery({
    queryKey,
    enabled,
    staleTime,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam as number;
      const to = from + pageSize - 1;
      let q: any = (supabase.from as any)(table)
        .select(select, { count: countMode })
        .order(order.col, { ascending: order.asc ?? false })
        .range(from, to);
      for (const [k, v] of Object.entries(filters)) {
        if (v == null || v === "") continue;
        if (Array.isArray(v)) q = q.in(k, v);
        else q = q.eq(k, v);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      const items = (data ?? []) as any[];
      const mapped = mapRow ? items.map(mapRow) : (items as TRow[]);
      return {
        items: mapped,
        nextOffset: items.length === pageSize ? from + pageSize : null,
        total: count ?? 0,
      };
    },
    getNextPageParam: (last) => last.nextOffset,
  });
}

export function flattenPages<T>(data: { pages: { items: T[]; total: number }[] } | undefined) {
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  return { items, total, loaded: items.length };
}
