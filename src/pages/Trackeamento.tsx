import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { CampanhasTab } from "@/features/trackeamento/CampanhasTab";
import { AtribuicaoTab } from "@/features/trackeamento/AtribuicaoTab";
import { LandingPagesTab } from "@/features/trackeamento/LandingPagesTab";
import { FilaEnviosTab } from "@/features/trackeamento/FilaEnviosTab";
import { TrackingConfigDrawer } from "@/features/trackeamento/TrackingConfigDrawer";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";

function periodToDates(p: "7d" | "30d" | "90d"): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  const days = p === "7d" ? 7 : p === "30d" ? 30 : 90;
  start.setDate(start.getDate() - days);
  return { start, end };
}

export default function Trackeamento() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [channel, setChannel] = useState<"all" | "meta" | "google">("all");
  const [cfgOpen, setCfgOpen] = useState(false);
  const canManage = useIsManagerOrAdmin();
  const { start, end } = periodToDates(period);

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Trackeamento</h1>
          <p className="text-sm text-muted-foreground">Acompanhe atribuição de campanhas, landing pages e fila de envios.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 dias</SelectItem>
              <SelectItem value="30d">30 dias</SelectItem>
              <SelectItem value="90d">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="meta">Meta</SelectItem>
              <SelectItem value="google">Google</SelectItem>
            </SelectContent>
          </Select>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setCfgOpen(true)}>
              <Settings className="h-4 w-4 mr-1" /> Configurar
            </Button>
          )}
        </div>
      </header>

      <Tabs defaultValue="campanhas">
        <TabsList>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="atribuicao">Atribuição</TabsTrigger>
          <TabsTrigger value="landing">Landing Pages</TabsTrigger>
          <TabsTrigger value="fila">Fila de Envios</TabsTrigger>
        </TabsList>
        <TabsContent value="campanhas" className="mt-4">
          <CampanhasTab periodStart={start} periodEnd={end} channel={channel} />
        </TabsContent>
        <TabsContent value="atribuicao" className="mt-4">
          <AtribuicaoTab periodStart={start} periodEnd={end} channel={channel} />
        </TabsContent>
        <TabsContent value="landing" className="mt-4">
          <LandingPagesTab />
        </TabsContent>
        <TabsContent value="fila" className="mt-4">
          <FilaEnviosTab periodStart={start} />
        </TabsContent>
      </Tabs>

      <TrackingConfigDrawer open={cfgOpen} onClose={() => setCfgOpen(false)} />
    </div>
  );
}
