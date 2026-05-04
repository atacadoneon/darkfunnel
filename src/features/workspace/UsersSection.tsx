import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Users as UsersIcon, Loader2, Pencil, Archive, Tag } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { useSectors, useCreateSector } from "@/features/channels/configHooks";

// ============= MEMBROS DOS SETORES =============
function useSectorMembersMap(sectorIds: string[]) {
  return useQuery({
    queryKey: ["sector-members-map", sectorIds.sort().join(",")],
    enabled: sectorIds.length > 0,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const { data, error } = await supabase
        .from("sector_members")
        .select("sector_id,user_id")
        .in("sector_id", sectorIds);
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const r of data ?? []) {
        const row = r as { sector_id: string; user_id: string };
        (map[row.sector_id] ||= []).push(row.user_id);
      }
      return map;
    },
  });
}

async function setSectorMembers(sectorId: string, userIds: string[]) {
  const { error: delErr } = await supabase.from("sector_members").delete().eq("sector_id", sectorId);
  if (delErr) throw delErr;
  if (!userIds.length) return;
  const { error } = await supabase
    .from("sector_members")
    .insert(userIds.map((user_id) => ({ sector_id: sectorId, user_id })));
  if (error) throw error;
}

// ============= SETORES SECTION =============
function SectorsCard() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const { data: sectors = [], isLoading } = useSectors();
  const { data: members = [] } = useWorkspaceMembers();
  const createSector = useCreateSector();
  const sectorIds = sectors.map((s) => s.id);
  const { data: membersMap = {} } = useSectorMembersMap(sectorIds);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingSector, setEditingSector] = useState<{ id: string; name: string } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [membersDialog, setMembersDialog] = useState<{ id: string; name: string } | null>(null);
  const [draftMembers, setDraftMembers] = useState<string[]>([]);
  const [savingMembers, setSavingMembers] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["sectors", current?.id] });
    qc.invalidateQueries({ queryKey: ["sector-members-map"] });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createSector.mutateAsync(newName);
      setNewName("");
      setCreating(false);
      toast.success("Setor criado");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleRename = async () => {
    if (!editingSector || !renameDraft.trim()) return;
    setSavingRename(true);
    const { error } = await supabase.from("sectors").update({ name: renameDraft.trim() }).eq("id", editingSector.id);
    setSavingRename(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Setor renomeado");
    setEditingSector(null);
    refresh();
  };

  const handleArchive = async (id: string) => {
    const { error } = await supabase.from("sectors").update({ archived_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Setor arquivado");
    refresh();
  };

  const openMembersDialog = (s: { id: string; name: string }) => {
    setMembersDialog(s);
    setDraftMembers(membersMap[s.id] ?? []);
  };

  const saveMembers = async () => {
    if (!membersDialog) return;
    setSavingMembers(true);
    try {
      await setSectorMembers(membersDialog.id, draftMembers);
      toast.success("Usuários do setor atualizados");
      setMembersDialog(null);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingMembers(false);
    }
  };

  const toggleDraft = (uid: string) => {
    setDraftMembers((p) => p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]);
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Tag className="h-4 w-4" /> Setores</h3>
          <p className="text-sm text-muted-foreground">Organize sua equipe por setores (vendas, suporte, etc.) e use no rodízio dos canais.</p>
        </div>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo setor
          </Button>
        )}
      </div>

      {creating && (
        <div className="flex gap-2 mb-4 p-3 bg-muted/40 rounded-lg border">
          <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Vendas, Suporte..." />
          <Button onClick={handleCreate} disabled={createSector.isPending || !newName.trim()}>
            {createSector.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
          </Button>
          <Button variant="ghost" onClick={() => { setCreating(false); setNewName(""); }}>Cancelar</Button>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : sectors.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
          Nenhum setor cadastrado.
        </div>
      ) : (
        <div className="space-y-2">
          {sectors.map((s) => {
            const count = membersMap[s.id]?.length ?? 0;
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{count} {count === 1 ? "usuário" : "usuários"}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => openMembersDialog(s)}>
                  <UsersIcon className="h-3.5 w-3.5 mr-1" /> Usuários
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setEditingSector(s); setRenameDraft(s.name); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleArchive(s.id)} aria-label="Arquivar setor">
                  <Archive className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Renomear */}
      <Dialog open={!!editingSector} onOpenChange={(o) => !o && setEditingSector(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear setor</DialogTitle>
          </DialogHeader>
          <Input autoFocus value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingSector(null)}>Cancelar</Button>
            <Button onClick={handleRename} disabled={savingRename || !renameDraft.trim()}>
              {savingRename ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usuários */}
      <Dialog open={!!membersDialog} onOpenChange={(o) => !o && setMembersDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuários do setor "{membersDialog?.name}"</DialogTitle>
            <DialogDescription>Selecione quem faz parte deste setor.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-72 -mx-2">
            <div className="px-2 space-y-1">
              {members.map((m) => (
                <label key={m.user_id} className="flex items-center gap-3 px-2 py-2 rounded hover:bg-accent cursor-pointer">
                  <Checkbox checked={draftMembers.includes(m.user_id)} onCheckedChange={() => toggleDraft(m.user_id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.display_name ?? m.email ?? m.user_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                  </div>
                </label>
              ))}
              {members.length === 0 && <div className="text-xs text-muted-foreground p-2">Nenhum usuário cadastrado.</div>}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMembersDialog(null)}>Cancelar</Button>
            <Button onClick={saveMembers} disabled={savingMembers}>
              {savingMembers ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============= USUÁRIOS SECTION =============
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WorkspaceRole } from "@/features/workspace/permissions";

function AddUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [clientVisibleName, setClientVisibleName] = useState("");
  const [hideClientName, setHideClientName] = useState(true);
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setEmail(""); setDisplayName(""); setPassword("");
    setClientVisibleName(""); setHideClientName(true); setRole("member");
  };

  const handleAdd = async () => {
    if (!current) return;
    if (!email.trim() || !displayName.trim() || !password) {
      toast.error("Preencha email, nome e senha"); return;
    }
    if (password.length < 6) { toast.error("Senha deve ter ao menos 6 caracteres"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          workspace_id: current.id,
          email: email.trim().toLowerCase(),
          password,
          display_name: displayName.trim(),
          client_visible_name: hideClientName ? null : (clientVisibleName.trim() || null),
          role,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário cadastrado");
      qc.invalidateQueries({ queryKey: ["ws-members", current.id] });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || "Erro ao cadastrar usuário");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Usuário</DialogTitle>
          <DialogDescription>
            Preencha os dados do usuário que terá acesso à sua conta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <h4 className="text-sm font-semibold text-primary">Dados do Usuário</h4>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Digite o email..." />
              <p className="text-xs text-muted-foreground">Insira um email válido para poder recuperar a senha em caso de esquecimento.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome</label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nome do usuário" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Senha</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite a senha..." />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:items-end">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nome visível para o cliente</label>
                <Input
                  value={clientVisibleName}
                  onChange={(e) => setClientVisibleName(e.target.value)}
                  placeholder="Nome visível para o cliente"
                  disabled={hideClientName}
                />
                <p className="text-xs text-muted-foreground">Este é o nome que será inserido automaticamente antes da mensagem caso ative esta opção.</p>
              </div>
              <Button
                type="button"
                variant={hideClientName ? "secondary" : "default"}
                onClick={() => setHideClientName((v) => !v)}
                className="sm:min-w-[140px]"
              >
                {hideClientName ? "Não Exibir" : "Exibir"}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-primary">Nível/Permissões</h4>
            <Select value={role} onValueChange={(v) => setRole(v as WorkspaceRole)}>
              <SelectTrigger><SelectValue placeholder="- SELECIONE -" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Vendedor</SelectItem>
                <SelectItem value="manager">Gestor</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Usuário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembersCard() {
  const { data: members = [], isLoading } = useWorkspaceMembers();
  const [addOpen, setAddOpen] = useState(false);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><UsersIcon className="h-4 w-4" /> Usuários</h3>
          <p className="text-sm text-muted-foreground">Usuários que têm acesso ao sistema.</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar usuário
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                {(m.display_name ?? m.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{m.display_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground truncate">{m.email}</div>
              </div>
              <Badge variant="outline" className="capitalize text-xs">{m.role}</Badge>
            </div>
          ))}
        </div>
      )}

      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} />
    </Card>
  );
}

export function UsersSection() {
  return (
    <div className="space-y-6">
      <MembersCard />
      <SectorsCard />
    </div>
  );
}
