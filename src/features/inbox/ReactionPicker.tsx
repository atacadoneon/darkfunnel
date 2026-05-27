import { useEffect, useState } from "react";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { SmilePlus, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import type { MessageRow } from "./hooks";

const QUICK = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

type Props = { message: MessageRow };

type ReactionRow = { id: string; message_id: string; user_id: string; emoji: string };

export function ReactionPicker({ message }: Props) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);

  const apply = async (emoji: string) => {
    setOpen(false);
    setFull(false);
    try {
      const { error } = await supabase.rpc("react_to_message", {
        _message_id: message.id,
        _emoji: emoji,
      });
      if (error) throw error;
    } catch (e) {
      toast.error("Não foi possível reagir", { description: (e as Error).message });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="wa-quick-btn" title="Reagir">
          <SmilePlus className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="p-1 w-auto rounded-full border bg-popover shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {full ? (
          <div className="p-0">
            <EmojiPicker
              emojiStyle={EmojiStyle.NATIVE}
              theme={Theme.AUTO}
              width={320}
              height={380}
              skinTonesDisabled
              searchPlaceholder="Buscar emoji…"
              onEmojiClick={(e) => apply(e.emoji)}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1 px-1">
            {QUICK.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => apply(e)}
                className="text-xl leading-none w-9 h-9 rounded-full hover:bg-muted transition-transform hover:scale-125"
                title={`Reagir ${e}`}
              >
                {e}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFull(true)}
              className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
              title="Mais emojis"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ============ Aggregated reaction chips ============
 * Reads from message_reactions table with realtime subscription per message.
 */
export function ReactionChips({ message }: { message: MessageRow }) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: reactions = [] } = useQuery({
    queryKey: ["msg-reactions", message.id],
    queryFn: async (): Promise<ReactionRow[]> => {
      const { data, error } = await supabase
        .from("message_reactions")
        .select("id,message_id,user_id,emoji")
        .eq("message_id", message.id);
      if (error) throw error;
      return (data ?? []) as ReactionRow[];
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`reactions:${message.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions", filter: `message_id=eq.${message.id}` },
        () => qc.invalidateQueries({ queryKey: ["msg-reactions", message.id] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [message.id, qc]);

  // Fallback: legacy reactions stored on payload
  const legacy = ((message.payload as { reactions?: Array<{ emoji: string; user_id?: string }> })?.reactions) || [];
  const all: Array<{ emoji: string; user_id: string | null }> = reactions.length
    ? reactions.map((r) => ({ emoji: r.emoji, user_id: r.user_id }))
    : legacy.map((r) => ({ emoji: r.emoji, user_id: r.user_id ?? null }));

  if (all.length === 0) return null;

  const counts = new Map<string, number>();
  for (const r of all) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);

  const mineEmoji = all.find((r) => r.user_id && r.user_id === user?.id)?.emoji ?? null;

  const removeMine = async () => {
    if (!mineEmoji) return;
    try {
      const { error } = await supabase.rpc("react_to_message", {
        _message_id: message.id,
        _emoji: mineEmoji,
      });
      if (error) throw error;
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={removeMine}
      className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded-full bg-popover border shadow-sm text-[11px] -mt-1 hover:bg-muted"
      title={mineEmoji ? "Clique para remover sua reação" : "Reações"}
    >
      {[...counts.entries()].map(([emoji, n]) => (
        <span key={emoji} className="flex items-center gap-0.5">
          <span className="text-sm leading-none">{emoji}</span>
          {n > 1 && <span className="text-[10px] text-muted-foreground">{n}</span>}
        </span>
      ))}
    </button>
  );
}
