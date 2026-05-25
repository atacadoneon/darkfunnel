import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function MessageStatusIcon({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  if (status === "sending" || status === "queued") {
    return (
      <Clock
        className={cn("w-3 h-3 text-muted-foreground/70 animate-pulse", className)}
        aria-label="enviando"
      />
    );
  }
  if (status === "sent") {
    return (
      <Check
        className={cn("w-3 h-3 text-muted-foreground", className)}
        aria-label="enviado"
      />
    );
  }
  if (status === "delivered") {
    return (
      <CheckCheck
        className={cn("w-3 h-3 text-muted-foreground", className)}
        aria-label="entregue"
      />
    );
  }
  if (status === "read") {
    return (
      <CheckCheck className={cn("w-3 h-3 text-sky-500", className)} aria-label="lido" />
    );
  }
  if (status === "failed") {
    return (
      <AlertCircle
        className={cn("w-3 h-3 text-destructive", className)}
        aria-label="falhou"
      />
    );
  }
  return null;
}
