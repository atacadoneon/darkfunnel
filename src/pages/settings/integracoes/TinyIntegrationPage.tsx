import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChevronRight, ExternalLink, Loader2, Plug, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  useIntegrationConnection,
  useUpsertIntegrationConnection,
  useCreateSyncJob,
  useTriggerTinyImport,
  useSyncJob,
  useSyncJobs,
  useSyncLogs,
} from "@/hooks/integrations/useTinyIntegration";

const SLUG = "tiny_erp";

export default function TinyIntegrationPage() {
  const navigate = useNavigate();
  const { data: conn, isLoading } = useIntegrationConnection(SLUG);
  const isConnected = !!conn && conn.status === "active";

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <nav className="flex items-center text-sm text-muted-foreground gap-1">
        <button onClick={() => navigate("/settings/perfil")} className="hover:text-foreground">Configurações</button>
        <ChevronRight className="h-3 w-3" />
        <button onClick={() => navigate("/settings/integracoes")} className="hover:text-foreground">Integrações</button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Tiny ERP</span>
      </nav>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Plug className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tiny ERP</h1>
            <p className="text-sm text-muted-foreground">Sincronize produtos, clientes e propostas com o Tiny ERP.</p>
          </div>
        </div>
        <Badge className={isConnected ? "bg-emerald-600 hover:bg-emerald-600" : "bg-muted text-muted-foreground"}>
          {isLoading ? "..." : isConnected ? "Conectado" : "Desconectado"}
        </Badge>
      </header>

      <Tabs defaultValue="conexao">
        <TabsList>
          <TabsTrigger value="conexao">Conexão</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="propostas">Propostas</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="conexao"><ConexaoTab conn={conn} /></TabsContent>
        <TabsContent value="produtos"><EntityTab conn={conn} entity="products" /></TabsContent>
        <TabsContent value="clientes"><EntityTab conn={conn} entity="contacts" /></TabsContent>
        <TabsContent value="propostas"><PropostasTab conn={conn} /></TabsContent>
        <TabsContent value="logs"><LogsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============ CONEXÃO ============ */
function ConexaoTab({ conn }: { conn: any }) {
  const [version, setVersion] = useState<string>(conn?.provider_version ?? "v2");
  const [token, setToken] = useState<string>(conn?.credentials_jsonb?.api_token ?? "");
  const [testing, setTesting] = useState(false);
  const upsert = useUpsertIntegrationConnection();

  async function testConnection() {
    if (!token) return toast.error("Informe o token");
    setTesting(true);
    try {
      const r = await fetch(`https://api.tiny.com.br/api2/info.php?token=${encodeURIComponent(token)}&formato=json`);
      const j = await r.json();
      if (j?.retorno?.status === "OK") toast.success("Conexão OK");
      else toast.error("Token inválido ou erro Tiny");
    } catch {
      toast.message("API Tiny só responde via servidor; salve o token e clique Importar para validar");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="p-6 space-y-4 max-w-2xl">
      <div className="space-y-2">
        <Label>Versão da API</Label>
        <Select value={version} onValueChange={setVersion}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="v2">v2 (Token)</SelectItem>
            <SelectItem value="v3" disabled>v3 (OAuth — em breve)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Token de API</Label>
        <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="cole aqui o token Tiny" />
        <a href="https://www.tiny.com.br/ajuda/api2" target="_blank" rel="noreferrer" className="text-xs text-violet-600 inline-flex items-center gap-1">
          Como obter o token Tiny <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {conn?.last_sync_at && (
        <p className="text-xs text-muted-foreground">Última sincronização: {new Date(conn.last_sync_at).toLocaleString("pt-BR")}</p>
      )}
      <div className="flex gap-2">
        <Button variant="outline" onClick={testConnection} disabled={testing}>
          {testing && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Testar conexão
        </Button>
        <Button
          onClick={() => upsert.mutate({
            integration_slug: SLUG,
            provider_version: version,
            credentials_jsonb: { ...(conn?.credentials_jsonb ?? {}), api_token: token },
            status: "active",
          })}
          disabled={upsert.isPending}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar
        </Button>
      </div>
    </Card>
  );
}

/* ============ PRODUTOS / CLIENTES (mesmo layout) ============ */
const FIELD_MAPS: Record<string, Array<[string, string]>> = {
  products: [["id", "external_id"], ["nome", "name"], ["codigo", "sku"], ["preco", "price_cents"], ["unidade", "unidade"], ["situacao", "status"]],
  contacts: [["id", "external_id"], ["nome", "full_name"], ["fone", "phone_e164 (+55)"], ["email", "email"]],
};

function EntityTab({ conn, entity }: { conn: any; entity: "products" | "contacts" }) {
  const upsert = useUpsertIntegrationConnection();
  const createJob = useCreateSyncJob();
  const triggerImport = useTriggerTinyImport();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const scopeKey = entity === "products" ? "scope_products" : "scope_contacts";
  const sc = conn?.sync_config_jsonb ?? {};
  const autoSync = !!conn?.auto_sync_enabled;
  const frequency = sc.frequency ?? "manual";
  const scope = sc[scopeKey] ?? "todos";

  function patchConfig(patch: Record<string, any>) {
    upsert.mutate({
      integration_slug: SLUG,
      sync_config_jsonb: { ...sc, ...patch },
    });
  }

  async function runImport() {
    try {
      const jobType = entity === "products" ? "import_products" : "import_contacts";
      const jobId = await createJob.mutateAsync({ slug: SLUG, job_type: jobType });
      if (!jobId) throw new Error("Falha ao criar job");
      setActiveJobId(jobId);
      triggerImport.mutate({ job_id: jobId, entity });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao iniciar importação");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Configurações de Importação</h3>
        <div className="flex items-center justify-between">
          <div>
            <Label>Auto-sync</Label>
            <p className="text-xs text-muted-foreground">Sincronizar automaticamente</p>
          </div>
          <Switch checked={autoSync} onCheckedChange={(v) => upsert.mutate({ integration_slug: SLUG, auto_sync_enabled: v })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Frequência</Label>
            <Select value={frequency} onValueChange={(v) => patchConfig({ frequency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="hora">A cada hora</SelectItem>
                <SelectItem value="dia">Diariamente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>O que importar</Label>
            <Select value={scope} onValueChange={(v) => patchConfig({ [scopeKey]: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativos">Apenas ativos</SelectItem>
                <SelectItem value="modificados">Apenas modificados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Mapeamento de campos</Label>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Tiny</TableHead><TableHead>DarkFunnel</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {FIELD_MAPS[entity].map(([from, to]) => (
                <TableRow key={from}>
                  <TableCell className="font-mono text-xs">{from}</TableCell>
                  <TableCell className="font-mono text-xs">{to}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div>
          <Button onClick={runImport} disabled={createJob.isPending || triggerImport.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
            {(createJob.isPending || triggerImport.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Importar agora
          </Button>
        </div>
      </Card>

      <ProgressDialog jobId={activeJobId} onClose={() => setActiveJobId(null)} />
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    running: "bg-blue-500 hover:bg-blue-500 text-white",
    completed: "bg-emerald-600 hover:bg-emerald-600 text-white",
    failed: "bg-red-600 hover:bg-red-600 text-white",
  };
  return <Badge className={map[status] ?? "bg-muted"}>{status}</Badge>;
}

function ProgressDialog({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const { data: job } = useSyncJob(jobId);
  const pct = useMemo(() => {
    if (!job) return 0;
    const total = job.total_items ?? 0;
    const processed = job.processed_items ?? 0;
    return total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : (job.status === "completed" ? 100 : 5);
  }, [job]);

  const done = job?.status === "completed" || job?.status === "failed";

  return (
    <Dialog open={!!jobId} onOpenChange={(o) => { if (!o && done) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importação em andamento</DialogTitle>
          <DialogDescription>Acompanhe o progresso da sincronização.</DialogDescription>
        </DialogHeader>
        {!job ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Iniciando…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              {statusBadge(job.status)}
              <span className="text-xs text-muted-foreground">{job.processed_items ?? 0} / {job.total_items ?? "?"}</span>
            </div>
            <Progress value={pct} />
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div><div className="text-muted-foreground text-xs">Sucesso</div><div className="font-semibold text-emerald-600">{job.succeeded_items ?? 0}</div></div>
              <div><div className="text-muted-foreground text-xs">Erros</div><div className="font-semibold text-red-600">{job.failed_items ?? 0}</div></div>
              <div><div className="text-muted-foreground text-xs">Total</div><div className="font-semibold">{job.total_items ?? 0}</div></div>
            </div>
            {done && (
              <Button onClick={onClose} className="w-full">Fechar</Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ============ PROPOSTAS ============ */
function PropostasTab({ conn }: { conn: any }) {
  const upsert = useUpsertIntegrationConnection();
  const sc = conn?.sync_config_jsonb ?? {};
  const exportOnApprove = !!sc.export_proposals_on_approve;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>Enviar propostas para o Tiny automaticamente quando aprovada</Label>
          <p className="text-xs text-muted-foreground">Ao aprovar uma proposta, será criado um pedido correspondente no Tiny via API.</p>
        </div>
        <Switch
          checked={exportOnApprove}
          onCheckedChange={(v) => upsert.mutate({ integration_slug: SLUG, sync_config_jsonb: { ...sc, export_proposals_on_approve: v } })}
        />
      </div>
      <div className="border rounded-md p-8 text-center text-sm text-muted-foreground">Nenhuma proposta exportada ainda</div>
    </Card>
  );
}

/* ============ LOGS ============ */
function LogsTab() {
  const { data: jobs = [], refetch, isFetching } = useSyncJobs(SLUG);
  const [openJob, setOpenJob] = useState<string | null>(null);

  const typeLabel = (t: string) =>
    t === "import_products" ? "Importar Produtos" : t === "import_contacts" ? "Importar Clientes" : t;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Sucesso</TableHead>
              <TableHead>Erro</TableHead>
              <TableHead>Iniciado</TableHead>
              <TableHead>Concluído</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum job ainda</TableCell></TableRow>
            )}
            {jobs.map((j) => (
              <TableRow key={j.id}>
                <TableCell><Badge variant="outline">{typeLabel(j.job_type)}</Badge></TableCell>
                <TableCell>{statusBadge(j.status)}</TableCell>
                <TableCell>{j.total_items ?? "-"}</TableCell>
                <TableCell className="text-emerald-600">{j.succeeded_items ?? 0}</TableCell>
                <TableCell className="text-red-600">{j.failed_items ?? 0}</TableCell>
                <TableCell className="text-xs">{j.started_at ? new Date(j.started_at).toLocaleString("pt-BR") : "-"}</TableCell>
                <TableCell className="text-xs">{j.finished_at ? new Date(j.finished_at).toLocaleString("pt-BR") : "-"}</TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => setOpenJob(j.id)}>Ver detalhes</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <JobLogsSheet jobId={openJob} onClose={() => setOpenJob(null)} />
    </div>
  );
}

function JobLogsSheet({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const { data: logs = [], isLoading } = useSyncLogs(jobId);
  return (
    <Sheet open={!!jobId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader><SheetTitle>Logs do Job</SheetTitle></SheetHeader>
        <div className="mt-4">
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>External ID</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem logs</TableCell></TableRow>}
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.external_id ?? "-"}</TableCell>
                    <TableCell className="text-xs">{l.action ?? "-"}</TableCell>
                    <TableCell>{statusBadge(l.status)}</TableCell>
                    <TableCell className="text-xs text-red-600">{l.error_message ?? "-"}</TableCell>
                    <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
