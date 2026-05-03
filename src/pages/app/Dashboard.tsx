import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeals, useStages, formatMoney } from "@/features/pipeline/hooks";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import {
  TrendingUp,
  DollarSign,
  Target,
  Trophy,
  XCircle,
  ArrowRight,
  Plus,
  Activity,
} from "lucide-react";

export default function Dashboard() {
  const { current } = useWorkspace();
  const { data: stages, isLoading: loadingStages } = useStages();
  const { data: deals, isLoading: loadingDeals } = useDeals();

  const metrics = useMemo(() => {
    const all = deals ?? [];
    const open = all.filter((d) => d.status === "open");
    const won = all.filter((d) => d.status === "won");
    const lost = all.filter((d) => d.status === "lost");
    const sum = (arr: typeof all) => arr.reduce((a, d) => a + (d.value_cents ?? 0), 0);
    const closed = won.length + lost.length;
    const winRate = closed > 0 ? (won.length / closed) * 100 : 0;
    return {
      openCount: open.length,
      openValue: sum(open),
      wonCount: won.length,
      wonValue: sum(won),
      lostCount: lost.length,
      winRate,
      total: all.length,
    };
  }, [deals]);

  const byStage = useMemo(() => {
    const map = new Map<string, number>();
    (deals ?? []).forEach((d) => {
      if (d.status === "open") map.set(d.stage_id, (map.get(d.stage_id) ?? 0) + 1);
    });
    return (stages ?? []).map((s) => ({ ...s, count: map.get(s.id) ?? 0 }));
  }, [deals, stages]);

  const recent = useMemo(
    () =>
      [...(deals ?? [])]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [deals]
  );

  const loading = loadingStages || loadingDeals;
  const maxStage = Math.max(1, ...byStage.map((s) => s.count));

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral de {current?.name ?? "seu workspace"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild size="sm">
            <Link to="/app/pipeline">
              Ver pipeline <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/app/pipeline">
              <Plus className="mr-1 h-4 w-4" /> Novo deal
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Target className="h-4 w-4" />}
          label="Negócios abertos"
          value={loading ? null : String(metrics.openCount)}
          hint={loading ? null : formatMoney(metrics.openValue)}
        />
        <KpiCard
          icon={<Trophy className="h-4 w-4 text-emerald-500" />}
          label="Ganhos"
          value={loading ? null : String(metrics.wonCount)}
          hint={loading ? null : formatMoney(metrics.wonValue)}
        />
        <KpiCard
          icon={<XCircle className="h-4 w-4 text-rose-500" />}
          label="Perdidos"
          value={loading ? null : String(metrics.lostCount)}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
          label="Win rate"
          value={loading ? null : `${metrics.winRate.toFixed(0)}%`}
          hint={loading ? null : `${metrics.total} deals totais`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Funnel by stage */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Funil por estágio</CardTitle>
            <Badge variant="secondary" className="text-xs">
              <Activity className="mr-1 h-3 w-3" /> tempo real
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))
              : byStage.length === 0
              ? <p className="text-sm text-muted-foreground">Sem estágios configurados.</p>
              : byStage.map((s) => (
                  <div key={s.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="font-medium">{s.name}</span>
                      </div>
                      <span className="text-muted-foreground">{s.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(s.count / maxStage) * 100}%`,
                          backgroundColor: s.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>

        {/* Recent deals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atividade recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum deal ainda.</p>
            ) : (
              recent.map((d) => (
                <Link
                  key={d.id}
                  to="/app/pipeline"
                  className="flex items-center justify-between gap-2 rounded-md border border-border/50 p-2 hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{d.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">
                      {formatMoney(d.value_cents, d.currency)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  hint?: string | null;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        <div className="mt-2 text-2xl font-semibold">
          {value === null ? <Skeleton className="h-7 w-20" /> : value}
        </div>
        {hint !== undefined && (
          <div className="mt-1 text-xs text-muted-foreground">
            {hint === null ? <Skeleton className="h-3 w-16" /> : hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
