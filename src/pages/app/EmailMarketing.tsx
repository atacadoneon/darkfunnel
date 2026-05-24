import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import { Mail, Plus, Search, Users, FileText, BarChart3, Eye, MousePointerClick, Send, AlertTriangle, Pencil, Copy, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import {
  useEmailCampaigns, useEmailLists, useEmailTemplates, useEmailSuppressions,
  useCreateTemplate, useDeleteTemplate, useDeleteList,
  statusColor, statusLabel, type EmailCampaign, type EmailList, type EmailTemplate,
} from "@/features/emailmarketing/hooks";
import { NewCampaignDialog } from "@/features/emailmarketing/NewCampaignDialog";
import { NewListDialog } from "@/features/emailmarketing/NewListDialog";
import { TemplateDialog } from "@/features/emailmarketing/TemplateDialog";
import { ListDetailsDrawer } from "@/features/emailmarketing/ListDetailsDrawer";
import { CampaignDrawer } from "@/features/emailmarketing/CampaignDrawer";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function EmailMarketing() {
  const [tab, setTab] = useState("campaigns");

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Email Marketing</h1>
        <p className="text-sm text-muted-foreground">Crie e dispare campanhas de email para suas listas</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="campaigns"><Mail className="h-4 w-4 mr-1.5" />Campanhas</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="h-4 w-4 mr-1.5" />Templates</TabsTrigger>
          <TabsTrigger value="lists"><Users className="h-4 w-4 mr-1.5" />Listas</TabsTrigger>
          <TabsTrigger value="metrics"><BarChart3 className="h-4 w-4 mr-1.5" />Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns"><CampaignsTab /></TabsContent>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="lists"><ListsTab /></TabsContent>
        <TabsContent value="metrics"><MetricsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============ Campaigns ============ */
function CampaignsTab() {
  const { data: campaigns = [], isLoading } = useEmailCampaigns();
  const [newOpen, setNewOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<EmailCampaign | null>(null);

  const lastMonth = useMemo(() => {
    const since = subDays(new Date(), 30).getTime();
    return campaigns.filter((c) => new Date(c.created_at).getTime() >= since);
  }, [campaigns]);

  const kpis = useMemo(() => {
    const sent = lastMonth.reduce((s, c) => s + (c.recipients_count ?? 0), 0);
    const delivered = lastMonth.reduce((s, c) => s + (c.delivered_count ?? c.recipients_count ?? 0), 0);
    const opened = lastMonth.reduce((s, c) => s + (c.opened_count ?? 0), 0);
    const clicked = lastMonth.reduce((s, c) => s + (c.clicked_count ?? 0), 0);
    const bounced = lastMonth.reduce((s, c) => s + (c.bounced_count ?? 0), 0);
    return {
      sent,
      openRate: delivered ? (opened / delivered) * 100 : 0,
      clickRate: delivered ? (clicked / delivered) * 100 : 0,
      bounceRate: sent ? (bounced / sent) * 100 : 0,
    };
  }, [lastMonth]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) =>
      (!q || c.name.toLowerCase().includes(q)) &&
      (status === "all" || c.status === status)
    );
  }, [campaigns, search, status]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1" />
        <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Nova campanha</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Send} label="Total enviados (30d)" value={isLoading ? null : kpis.sent.toLocaleString("pt-BR")} />
        <Kpi icon={Eye} label="Taxa de abertura" value={isLoading ? null : `${kpis.openRate.toFixed(1)}%`} tone="emerald" />
        <Kpi icon={MousePointerClick} label="Taxa de clique" value={isLoading ? null : `${kpis.clickRate.toFixed(1)}%`} tone="sky" />
        <Kpi icon={AlertTriangle} label="Taxa de bounce" value={isLoading ? null : `${kpis.bounceRate.toFixed(1)}%`} tone="rose" />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar campanhas..." className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="scheduled">Agendadas</SelectItem>
            <SelectItem value="sending">Enviando</SelectItem>
            <SelectItem value="sent">Enviadas</SelectItem>
            <SelectItem value="failed">Falharam</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" />
        : filtered.length === 0 ? (
          <Card><CardContent className="p-10">
            <EmptyState icon={Mail} title="Nenhuma campanha ainda"
              description="Crie sua primeira campanha de email para começar."
              action={<Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Nova campanha</Button>} />
          </CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-[1fr_100px_90px_90px_80px_80px_120px] gap-2 px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                <span>Nome</span><span>Status</span><span className="text-right">Destinat.</span><span className="text-right">Enviados</span><span className="text-right">Abertura</span><span className="text-right">Clique</span><span>Quando</span>
              </div>
              {filtered.map((c) => {
                const delivered = c.delivered_count ?? c.recipients_count ?? 0;
                const openRate = delivered ? ((c.opened_count ?? 0) / delivered) * 100 : 0;
                const clickRate = delivered ? ((c.clicked_count ?? 0) / delivered) * 100 : 0;
                const when = c.sent_at ?? c.scheduled_for ?? c.created_at;
                return (
                  <button key={c.id} onClick={() => setSelected(c)} className="w-full grid grid-cols-[1fr_100px_90px_90px_80px_80px_120px] gap-2 px-4 py-2.5 text-sm border-b hover:bg-muted/50 text-left items-center">
                    <div className="min-w-0"><div className="truncate font-medium">{c.name}</div>{c.description && <div className="truncate text-xs text-muted-foreground">{c.description}</div>}</div>
                    <Badge variant="outline" className={statusColor(c.status)}>{statusLabel(c.status)}</Badge>
                    <span className="text-right">{c.recipients_count ?? 0}</span>
                    <span className="text-right">{delivered}</span>
                    <span className="text-right">{openRate.toFixed(1)}%</span>
                    <span className="text-right">{clickRate.toFixed(1)}%</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(when), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}

      <NewCampaignDialog open={newOpen} onOpenChange={setNewOpen} />
      <CampaignDrawer campaign={selected} onOpenChange={(v) => !v && setSelected(null)} />
    </div>
  );
}

/* ============ Templates ============ */
function TemplatesTab() {
  const { data: templates = [], isLoading } = useEmailTemplates();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const create = useCreateTemplate();
  const del = useDeleteTemplate();

  async function duplicate(t: EmailTemplate) {
    await create.mutateAsync({ name: `${t.name} (cópia)`, category: t.category, subject: t.subject, body_html: t.body_html, body_text: t.body_text });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1.5" />Novo template</Button>
      </div>
      {isLoading ? <Skeleton className="h-48 w-full" />
        : templates.length === 0 ? (
          <Card><CardContent className="p-10">
            <EmptyState icon={FileText} title="Nenhum template ainda" description="Crie templates reutilizáveis para suas campanhas."
              action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1.5" />Novo template</Button>} />
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((t) => (
              <Card key={t.id} className="overflow-hidden">
                <div className="h-32 bg-muted/50 border-b flex items-center justify-center text-muted-foreground">
                  <iframe title={t.name} srcDoc={t.body_html ?? ""} className="w-full h-full pointer-events-none scale-50 origin-top-left" style={{ width: "200%", height: "200%" }} />
                </div>
                <CardContent className="p-3">
                  <div className="font-medium truncate">{t.name}</div>
                  {t.category && <Badge variant="outline" className="text-[10px] mt-1">{t.category}</Badge>}
                  <div className="flex gap-1 mt-3">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-3 w-3 mr-1" />Editar</Button>
                    <Button size="sm" variant="outline" onClick={() => duplicate(t)}><Copy className="h-3 w-3 mr-1" />Duplicar</Button>
                    <Button size="sm" variant="outline" onClick={() => del.mutate(t.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      <TemplateDialog open={open} onOpenChange={setOpen} template={editing} />
    </div>
  );
}

/* ============ Lists ============ */
function ListsTab() {
  const { data: lists = [], isLoading } = useEmailLists();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EmailList | null>(null);
  const del = useDeleteList();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Nova lista</Button>
      </div>
      {isLoading ? <Skeleton className="h-48 w-full" />
        : lists.length === 0 ? (
          <Card><CardContent className="p-10">
            <EmptyState icon={Users} title="Nenhuma lista ainda"
              description="Crie listas para segmentar seus envios."
              action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Nova lista</Button>} />
          </CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-[1fr_90px_120px_140px_90px] gap-2 px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                <span>Nome</span><span className="text-right">Membros</span><span>Fonte</span><span>Atualizada</span><span></span>
              </div>
              {lists.map((l) => (
                <div key={l.id} className="grid grid-cols-[1fr_90px_120px_140px_90px] gap-2 px-4 py-2.5 text-sm border-b items-center hover:bg-muted/50">
                  <button onClick={() => setSelected(l)} className="text-left min-w-0">
                    <div className="truncate font-medium">{l.name}</div>
                    {l.description && <div className="truncate text-xs text-muted-foreground">{l.description}</div>}
                  </button>
                  <span className="text-right">{l.members_count ?? 0}</span>
                  <Badge variant="outline" className="text-[10px] w-fit">{l.source}</Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(l.updated_at ?? l.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      <NewListDialog open={open} onOpenChange={setOpen} />
      <ListDetailsDrawer list={selected} onOpenChange={(v) => !v && setSelected(null)} />
    </div>
  );
}

/* ============ Metrics ============ */
function MetricsTab() {
  const { data: campaigns = [] } = useEmailCampaigns();
  const { data: suppressions = [] } = useEmailSuppressions();

  const totals = useMemo(() => {
    const sent = campaigns.reduce((s, c) => s + (c.recipients_count ?? 0), 0);
    const delivered = campaigns.reduce((s, c) => s + (c.delivered_count ?? c.recipients_count ?? 0), 0);
    const opened = campaigns.reduce((s, c) => s + (c.opened_count ?? 0), 0);
    const clicked = campaigns.reduce((s, c) => s + (c.clicked_count ?? 0), 0);
    return { sent, openRate: delivered ? (opened / delivered) * 100 : 0, clickRate: delivered ? (clicked / delivered) * 100 : 0, suppressed: suppressions.length };
  }, [campaigns, suppressions]);

  const last30 = useMemo(() => {
    const arr: { date: string; sent: number }[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const day = new Date(today); day.setDate(today.getDate() - i);
      const next = new Date(day); next.setDate(day.getDate() + 1);
      let sent = 0;
      for (const c of campaigns) {
        const when = c.sent_at ? new Date(c.sent_at) : null;
        if (when && when >= day && when < next) sent += c.recipients_count ?? 0;
      }
      arr.push({ date: format(day, "dd/MM"), sent });
    }
    return arr;
  }, [campaigns]);

  const topCampaigns = useMemo(() =>
    [...campaigns]
      .filter((c) => c.status === "sent")
      .map((c) => {
        const delivered = c.delivered_count ?? c.recipients_count ?? 0;
        return { ...c, _open: delivered ? ((c.opened_count ?? 0) / delivered) * 100 : 0 };
      })
      .sort((a, b) => b._open - a._open)
      .slice(0, 5),
    [campaigns]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Send} label="Total enviados" value={totals.sent.toLocaleString("pt-BR")} />
        <Kpi icon={Eye} label="Taxa abertura geral" value={`${totals.openRate.toFixed(1)}%`} tone="emerald" />
        <Kpi icon={MousePointerClick} label="Taxa clique geral" value={`${totals.clickRate.toFixed(1)}%`} tone="sky" />
        <Kpi icon={AlertTriangle} label="Suppressions" value={String(totals.suppressed)} tone="rose" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-semibold mb-3">Envios por dia (últimos 30 dias)</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last30}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Bar dataKey="sent" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-semibold mb-3">Top campanhas (abertura)</div>
            {topCampaigns.length === 0 ? <EmptyState icon={Mail} title="Sem campanhas enviadas" />
              : <ul className="divide-y">{topCampaigns.map((c) => (
                <li key={c.id} className="flex justify-between py-2 text-sm">
                  <span className="truncate flex-1">{c.name}</span>
                  <Badge variant="outline">{c._open.toFixed(1)}%</Badge>
                </li>
              ))}</ul>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-semibold mb-3">Suppressions ({suppressions.length})</div>
            {suppressions.length === 0 ? <EmptyState icon={AlertTriangle} title="Nenhuma supressão" />
              : <ul className="divide-y max-h-64 overflow-y-auto">{suppressions.slice(0, 50).map((s) => (
                <li key={s.id} className="flex justify-between gap-2 py-1.5 text-sm">
                  <span className="truncate">{s.email}</span>
                  <Badge variant="outline" className="text-[10px]">{s.reason}</Badge>
                </li>
              ))}</ul>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ============ shared ============ */
function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: React.ReactNode; tone?: "emerald" | "sky" | "rose" }) {
  const color = tone === "emerald" ? "text-emerald-500" : tone === "sky" ? "text-sky-500" : tone === "rose" ? "text-rose-500" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className={`mt-2 text-2xl font-bold ${color}`}>{value ?? <Skeleton className="h-7 w-20" />}</div>
      </CardContent>
    </Card>
  );
}
