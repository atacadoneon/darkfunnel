import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  channelId: string;
  channelName: string;
};

type Summary = {
  chats_found?: number;
  contacts_inserted?: number;
  conversations_inserted?: number;
  messages_inserted?: number;
  errors?: number;
};

export function ImportHistoryDialog({ open, onOpenChange, channelId, channelName }: Props) {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const [sinceDays, setSinceDays] = useState(90);
  const [msgsPerChat, setMsgsPerChat] = useState(50);
  const [includeGroups, setIncludeGroups] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const start = async () => {
    setBusy(true);
    setSummary(null);
    try {
      const { data, error } = await supabase.functions.invoke("import-history-start", {
        body: {
          channel_id: channelId,
          since_days: sinceDays,
          msgs_per_chat: msgsPerChat,
          include_groups: includeGroups,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.reason || data.error);
      setSummary(data?.summary ?? {});
      toast.success("Importação concluída");
      qc.invalidateQueries({ queryKey: ["conversations", current?.id] });
      qc.invalidateQueries({ queryKey: ["contacts", current?.id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Importar Histórico
          </DialogTitle>
          <DialogDescription>
            Importar conversas e mensagens do canal "{channelName}". Pode demorar 30–60 segundos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Últimos N dias</Label>
              <span className="text-sm text-muted-foreground">{sinceDays}</span>
            </div>
            <Slider min={1} max={365} step={1} value={[sinceDays]} onValueChange={(v) => setSinceDays(v[0])} disabled={busy} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Mensagens por chat</Label>
              <span className="text-sm text-muted-foreground">{msgsPerChat}</span>
            </div>
            <Slider min={1} max={200} step={1} value={[msgsPerChat]} onValueChange={(v) => setMsgsPerChat(v[0])} disabled={busy} />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="include-groups" className="cursor-pointer">Incluir grupos</Label>
            <Switch id="include-groups" checked={includeGroups} onCheckedChange={setIncludeGroups} disabled={busy} />
          </div>

          {summary && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
              <div className="font-medium">Resumo</div>
              <div>Chats encontrados: {summary.chats_found ?? 0}</div>
              <div>Contatos inseridos: {summary.contacts_inserted ?? 0}</div>
              <div>Conversas inseridas: {summary.conversations_inserted ?? 0}</div>
              <div>Mensagens inseridas: {summary.messages_inserted ?? 0}</div>
              {!!summary.errors && <div className="text-rose-500">Erros: {summary.errors}</div>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Fechar</Button>
          <Button onClick={start} disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando…</> : "Iniciar Importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
