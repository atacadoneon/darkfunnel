import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Phone, AlertCircle, Smartphone, BadgeCheck, RefreshCw, Loader2, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useChannels, type ChannelRow, type ChannelStatus } from "@/features/channels/hooks";
import { ChannelDialog } from "@/features/channels/ChannelDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusVariant: Record<ChannelStatus, { label: string; className: string }> = {
  connected:    { label: "Conectado",   className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  qr_pending:   { label: "QR pendente", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  pending:      { label: "Pendente",    className: "bg-muted text-muted-foreground border-border" },
  disconnected: { label: "Desconectado",className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30" },
  banned:       { label: "Banido",      className: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" },
  expired:      { label: "Expirado",    className: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" },
};

export function ChannelsSection() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const { data: channels = [], isLoading } = useChannels();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChannelRow | null>(null);
  const [deleting, setDeleting] = useState<ChannelRow | null>(null);
  const [deleteConversations, setDeleteConversations] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const autoEnabledRef = useRef<Set<string>>(new Set());

  // Garante que grupos estejam sempre habilitados nos canais conectados
  useEffect(() => {
    channels.forEach((c) => {
      if (c.kind === "uazapi" && c.status === "connected" && !autoEnabledRef.current.has(c.id)) {
        autoEnabledRef.current.add(c.id);
        supabase.functions
          .invoke("uazapi-reconfigure-webhook", { body: { channel_id: c.id } })
          .catch(() => { /* silencioso */ });
      }
    });
  }, [channels]);

  const onNew = () => { setEditing(null); setDialogOpen(true); };
  const onEdit = (c: ChannelRow) => { setEditing(c); setDialogOpen(true); };

  const onSync = async (c: ChannelRow) => {
    setSyncingId(c.id);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-instance", {
        body: { channel_id: c.id, action: "sync_history", chat_limit: 200, per_chat_limit: 100 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Sincronizado: ${data?.chats_processed ?? 0} conversas, ${data?.messages_imported ?? 0} mensagens importadas`);
      qc.invalidateQueries({ queryKey: ["conversations", current?.id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncingId(null);
    }
  };

  const onRefreshContacts = async (c: ChannelRow) => {
    setRefreshingId(c.id);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-instance", {
        body: { channel_id: c.id, action: "refresh_contacts" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Contatos atualizados: ${data?.contacts_updated ?? 0} de ${data?.contacts_total ?? 0}`);
      qc.invalidateQueries({ queryKey: ["contacts", current?.id] });
      qc.invalidateQueries({ queryKey: ["conversations", current?.id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshingId(null);
    }
  };





  const confirmDelete = async () => {
    if (!deleting || !current) return;
    setDeletingBusy(true);
    try {
      // Exclui também a instância no UAZAPI (best-effort)
      try {
        await supabase.functions.invoke("uazapi-instance", {
          body: { channel_id: deleting.id, action: "delete" },
        });
      } catch (_) { /* segue exclusão lógica mesmo se falhar */ }

      if (deleteConversations) {
        // Busca conversas do canal para apagar mensagens e depois as conversas
        const { data: convs, error: cerr } = await supabase
          .from("conversations")
          .select("id")
          .eq("channel_id", deleting.id);
        if (cerr) throw cerr;
        const ids = (convs ?? []).map((c) => c.id);
        if (ids.length > 0) {
          const { error: merr } = await supabase.from("messages").delete().in("conversation_id", ids);
          if (merr) throw merr;
          const { error: derr } = await supabase.from("conversations").delete().in("id", ids);
          if (derr) throw derr;
        }
      }

      const { error } = await supabase
        .from("channels")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", deleting.id);
      if (error) throw error;

      toast.success(deleteConversations ? "Canal e conversas removidos" : "Canal removido");
      qc.invalidateQueries({ queryKey: ["channels", current.id] });
      qc.invalidateQueries({ queryKey: ["conversations", current.id] });
      setDeleting(null);
      setDeleteConversations(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Canais</h2>
          <p className="text-sm text-muted-foreground">
            Crie quantos canais precisar — WhatsApp Business (QR) ou WhatsApp API (WABA).
          </p>
        </div>
        <Button onClick={onNew}>
          <Plus className="h-4 w-4 mr-2" />
          Criar canal
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : channels.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Phone className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">Nenhum canal cadastrado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Crie seu primeiro canal para começar a receber e enviar mensagens.
          </p>
          <Button onClick={onNew} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Criar canal
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {channels.map((c) => {
            const s = statusVariant[c.status];
            const Icon = c.kind === "uazapi" ? Smartphone : BadgeCheck;
            return (
              <Card key={c.id} className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{c.display_name}</h3>
                    <Badge variant="outline" className="text-xs">
                      {c.kind === "uazapi" ? "WhatsApp Business" : "WhatsApp API (WABA)"}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${s.className}`}>{s.label}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {c.phone_e164 ?? "Sem telefone"} · {c.policy}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onEdit(c)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {c.kind === "uazapi" && c.status === "connected" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSync(c)}
                      disabled={syncingId === c.id}
                      title="Importar histórico de mensagens do WhatsApp"
                    >
                      {syncingId === c.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Sincronizar histórico
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRefreshContacts(c)}
                      disabled={refreshingId === c.id}
                      title="Atualizar nome, foto e status dos contatos com conversa neste canal"
                    >
                      {refreshingId === c.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UserRoundCog className="h-4 w-4 mr-2" />
                      )}
                      Atualizar contatos
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" onClick={() => setDeleting(c)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-4 bg-amber-500/5 border-amber-500/20">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong>Credenciais</strong> (token UAZAPI / access_token Cloud) são armazenadas
            cifradas (AES-256-GCM) pela Edge Function — disponível no próximo sprint.
            Por enquanto, o canal fica em status <em>pending</em> até o backend se conectar.
          </div>
        </div>
      </Card>

      <ChannelDialog open={dialogOpen} onOpenChange={setDialogOpen} channel={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover canal?</AlertDialogTitle>
            <AlertDialogDescription>
              O canal "{deleting?.display_name}" será desativado. Conversas existentes não serão apagadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
