import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCampaignRecipients, useCampaignEvents, useSendCampaign, statusColor, statusLabel, type EmailCampaign } from "./hooks";
import { EmptyState } from "@/components/EmptyState";
import { Mail, Send } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Props = { campaign: EmailCampaign | null; onOpenChange: (v: boolean) => void };

export function CampaignDrawer({ campaign, onOpenChange }: Props) {
  const { data: recipients = [] } = useCampaignRecipients(campaign?.id ?? null);
  const { data: events = [] } = useCampaignEvents(campaign?.id ?? null);
  const send = useSendCampaign();

  const canSend = campaign && (campaign.status === "draft" || campaign.status === "scheduled");

  return (
    <Sheet open={!!campaign} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader><SheetTitle className="flex items-center gap-2">{campaign?.name} {campaign && <Badge variant="outline" className={statusColor(campaign.status)}>{statusLabel(campaign.status)}</Badge>}</SheetTitle></SheetHeader>
        {!campaign ? null : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{campaign.subject}</div>
              {canSend && (
                <Button size="sm" disabled={send.isPending} onClick={() => send.mutate(campaign.id)}>
                  <Send className="h-4 w-4 mr-1" />{send.isPending ? "Enviando..." : "Enviar agora"}
                </Button>
              )}
            </div>

            <Tabs defaultValue="preview">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="recipients">Destinatários ({recipients.length})</TabsTrigger>
                <TabsTrigger value="events">Eventos ({events.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="preview">
                <iframe title="preview" className="w-full h-[60vh] border rounded bg-white" srcDoc={campaign.body_html ?? ""} />
              </TabsContent>
              <TabsContent value="recipients">
                {recipients.length === 0 ? <EmptyState icon={Mail} title="Sem destinatários ainda" /> : (
                  <div className="border rounded divide-y max-h-[60vh] overflow-y-auto">
                    {recipients.map((r) => (
                      <div key={r.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center p-2 text-sm">
                        <span className="truncate">{r.email}</span>
                        <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                        <span className="text-xs text-muted-foreground">{r.sent_at ? format(new Date(r.sent_at), "dd/MM HH:mm", { locale: ptBR }) : "—"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="events">
                {events.length === 0 ? <EmptyState icon={Mail} title="Sem eventos registrados" /> : (
                  <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
                    {events.map((e) => (
                      <li key={e.id} className="flex items-center gap-2 text-xs border-l-2 border-primary/40 pl-2 py-1">
                        <Badge variant="outline" className="text-[10px]">{e.type}</Badge>
                        <span className="text-muted-foreground">{format(new Date(e.occurred_at), "dd/MM HH:mm:ss", { locale: ptBR })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
