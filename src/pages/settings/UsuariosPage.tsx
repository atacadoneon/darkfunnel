import { useMemo, useState } from "react";
import { useWorkspaceMembers, type WorkspaceRole } from "@/features/workspace/permissions";
import {
  usePermissionCatalog,
  useUserPermissions,
  useUpsertUserPermission,
  useResetUserPermissions,
  type PermissionCatalogRow,
} from "@/hooks/usePermissions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Search, Shield } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UsersSection } from "@/features/workspace/UsersSection";

const MODULE_LABELS: Record<string, string> = {
  crm: "CRM",
  chats: "Chats",
  ligacoes: "Ligações",
  discador: "Discador",
  email_marketing: "Email Marketing",
  metas: "Metas",
  tarefas: "Tarefas",
  reunioes: "Reuniões",
  automacoes: "Automações",
  prospeccao: "Prospecção",
  wallet: "Wallet",
  pagamentos: "Pagamentos",
  propostas: "Propostas",
  produtos: "Produtos",
  dashboard: "Dashboard",
  settings: "Settings",
  workspace: "Workspace",
};

function defaultFor(role: WorkspaceRole, p: PermissionCatalogRow): string {
  switch (role) {
    case "proprietario":
    case "platform_admin":
      return p.default_proprietario;
    case "gerente":
      return p.default_gerente;
    case "vendedor":
      return p.default_vendedor;
    case "colaborador":
      return p.default_colaborador;
    default:
      return p.default_vendedor;
  }
}

function scopeToBool(scope: string): boolean {
  return scope !== "none" && scope !== "" && !!scope;
}

function PermissionEditor({ userId, role }: { userId: string; role: WorkspaceRole }) {
  const { data: catalog = [], isLoading: loadingCat } = usePermissionCatalog();
  const { data: overrides = [], isLoading: loadingOv } = useUserPermissions(userId);
  const upsert = useUpsertUserPermission();
  const reset = useResetUserPermissions();

  const overrideMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of overrides) m.set(o.permission_slug, o.scope);
    return m;
  }, [overrides]);

  const grouped = useMemo(() => {
    const g: Record<string, PermissionCatalogRow[]> = {};
    for (const p of catalog) (g[p.module] ||= []).push(p);
    return g;
  }, [catalog]);

  if (loadingCat || loadingOv) {
    return (
      <div className="p-10 flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando permissões...
      </div>
    );
  }

  const handleToggle = async (p: PermissionCatalogRow, next: boolean) => {
    const scope = next ? "all" : "none";
    try {
      await upsert.mutateAsync({ userId, permissionSlug: p.slug, scope: scope as any });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleReset = async () => {
    try {
      await reset.mutateAsync(userId);
      toast.success("Permissões resetadas para o padrão da role");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-5 py-3 border-b flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          Permissões granulares — alterações são salvas automaticamente
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={reset.isPending}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Resetar para padrão da role
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-5 space-y-6">
          {Object.entries(grouped).map(([mod, perms]) => (
            <div key={mod}>
              <h3 className="text-sm font-semibold mb-2 sticky top-0 bg-background py-1">
                {MODULE_LABELS[mod] ?? mod}
              </h3>
              <div className="rounded-lg border divide-y">
                {perms.map((p) => {
                  const overrideScope = overrideMap.get(p.slug);
                  const hasOverride = overrideScope !== undefined;
                  const effective = hasOverride
                    ? scopeToBool(overrideScope!)
                    : scopeToBool(defaultFor(role, p));
                  return (
                    <div
                      key={p.slug}
                      className="flex items-start gap-3 px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{p.label}</div>
                        {p.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {p.description}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground/70 mt-1 font-mono">
                          {p.slug}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "p-0.5 rounded-full",
                          hasOverride && "ring-2 ring-violet-500/70"
                        )}
                      >
                        <Switch
                          checked={effective}
                          onCheckedChange={(v) => handleToggle(p, v)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function PermissionsMatrix() {
  const { data: members = [], isLoading } = useWorkspaceMembers();
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      (m.display_name ?? "").toLowerCase().includes(q) ||
      (m.email ?? "").toLowerCase().includes(q)
    );
  }, [members, search]);

  const selectedMember = members.find((m) => m.user_id === selected) ?? null;

  const handleRoleChange = async (newRole: WorkspaceRole) => {
    if (!selectedMember || !current) return;
    const { error } = await supabase
      .from("workspace_members")
      .update({ role: newRole })
      .eq("workspace_id", current.id)
      .eq("user_id", selectedMember.user_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Role atualizada");
    qc.invalidateQueries({ queryKey: ["ws-members", current.id] });
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex h-[640px] min-h-0">
        {/* Left: members list */}
        <div className="w-[320px] border-r flex flex-col min-h-0">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-1">
              {isLoading && (
                <div className="text-xs text-muted-foreground p-3">Carregando...</div>
              )}
              {filtered.map((m) => {
                const active = selected === m.user_id;
                return (
                  <button
                    key={m.user_id}
                    onClick={() => setSelected(m.user_id)}
                    className={cn(
                      "w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors",
                      active ? "bg-accent" : "hover:bg-accent/50"
                    )}
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                      {(m.display_name ?? m.email ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {m.display_name ?? "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {m.email}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {m.role}
                    </Badge>
                  </button>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <div className="text-xs text-muted-foreground p-3 text-center">
                  Nenhum usuário encontrado
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right: editor */}
        <div className="flex-1 flex flex-col min-h-0">
          {!selectedMember ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Selecione um usuário para editar as permissões.
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-semibold text-primary shrink-0">
                  {(selectedMember.display_name ?? selectedMember.email ?? "?")
                    .slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {selectedMember.display_name ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {selectedMember.email}
                  </div>
                </div>
                <Badge className="bg-violet-600 hover:bg-violet-600 capitalize">
                  {selectedMember.role}
                </Badge>
                <Select
                  value={selectedMember.role}
                  onValueChange={(v) => handleRoleChange(v as WorkspaceRole)}
                >
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="proprietario">Proprietário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-h-0">
                <PermissionEditor
                  userId={selectedMember.user_id}
                  role={selectedMember.role}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function UsuariosPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie usuários, setores e permissões granulares da sua conta.
        </p>
      </header>
      <PermissionsMatrix />
      <UsersSection />
    </div>
  );
}
