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
      toast.success("Membros do setor atualizados");
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
                  <div className="text-xs text-muted-foreground">{count} {count === 1 ? "membro" : "membros"}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => openMembersDialog(s)}>
                  <UsersIcon className="h-3.5 w-3.5 mr-1" /> Membros
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

      {/* Membros */}
      <Dialog open={!!membersDialog} onOpenChange={(o) => !o && setMembersDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Membros do setor "{membersDialog?.name}"</DialogTitle>
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
              {members.length === 0 && <div className="text-xs text-muted-foreground p-2">Nenhum membro cadastrado.</div>}
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
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [saving, setSaving] = useState(false);

  const reset = () => { setEmail(""); setRole("member"); };

  const handleAdd = async () => {
    if (!current || !email.trim()) return;
    setSaving(true);
    try {
      const target = email.trim().toLowerCase();
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("id,email")
        .ilike("email", target)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile) {
        toast.error("Nenhum usuário com esse email. Peça para se cadastrar primeiro.");
        return;
      }
      const { error } = await supabase
        .from("workspace_members")
        .insert({ workspace_id: current.id, user_id: profile.id, role });
      if (error) {
        if (error.code === "23505") toast.error("Esse usuário já faz parte.");
        else throw error;
        return;
      }
      toast.success("Usuário adicionado");
      qc.invalidateQueries({ queryKey: ["ws-members", current.id] });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar usuário</DialogTitle>
          <DialogDescription>O usuário precisa já ter uma conta cadastrada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Permissão</label>
            <Select value={role} onValueChange={(v) => setRole(v as WorkspaceRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membro</SelectItem>
                <SelectItem value="manager">Gestor</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAdd} disabled={saving || !email.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
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
          <p className="text-sm text-muted-foreground">Membros que têm acesso ao sistema.</p>
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
