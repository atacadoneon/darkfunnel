import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { cn } from "@/lib/utils";

export function UnreadBell() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const nav = useNavigate();

  const { data: total = 0 } = useQuery({
    queryKey: ["unread-total", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("conversations")
        .select("unread_count")
        .eq("workspace_id", current!.id);
      if (error) return 0;
      return (data ?? []).reduce((acc, r: { unread_count: number | null }) => acc + (r.unread_count ?? 0), 0);
    },
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`unread:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["unread-total", current.id] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["unread-total", current.id] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Notificações"
      onClick={() => nav("/chats")}
      className="relative"
    >
      <Bell className="h-4 w-4" />
      {total > 0 && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white",
            "text-[10px] font-semibold flex items-center justify-center tabular-nums",
          )}
        >
          {total > 99 ? "99+" : total}
        </span>
      )}
    </Button>
  );
}
