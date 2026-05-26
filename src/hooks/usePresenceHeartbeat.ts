import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export function usePresenceHeartbeat() {
  const { user } = useAuth();
  const { current } = useWorkspace();

  useEffect(() => {
    if (!user || !current) return;
    let stopped = false;

    const readManual = (): "online" | "away" | null => {
      const v = localStorage.getItem("presence:manual");
      return v === "away" || v === "online" ? v : null;
    };

    const upsert = async (status: "online" | "away" | "offline") => {
      if (stopped) return;
      const manual = readManual();
      const final = status === "offline" ? "offline" : (manual ?? status);
      try {
        await supabase.from("user_presence" as never).upsert(
          {
            user_id: user.id,
            workspace_id: current.id,
            status: final,
            last_seen_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(),
          } as never,
          { onConflict: "user_id,workspace_id" } as never,
        );
      } catch {
        /* table may not exist */
      }
    };

    upsert("online");
    const interval = window.setInterval(() => upsert("online"), 30_000);
    const onVisibility = () =>
      upsert(document.visibilityState === "visible" ? "online" : "away");
    const onManual = () => upsert("online");
    window.addEventListener("presence:manual-change", onManual);
    const onUnload = () => {
      try {
        // best effort
        void upsert("offline");
      } catch {
        /* noop */
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onUnload);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("presence:manual-change", onManual);
      void upsert("offline");
    };
  }, [user, current]);
}
