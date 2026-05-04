import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Zap, Key, Loader2, Copy, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = { channelId: string | null };

export function ChannelStepIntegrations({ channelId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [genKey, setGenKey] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (!channelId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("channel_credentials")
        .select("n8n_enabled,n8n_webhook_url,n8n_webhook_secret,send_api_key")
        .eq("channel_id", channelId).maybeSingle();
      if (data) {
        setEnabled(!!data.n8n_enabled);
        setUrl(data.n8n_webhook_url ?? "");
        setSecret(data.n8n_webhook_secret ?? "");
        setApiKey(data.send_api_key ?? "");
      }
      setLoading(false);
    })();
  }, [channelId]);

  const save = async () => {
    if (!channelId) return;
    if (enabled && !url.trim()) { toast.error("Informe a URL do Webhook n8n"); return; }
    setSaving(true);
    const { error } = await supabase.functions.invoke("uazapi-instance", {
      body: { channel_id: channelId, action: "save_n8n", n8n: { enabled, url: url.trim() || null, secret: secret.trim() || null } },
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Configurações salvas");
  };

  const generateKey = async () => {
    if (!channelId) return;
    setGenKey(true);
    const { data, error } = await supabase.functions.invoke("uazapi-instance", {
      body: { channel_id: channelId, action: "generate_api_key" },
    });
    setGenKey(false);
    if (error || !data?.api_key) { toast.error(error?.message ?? "Falha ao gerar API Key"); return; }
    setApiKey(data.api_key);
    setShowApiKey(true);
    toast.success("API Key gerada");
  };

  const copy = (v: string, label: string) => {
    if (!v) return;
    navigator.clipboard.writeText(v);
    toast.success(`${label} copiado`);
  };

  if (!channelId) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Salve as informações do canal para configurar as integrações.
      </div>
    );
  }
  if (loading) return <div className="p-6 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Integração n8n / Automações</div>
            <p className="text-xs text-muted-foreground">Webhook bidirecional com n8n</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-sm">Ativar Integração n8n</Label>
            <p className="text-xs text-muted-foreground">Encaminha eventos de mensagem recebida para o webhook configurado</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-sm">URL do Webhook n8n</Label>
          <Input placeholder="https://n8n.seudominio.com/webhook/..." value={url} onChange={(e) => setUrl(e.target.value)} disabled={!enabled} />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Secret do Webhook (opcional)</Label>
          <div className="flex gap-2">
            <Input
              type={showSecret ? "text" : "password"}
              placeholder="Será enviado no header x-webhook-secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              disabled={!enabled}
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setShowSecret((v) => !v)}>
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-sm flex items-center gap-2"><Key className="h-4 w-4" /> API Key para Envio de Mensagens</Label>
          {apiKey ? (
            <div className="flex gap-2">
              <Input type={showApiKey ? "text" : "password"} value={apiKey} readOnly className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowApiKey((v) => !v)}>
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => copy(apiKey, "API Key")}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" onClick={generateKey} disabled={genKey}>
                {genKey ? <Loader2 className="h-4 w-4 animate-spin" /> : "Regenerar"}
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={generateKey} disabled={genKey}>
              {genKey ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Key className="h-4 w-4 mr-2" />} Gerar API Key
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Use essa chave para enviar mensagens via API a partir do n8n ou outro sistema.</p>
        </div>

        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
