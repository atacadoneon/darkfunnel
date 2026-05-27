import { useState } from "react";
import {
  ChevronDown, Reply, Forward as ForwardIcon, Pin, Star, Trash2, FileText,
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

/** Reads dedicated columns first, falls back to payload (back-compat). */
export function isDeletedForMe(m: MessageRow, userId: string | null | undefined): boolean {
  if (!userId) return false;
  const col = m.deleted_for_user_ids;
  if (Array.isArray(col)) return col.includes(userId);
  const arr = (m.payload as { deleted_for_user_ids?: unknown })?.deleted_for_user_ids;
  return Array.isArray(arr) && arr.includes(userId);
}

export function isDeletedForAll(m: MessageRow): boolean {
  return !!m.deleted_for_all_at
    || !!(m.payload as { deleted_for_all_at?: unknown })?.deleted_for_all_at;
}

export function isPinned(m: MessageRow): boolean {
  return !!m.pinned_at || !!(m.payload as { pinned_at?: unknown })?.pinned_at;
}

export function isStarred(m: MessageRow, userId: string | null | undefined): boolean {
  if (!userId) return false;
  const col = m.starred_by_user_ids;
  if (Array.isArray(col)) return col.includes(userId);
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
      const { error } = await supabase.rpc("pin_message", { _message_id: message.id });
      if (error) throw error;
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
  };

  const toggleStar = async () => {
    try {
      const { error } = await supabase.rpc("toggle_star_message", { _message_id: message.id });
      if (error) throw error;
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
  };

  const deleteForMe = async () => {
    try {
      const { error } = await supabase.rpc("delete_message_for_me", { _message_id: message.id });
      if (error) throw error;
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
  };

  const deleteForAll = async () => {
    try {
      const { error } = await supabase.rpc("delete_message_for_all", { _message_id: message.id });
      if (error) throw error;
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
  };

  const toNote = async () => {
    try {
      const { error } = await supabase.rpc("message_to_note", { _message_id: message.id });
      if (error) throw error;
      toast.success("Mensagem salva como nota");
    } catch (e) { toast.error((e as Error).message); }
  };

  const isOut = side === "out";
  const recent = Date.now() - new Date(message.created_at).getTime() < SEVEN_MIN_MS;
  const canDeleteForAll = isOut && recent;
  const starred = isStarred(message, user?.id);
  const pinned = isPinned(message);

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
          <Pin className="h-4 w-4 text-muted-foreground" /> {pinned ? "Desafixar" : "Fixar"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleStar} className="gap-3 px-4 py-2.5 text-[14px] cursor-pointer">
          <Star className={`h-4 w-4 ${starred ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground"}`} />
          {starred ? "Remover dos favoritos" : "Favoritar"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toNote} className="gap-3 px-4 py-2.5 text-[14px] cursor-pointer">
          <FileText className="h-4 w-4 text-muted-foreground" /> Salvar como nota
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
