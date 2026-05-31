import { Link } from "react-router-dom";
import { Trophy, AlertTriangle, Star, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";
import { useGoalsProgress, type GoalProgress } from "@/hooks/useDashboard";

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format((cents ?? 0) / 100);

const SCOPE_LABEL: Record<string, string> = {
  workspace: "Workspace",
  department: "Departamento",
  user: "Vendedor",
};

function GoalRow({ g }: { g: GoalProgress }) {
  const pct = Math.min(100, Math.max(0, g.progress_pct ?? 0));
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate">{g.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] py-0">{SCOPE_LABEL[g.scope] ?? g.scope}</Badge>
            {g.scope_label && <span>· {g.scope_label}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums">{pct.toFixed(1)}%</div>
          <div className="text-[11px] text-muted-foreground">{g.days_remaining} dias restantes</div>
        </div>
      </div>
      <Progress value={pct} className="h-2 [&>div]:bg-primary" />
      <div className="flex items-center justify-between text-xs tabular-nums">
        <span className="text-foreground font-medium">{brl(g.current_cents)}</span>
        <span className="text-muted-foreground">de {brl(g.target_cents)}</span>
      </div>
    </div>
  );
}

export function MetasView() {
  const { filters } = useDashboardFilters();
  const { data: goals, isLoading } = useGoalsProgress(filters);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-40" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-40" /><Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (!goals || goals.length === 0) {
    return (
      <div className="p-6">
        <Card className="p-10 border-dashed text-center space-y-4">
          <Trophy className="h-10 w-10 mx-auto text-muted-foreground" />
          <div className="text-base font-semibold">Nenhuma meta criada</div>
          <p className="text-sm text-muted-foreground">Defina metas de receita para acompanhar o desempenho.</p>
          <Button asChild className="gap-2"><Link to="/metas"><Plus className="h-4 w-4" /> Criar meta</Link></Button>
        </Card>
      </div>
    );
  }

  const topUsers = [...goals]
    .filter((g) => g.scope === "user")
    .sort((a, b) => (b.progress_pct ?? 0) - (a.progress_pct ?? 0))
    .slice(0, 3);

  const atrasados = goals.filter((g) => (g.progress_pct ?? 0) < 50 && (g.period_elapsed_pct ?? 0) > 50);

  return (
    <div className="p-6 space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-primary" /> Metas ativas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {goals.map((g) => <GoalRow key={g.goal_id} g={g} />)}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Star className="h-4 w-4 text-amber-500" /> Vendedores em destaque</CardTitle>
          </CardHeader>
          <CardContent>
            {topUsers.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Sem metas individuais.</div>
            ) : (
              <div className="space-y-3">
                {topUsers.map((g, i) => (
                  <div key={g.goal_id} className="flex items-center gap-3">
                    <div className="text-lg font-semibold text-muted-foreground w-6 text-center">{i + 1}</div>
                    <Avatar className="h-9 w-9"><AvatarImage src={g.avatar_url ?? undefined} /><AvatarFallback>{(g.display_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{g.display_name ?? g.scope_label ?? "—"}</div>
                      <Progress value={Math.min(100, g.progress_pct ?? 0)} className="h-1.5 mt-1 [&>div]:bg-primary" />
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{(g.progress_pct ?? 0).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-destructive" /> Atrasados</CardTitle>
          </CardHeader>
          <CardContent>
            {atrasados.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Tudo no rumo certo 🎉</div>
            ) : (
              <div className="space-y-3">
                {atrasados.map((g) => (
                  <div key={g.goal_id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{g.name}</span>
                      <span className="text-destructive font-semibold tabular-nums">{(g.progress_pct ?? 0).toFixed(0)}%</span>
                    </div>
                    <Progress value={Math.min(100, g.progress_pct ?? 0)} className="h-1.5 [&>div]:bg-destructive" />
                    <div className="text-xs text-muted-foreground">Período {(g.period_elapsed_pct ?? 0).toFixed(0)}% decorrido</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
