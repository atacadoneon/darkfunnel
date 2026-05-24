import { useEffect, useState } from "react";
import { formatDuration } from "@/features/voice/hooks";

export function CallTimer({ startedAt, className }: { startedAt: string | Date | null | undefined; className?: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!startedAt) { setSecs(0); return; }
    const start = new Date(startedAt).getTime();
    const tick = () => setSecs(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span className={`tabular-nums ${className ?? ""}`}>{formatDuration(secs)}</span>;
}
