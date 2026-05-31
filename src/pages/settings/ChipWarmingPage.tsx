import { useMemo } from "react";
import {
  Flame, ShieldAlert, Play, Pause, Power, Activity, Users, MessageCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { useChannels } from "@/features/channels/hooks";
import {
  useWarmingPool, useUpdateWarmingPool, useWarmingPoolStats,
  type WarmingPoolRow, type WarmingStatus,
} from "@/hooks/useChipWarming";
import { cn } from "@/lib/utils";

function scoreMeta(score: number) {
  if (score >= 71) return { label: "Quente", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" };
  if (score >= 31) return { label: "Morno",  cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300" };
  return { label: "Frio", cls: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300" };
}

function statusMeta(s: WarmingStatus) {
  const map: Record<WarmingStatus, { label: string; cls: string }> = {
    warming:  { label: "Aquecendo", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
    warm:     { label: "Quente",    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
    paused:   { label: "Pausado",   cls: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300" },
    disabled: { label: "Desativado",cls: "bg-red-500/15 text-red-600 dark:text-red-300" },
  };
  return map[s] ?? map.disabled;
}

export default function ChipWarmingPage() {
  const { data: channels = [] } = useChannels();
  const { data: pool = [] } = useWarmingPool();
  const update = useUpdateWarmingPool();
  const { data: stats } = useWarmingPoolStats();

  const poolByChannel = useMemo(() => {
    const m = new Map<string, WarmingPoolRow>();
    pool.forEach((p) => m.set(p.channel_id, p));
    return m;
  }, [pool]);

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Flame className="h-6 w-6 text-orange-500" />
          Aquecimento de Chip
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mantenha seus números WhatsApp aquecidos automaticamente trocando mensagens com a comunidade DarkFunnel.
        </p>
      </div>

      {/* Como funciona */}
      <Card className="p-5">
        <h2 className="font-semibold mb-3">Como funciona</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { n: 1, t: "Habilite seu canal",   d: "Ative o opt-in no número que deseja aquecer." },
            { n: 2, t: "Conversas naturais",   d: "O sistema simula trocas com outros números opt-in da pool." },
            { n: 3, t: "Score sobe diariamente", d: "Seu warm_score evolui conforme o uso saudável do número." },
          ].map((c) => (
            <div key={c.n} className="rounded-lg border bg-card/50 p-4">
              <div className="h-7 w-7 rounded-full bg-orange-500/15 text-orange-600 flex items-center justify-center text-sm font-semibold mb-2">
                {c.n}
              </div>
              <div className="font-medium text-sm">{c.t}</div>
              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.d}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Stats Pool */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-500/15 text-violet-500 flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums">{stats?.total_opt_in ?? "—"}</div>
            <div className="text-xs text-muted-foreground">Canais opt-in na pool global</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums">{stats?.messages_last_24h ?? "—"}</div>
            <div className="text-xs text-muted-foreground">Mensagens trocadas nas últimas 24h</div>
          </div>
        </Card>
      </div>

      {/* Tabela canais */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Seus canais</h2>
        </div>
        {channels.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground text-center">
            Nenhum canal conectado. Vá em <strong>Conexões</strong> para adicionar um número.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead>Opt-in</TableHead>
                <TableHead>Limite diário</TableHead>
                <TableHead className="text-right">Enviadas hoje</TableHead>
                <TableHead className="text-right">Recebidas hoje</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((ch: any) => {
                const row = poolByChannel.get(ch.id);
                const optIn = !!row?.opt_in;
                const limit = row?.daily_message_limit ?? 20;
                const sent = row?.current_day_sent ?? 0;
                const recv = row?.current_day_received ?? 0;
                const score = row?.warm_score ?? 0;
                const status = (row?.status ?? "disabled") as WarmingStatus;
                const sm = scoreMeta(score);
                const stm = statusMeta(status);
                const patch = (p: Partial<WarmingPoolRow>) =>
                  update.mutate({ channel_id: ch.id, patch: p });

                return (
                  <TableRow key={ch.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{ch.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{ch.phone_e164 ?? ch.number ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={optIn}
                        onCheckedChange={(v) =>
                          patch({ opt_in: v, status: v ? (status === "disabled" ? "warming" : status) : "disabled" })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={500}
                        defaultValue={limit}
                        className="h-8 w-20"
                        onBlur={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v) && v !== limit) patch({ daily_message_limit: v });
                        }}
                        disabled={!optIn}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{sent}</TableCell>
                    <TableCell className="text-right tabular-nums">{recv}</TableCell>
                    <TableCell>
                      <Badge className={cn(sm.cls)} variant="secondary">
                        {score} · {sm.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(stm.cls)} variant="secondary">{stm.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {status === "paused" ? (
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Retomar"
                            onClick={() => patch({ status: "warming" })}>
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Pausar"
                            disabled={!optIn || status === "disabled"}
                            onClick={() => patch({ status: "paused" })}>
                            <Pause className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" title="Desativar"
                          disabled={status === "disabled"}
                          onClick={() => patch({ opt_in: false, status: "disabled" })}>
                          <Power className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Disclaimers */}
      <Card className="p-4 bg-amber-500/5 border-amber-500/30">
        <div className="flex gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-300">Avisos de segurança</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Use apenas em números próprios da sua empresa.</li>
              <li>Aquecimento excessivo pode acionar bloqueio do WhatsApp — respeite os limites.</li>
              <li>Os contatos da pool são sempre outros números opt-in — nunca clientes reais.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
