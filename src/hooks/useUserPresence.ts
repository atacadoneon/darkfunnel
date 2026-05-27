import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

type Status = "online" | "away" | "offline";

/**
 * Heartbeat de presença no workspace_user_presence.
 * - mount: online
 * - heartbeat 30s
 * - visibilitychange hidden por 60s -> away
 * - visible -> online
 * - unmount / beforeunload -> offline
 */
export function useUserPresence() {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const hiddenSince = useRef<number | null>(null);
  const awayTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!user || !current) return;
    let stopped = false;

    const upsert = async (status: Status) => {
      if (stopped) return;
      try {
        await supabase.from("workspace_user_presence" as never).upsert(
          {
            user_id: user.id,
            workspace_id: current.id,
            status,
            last_seen_at: new Date().toISOString(),
          } as never,
          { onConflict: "user_id,workspace_id" } as never,
        );
      } catch {
        /* tabela pode não estar pronta; ignora */
      }
    };

    void upsert("online");
    const hb = window.setInterval(() => void upsert("online"), 30_000);

    const clearAway = () => {
      if (awayTimer.current) {
        window.clearTimeout(awayTimer.current);
        awayTimer.current = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenSince.current = Date.now();
        clearAway();
        awayTimer.current = window.setTimeout(() => void upsert("away"), 60_000);
      } else {
        hiddenSince.current = null;
        clearAway();
        void upsert("online");
      }
    };

    const onUnload = () => {
      try {
        navigator.sendBeacon?.(
          // fallback síncrono best-effort; supabase não suporta beacon nativamente,
          // então tentamos um upsert direto também.
          "",
        );
      } catch { /* noop */ }
      void upsert("offline");
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onUnload);

    return () => {
      stopped = true;
      window.clearInterval(hb);
      clearAway();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      void upsert("offline");
    };
  }, [user, current]);
}
