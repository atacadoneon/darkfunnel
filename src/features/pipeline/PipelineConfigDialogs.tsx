import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus, Copy, Eye, EyeOff, Webhook, Timer, AlertCircle, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStages } from "./hooks";
import { useCreateStage, useUpdateStage, useDeleteStage,
  useLeadOrigins, useCreateOrigin, useDeleteOrigin,
  useLeadAutomations, useSaveAutomations,
  useCaptureWebhooks, useUpsertWebhook, useDeleteWebhook,
  type CaptureWebhook } from "./configHooks";
import { useLossReasons, LossReasonsAdminSection } from "@/features/workspace/CatalogsAdmin";
import { useProducts } from "./leadEditHooks";
import { usePipelines } from "./leadEditHooks";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

/* =================== ETAPAS =================== */
export function StagesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: stages = [] } = useStages();
  const create = useCreateStage();
  const update = useUpdateStage();
  const del = useDeleteStage();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"normal" | "won" | "lost">("normal");

  const submit = async () => {
    if (!name.trim()) { toast.error("Preencha o nome"); return; }
    await create.mutateAsync({ name: name.trim(), type });
    setName(""); setType("normal"); setShowNew(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Etapas do Funil</DialogTitle>
          <DialogDescription>Gerencie as etapas do seu funil de vendas.</DialogDescription>
        </DialogHeader>

        {showNew ? (
          <div className="space-y-3">
            <div>
              <Label>Nome da Etapa</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Em Negociação" autoFocus />
            </div>
            <div>
              <Label>Tipo da Etapa</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="won">Ganho (Comprou/Vendeu)</SelectItem>
                  <SelectItem value="lost">Perdido</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Etapa padrão do funil de vendas.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
              <Button onClick={submit} disabled={create.isPending}>Criar Etapa</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {stages.map((s) => (
                <div key={s.id} className="flex items-center gap-2 p-2 rounded-md border">
                  <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                  <Input value={s.name} onChange={(e) => update.mutate({ id: s.id, name: e.target.value })}
                    className="h-8 border-none focus-visible:ring-0 px-1" />
                  {s.is_won && <Badge variant="outline" className="text-xs">Ganho</Badge>}
                  {s.is_lost && <Badge variant="outline" className="text-xs">Perdido</Badge>}
                  <button onClick={() => { if (confirm(`Remover etapa "${s.name}"? Os leads precisam ser movidos antes.`)) del.mutate(s.id); }}
                    className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowNew(true)} className="w-full"><Plus className="h-4 w-4 mr-1" /> Nova Etapa</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* =================== MOTIVOS DE PERDA =================== */
export function LossReasonsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: reasons = [] } = useLossReasons();
  const { current } = useWorkspace();
  const [name, setName] = useState("");

  const create = async () => {
    if (!current || !name.trim()) return;
    const { error } = await supabase.from("loss_reasons").insert({ workspace_id: current.id, name: name.trim() });
    if (error) return toast.error(error.message);
    setName("");
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("loss_reasons").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Motivos de Perda</DialogTitle>
          <DialogDescription>Gerencie os motivos disponíveis para quando um lead é marcado como perdido.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do novo motivo..." />
          <Button size="icon" onClick={create}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="text-xs font-medium text-muted-foreground">Motivos Cadastrados ({reasons.length})</div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {reasons.map((r) => (
            <div key={r.id} className="flex items-center gap-2 p-2 rounded-md border bg-card">
              <span className="text-muted-foreground">⋮⋮</span>
              <span className="flex-1 text-sm">{r.name}</span>
              <button className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(r.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* =================== CANAIS DE ORIGEM =================== */
const ORIGIN_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#6366f1","#a855f7","#ec4899","#64748b"];
export function OriginsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: origins = [] } = useLeadOrigins();
  const create = useCreateOrigin();
  const del = useDeleteOrigin();
  const [name, setName] = useState("");
  const [color, setColor] = useState(ORIGIN_COLORS[3]);

  const system = origins.filter(o => o.is_system);
  const custom = origins.filter(o => !o.is_system);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Canais de Origem</DialogTitle>
          <DialogDescription>Configure as origens de leads disponíveis para sua equipe.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 items-center">
          <button className="h-9 w-9 rounded-md shrink-0" style={{ background: color }}
            onClick={() => setColor(ORIGIN_COLORS[(ORIGIN_COLORS.indexOf(color)+1) % ORIGIN_COLORS.length])} />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do novo canal..." />
          <Button size="icon" onClick={() => name.trim() && create.mutate({ name: name.trim(), color }, { onSuccess: () => setName("") })}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-xs font-medium text-muted-foreground">Canais do Sistema ({system.length})</div>
        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {system.map((o) => (
            <div key={o.id} className="flex items-center gap-2 p-2 rounded-md border">
              <span className="h-2 w-2 rounded-full" style={{ background: o.color }} />
              <span className="flex-1 text-sm">{o.name}</span>
              <Badge variant="outline" className="text-xs">Sistema</Badge>
            </div>
          ))}
        </div>

        <div className="text-xs font-medium text-muted-foreground">Canais Personalizados ({custom.length})</div>
        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {custom.length === 0 && <div className="text-xs text-muted-foreground italic px-2">Nenhum canal personalizado.</div>}
          {custom.map((o) => (
            <div key={o.id} className="flex items-center gap-2 p-2 rounded-md border bg-card">
              <span className="text-muted-foreground">⋮⋮</span>
              <span className="h-2 w-2 rounded-full" style={{ background: o.color }} />
              <span className="flex-1 text-sm">{o.name}</span>
              <button onClick={() => del.mutate(o.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* =================== SERVIÇOS / PRODUTOS =================== */
export function ProductsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: products = [] } = useProducts();
  const { current } = useWorkspace();
  const [name, setName] = useState("");

  const create = async () => {
    if (!current || !name.trim()) return;
    const { error } = await supabase.from("workspace_products").insert({ workspace_id: current.id, name: name.trim() });
    if (error) return toast.error(error.message);
    setName("");
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("workspace_products").update({ archived_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Serviços/Produtos</DialogTitle>
          <DialogDescription>Gerencie os serviços e produtos disponíveis para associar aos leads.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do novo serviço..." />
          <Button size="icon" onClick={create}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="text-xs font-medium text-muted-foreground">Serviços Ativos ({products.length})</div>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-2 p-2 rounded-md border bg-card">
              <span className="text-muted-foreground">⋮⋮</span>
              <span className="flex-1 text-sm">{p.name}</span>
              <button className="text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(p.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* =================== AUTOMAÇÕES =================== */
export function AutomationsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: cfg } = useLeadAutomations();
  const save = useSaveAutomations();
  const [autoLoss, setAutoLoss] = useState(cfg?.auto_loss_enabled ?? false);
  const [lostDays, setLostDays] = useState(cfg?.archive_lost_after_days ?? 30);
  const [wonDays, setWonDays] = useState(cfg?.archive_won_after_days ?? 30);
  const [inactDays, setInactDays] = useState(cfg?.archive_inactive_after_days ?? 30);
  const [lossDays, setLossDaysVal] = useState(cfg?.auto_loss_days ?? 30);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Timer className="h-4 w-4" /> Automações de Leads</DialogTitle>
          <DialogDescription>Configure automações de perda por inatividade e sugestões de arquivamento.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="font-semibold text-sm">Perda Automática por Inatividade</div>
          <div className="flex items-center gap-3 p-3 border rounded-md">
            <div className="flex-1">
              <div className="text-sm font-medium">Ativar perda automática</div>
              <div className="text-xs text-muted-foreground">Leads sem movimentação serão marcados como perdidos automaticamente</div>
            </div>
            <Switch checked={autoLoss} onCheckedChange={setAutoLoss} />
          </div>
          {autoLoss && (
            <div>
              <Label>Dias sem movimentação para marcar como perdido</Label>
              <Input type="number" value={lossDays} onChange={(e) => setLossDaysVal(+e.target.value)} />
            </div>
          )}
          <div className="flex gap-2 p-3 rounded-md border bg-amber-500/5 border-amber-500/30 text-xs">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <span>Leads em etapas finais (ganhos/perdidos) e leads arquivados não são afetados pela perda automática.</span>
          </div>

          <div className="font-semibold text-sm pt-2 border-t">Sugestões de Arquivamento</div>
          <div className="flex gap-2 p-3 rounded-md border bg-blue-500/5 border-blue-500/30 text-xs">
            <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <span>O sistema sugere leads para arquivamento. Nenhum lead é arquivado automaticamente.</span>
          </div>
          <div>
            <Label>Leads perdidos após (dias)</Label>
            <Input type="number" value={lostDays} onChange={(e) => setLostDays(+e.target.value)} />
          </div>
          <div>
            <Label>Leads ganhos após (dias)</Label>
            <Input type="number" value={wonDays} onChange={(e) => setWonDays(+e.target.value)} />
          </div>
          <div>
            <Label>Leads inativos após (dias)</Label>
            <Input type="number" value={inactDays} onChange={(e) => setInactDays(+e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={async () => {
            await save.mutateAsync({
              auto_loss_enabled: autoLoss, auto_loss_days: lossDays,
              archive_lost_after_days: lostDays, archive_won_after_days: wonDays, archive_inactive_after_days: inactDays,
            });
            onOpenChange(false);
          }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =================== CAPTURA / WEBHOOKS =================== */
export function CaptureDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: hooks = [] } = useCaptureWebhooks();
  const del = useDeleteWebhook();
  const [editing, setEditing] = useState<CaptureWebhook | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  // URL pública (proxy no domínio do app). Fallback para a edge function direta.
  const PUBLIC_BASE = "https://crm.darksales.digital/api/capture/";
  const baseUrl = PUBLIC_BASE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Webhook className="h-4 w-4" /> Captura de Leads</DialogTitle>
          <DialogDescription>Receba leads de formulários externos (Elementor, Typeform, etc.)</DialogDescription>
        </DialogHeader>

        {showForm ? (
          <WebhookForm webhook={editing} onClose={() => { setShowForm(false); setEditing(null); }} />
        ) : (
          <>
            <div className="flex justify-end">
              <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="h-4 w-4 mr-1" /> Novo Webhook</Button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {hooks.length === 0 && <div className="text-sm text-muted-foreground italic text-center py-8">Nenhum webhook cadastrado.</div>}
              {hooks.map((h) => (
                <div key={h.id} className="border rounded-md p-3 space-y-2 bg-card">
                  <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm flex-1">{h.name}</span>
                    {h.active && <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Ativo</Badge>}
                    <button onClick={() => { setEditing(h); setShowForm(true); }} className="text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => del.mutate(h.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <code className="flex-1 font-mono bg-muted px-2 py-1 rounded truncate">
                      {reveal[h.id] ? baseUrl + h.token : "•".repeat(40)}
                    </code>
                    <button onClick={() => setReveal(r => ({ ...r, [h.id]: !r[h.id] }))} className="text-muted-foreground">
                      {reveal[h.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(baseUrl + h.token); toast.success("URL copiada"); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-3">
                    <span>{h.leads_count} leads capturados</span>
                    {h.last_lead_at && <span>Último: {new Date(h.last_lead_at).toLocaleDateString("pt-BR")}</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WebhookForm({ webhook, onClose }: { webhook: CaptureWebhook | null; onClose: () => void }) {
  const { data: pipelines = [] } = usePipelines();
  const { data: stages = [] } = useStages();
  const { data: origins = [] } = useLeadOrigins();
  const { data: members = [] } = useWorkspaceMembers();
  const upsert = useUpsertWebhook();

  const [name, setName] = useState(webhook?.name ?? "");
  const [pipelineId, setPipelineId] = useState(webhook?.pipeline_id ?? pipelines[0]?.id ?? "");
  const [stageId, setStageId] = useState(webhook?.stage_id ?? stages[0]?.id ?? "");
  const [originId, setOriginId] = useState(webhook?.origin_id ?? "");
  const [assignee, setAssignee] = useState(webhook?.default_assignee ?? "none");
  const [mappings, setMappings] = useState<{k: string; v: string}[]>(
    Object.entries(webhook?.field_mapping ?? { name: "nome_responsavel", message: "observacoes" })
      .map(([k, v]) => ({ k, v: String(v) }))
  );

  const save = async () => {
    if (!name.trim()) { toast.error("Preencha o nome"); return; }
    const fm: Record<string, string> = {};
    mappings.forEach(m => { if (m.k && m.v) fm[m.k] = m.v; });
    await upsert.mutateAsync({
      id: webhook?.id, name: name.trim(),
      pipeline_id: pipelineId || null, stage_id: stageId || null,
      origin_id: originId || null,
      default_assignee: assignee === "none" ? null : assignee,
      field_mapping: fm, active: webhook?.active ?? true,
    });
    onClose();
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Nome do Webhook *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Formulário Landing Page" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Pipeline *</Label>
          <Select value={pipelineId} onValueChange={setPipelineId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Etapa Inicial *</Label>
          <Select value={stageId} onValueChange={setStageId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Origem dos Leads *</Label>
        <Select value={originId} onValueChange={setOriginId}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>{origins.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Vendedor Padrão (opcional)</Label>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum (não atribuir)</SelectItem>
            {members.map((m: any) => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name ?? m.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 border rounded-md p-3">
        <div className="text-sm font-medium flex items-center justify-between">
          <span>Mapeamento de Campos (Avançado)</span>
        </div>
        <div className="text-xs text-muted-foreground">Defina qual campo do formulário externo corresponde a cada campo do lead no CRM</div>
        <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center text-xs font-medium text-muted-foreground">
          <span>CAMPO NO FORMULÁRIO</span><span></span><span>CAMPO NO CRM</span><span></span>
        </div>
        {mappings.map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
            <Input value={m.k} onChange={(e) => setMappings(arr => arr.map((x,j) => j===i ? {...x, k: e.target.value} : x))} className="h-8" />
            <span className="text-muted-foreground">→</span>
            <Input value={m.v} onChange={(e) => setMappings(arr => arr.map((x,j) => j===i ? {...x, v: e.target.value} : x))} className="h-8" />
            <button onClick={() => setMappings(arr => arr.filter((_,j) => j!==i))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full" onClick={() => setMappings(arr => [...arr, { k: "", v: "" }])}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Campo
        </Button>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={upsert.isPending}>{webhook ? "Salvar" : "Criar Webhook"}</Button>
      </DialogFooter>
    </div>
  );
}
