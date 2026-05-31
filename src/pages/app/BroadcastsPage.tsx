import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Send, Search, Pencil, Calendar, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { useBroadcasts, statusMeta, type BroadcastStatus } from "@/features/broadcasts/hooks";
import { useChannels } from "@/features/channels/hooks";
import { format } from "date-fns";

const TAB_FILTERS: Record<string, BroadcastStatus[] | null> = {
  all: null,
  draft: ["draft"],
  scheduled: ["scheduled"],
  running: ["running"],
  completed: ["completed"],
  cancelled: ["cancelled", "failed"],
};

export default function BroadcastsPage() {
  const nav = useNavigate();
  const { data: broadcasts = [], isLoading } = useBroadcasts();
  const { data: channels = [] } = useChannels();
  const [tab, setTab] = useState<string>("all");
  const [q, setQ] = useState("");

  const chMap = useMemo(() => new Map(channels.map((c: any) => [c.id, c])), [channels]);

  const filtered = useMemo(() => {
    const allowed = TAB_FILTERS[tab];
    return broadcasts.filter((b) => {
      if (allowed && !allowed.includes(b.status)) return false;
      if (q && !b.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [broadcasts, tab, q]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Send className="h-6 w-6 text-violet-500" />
            Disparo em Massa
          </h1>
          <p className="text-sm text-muted-foreground">
            Envie mensagens para listas filtradas de contatos e dispare ações automáticas.
          </p>
        </div>
        <Button
          className="bg-violet-600 hover:bg-violet-700 text-white"
          onClick={() => nav("/broadcasts/novo")}
        >
          <Plus className="h-4 w-4 mr-1.5" /> Novo Disparo
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-fit">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="draft">Rascunhos</TabsTrigger>
          <TabsTrigger value="scheduled">Agendados</TabsTrigger>
          <TabsTrigger value="running">Em execução</TabsTrigger>
          <TabsTrigger value="completed">Concluídos</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Send className="h-8 w-8 text-violet-500" />}
            title="Nenhum disparo encontrado"
            description="Crie seu primeiro disparo em massa para começar."
            action={
              <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={() => nav("/broadcasts/novo")}>
                <Plus className="h-4 w-4 mr-1.5" /> Novo Disparo
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">Destinatários</TableHead>
                <TableHead className="text-right">Enviadas</TableHead>
                <TableHead className="text-right">Falhadas</TableHead>
                <TableHead>Agendado para</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => {
                const meta = statusMeta(b.status);
                const ch = b.channel_id ? (chMap.get(b.channel_id) as any) : null;
                return (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link to={`/broadcasts/${b.id}`} className="font-medium hover:text-violet-500">
                        {b.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge className={meta.cls} variant="secondary">{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{ch?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{b.total_recipients ?? 0}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">{b.sent_count ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums text-red-500">{b.failed_count ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {b.scheduled_at ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(b.scheduled_at), "dd/MM/yyyy HH:mm")}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => nav(`/broadcasts/${b.id}`)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
