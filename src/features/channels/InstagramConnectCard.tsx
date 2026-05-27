import { useState } from "react";
import { Instagram, Plus, ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ChannelRow } from "./hooks";

const STATUS_PILL: Record<string, string> = {
  connected: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  qr_pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  pending: "bg-muted text-muted-foreground border-border",
  disconnected: "bg-zinc-500/15 text-zinc-600 border-zinc-500/30",
  banned: "bg-rose-500/15 text-rose-600 border-rose-500/30",
  expired: "bg-rose-500/15 text-rose-600 border-rose-500/30",
};

export function InstagramConnectCard({ channels }: { channels: ChannelRow[] }) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [howOpen, setHowOpen] = useState(channels.length === 0);

  const onConnect = async () => {
    if (!current) return;
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-oauth-start", {
        body: { workspace_id: current.id },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.code === "meta_not_configured") {
        toast.error("Configure META_APP_ID e META_APP_SECRET nos Secrets primeiro.", { duration: 8000 });
        return;
      }
      const url = (data as any)?.oauth_url as string | undefined;
      if (!url) throw new Error("oauth_url ausente na resposta");
      window.open(url, "meta-oauth", "width=600,height=700");
      toast("Autorize o DarkFunnel no Facebook. Após autorizar, a página atualiza sozinha.");
      // realtime já cobre, mas refetch como reforço
      setTimeout(() => qc.invalidateQueries({ queryKey: ["channels", current.id] }), 8000);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Card className="p-5 overflow-hidden relative">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)" }}>
          <Instagram className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">Instagram</h3>
            <Badge variant="outline" className="text-[10px]">DM via Meta API</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Receba e responda DMs do Instagram Business direto no Inbox.
          </p>
        </div>
        <Button
          onClick={onConnect}
          disabled={connecting}
          className="shrink-0 text-white border-0"
          style={{ background: "linear-gradient(135deg,#f09433 0%,#dc2743 50%,#bc1888 100%)" }}
        >
          {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Conectar Instagram
        </Button>
      </div>

      {channels.length > 0 && (
        <div className="mt-4 grid gap-2">
          {channels.map((c) => (
            <div key={c.id} className="flex items-center gap-3 border rounded-lg p-2.5 bg-card">
              <Avatar className="h-9 w-9">
                {c.profile_picture_url && <AvatarImage src={c.profile_picture_url} alt={c.ig_username ?? ""} />}
                <AvatarFallback>
                  <Instagram className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  @{c.ig_username ?? c.display_name}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {c.profile_name ?? "Instagram Business"}
                </div>
              </div>
              <Badge variant="outline" className={`text-[10px] ${STATUS_PILL[c.status] ?? STATUS_PILL.pending}`}>
                {c.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setHowOpen((v) => !v)}
        className="mt-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {howOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Como conectar?
      </button>

      {howOpen && (
        <div className="mt-2 rounded-md border bg-muted/30 p-3 text-xs space-y-1.5">
          <ol className="list-decimal pl-4 space-y-1">
            <li>Tenha uma conta Instagram Business linkada a uma Facebook Page.</li>
            <li>Crie um Meta App em <a className="text-primary inline-flex items-center gap-0.5" href="https://developers.facebook.com" target="_blank" rel="noreferrer">developers.facebook.com <ExternalLink className="h-3 w-3" /></a> como tipo Business.</li>
            <li>Adicione produtos: Instagram + Webhooks + Facebook Login.</li>
            <li>Solicite permissões: <code className="text-[10px]">instagram_basic, instagram_manage_messages, pages_messaging, pages_show_list, business_management</code>.</li>
            <li>Adicione você e seus vendedores como Testers (Roles).</li>
            <li>Configure <code className="text-[10px]">META_APP_ID</code> e <code className="text-[10px]">META_APP_SECRET</code> em Secrets do Lovable Cloud.</li>
            <li>Webhook URL: <code className="text-[10px] break-all">https://sbyslxhjjfcqlxaehidw.supabase.co/functions/v1/instagram-webhook</code></li>
            <li>Verify Token: use o valor do secret <code className="text-[10px]">META_VERIFY_TOKEN</code>.</li>
            <li>Clique em <strong>Conectar Instagram</strong> aqui pra rodar o fluxo OAuth.</li>
          </ol>
        </div>
      )}
    </Card>
  );
}

export function ComingSoonChannel({
  name, color, icon: Icon,
}: { name: string; color: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="p-4 flex items-center gap-3 opacity-60 cursor-not-allowed">
      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: color }}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-[11px] text-muted-foreground">Em breve</div>
      </div>
      <Badge variant="outline" className="text-[10px]">Soon</Badge>
    </Card>
  );
}
