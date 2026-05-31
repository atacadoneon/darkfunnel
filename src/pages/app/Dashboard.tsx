import { TrendingUp, MessageCircle, Target, Filter, Trophy, Settings2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardFiltersProvider } from "@/contexts/DashboardFiltersContext";
import { DashboardFiltersBar } from "@/features/dashboard/DashboardFiltersBar";
import { CommercialView } from "@/features/dashboard/CommercialView";
import { AtendimentoView } from "@/features/dashboard/AtendimentoView";
import { TrafegoView } from "@/features/dashboard/TrafegoView";
import { FunilView } from "@/features/dashboard/FunilView";
import { MetasView } from "@/features/dashboard/MetasView";
import { PersonalizadoView } from "@/features/dashboard/PersonalizadoView";

const TABS = [
  { value: "comercial", label: "Comercial", icon: TrendingUp },
  { value: "atendimento", label: "Atendimento (SLA)", icon: MessageCircle },
  { value: "trafego", label: "Tráfego Pago", icon: Target },
  { value: "funil", label: "Funil", icon: Filter },
  { value: "metas", label: "Metas", icon: Trophy },
  { value: "personalizado", label: "Personalizado", icon: Settings2 },
] as const;

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="p-6">
      <Card className="p-10 border-dashed">
        <div className="max-w-md mx-auto text-center space-y-3">
          <div className="text-lg font-semibold">{title}</div>
          <p className="text-sm text-muted-foreground">
            Em construção — próximo build. Esta visão usará os filtros globais do topo.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-48" />
        </div>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  return (
    <DashboardFiltersProvider>
      <div className="flex flex-col min-h-full">
        <Tabs defaultValue="comercial" className="flex flex-col">
          <div className="border-b px-4 pt-4 bg-background">
            <TabsList className="h-auto bg-transparent p-0 gap-1 flex flex-wrap justify-start">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="gap-2 px-4 py-2.5 rounded-md text-sm font-medium border border-transparent
                               data-[state=active]:bg-accent data-[state=active]:text-accent-foreground
                               data-[state=active]:border-border data-[state=active]:shadow-none
                               relative
                               data-[state=active]:after:absolute data-[state=active]:after:left-3 data-[state=active]:after:right-3
                               data-[state=active]:after:-bottom-[1px] data-[state=active]:after:h-0.5
                               data-[state=active]:after:bg-primary data-[state=active]:after:rounded-full"
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <DashboardFiltersBar />

          <TabsContent value="comercial" className="mt-0"><CommercialView /></TabsContent>
          <TabsContent value="atendimento" className="mt-0"><AtendimentoView /></TabsContent>
          <TabsContent value="trafego" className="mt-0"><TrafegoView /></TabsContent>
          <TabsContent value="funil" className="mt-0"><FunilView /></TabsContent>
          <TabsContent value="metas" className="mt-0"><MetasView /></TabsContent>
          <TabsContent value="personalizado" className="mt-0"><ComingSoon title="Personalizado" /></TabsContent>
        </Tabs>
      </div>
    </DashboardFiltersProvider>
  );
}
