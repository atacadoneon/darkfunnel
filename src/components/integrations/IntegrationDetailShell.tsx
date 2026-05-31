import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { Check, ChevronRight, ExternalLink, Loader2, Plug, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OAuthAppCredentialsCard } from "@/features/integrations/OAuthAppCredentialsCard";
import { useOAuthAppMetadata } from "@/hooks/useOAuthApps";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import {
  useIntegrationConnection,
  useUpsertIntegrationConnection,
  useCreateSyncJob,
  useSyncJob,
  useSyncJobs,
  useSyncLogs,
} from "@/hooks/integrations/useTinyIntegration";

export type IntegrationShellProps = {
  slug: "tiny_erp" | "bling";
  name: string;
  supportsV2: boolean;
  v2HelpUrl: string;
  oauthAuthorizeFunction: string;
  syncFunction: string;
  v2ImportFunction?: string;
};

export function IntegrationDetailShell(props: IntegrationShellProps) {
  const navigate = useNavigate();
  const { data: conn, isLoading, refetch } = useIntegrationConnection(props.slug);
  const status = conn?.status ?? "disconnected";
  const isConnected = status === "active";

  // Polling: when status is 'pending_oauth' or similar, poll for change.
  useEffect(() => {
    if (status === "pending_oauth" || status === "connecting") {
      const t = setInterval(() => refetch(), 3000);
      return () => clearInterval(t);
    }
  }, [status, refetch]);

  const statusColor =
    isConnected ? "bg-emerald-600 hover:bg-emerald-600"
    : status === "error" ? "bg-red-600 hover:bg-red-600 text-white"
    : "bg-muted text-muted-foreground";
  const statusLabel = isLoading ? "..." : isConnected ? "Conectado" : status === "error" ? "Erro" : "Desconectado";

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <nav className="flex items-center text-sm text-muted-foreground gap-1">
        <button onClick={() => navigate("/settings/perfil")} className="hover:text-foreground">Configurações</button>
        <ChevronRight className="h-3 w-3" />
        <button onClick={() => navigate("/settings/integracoes")} className="hover:text-foreground">Integrações</button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{props.name}</span>
      </nav>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Plug className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{props.name}</h1>
            <p className="text-sm text-muted-foreground">
              Sincronize produtos, clientes e propostas com o {props.name}.
            </p>
            {conn?.last_sync_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Última sincronização: {new Date(conn.last_sync_at).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        </div>
        <Badge className={statusColor}>{statusLabel}</Badge>
      </header>

      <Tabs defaultValue="conexao">
        <TabsList>
          <TabsTrigger value="conexao">Conexão</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="propostas">Propostas</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="conexao"><ConexaoTab conn={conn} props={props} /></TabsContent>
        <TabsContent value="produtos"><EntityTab conn={conn} entity="products" props={props} /></TabsContent>
        <TabsContent value="clientes"><EntityTab conn={conn} entity="contacts" props={props} /></TabsContent>
        <TabsContent value="propostas"><PropostasTab conn={conn} props={props} /></TabsContent>
        <TabsContent value="logs"><LogsTab slug={props.slug} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============ CONEXÃO ============ */
function ConexaoTab({ conn, props }: { conn: any; props: IntegrationShellProps }) {
  const { data: oauthMeta } = useOAuthAppMetadata(props.slug);
  const oauthReady = !!(oauthMeta?.has_secret && oauthMeta?.client_id);

  const derivedDefaultVersion = useMemo(() => {
    if (conn?.status === "active" && conn?.provider_version) return conn.provider_version;
    if (oauthMeta?.has_secret && oauthMeta?.client_id) return "v3";
    if (conn?.credentials_jsonb?.api_token) return props.supportsV2 ? "v2" : "v3";
    return "v3";
  }, [conn, oauthMeta, props.supportsV2]);

  const [version, setVersion] = useState<string>(derivedDefaultVersion);
  useEffect(() => { setVersion(derivedDefaultVersion); }, [derivedDefaultVersion]);

  const [token, setToken] = useState<string>(conn?.credentials_jsonb?.api_token ?? "");
  useEffect(() => { setToken(conn?.credentials_jsonb?.api_token ?? ""); }, [conn?.credentials_jsonb?.api_token]);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const upsert = useUpsertIntegrationConnection();

  const activeVersion = conn?.status === "active" ? conn?.provider_version : null;
  const connectedAtRaw = (conn as any)?.connected_at ?? conn?.last_sync_at ?? null;
  const connectedAtLabel = connectedAtRaw ? new Date(connectedAtRaw).toLocaleDateString("pt-BR") : null;

  async function testConnection() {
    if (!token) return toast.error("Informe o token");
    setTesting(true);
    try {
      const r = await fetch(`https://api.tiny.com.br/api2/info.php?token=${encodeURIComponent(token)}&formato=json`);
      const j = await r.json();
      if (j?.retorno?.status === "OK") toast.success("Conexão OK");
      else toast.error("Token inválido");
    } catch {
      toast.message("Validação completa só via servidor — salve e teste com Importar.");
    } finally {
      setTesting(false);
    }
  }

  function focusCredentialsCard() {
    const el = document.getElementById("oauth-credentials-card");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-violet-500");
      setTimeout(() => el.classList.remove("ring-2", "ring-violet-500"), 2000);
    }
  }

  async function startOAuth() {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke(props.oauthAuthorizeFunction, {
        body: { redirect_to: window.location.href },
      });
      if (error) throw error;
      const payload = data as any;
      if (payload?.ok === false && payload?.error === "oauth_app_not_configured") {
        toast.error("Cadastre as credenciais OAuth antes de conectar.");
        focusCredentialsCard();
        return;
      }
      const url = payload?.authorize_url ?? payload?.url;
      if (!url) throw new Error("URL OAuth não retornada");
      window.open(url, "_blank", "width=600,height=700");
      toast.message("Conclua a autorização na janela aberta.");
    } catch (e: any) {
      const msg = e?.message ?? "Falha ao iniciar OAuth";
      if (String(msg).includes("oauth_app_not_configured")) {
        toast.error("Cadastre as credenciais OAuth antes de conectar.");
        focusCredentialsCard();
      } else {
        toast.error(msg);
      }
    } finally {
      setConnecting(false);
    }
  }

  const isV3Connected = conn?.provider_version === "v3" && conn?.status === "active";

  const showV3 = !(version === "v2" && props.supportsV2);
  const connectBtn = (
    <Button
      onClick={startOAuth}
      disabled={connecting || !oauthReady}
      className="bg-violet-600 hover:bg-violet-700 text-white"
    >
      {connecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
      Conectar com {props.name}
    </Button>
  );
  const reconnectBtn = (
    <Button variant="outline" onClick={startOAuth} disabled={connecting || !oauthReady}>
      {connecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Reconectar
    </Button>
  );

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4 max-w-2xl">
        <div>
          {conn?.status === "active" ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1">
              <Check className="h-3 w-3" />
              Conectado via {conn?.provider_version}
              {connectedAtLabel ? ` desde ${connectedAtLabel}` : ""}
            </Badge>
          ) : conn?.status === "error" ? (
            <Badge className="bg-red-600 hover:bg-red-600 text-white">Conexão com erro — reconecte</Badge>
          ) : (
            <Badge variant="secondary">Não conectado</Badge>
          )}
        </div>
        <div className="space-y-2">
          <Label>Versão da API</Label>
          <Select value={version} onValueChange={setVersion}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {props.supportsV2 && (
                <SelectItem value="v2">
                  v2 (Token API){activeVersion === "v2" ? " ✓ Conectado" : ""}
                </SelectItem>
              )}
              <SelectItem value="v3">
                v3 (OAuth 2.0){activeVersion === "v3" ? " ✓ Conectado" : ""}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!showV3 ? (
          <>
            <div className="space-y-2">
              <Label>Token de API</Label>
              <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="cole aqui o token" />
              <a href={props.v2HelpUrl} target="_blank" rel="noreferrer" className="text-xs text-violet-600 inline-flex items-center gap-1">
                Como obter o token <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={testConnection} disabled={testing}>
                {testing && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Testar conexão
              </Button>
              <Button
                onClick={() => upsert.mutate({
                  integration_slug: props.slug,
                  provider_version: "v2",
                  credentials_jsonb: { ...(conn?.credentials_jsonb ?? {}), api_token: token },
                  status: "active",
                })}
                disabled={upsert.isPending}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar
              </Button>
            </div>
          </>
        ) : null}
      </Card>

      {showV3 && (
        <>
          <OAuthAppCredentialsCard slug={props.slug} />

          <Card className="p-6 space-y-3 max-w-2xl">
            {isV3Connected ? (
              <>
                <div className="rounded-md border p-3 text-sm">
                  <div className="font-medium">Conta conectada</div>
                  <div className="text-xs text-muted-foreground">
                    {conn?.credentials_jsonb?.account_name ?? "Conta OAuth ativa"}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!oauthReady ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild><span>{reconnectBtn}</span></TooltipTrigger>
                        <TooltipContent>Cadastre as credenciais antes de conectar</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : reconnectBtn}
                  <Button
                    variant="outline"
                    onClick={() => upsert.mutate({ integration_slug: props.slug, status: "disconnected" })}
                  >
                    Desconectar
                  </Button>
                </div>
              </>
            ) : !oauthReady ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild><span>{connectBtn}</span></TooltipTrigger>
                  <TooltipContent>Cadastre as credenciais antes de conectar</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : connectBtn}
            <a href={props.v2HelpUrl} target="_blank" rel="noreferrer" className="text-xs text-violet-600 inline-flex items-center gap-1">
              Documentação OAuth <ExternalLink className="h-3 w-3" />
            </a>
          </Card>
        </>
      )}
    </div>
  );
}

