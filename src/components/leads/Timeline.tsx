import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock, Inbox, Circle, UserCheck, ArrowRightCircle, Trophy, XCircle,
  FileText, CheckCircle, CreditCard, DollarSign, Sparkles, MessageCircle,
  Send, Phone, StickyNote, Tag, Calendar, CheckSquare, User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LoadMoreSentinel } from "@/components/lists/LoadMoreSentinel";

const PAGE = 50;

type TimelineEvent = {
  source_type: string;
  source_id: string;
  contact_id: string;
  happened_at: string;
  kind: string | null;
  title: string | null;
  body: string | null;
  icon: string | null;
  color: string | null;
  actor_name: string | null;
  ref_type: string | null;
  ref_id: string | null;
  value_cents: number | null;
};

const ICON_MAP: Record<string, any> = {
  "user-check": UserCheck,
  "arrow-right-circle": ArrowRightCircle,
  trophy: Trophy,
  "x-circle": XCircle,
  "file-text": FileText,
  "check-circle": CheckCircle,
  "credit-card": CreditCard,
  "dollar-sign": DollarSign,
  sparkles: Sparkles,
  "message-circle": MessageCircle,
  send: Send,
  phone: Phone,
  "sticky-note": StickyNote,
  tag: Tag,
  calendar: Calendar,
  "check-square": CheckSquare,
};

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  green: "bg-green-100 text-green-700 border-green-200",
  red: "bg-red-100 text-red-700 border-red-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  gray: "bg-gray-100 text-gray-700 border-gray-200",
};

type FilterKey = "all" | "events" | "messages" | "calls" | "notes";

const FILTER_SOURCES: Record<FilterKey, string[] | null> = {
  all: null,
  events: ["lead_event"],
  messages: ["message"],
  calls: ["call"],
  notes: ["note"],
};

function useTimeline(contactId: string, filter: FilterKey) {
  return useInfiniteQuery({
    queryKey: ["timeline", contactId, filter],
    enabled: !!contactId,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam as number;
      const to = from + PAGE - 1;
      let q: any = supabase
        .from("lead_timeline" as any)
        .select("*", { count: "exact" })
        .eq("contact_id", contactId)
        .order("happened_at", { ascending: false })
        .range(from, to);
      const sources = FILTER_SOURCES[filter];
      if (sources) q = q.in("source_type", sources);
      const { data, error, count } = await q;
      if (error) throw error;
      const items = (data ?? []) as TimelineEvent[];
      return {
        items,
        total: count ?? 0,
        nextOffset: items.length === PAGE ? from + PAGE : null,
      };
    },
    getNextPageParam: (last) => last.nextOffset,
    staleTime: 30_000,
  });
}

function groupByDate(events: TimelineEvent[]) {
  const groups: Record<string, TimelineEvent[]> = {};
  for (const ev of events) {
    const d = new Date(ev.happened_at);
    const label = isToday(d)
      ? "HOJE"
      : isYesterday(d)
      ? "ONTEM"
      : format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR }).toUpperCase();
    if (!groups[label]) groups[label] = [];
    groups[label].push(ev);
  }
  return groups;
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  const navigate = useNavigate();
  const Icon = ICON_MAP[event.icon ?? ""] || Circle;
  const colorClass = COLOR_MAP[event.color ?? ""] || COLOR_MAP.gray;
  const time = format(new Date(event.happened_at), "HH:mm");

  const handleRefClick = () => {
    if (!event.ref_type || !event.ref_id) return;
    if (event.ref_type === "proposal") navigate(`/propostas/${event.ref_id}`);
    else if (event.ref_type === "payment_link") navigate(`/pagamentos/${event.ref_id}`);
  };

  const refLabel =
    event.ref_type === "proposal"
      ? "Ver proposta →"
      : event.ref_type === "payment_link"
      ? "Ver pagamento →"
      : event.ref_type === "call"
      ? "Ver chamada →"
      : null;

  return (
    <div className="relative pb-3 group">
      <div
        className={cn(
          "absolute -left-7 top-0 w-6 h-6 rounded-full border flex items-center justify-center",
          colorClass,
        )}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="bg-background rounded-lg p-2.5 border hover:border-muted-foreground/30 transition">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{event.title ?? event.kind ?? "Evento"}</div>
            {event.body && (
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-3 whitespace-pre-wrap">
                {event.body}
              </div>
            )}
            {event.value_cents != null && event.value_cents > 0 && (
              <div className="text-xs font-semibold mt-1">
                R$ {(event.value_cents / 100).toFixed(2).replace(".", ",")}
              </div>
            )}
            {event.actor_name && (
              <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <User className="w-3 h-3" /> {event.actor_name}
              </div>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground flex-shrink-0">{time}</div>
        </div>
        {refLabel && (
          <button
            onClick={handleRefClick}
            className="text-xs text-primary mt-2 hover:underline opacity-0 group-hover:opacity-100 transition"
          >
            {refLabel}
          </button>
        )}
      </div>
    </div>
  );
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "events", label: "Eventos" },
  { key: "messages", label: "Mensagens" },
  { key: "calls", label: "Ligações" },
  { key: "notes", label: "Notas" },
];

export function Timeline({ contactId }: { contactId: string }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const qc = useQueryClient();
  const { data, fetchNextPage, hasNextPage, isFetching, isLoading } = useTimeline(contactId, filter);

  useEffect(() => {
    if (!contactId) return;
    const invalidate = () => qc.invalidateQueries({ queryKey: ["timeline", contactId] });
    const ch = supabase
      .channel(`timeline-${contactId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lead_events", filter: `contact_id=eq.${contactId}` },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `contact_id=eq.${contactId}` },
        invalidate,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [contactId, qc]);

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const grouped = useMemo(() => groupByDate(items), [items]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between sticky top-0 bg-background py-2 z-10 border-b">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Clock className="w-4 h-4" /> Histórico do Lead
        </h3>
        <Badge variant="secondary">{total} eventos</Badge>
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] border transition",
              filter === f.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative pl-7">
        <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-border via-border to-transparent" />
        {Object.entries(grouped).map(([dateLabel, events]) => (
          <div key={dateLabel} className="mb-4">
            <div className="-ml-7 mb-2 flex items-center gap-2">
              <div className="bg-muted text-muted-foreground text-[10px] font-medium px-2.5 py-1 rounded-full">
                {dateLabel}
              </div>
              <div className="flex-1 h-px bg-border" />
            </div>
            {events.map((ev) => (
              <TimelineItem key={`${ev.source_type}-${ev.source_id}`} event={ev} />
            ))}
          </div>
        ))}

        {hasNextPage && (
          <LoadMoreSentinel
            hasMore={hasNextPage}
            isFetching={isFetching}
            onIntersect={() => fetchNextPage()}
          />
        )}
        {!hasNextPage && items.length > 0 && (
          <div className="text-center text-xs text-muted-foreground pt-4">— Início do histórico —</div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            <Inbox className="w-8 h-8 mx-auto opacity-30 mb-2" />
            Nenhum evento registrado ainda
          </div>
        )}
      </div>
    </div>
  );
}
