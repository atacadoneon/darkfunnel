import { useState } from "react";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { SmilePlus, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import type { MessageRow } from "./hooks";

const QUICK = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

type Props = { message: MessageRow };

export function ReactionPicker({ message }: Props) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const qc = useQueryClient();
  const { current } = useWorkspace();

  const apply = async (emoji: string) => {
    setOpen(false);
    setFull(false);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      const payload = (message.payload ?? {}) as Record<string, unknown>;
      const existing = Array.isArray(payload.reactions)
        ? (payload.reactions as Array<{ emoji: string; user_id?: string; at?: string }>)
        : [];
      // toggle: if mesma reação do mesmo user → remove; senão substitui a reação atual do user
      const mine = existing.find((r) => r.user_id === userId);
      let next: typeof existing;
      if (mine && mine.emoji === emoji) {
        next = existing.filter((r) => r.user_id !== userId);
      } else {
        next = [
          ...existing.filter((r) => r.user_id !== userId),
          { emoji, user_id: userId, at: new Date().toISOString() },
        ];
      }
      const { error } = await supabase
        .from("messages")
        .update({ payload: { ...payload, reactions: next } })
        .eq("id", message.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["messages", message.conversation_id] });
      qc.invalidateQueries({ queryKey: ["conversations", current?.id] });
    } catch (e) {
      toast.error("Não foi possível reagir", { description: (e as Error).message });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="wa-quick-btn" title="Reagir">
          <SmileIcon className="h-4 w-4" />
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

/* Chip de reação exibido abaixo do balão */
export function ReactionChips({ message }: { message: MessageRow }) {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const payload = (message.payload ?? {}) as Record<string, unknown>;
  const reactions = Array.isArray(payload.reactions)
    ? (payload.reactions as Array<{ emoji: string; user_id?: string }>)
    : [];
  if (reactions.length === 0) return null;

  const counts = new Map<string, number>();
  for (const r of reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);

  const removeMine = async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const next = reactions.filter((r) => r.user_id !== u?.user?.id);
      await supabase.from("messages").update({ payload: { ...payload, reactions: next } }).eq("id", message.id);
      qc.invalidateQueries({ queryKey: ["messages", message.conversation_id] });
      qc.invalidateQueries({ queryKey: ["conversations", current?.id] });
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={removeMine}
      className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded-full bg-popover border shadow-sm text-[11px] -mt-1 hover:bg-muted"
      title="Clique para remover sua reação"
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
