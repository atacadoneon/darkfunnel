import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Server, History } from "lucide-react";
import { toast } from "sonner";
import { useIsManagerOrAdmin, useMyRole } from "@/features/workspace/permissions";
import { useMcpCatalog, useMcpOverrides, useMcpSettings, useToggleMcpTool, useBulkToggleMcpTools } from "@/hooks/useMcpCatalog";
import { ApiTokensSection } from "@/components/mcp/ApiTokensSection";
import { ToolCard } from "@/components/mcp/ToolCard";
import { InvocationLogDrawer } from "@/components/mcp/InvocationLogDrawer";

const MCP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp`;

const CATEGORY_LABELS: Record<string, string> = {
  leads: "Leads",
  deals: "Negócios",
  conversations: "Conversas",
  activities: "Atividades",
  tags: "Tags",
  lists: "Listas",
  products: "Produtos",
  custom_fields: "Campos Adicionais",
  pipelines: "Pipelines",
  agents: "Atendentes",
  loss_reasons: "Motivos de Perda",
  hours: "Horários",
  departments: "Departamentos",
  connections: "Conexões",
};

export default function MCPServerSettingsPage() {
  const allowed = useIsManagerOrAdmin();
  const { isLoading: roleLoading } = useMyRole();
  const settings = useMcpSettings();
  const { data: catalog = [] } = useMcpCatalog();
  const { data: overrides = [] } = useMcpOverrides();
  const toggle = useToggleMcpTool();
  const bulk = useBulkToggleMcpTools();
  const [logOpen, setLogOpen] = useState(false);

  const overrideMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const o of overrides) m[o.tool_slug] = o.enabled;
    return m;
  }, [overrides]);

  const categories = useMemo(() => {
    const seen = new Map<string, number>();
    for (const t of catalog) seen.set(t.category, (seen.get(t.category) ?? 0) + 1);
    return Array.from(seen.keys());
  }, [catalog]);

  const [activeCat, setActiveCat] = useState<string | undefined>(undefined);
  const tab = activeCat ?? categories[0];

  if (roleLoading) return null;
  if (!allowed) return <Navigate to="/dashboard" replace />;

  const isEnabled = (slug: string, def: boolean) =>
    overrideMap[slug] ?? def;

  const copyUrl = () => { navigator.clipboard.writeText(MCP_URL); toast.success("URL copiada"); };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Server className="h-5 w-5" /> Servidor MCP
          </h1>
          <p className="text-sm text-muted-foreground">Conecte seu agente de IA ao CRM via Model Context Protocol.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setLogOpen(true)}>
          <History className="h-4 w-4 mr-1" /> Log de invocações
        </Button>
      </div>

      {/* Toggle global */}
      <Card className="p-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold">Servidor MCP</h3>
          <p className="text-sm text-muted-foreground">Ativar ou desativar o servidor MCP globalmente</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={settings.data?.server_enabled ? "default" : "outline"}>
            {settings.data?.server_enabled ? "Ativado" : "Desativado"}
          </Badge>
          <Switch
            checked={!!settings.data?.server_enabled}
            onCheckedChange={(v) => settings.setEnabled.mutate(v)}
          />
        </div>
      </Card>

      {/* Conexão */}
      <Card className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold">Informações de Conexão</h3>
          <p className="text-sm text-muted-foreground">Use essas informações para conectar seu agente de IA ao servidor MCP.</p>
        </div>
        <div>
          <label className="text-xs uppercase text-muted-foreground">URL Endpoint</label>
          <div className="flex items-center gap-2 mt-1">
            <Input readOnly value={MCP_URL} className="font-mono text-xs" />
            <Button size="icon" variant="outline" onClick={copyUrl}><Copy className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase text-muted-foreground">Autenticação</label>
          <p className="text-sm mt-1">
            Envie seu token de API no cabeçalho <code className="text-xs bg-muted px-1 py-0.5 rounded">Authorization</code> como <strong>Bearer token</strong>.
          </p>
        </div>
        <ApiTokensSection />
      </Card>

      {/* Ferramentas */}
      <Card className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold">Ferramentas MCP</h3>
          <p className="text-sm text-muted-foreground">Gerencie as configurações individuais das ferramentas</p>
        </div>

        {categories.length === 0 ? (
          <div className="text-sm text-muted-foreground">Carregando catálogo…</div>
        ) : (
          <Tabs value={tab} onValueChange={setActiveCat}>
            <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1">
              {categories.map((c) => {
                const tools = catalog.filter((t) => t.category === c);
                const enabledN = tools.filter((t) => isEnabled(t.slug, t.default_enabled)).length;
                return (
                  <TabsTrigger key={c} value={c} className="text-xs">
                    {CATEGORY_LABELS[c] ?? c} <span className="ml-1 text-muted-foreground">{enabledN}/{tools.length}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {categories.map((c) => {
              const tools = catalog.filter((t) => t.category === c);
              const enabledN = tools.filter((t) => isEnabled(t.slug, t.default_enabled)).length;
              return (
                <TabsContent key={c} value={c} className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{enabledN} de {tools.length} habilitadas</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline"
                        onClick={() => bulk.mutate({ slugs: tools.map((t) => t.slug), enabled: true })}>
                        Habilitar todas
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => bulk.mutate({ slugs: tools.map((t) => t.slug), enabled: false })}>
                        Desabilitar todas
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {tools.map((t) => (
                      <ToolCard
                        key={t.slug}
                        tool={t}
                        enabled={isEnabled(t.slug, t.default_enabled)}
                        onToggle={(v) => toggle.mutate({ slug: t.slug, enabled: v })}
                      />
                    ))}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </Card>

      <InvocationLogDrawer open={logOpen} onOpenChange={setLogOpen} />
    </div>
  );
}
