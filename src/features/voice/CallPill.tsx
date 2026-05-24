import { Phone, X, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useActiveCalls } from "./hooks";
import { CallTimer } from "@/components/voice/CallTimer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function CallPill() {
  const { data: calls = [] } = useActiveCalls();
  if (calls.length === 0) return null;
  const c = calls[0];
  const name = c.contact?.display_name ?? c.contact?.phone_e164 ?? c.to_number ?? "—";

  const hangup = async () => {
    try {
      await supabase.from("calls").update({ status: "completed" }).eq("id", c.id);
      toast.success("Chamada encerrada");
    } catch (e: any) { toast.error(e.message ?? "erro"); }
  };

  const isWa = c.channel === "whatsapp";
  return (
    <div className="flex items-center gap-2 rounded-full border bg-card pl-1 pr-2 py-1 shadow-sm">
      <Avatar className="h-6 w-6">
        <AvatarImage src={c.contact?.profile_pic_preview_url ?? undefined} />
        <AvatarFallback className="text-[10px]">{name.charAt(0)}</AvatarFallback>
      </Avatar>
      <span className="text-xs font-medium max-w-[120px] truncate">{name}</span>
      <CallTimer startedAt={c.initiated_at} className="text-xs text-muted-foreground" />
      {isWa ? (
        <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Phone className="h-3.5 w-3.5 text-sky-500" />
      )}
      <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full" onClick={hangup} aria-label="Encerrar">
        <X className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}