/* ============ PRODUTOS / CLIENTES ============ */
const FIELD_MAPS: Record<string, Array<[string, string]>> = {
  products: [["id", "external_id"], ["nome", "name"], ["codigo", "sku"], ["preco", "price_cents (x100)"], ["unidade", "unidade"], ["situacao", "status"]],
  contacts: [["id", "external_id"], ["nome", "full_name"], ["fone", "phone_e164 (+55)"], ["email", "email"]],
};

function EntityTab({ conn, entity, props }: { conn: any; entity: "products" | "contacts"; props: IntegrationShellProps }) {
  const upsert = useUpsertIntegrationConnection();
  const createJob = useCreateSyncJob();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const sc = conn?.sync_config_jsonb ?? {};
  const autoSync = !!conn?.auto_sync_enabled;
  const frequency = sc.auto_sync_frequency ?? "manual";
  const filterKey = entity === "products" ? "product_filter" : "contact_filter";
  const filter = sc[filterKey] ?? "todos";

  function patchConfig(patch: Record<string, any>) {
    upsert.mutate({ integration_slug: props.slug, sync_config_jsonb: { ...sc, ...patch } });
  }

  async function runImport() {
    setRunning(true);
    try {
      const jobType = entity === "products" ? "import_products" : "import_contacts";
      const jobId = await createJob.mutateAsync({ slug: props.slug, job_type: jobType });
      if (!jobId) throw new Error("Falha ao criar job");
      setActiveJobId(jobId);

      // Decide function: prefer v3 sync; fallback to v2 import only when v2 explicit
      const useV2 = props.v2ImportFunction && conn?.provider_version === "v2";
      const fn = useV2 ? props.v2ImportFunction! : props.syncFunction;
      const { error } = await supabase.functions.invoke(fn, { body: { job_id: jobId, entity } });
      if (error) throw error;
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao iniciar importação");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Configurações</h3>
        <div className="flex items-center justify-between">
          <div>
            <Label>Auto-sync periódico</Label>
            <p className="text-xs text-muted-foreground">Sincronizar automaticamente em segundo plano</p>
          </div>
          <Switch checked={autoSync} onCheckedChange={(v) => upsert.mutate({ integration_slug: props.slug, auto_sync_enabled: v })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Frequência</Label>
            <Select value={frequency} onValueChange={(v) => patchConfig({ auto_sync_frequency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="hourly">1x por hora</SelectItem>
                <SelectItem value="daily">1x por dia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Filtro</Label>
            <Select value={filter} onValueChange={(v) => patchConfig({ [filterKey]: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativos">Apenas ativos</SelectItem>
                <SelectItem value="modificados_24h">Modificados últimas 24h</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-2">
        <Label>Mapeamento de campos</Label>
        <Table>
          <TableHeader>
            <TableRow><TableHead>{props.name}</TableHead><TableHead>DarkFunnel</TableHead></TableRow>
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
      </Card>

      <div>
        <Button onClick={runImport} disabled={running || createJob.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
          {(running || createJob.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Importar agora
        </Button>
      </div>

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
    success: "bg-emerald-600 hover:bg-emerald-600 text-white",
    error: "bg-red-600 hover:bg-red-600 text-white",
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
            {done && <Button onClick={onClose} className="w-full">Fechar</Button>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ============ PROPOSTAS ============ */
function useProposalExports(slug: string) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["proposal-exports", current?.id, slug],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proposal_external_refs")
        .select("id, proposal_id, external_id, status, last_sync_at, created_at, request_payload, response_payload, proposals(customer_name, number)")
        .eq("workspace_id", current!.id)
        .eq("integration_slug", slug)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function PropostasTab({ conn, props }: { conn: any; props: IntegrationShellProps }) {
  const upsert = useUpsertIntegrationConnection();
  const sc = conn?.sync_config_jsonb ?? {};
  const exportOnApprove = !!sc.export_proposals_on_approve;
  const { data: rows = [], isLoading } = useProposalExports(props.slug);
  const [openRow, setOpenRow] = useState<any>(null);

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <Label>Enviar para o ERP automaticamente quando proposta aprovada</Label>
            <p className="text-xs text-muted-foreground">Ao aprovar uma proposta, o pedido será criado no {props.name}.</p>
          </div>
          <Switch
            checked={exportOnApprove}
            onCheckedChange={(v) => upsert.mutate({ integration_slug: props.slug, sync_config_jsonb: { ...sc, export_proposals_on_approve: v } })}
          />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proposta</TableHead>
              <TableHead>Data export</TableHead>
              <TableHead>ID externo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Última sync</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma proposta exportada</TableCell></TableRow>
            )}
            {rows.map((r: any) => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setOpenRow(r)}>
                <TableCell>{r.proposals?.customer_name ?? r.proposals?.number ?? "—"}</TableCell>
                <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="font-mono text-xs">{r.external_id ?? "—"}</TableCell>
                <TableCell>{statusBadge(r.status ?? "pending")}</TableCell>
                <TableCell className="text-xs">{r.last_sync_at ? new Date(r.last_sync_at).toLocaleString("pt-BR") : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Sheet open={!!openRow} onOpenChange={(o) => !o && setOpenRow(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader><SheetTitle>Detalhes do export</SheetTitle></SheetHeader>
          {openRow && (
            <div className="mt-4 space-y-4">
              <div>
                <Label>Payload enviado</Label>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">{JSON.stringify(openRow.request_payload ?? {}, null, 2)}</pre>
              </div>
              <div>
                <Label>Resposta do ERP</Label>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">{JSON.stringify(openRow.response_payload ?? {}, null, 2)}</pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ============ LOGS ============ */
function LogsTab({ slug }: { slug: string }) {
  const { data: jobs = [], refetch, isFetching } = useSyncJobs(slug);
  const [filterType, setFilterType] = useState<string>("all");
  const [openJob, setOpenJob] = useState<string | null>(null);

  const filtered = jobs.filter((j) => filterType === "all" || j.job_type === filterType);
  const typeLabel = (t: string) =>
    t === "import_products" ? "Importar Produtos" :
    t === "import_contacts" ? "Importar Clientes" :
    t === "export_proposal" ? "Exportar Proposta" : t;

  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="import_products">Importar Produtos</SelectItem>
            <SelectItem value="import_contacts">Importar Clientes</SelectItem>
            <SelectItem value="export_proposal">Exportar Proposta</SelectItem>
          </SelectContent>
        </Select>
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
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum job</TableCell></TableRow>
            )}
            {filtered.map((j) => (
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
