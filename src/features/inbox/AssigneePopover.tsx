import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspaceMembers, type WorkspaceRole } from "@/features/workspace/permissions";
import { useAssignConversation } from "./inboxFeatureHooks";
import { cn } from "@/lib/utils";

const roleLabel: Record<WorkspaceRole, string> = {
  owner: "Dono",
  admin: "Admin",
  manager: "Gerente",
  member: "Vendedor",
};

const palette = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-cyan-500", "bg-pink-500", "bg-orange-500"];
function colorFor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

export function AssigneePopover({
  conversationId,
  assignedUserId,
}: {
  conversationId: string;
  assignedUserId: string | null;
}) {
  const { data: members = [] } = useWorkspaceMembers();
  const assign = useAssignConversation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const current = members.find((m) => m.user_id === assignedUserId);
  const currentLabel = current?.display_name || current?.email?.split("@")[0] || "Sem responsável";

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return members;
    return members.filter((m) =>
      (m.display_name ?? "").toLowerCase().includes(t) ||
      (m.email ?? "").toLowerCase().includes(t)
    );
  }, [members, q]);

  const initials = (m: { display_name?: string | null; email?: string | null }) => {
    const n = m.display_name || m.email || "?";
    const parts = n.replace(/@.*/, "").split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <span className={cn("h-5 w-5 rounded-full text-white text-[10px] font-semibold flex items-center justify-center",
            current ? colorFor(current.user_id) : "bg-muted-foreground/40"
          )}>
            {current ? initials(current) : "?"}
          </span>
          <span className="text-xs max-w-[110px] truncate">{currentLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar usuário..."
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>
        <div className="px-2 pt-2 pb-1 text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">
          Membros da equipe
        </div>
        <div className="max-h-72 overflow-y-auto pb-2">
          <button
            type="button"
            onClick={() => { assign.mutate({ conversation_id: conversationId, user_id: null }); setOpen(false); }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50",
              !assignedUserId && "bg-muted/30"
            )}
          >
            <span className="h-7 w-7 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[10px]">—</span>
            <span className="flex-1 text-left">Sem responsável</span>
            {!assignedUserId && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
          {filtered.map((m) => {
            const active = m.user_id === assignedUserId;
            return (
              <button
                key={m.user_id}
                type="button"
                onClick={() => { assign.mutate({ conversation_id: conversationId, user_id: m.user_id }); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-sm group",
                  active ? "bg-emerald-500/15 hover:bg-emerald-500/20" : "hover:bg-muted/50"
                )}
              >
                <span className={cn("h-7 w-7 rounded-full text-white text-[10px] font-semibold flex items-center justify-center", colorFor(m.user_id))}>
                  {initials(m)}
                </span>
                <span className="flex-1 text-left truncate">
                  {m.display_name || m.email?.split("@")[0] || m.user_id.slice(0, 8)}
                </span>
                <span className="text-[10px] text-muted-foreground">{roleLabel[m.role]}</span>
                {active && <Check className="h-3.5 w-3.5 text-emerald-600" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhum membro encontrado</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
