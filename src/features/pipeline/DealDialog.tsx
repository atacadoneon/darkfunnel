import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check, ChevronsUpDown, Trophy, XCircle, Archive,
  User as UserIcon, Users, Lock, X,
} from "lucide-react";
import { useContacts } from "@/features/contacts/hooks";
import { useChannels } from "@/features/channels/hooks";
import {
  useDealCollaborators, useIsAdmin, useIsManagerOrAdmin, useWorkspaceMembers,
} from "@/features/workspace/permissions";
import { cn } from "@/lib/utils";
import { useLossReasons } from "@/features/workspace/CatalogsAdmin";
import type { Deal, Stage } from "./hooks";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stages: Stage[];
  deal?: Deal | null;
  defaultStageId?: string;
};

export function DealDialog({ open, onOpenChange, stages, deal, defaultStageId }: Props) {
  const { current } = useWorkspace();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const isManagerOrAdmin = useIsManagerOrAdmin();
  const qc = useQueryClient();
  const editing = !!deal;

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stageId, setStageId] = useState("");
  const [notes, setNotes] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [collabPickerOpen, setCollabPickerOpen] = useState(false);
  const [lossOpen, setLossOpen] = useState(false);
  const [lossReasonId, setLossReasonId] = useState<string | null>(null);
  const { data: lossReasons = [] } = useLossReasons(true);
  const [duplicateLead, setDuplicateLead] = useState<{ id: string; title: string; channelName?: string; phone?: string } | null>(null);

  const { data: contacts = [] } = useContacts();
  const { data: channels = [] } = useChannels();
  const { data: members = [] } = useWorkspaceMembers();
  const { data: collabs = [] } = useDealCollaborators(deal?.id ?? null);

  const wonStage = useMemo(() => stages.find((s) => s.is_won), [stages]);
  const lostStage = useMemo(() => stages.find((s) => s.is_lost), [stages]);
  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === contactId) ?? null,
    [contacts, contactId]
  );

  const isOwner = !!deal && deal.assigned_to === user?.id;
  // Admin, gerente, dono ou negócio novo podem trocar responsável e gerenciar colaboradores
  const canReassign = isManagerOrAdmin || isOwner || !editing;
  const canManageCollabs = canReassign;

  useEffect(() => {
    if (open) {
      setTitle(deal?.title ?? "");
      setValue(deal ? (deal.value_cents / 100).toFixed(2) : "");
      setStageId(deal?.stage_id ?? defaultStageId ?? stages[0]?.id ?? "");
      setNotes(deal?.notes ?? "");
      setContactId(deal?.contact_id ?? null);
      setAssignedTo(deal?.assigned_to ?? user?.id ?? null);
      setChannelId(((deal as any)?.channel_id) ?? null);
    }
  }, [open, deal, defaultStageId, stages, user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !user) return;
    setSaving(true);
    try {
      // Resolver pipeline_id a partir da stage selecionada (deals.pipeline_id é NOT NULL)
      let pipelineId: string | null = (stages.find((s) => s.id === stageId) as any)?.pipeline_id ?? null;
      if (!pipelineId) {
        const { data: stRow } = await supabase.from("pipeline_stages").select("pipeline_id").eq("id", stageId).maybeSingle();
        pipelineId = (stRow as any)?.pipeline_id ?? null;
      }
      if (!pipelineId) {
        const { data: defPipe } = await supabase.from("pipelines").select("id").eq("workspace_id", current.id).is("archived_at", null).order("is_default", { ascending: false }).limit(1).maybeSingle();
        pipelineId = (defPipe as any)?.id ?? null;
      }
      const payload = {
        workspace_id: current.id,
        pipeline_id: pipelineId,
        stage_id: stageId,
        title: title.trim(),
        value_cents: Math.round(parseFloat(value || "0") * 100),
        notes: notes.trim() || null,
        contact_id: contactId,
        channel_id: channelId,
        assigned_to: assignedTo ?? user.id,
      };
      if (editing && deal) {
        const { error } = await supabase.from("deals").update(payload).eq("id", deal.id);
        if (error) throw error;
        toast.success("Lead atualizado");
      } else {
        // Regra Lead = Chat: Lead único por (canal + número de telefone)
        if (channelId && contactId) {
          const phone = selectedContact?.phone_e164 ?? null;
          // 1) procurar contatos com mesmo telefone no workspace
          let contactIds: string[] = [contactId];
          if (phone) {
            const { data: sameNumber } = await supabase
              .from("contacts")
              .select("id")
              .eq("workspace_id", current.id)
              .eq("phone_e164", phone);
            contactIds = Array.from(new Set([contactId, ...((sameNumber ?? []).map((r: any) => r.id))]));
          }
          const { data: existing } = await supabase
            .from("deals")
            .select("id,title,contact_id")
            .eq("workspace_id", current.id)
            .eq("channel_id", channelId)
            .in("contact_id", contactIds)
            .is("archived_at", null)
            .is("deleted_at", null)
            .eq("status", "open")
            .limit(1)
            .maybeSingle();
          if (existing?.id) {
            const ch = channels.find((c) => c.id === channelId);
            setDuplicateLead({
              id: existing.id,
              title: existing.title,
              channelName: ch?.display_name,
              phone: phone ?? undefined,
            });
            setSaving(false);
            return;
          }
        }
        const { error } = await supabase.from("deals").insert(payload);
        if (error) throw error;
        toast.success("Lead criado");
      }

      // garantir owner_id no contato vinculado (se ainda nulo)
      if (contactId) {
        await supabase
          .from("contacts")
          .update({ owner_id: assignedTo ?? user.id })
          .eq("id", contactId)
          .is("owner_id", null);
      }

      qc.invalidateQueries({ queryKey: ["deals", current.id] });
      qc.invalidateQueries({ queryKey: ["contacts", current.id] });
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const moveTo = async (
    targetStageId: string,
    status: "won" | "lost",
    reasonId?: string | null,
  ) => {
    if (!deal || !current) return;
    const patch: Record<string, unknown> = { stage_id: targetStageId, status };
    if (status === "lost") patch.loss_reason_id = reasonId ?? null;
    if (status === "won") patch.loss_reason_id = null;
    const { error } = await supabase.from("deals").update(patch).eq("id", deal.id);
    if (error) return toast.error(error.message);
    toast.success(status === "won" ? "Marcado como ganho" : "Marcado como perdido");
    qc.invalidateQueries({ queryKey: ["deals", current.id] });
    onOpenChange(false);
  };

  const confirmLoss = async () => {
    if (!lostStage) return;
    if (lossReasons.length > 0 && !lossReasonId) {
      toast.error("Selecione um motivo de perda");
      return;
    }
    await moveTo(lostStage.id, "lost", lossReasonId);
    setLossOpen(false);
    setLossReasonId(null);
  };

  const onArchive = async () => {
    if (!deal || !current) return;
    const { error } = await supabase
      .from("deals")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", deal.id);
    if (error) return toast.error(error.message);
    toast.success("Lead arquivado");
    qc.invalidateQueries({ queryKey: ["deals", current.id] });
    onOpenChange(false);
  };

  const addCollaborator = async (uid: string) => {
    if (!deal || !current) return;
    const { error } = await supabase.from("deal_collaborators").insert({
      deal_id: deal.id,
      user_id: uid,
      workspace_id: current.id,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["deal-collabs", deal.id] });
    setCollabPickerOpen(false);
  };

  const removeCollaborator = async (uid: string) => {
    if (!deal) return;
    const { error } = await supabase
      .from("deal_collaborators")
      .delete()
      .eq("deal_id", deal.id)
      .eq("user_id", uid);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["deal-collabs", deal.id] });
  };

  const memberLabel = (uid: string) => {
    const m = members.find((x) => x.user_id === uid);
    return m?.display_name || m?.email || uid.slice(0, 8);
  };

  const availableToInvite = members.filter(
    (m) => m.user_id !== assignedTo && !collabs.includes(m.user_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Lead" : "Novo Lead"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t">Título</Label>
            <Input id="t" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pacote anual — Empresa X" />
          </div>

          <div className="space-y-1.5">
            <Label>Contato</Label>
            <Popover open={contactOpen} onOpenChange={setContactOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  <span className="flex items-center gap-2 truncate">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    {selectedContact
                      ? selectedContact.display_name || selectedContact.phone_e164 || "Sem nome"
                      : "Vincular contato/chat (opcional)"}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar contato..." />
                  <CommandList>
                    <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
                    <CommandGroup>
                      {contactId && (
                        <CommandItem
                          value="__none__"
                          onSelect={() => { setContactId(null); setContactOpen(false); }}
                        >
                          <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                          Remover vínculo
                        </CommandItem>
                      )}
                      {contacts.map((c) => {
                        const label = c.display_name || c.phone_e164 || "Sem nome";
                        return (
                          <CommandItem
                            key={c.id}
                            value={`${label} ${c.phone_e164 ?? ""}`}
                            onSelect={() => { setContactId(c.id); setContactOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", contactId === c.id ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{label}</span>
                            {c.phone_e164 && (
                              <span className="ml-auto text-xs text-muted-foreground">{c.phone_e164}</span>
                            )}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="v">Valor (R$)</Label>
              <Input id="v" type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Canal</Label>
            <Select value={channelId ?? "none"} onValueChange={(v) => setChannelId(v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar canal..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem canal vinculado</SelectItem>
                {channels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.display_name} {c.phone_e164 ? `· ${c.phone_e164}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              1 Lead = 1 Chat por canal. Mesmo contato em outro canal = Lead separado.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Vendedor responsável</Label>
            {canReassign ? (
              <Select value={assignedTo ?? user?.id ?? ""} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.display_name || m.email || m.user_id.slice(0, 8)}
                      {m.user_id === user?.id && " (você)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{memberLabel(assignedTo ?? user?.id ?? "")}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">Somente admin/dono altera</Badge>
              </div>
            )}
          </div>

          {editing && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Colaboradores convidados
                </Label>
                {canManageCollabs && availableToInvite.length > 0 && (
                  <Popover open={collabPickerOpen} onOpenChange={setCollabPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs">
                        Convidar
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="end">
                      <Command>
                        <CommandInput placeholder="Buscar membro..." />
                        <CommandList>
                          <CommandEmpty>Sem membros disponíveis.</CommandEmpty>
                          <CommandGroup>
                            {availableToInvite.map((m) => (
                              <CommandItem
                                key={m.user_id}
                                value={m.display_name || m.email || m.user_id}
                                onSelect={() => addCollaborator(m.user_id)}
                              >
                                {m.display_name || m.email || m.user_id.slice(0, 8)}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              {collabs.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Apenas o vendedor responsável vê este negócio. Convide colegas para compartilhar.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {collabs.map((uid) => (
                    <span
                      key={uid}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                    >
                      {memberLabel(uid)}
                      {canManageCollabs && (
                        <button
                          type="button"
                          onClick={() => removeCollaborator(uid)}
                          className="ml-0.5 text-muted-foreground hover:text-destructive"
                          aria-label="Remover"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="n">Notas</Label>
            <Textarea id="n" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          {editing && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {wonStage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                  onClick={() => moveTo(wonStage.id, "won")}
                >
                  <Trophy className="h-3.5 w-3.5" /> Ganhar
                </Button>
              )}
              {lostStage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-red-600 border-red-500/30 hover:bg-red-500/10"
                  onClick={() => setLossOpen(true)}
                >
                  <XCircle className="h-3.5 w-3.5" /> Perder
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground ml-auto"
                  >
                    <Archive className="h-3.5 w-3.5" /> Arquivar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Arquivar Lead?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O negócio sai do funil ativo, mas pode ser restaurado depois. O contato permanece intacto.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onArchive}>Arquivar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !title.trim() || !stageId}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <Dialog open={lossOpen} onOpenChange={setLossOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar como perdido</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {lossReasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum motivo cadastrado. Peça a um administrador para cadastrar em
                <strong> Configurações → Cadastros</strong>.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label>Motivo</Label>
                <Select value={lossReasonId ?? ""} onValueChange={setLossReasonId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um motivo" /></SelectTrigger>
                  <SelectContent>
                    {lossReasons.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLossOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={confirmLoss}
              disabled={lossReasons.length > 0 && !lossReasonId}
            >
              Confirmar perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!duplicateLead} onOpenChange={(v) => { if (!v) setDuplicateLead(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lead já existe neste canal</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe um Lead{duplicateLead?.phone ? ` para o número ${duplicateLead.phone}` : ""}
              {duplicateLead?.channelName ? ` no canal "${duplicateLead.channelName}"` : ""}:{" "}
              <strong>{duplicateLead?.title}</strong>.
              <br />
              Não é permitido criar dois Leads com o mesmo número no mesmo canal. Abra o Lead existente para continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDuplicateLead(null)}>Fechar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!duplicateLead) return;
                const dupId = duplicateLead.id;
                setDuplicateLead(null);
                qc.invalidateQueries({ queryKey: ["deals", current?.id] });
                onOpenChange(false);
                // dispara evento global p/ Pipeline abrir o Lead existente
                window.dispatchEvent(new CustomEvent("open-deal", { detail: { dealId: dupId } }));
              }}
            >
              Abrir Lead existente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
