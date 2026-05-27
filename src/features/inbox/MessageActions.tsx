import { useState } from "react";
import {
  ChevronDown, Reply, Forward as ForwardIcon, Pin, Star, Trash2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import type { MessageRow } from "./hooks";

const SEVEN_MIN_MS = 7 * 60 * 1000;

async function patchPayload(m: MessageRow, patch: Record<string, unknown>) {
  const payload = { ...(m.payload ?? {}), ...patch };
  const { error } = await supabase.from("messages").update({ payload }).eq("id", m.id);
  if (error) throw error;
}

export function isDeletedForMe(m: MessageRow, userId: string | null | undefined): boolean {
  if (!userId) return false;
  const arr = (m.payload as { deleted_for_user_ids?: unknown })?.deleted_for_user_ids;
  return Array.isArray(arr) && arr.includes(userId);
}

export function isDeletedForAll(m: MessageRow): boolean {
  return !!(m.payload as { deleted_for_all_at?: unknown })?.deleted_for_all_at;
}

export function isPinned(m: MessageRow): boolean {
  return !!(m.payload as { pinned_at?: unknown })?.pinned_at;
}

export function isStarred(m: MessageRow, userId: string | null | undefined): boolean {
  if (!userId) return false;
  const arr = (m.payload as { starred_by_user_ids?: unknown })?.starred_by_user_ids;
  return Array.isArray(arr) && arr.includes(userId);
}

type Props = {
  message: MessageRow;
  side: "out" | "in";
  onReply: (m: MessageRow) => void;
  onForward: (m: MessageRow) => void;
};

export function MessageActions({ message, side, onReply, onForward }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["messages", message.conversation_id] });
  };

  const togglePin = async () => {
    try {
      await patchPayload(message, { pinned_at: isPinned(message) ? null : new Date().toISOString() });
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
  };

  const toggleStar = async () => {
    if (!user) return;
    try {
      const arr = ((message.payload as { starred_by_user_ids?: string[] })?.starred_by_user_ids ?? []) as string[];
      const next = arr.includes(user.id) ? arr.filter((x) => x !== user.id) : [...arr, user.id];
      await patchPayload(message, { starred_by_user_ids: next });
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
  };

  const deleteForMe = async () => {
    if (!user) return;
    try {
      const arr = ((message.payload as { deleted_for_user_ids?: string[] })?.deleted_for_user_ids ?? []) as string[];
      if (!arr.includes(user.id)) arr.push(user.id);
      await patchPayload(message, { deleted_for_user_ids: arr });
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
  };

  const deleteForAll = async () => {
    try {
      await patchPayload(message, { deleted_for_all_at: new Date().toISOString() });
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
  };

  const isOut = side === "out";
  const recent = Date.now() - new Date(message.created_at).getTime() < SEVEN_MIN_MS;
  const canDeleteForAll = isOut && recent;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="wa-quick-btn"
          title="Mais ações"
          aria-label="Mais ações"
          onClick={(e) => e.stopPropagation()}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isOut ? "end" : "start"}
        side="bottom"
        className="min-w-[200px] rounded-lg shadow-xl"
      >
        <DropdownMenuItem onClick={() => onReply(message)} className="gap-3 px-4 py-2.5 text-[14px] cursor-pointer">
          <Reply className="h-4 w-4 text-muted-foreground" /> Responder
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onForward(message)} className="gap-3 px-4 py-2.5 text-[14px] cursor-pointer">
          <ForwardIcon className="h-4 w-4 text-muted-foreground" /> Encaminhar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={togglePin} className="gap-3 px-4 py-2.5 text-[14px] cursor-pointer">
          <Pin className="h-4 w-4 text-muted-foreground" /> {isPinned(message) ? "Desafixar" : "Fixar"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleStar} className="gap-3 px-4 py-2.5 text-[14px] cursor-pointer">
          <Star className={`h-4 w-4 ${isStarred(message, user?.id) ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground"}`} />
          {isStarred(message, user?.id) ? "Remover dos favoritos" : "Favoritar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-3 px-4 py-2.5 text-[14px] text-red-600 focus:text-red-600 cursor-pointer">
            <Trash2 className="h-4 w-4" /> Apagar
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-[200px]">
            <DropdownMenuItem onClick={deleteForMe} className="gap-3 px-4 py-2.5 text-[14px] cursor-pointer">
              Apagar só pra mim
            </DropdownMenuItem>
            {canDeleteForAll && (
              <DropdownMenuItem onClick={deleteForAll} className="gap-3 px-4 py-2.5 text-[14px] text-red-600 focus:text-red-600 cursor-pointer">
                Apagar para todos
              </DropdownMenuItem>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
