import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Target, Copy, Trash2, Pause, Play, Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  useLandingPages, useCreateLandingPage, useUpdateLandingPage, useDeleteLandingPage,
  useTrackingConfig, useUpsertTrackingConfig, type LandingPage,
} from "./hooks";

const LP_BASE = "https://app.darkfunnel.com/lp";

export function LandingPagesTab() {
  const { data: pages = [] } = useLandingPages();
  const create = useCreateLandingPage();
  const update = useUpdateLandingPage();
  const del = useDeleteLandingPage();
  const { data: cfg } = useTrackingConfig();
  const upsertCfg = useUpsertTrackingConfig();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("Olá! Vim do site e gostaria de mais informações.");
  const [campaign, setCampaign] = useState("");
  const [traffic, setTraffic] = useState<string>("");
  const [utm, setUtm] = useState({ source: "", medium: "", campaign: "", content: "", term: "" });
  const [custom, setCustom] = useState<{ key: string; value: string }[]>([]);
  const [generated, setGenerated] = useState<LandingPage | null>(null);
  const [delTarget, setDelTarget] = useState<LandingPage | null>(null);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) return toast.error("Preencha nome e telefone");
    const lp = await create.mutateAsync({
      name: name.trim(),
      whatsapp_phone: phone.replace(/\D/g, ""),
      message: msg,
      campaign_name: campaign || null,
      traffic_source: traffic || null,
      utm_source: utm.source || null,
      utm_medium: utm.medium || null,
      utm_campaign: utm.campaign || null,
      utm_content: utm.content || null,
      utm_term: utm.term || null,
      custom_params: Object.fromEntries(custom.filter(c => c.key).map(c => [c.key, c.value])),
    });
    setGenerated(lp as any);
    setName(""); setPhone(""); setCampaign("");
    setUtm({ source: "", medium: "", campaign: "", content: "", term: "" });
    setCustom([]);
  };

  const metaEnabled = cfg?.meta_status === "configured";
  const googleEnabled = cfg?.google_status === "configured";
  const noneEnabled = !metaEnabled && !googleEnabled;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="font-semibold">Gerador de links para landing pages</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Crie links de WhatsApp com rastreamento invisível para suas LPs.
        </p>

        <div className="mt-4 rounded-md bg-blue-500/5 border border-blue-500/30 p-3 text-xs space-y-1.5">
          <div className="font-semibold">Como funciona o rastreamento</div>
          <div><b>Passo 1:</b> Gere o link abaixo e cole nos botões do seu site (ex: "Falar no WhatsApp").</div>
          <div><b>Passo 2:</b> Se você usa Google Ads, Meta Ads ou outro tráfego pago, instale também o snippet JavaScript no site. Sem ele, todos os leads aparecerão como "Site Orgânico" em vez da origem real do anúncio.</div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Nome do link *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: LP Imóveis SP" />
          </div>
          <div>
            <Label className="text-xs">Número do WhatsApp *</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex: 11 99999-9999" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Mensagem pré-preenchida</Label>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} />
          </div>
          <div>
            <Label className="text-xs">Nome da campanha</Label>
            <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Ex: Black Friday 2026" />
          </div>
          <div>
            <Label className="text-xs">Fonte do tráfego</Label>
            <Select value={traffic} onValueChange={setTraffic}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="google_ads">Google Ads</SelectItem>
                <SelectItem value="meta_ads">Meta Ads</SelectItem>
                <SelectItem value="tiktok_ads">TikTok Ads</SelectItem>
                <SelectItem value="linkedin_ads">LinkedIn Ads</SelectItem>
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Accordion type="single" collapsible className="mt-4">
          <AccordionItem value="adv">
            <AccordionTrigger className="text-sm">Configurações avançadas</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(["source", "medium", "campaign", "content", "term"] as const).map((k) => (
                  <div key={k}>
                    <Label className="text-xs">UTM {k}</Label>
                    <Input value={utm[k]} onChange={(e) => setUtm({ ...utm, [k]: e.target.value })} />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Parâmetros customizados</Label>
                  <Button size="sm" variant="outline" onClick={() => setCustom([...custom, { key: "", value: "" }])}>
                    + Adicionar
                  </Button>
                </div>
                <div className="space-y-2 mt-2">
                  {custom.map((c, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <Input placeholder="key" value={c.key} onChange={(e) => {
                        const x = [...custom]; x[i].key = e.target.value; setCustom(x);
                      }} />
                      <Input placeholder="value" value={c.value} onChange={(e) => {
                        const x = [...custom]; x[i].value = e.target.value; setCustom(x);
                      }} />
                      <Button size="icon" variant="ghost" onClick={() => setCustom(custom.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button className="w-full mt-4" onClick={submit} disabled={create.isPending}>
          Gerar link com rastreamento
        </Button>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold">Links de rastreamento ativos</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Acompanhe o desempenho de cada landing page.
        </p>

        {pages.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-md mt-4">
            <Target className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <div className="font-medium">Nenhum link de rastreamento criado ainda</div>
            <div className="text-xs text-muted-foreground mt-1">Use o gerador acima para criar seu primeiro link!</div>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {pages.map((p) => {
              const url = `${LP_BASE}/${p.slug}`;
              return (
                <div key={p.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground break-all">{url}</div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        <span><b>{p.clicks_count ?? 0}</b> cliques</span>
                        <span><b>{p.conversations_count ?? 0}</b> conversas</span>
                        <span><b>{p.conversions_count ?? 0}</b> conversões</span>
                        <span>R$ <b>{((p.revenue_cents ?? 0) / 100).toLocaleString("pt-BR")}</b></span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => {
                        navigator.clipboard.writeText(url); toast.success("URL copiada");
                      }}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
                      <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: p.id, active: !p.active })}>
                        {p.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDelTarget(p)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {!p.active && <Badge variant="secondary" className="mt-2">Pausado</Badge>}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold">Conversões por landing page</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Envie eventos de conversão quando leads vindos de LPs iniciarem conversa.
        </p>

        {noneEnabled && (
          <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs flex gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>Configure a conexão com Meta Ads ou Google Ads acima para habilitar o envio de conversões.</span>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div>
              <div className="text-sm font-medium flex items-center gap-2">
                Enviar "Lead" para Meta Ads
                {!metaEnabled && <Badge variant="secondary" className="text-[10px]">Não configurado</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                Envia evento Lead via Conversions API quando o lead enviar a 1ª mensagem.
              </div>
            </div>
            <Switch
              checked={!!cfg?.lp_send_lead_to_meta}
              disabled={!metaEnabled}
              onCheckedChange={(v) => upsertCfg.mutate({ lp_send_lead_to_meta: v })}
            />
          </div>
          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div>
              <div className="text-sm font-medium flex items-center gap-2">
                Enviar "Lead" para Google Ads
                {!googleEnabled && <Badge variant="secondary" className="text-[10px]">Não configurado</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                Envia conversão offline quando o lead enviar a 1ª mensagem.
              </div>
            </div>
            <Switch
              checked={!!cfg?.lp_send_lead_to_google}
              disabled={!googleEnabled}
              onCheckedChange={(v) => upsertCfg.mutate({ lp_send_lead_to_google: v })}
            />
          </div>
        </div>
      </Card>

      <Dialog open={!!generated} onOpenChange={(o) => !o && setGenerated(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link gerado com sucesso</DialogTitle></DialogHeader>
          {generated && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">URL de rastreamento</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={`${LP_BASE}/${generated.slug}`} />
                  <Button onClick={() => {
                    navigator.clipboard.writeText(`${LP_BASE}/${generated.slug}`);
                    toast.success("URL copiada");
                  }}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Snippet JavaScript (cole no seu site)</Label>
                <Textarea
                  readOnly
                  rows={4}
                  className="font-mono text-xs"
                  value={`<script src="${LP_BASE.replace("/lp", "")}/pixel.js" data-ws="${generated.workspace_id}"></script>`}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover link?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O link "{delTarget?.name}" deixará de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (delTarget) del.mutate(delTarget.id);
              setDelTarget(null);
            }}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
