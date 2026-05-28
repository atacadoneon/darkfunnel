import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type CalendarKind = "event" | "meeting" | "task" | "activity";

export type UnifiedCalendarItem = {
  id: string;
  workspace_id: string;
  kind: CalendarKind;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean | null;
  location: string | null;
  status: string | null;
  meeting_url: string | null;
  conference_type: string | null;
  contact_id: string | null;
  deal_id: string | null;
  owner_id: string | null;
  attendees: any[] | null;
  source: string | null;
  source_id: string | null;
  created_at: string;
};

export function useUnifiedCalendar(range: { from: Date; to: Date }) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["unified-calendar", current?.id, range.from.toISOString(), range.to.toISOString()],
    enabled: !!current,
    queryFn: async (): Promise<UnifiedCalendarItem[]> => {
      const { data, error } = await supabase
        .from("unified_calendar" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .gte("starts_at", range.from.toISOString())
        .lte("starts_at", range.to.toISOString())
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as any as UnifiedCalendarItem[];
    },
  });
}
