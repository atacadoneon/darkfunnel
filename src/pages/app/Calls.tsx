import { useMemo, useState } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing, MessageCircle, Download, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { useCallsList, formatDuration, type CallRow } from "@/features/voice/hooks";
import { formatBRL } from "@/features/wallet/hooks";
import { useDialer } from "@/features/voice/VoiceProvider";
import { CallDrawer } from "@/features/voice/CallDrawer";
import Dialer from "@/pages/app/Dialer";
import { format } from "date-fns";

export default function Calls() {
  const { open } = useDialer();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [direction, setDirection] = useState("");
  const [channel, setChannel] = useState("");
  const [outcome, setOutcome] = useState("");
  const [minDur, setMinDur] = useState("");
  const [selected, setSelected] = useState<CallRow | null>(null);

  const filters = useMemo(() => ({
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
    direction: direction || undefined,
    channel: channel || undefined,
    outcome: outcome || undefined,
    minDuration: minDur ? Number(minDur) : undefined,
  }), [from, to, direction, channel, outcome, minDur]);

  const { data: calls = [], isLoading } = useCallsList(filters);

  const kpis = useMemo(() => {
    const total = calls.length;
    const tdur = calls.reduce((a, c) => a + (c.duration_seconds ?? 0), 0);
    const connected = calls.filter(c => (c.duration_seconds ?? 0) > 0).length;
    const cost = calls.reduce((a, c) => a + (c.cost_cents ?? 0), 0);
    return { total, tdur, conn: total ? (connected / total) * 100 : 0, cost };
  }, [calls]);

  const exportXlsx = async () => {
    const xlsx = await import("xlsx");
    const rows = calls.map(c => ({
      Data: c.initiated_at ? format(new Date(c.initiated_at), "yyyy-MM-dd HH:mm") : "",
      Contato: c.contact?.display_name ?? c.contact?.phone_e164 ?? "",
      De: c.from_number, Para: c.to_number,
      Direção: c.direction, Canal: c.channel,
      Duração: formatDuration(c.duration_seconds), Outcome: c.outcome,
      Custo: (c.cost_cents ?? 0) / 100,
    }));
    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Ligações");
    xlsx.writeFile(wb, `ligacoes_${Date.now()}.xlsx`);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b px-3 h-10 flex items-center gap-2 sticky top-0 bg-background z-10">
        <Phone className="h-3.5 w-3.5 text-primary" />
        <h1 className="text-sm font-medium">Ligações</h1>
        <span className="text-[11px] text-muted-foreground">· {calls.length}</span>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportXlsx} disabled={calls.length === 0}>
          <Download className="h-3 w-3 mr-1" /> Exportar
        </Button>
      </div>
      <div className="p-3 space-y-3">

      <Card className="p-3 flex flex-wrap gap-2 items-end">
        <div><label className="text-xs text-muted-foreground">De</label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 w-36" /></div>
        <div><label className="text-xs text-muted-foreground">Até</label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 w-36" /></div>
        <div>
          <label className="text-xs text-muted-foreground">Direção</label>
          <Select value={direction || "all"} onValueChange={v => setDirection(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="outbound">Saída</SelectItem>
              <SelectItem value="inbound">Entrada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Canal</label>
          <Select value={channel || "all"} onValueChange={v => setChannel(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pstn">VoIP</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Outcome</label>
          <Input value={outcome} onChange={e => setOutcome(e.target.value)} placeholder="…" className="h-8 w-32" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Duração min (s)</label>
          <Input type="number" value={minDur} onChange={e => setMinDur(e.target.value)} className="h-8 w-24" />
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-xl font-bold">{kpis.total}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Tempo total</div><div className="text-xl font-bold">{formatDuration(kpis.tdur)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Taxa conexão</div><div className="text-xl font-bold">{kpis.conn.toFixed(0)}%</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Custo total</div><div className="text-xl font-bold">{formatBRL(kpis.cost)}</div></Card>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-6 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : calls.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="Nenhuma ligação ainda"
            description="Faça sua primeira chamada pelo Dialer."
            action={<Button onClick={() => open()}><Phone className="h-4 w-4 mr-1" /> Fazer minha primeira ligação</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>De → Para</TableHead>
                <TableHead>Dir.</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map(c => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                  <TableCell className="text-xs">{c.initiated_at ? format(new Date(c.initiated_at), "dd/MM HH:mm") : "—"}</TableCell>
                  <TableCell className="text-sm">{c.contact?.display_name ?? c.contact?.phone_e164 ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{c.from_number} → {c.to_number}</TableCell>
                  <TableCell>{c.direction === "inbound" ? <PhoneIncoming className="h-3.5 w-3.5 text-emerald-500" /> : <PhoneOutgoing className="h-3.5 w-3.5 text-sky-500" />}</TableCell>
                  <TableCell>
                    {c.channel === "whatsapp" ? <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30"><MessageCircle className="h-3 w-3 mr-1" />WhatsApp</Badge>
                      : <Badge variant="outline"><Phone className="h-3 w-3 mr-1" />VoIP</Badge>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{formatDuration(c.duration_seconds)}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{c.outcome ?? "—"}</Badge></TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatBRL(c.cost_cents ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <CallDrawer call={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
      </div>
    </div>
  );
}

export { FileText };
