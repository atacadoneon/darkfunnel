import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Inbox, User as UserIcon, MessageCircle, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ContactAvatar } from "./ContactAvatar";
import { EmptyState } from "@/components/EmptyState";
import {
  CONVERSATION_STATUS,
  type ConversationStatus,
  contactLabel,
  normalizeStatus,
} from "./conversationStatus";
import { useUpdateConversationStatus } from "./inboxFeatureHooks";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { usePresenceMap, type PresenceStatus } from "./usePresence";
import { MessageStatusIcon } from "@/components/messages/MessageStatusIcon";

import type { ConversationRow } from "./hooks";

type Props = {
  conversations: ConversationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const channelPalette: Record<string, string> = {
  whatsapp_cloud: "text-emerald-600",
  uazapi: "text-emerald-600",
};

function ChannelIcon({ kind, className }: { kind?: string; className?: string }) {
  if (kind === "whatsapp_cloud" || kind === "uazapi") {
    return <MessageCircle className={cn("text-emerald-600", className)} />;
  }
  return <Phone className={cn("text-muted-foreground", className)} />;
}

function AvatarWithPresence({
  user,
  presence,
}: {
  user?: { display_name?: string | null; email?: string | null; avatar_url?: string | null } | null;
  presence?: PresenceStatus;
}) {
  if (!user) {
    return (
      <div
        className="w-5 h-5 rounded-full border border-dashed border-border bg-muted flex items-center justify-center"
        title="Sem responsável"
      >
        <UserIcon className="w-3 h-3 text-muted-foreground" />
      </div>
    );
  }
  const name = user.display_name || user.email?.split("@")[0] || "?";
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const dotColor =
    presence === "online"
      ? "bg-emerald-500"
      : presence === "away"
        ? "bg-amber-500"
        : presence === "busy"
          ? "bg-rose-500"
          : "bg-rose-500"; // offline = vermelho
  return (
    <div className="relative shrink-0" title={`${name}${presence ? ` · ${presence}` : ""}`}>
      <Avatar className="w-5 h-5">
        {user.avatar_url && <AvatarImage src={user.avatar_url} alt={name} />}
        <AvatarFallback className="text-[9px] font-medium">{initial}</AvatarFallback>
      </Avatar>
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background",
          dotColor,
        )}
      />
    </div>
  );
}

function StatusBadge({
  conversationId,
  status,
}: {
  conversationId: string;
  status: ConversationStatus;
}) {
  const update = useUpdateConversationStatus();
  const cfg = CONVERSATION_STATUS[status];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="focus:outline-none"
          title={cfg.label}
        >
          <span
            className={cn(
              "inline-flex items-center gap-1 h-4 text-[9px] px-1.5 rounded-full border font-semibold uppercase tracking-wide",
              cfg.badge,
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
            {cfg.short}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64"
        onClick={(e) => e.stopPropagation()}
      >
        {(Object.keys(CONVERSATION_STATUS) as ConversationStatus[]).map((k) => {
          const s = CONVERSATION_STATUS[k];
          const active = k === status;
          return (
            <DropdownMenuItem
              key={k}
              className={cn("flex flex-col items-start gap-0.5 py-2", active && "bg-muted")}
              onClick={(e) => {
                e.stopPropagation();
                if (!active) update.mutate({ conversation_id: conversationId, status: k });
              }}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                <span className={cn("w-2 h-2 rounded-full", s.dot)} />
                {s.label}
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight pl-3.5">
                {s.description}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ConversationList({ conversations, selectedId, onSelect }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  const { data: members = [] } = useWorkspaceMembers();
  const membersMap = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const { data: presenceMap = {} } = usePresenceMap();

  return (
    <div ref={parentRef} className="h-full overflow-y-auto overscroll-contain scrollbar-hide">
      <div style={{ height: v.getTotalSize(), position: "relative" }}>
        {v.getVirtualItems().map((vi) => {
          const c = conversations[vi.index];
          const label = contactLabel(c.contacts);
          const time = c.last_message_at
            ? formatDistanceToNowStrict(new Date(c.last_message_at), { locale: ptBR, addSuffix: false })
            : "";
          const rawPreview = c.last_message_preview ?? "";
          const previewText = rawPreview.length > 64 ? rawPreview.slice(0, 64) + "…" : rawPreview;
          const status = normalizeStatus(c.status);
          const deal = c.open_deals?.[0];
          const valueBRL =
            deal?.value_cents != null
              ? `R$ ${(deal.value_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
              : null;
          const assigned = c.assigned_user_id ? membersMap[c.assigned_user_id] : null;
          const presence = c.assigned_user_id ? presenceMap[c.assigned_user_id]?.status : undefined;

          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "absolute left-0 right-0 px-2 py-2 flex items-center gap-2 text-left border-b border-border/40 hover:bg-muted/60 transition-colors",
                selectedId === c.id && "bg-muted",
              )}
              style={{ top: vi.start, height: vi.size }}
            >
              <ContactAvatar contact={c.contacts} size={36} />

              {/* Center column */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{label}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {time}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <ChannelIcon kind={c.channels?.kind} className="w-3 h-3 shrink-0" />
                  <span
                    className={cn(
                      "text-[11px] truncate",
                      c.unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground",
                    )}
                  >
                    {previewText || <span className="italic opacity-60">Sem mensagens</span>}
                  </span>
                </div>
              </div>

              {/* Right column */}
              <div className="flex flex-col items-end gap-1 shrink-0 min-w-[92px]">
                <div className="flex items-center gap-1.5 h-4">
                  {valueBRL && (
                    <span className="text-[11px] font-semibold text-emerald-600 tabular-nums">
                      {valueBRL}
                    </span>
                  )}
                  {c.unread_count > 0 && (
                    <Badge className="h-4 min-w-[18px] text-[10px] px-1 rounded-full justify-center">
                      {c.unread_count}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {deal?.pipeline_stages?.name && (
                    <span
                      className="text-[9px] text-muted-foreground border rounded px-1 py-px truncate max-w-[70px] leading-tight"
                      style={{
                        borderColor: deal.pipeline_stages.color ?? undefined,
                        color: deal.pipeline_stages.color ?? undefined,
                      }}
                      title={deal.pipeline_stages.name}
                    >
                      {deal.pipeline_stages.name}
                    </span>
                  )}
                  <StatusBadge conversationId={c.id} status={status} />
                  <AvatarWithPresence
                    user={assigned ?? undefined}
                    presence={presence as PresenceStatus | undefined}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {conversations.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="Nenhuma conversa por aqui"
          description="Quando novas mensagens chegarem ou você iniciar uma conversa, ela aparecerá nesta lista."
        />
      )}
    </div>
  );
}
