import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { usePresenceMap, type PresenceStatus } from "@/features/inbox/usePresence";
import { cn } from "@/lib/utils";

function statusColor(s?: PresenceStatus) {
  return s === "online"
    ? "bg-emerald-500"
    : s === "away"
      ? "bg-amber-500"
      : s === "busy"
        ? "bg-rose-500"
        : "bg-zinc-400";
}
function statusLabel(s?: PresenceStatus) {
  return s === "online"
    ? "Online"
    : s === "away"
      ? "Ausente"
      : s === "busy"
        ? "Ocupado"
        : "Offline";
}

export default function EquipeOnline() {
  const { data: members = [] } = useWorkspaceMembers();
  const { data: presenceMap = {} } = usePresenceMap();

  const enriched = members.map((m) => ({
    ...m,
    presence: presenceMap[m.user_id]?.status as PresenceStatus | undefined,
    lastSeen: presenceMap[m.user_id]?.last_seen_at ?? null,
  }));
  const total = enriched.length;
  const online = enriched.filter((m) => m.presence === "online").length;
  const away = enriched.filter((m) => m.presence === "away").length;
  const offline = total - online - away;

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Equipe Online</h1>
          <p className="text-sm text-muted-foreground">
            Presença em tempo real da sua equipe.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-xl font-semibold">{total}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Online</div>
          <div className="text-xl font-semibold text-emerald-600">{online}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Ausente</div>
          <div className="text-xl font-semibold text-amber-600">{away}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Offline</div>
          <div className="text-xl font-semibold text-zinc-500">{offline}</div>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último visto</TableHead>
              <TableHead>Função</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enriched.map((m) => {
              const name = m.display_name || m.email?.split("@")[0] || "Usuário";
              const initial = name.charAt(0).toUpperCase();
              return (
                <TableRow key={m.user_id}>
                  <TableCell>
                    <div className="relative w-8 h-8">
                      <Avatar className="w-8 h-8">
                        {m.avatar_url && <AvatarImage src={m.avatar_url} alt={name} />}
                        <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
                          statusColor(m.presence),
                        )}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{name}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className={cn("w-2 h-2 rounded-full", statusColor(m.presence))} />
                      {statusLabel(m.presence)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.lastSeen
                      ? formatDistanceToNowStrict(new Date(m.lastSeen), {
                          locale: ptBR,
                          addSuffix: true,
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {m.role}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {enriched.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                  Nenhum membro encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
