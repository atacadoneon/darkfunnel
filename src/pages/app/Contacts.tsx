import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useContacts, type Contact, IDENTITY_LABELS } from "@/features/contacts/hooks";
import { ContactDialog, IDENTITY_ICON } from "@/features/contacts/ContactDialog";
import {
  MoreHorizontal,
  Search,
  Archive,
  ArchiveRestore,
  Pencil,
  Users,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Contacts() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const { data: contacts = [], isLoading } = useContacts(search, showArchived);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [toArchive, setToArchive] = useState<Contact | null>(null);

  const total = contacts.length;
  const withChannels = useMemo(
    () => contacts.filter((c) => (c.identities ?? []).length > 0).length,
    [contacts]
  );

  const openEdit = (c: Contact) => {
    setEditing(c);
    setDialogOpen(true);
  };

  const onConfirmArchive = async () => {
    if (!toArchive || !current) return;
    const isArchived = !!toArchive.archived_at;
    try {
      const { error } = await supabase
        .from("contacts")
        .update({ archived_at: isArchived ? null : new Date().toISOString() })
        .eq("id", toArchive.id);
      if (error) throw error;
      toast.success(isArchived ? "Contato restaurado" : "Contato arquivado");
      qc.invalidateQueries({ queryKey: ["contacts", current.id] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setToArchive(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Banco unificado
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Contatos & Leads</h1>
                <p className="text-sm text-muted-foreground">
                  {total} contato{total === 1 ? "" : "s"} · {withChannels} com canais · criados automaticamente pelo atendimento
                </p>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Badge variant="outline" className="text-[11px]">
                Base unificada · Atendimento + CRM
              </Badge>
            </div>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Switch id="show-arch" checked={showArchived} onCheckedChange={setShowArchived} />
              <Label htmlFor="show-arch" className="text-xs cursor-pointer whitespace-nowrap">Arquivados</Label>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou telefone…"
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="hidden grid-cols-[1fr_180px_140px_56px] gap-3 border-b border-border/40 px-4 py-3 text-[11px] uppercase tracking-wide text-muted-foreground md:grid">
            <span>Nome</span>
            <span>Canais</span>
            <span>Adicionado</span>
            <span className="text-right">Ações</span>
          </div>

          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {search
                  ? "Nenhum contato encontrado."
                  : "Nenhum contato ainda. Eles aparecem aqui automaticamente quando uma conversa é iniciada no atendimento."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {contacts.map((c) => {
                const name = c.display_name ?? c.phone_e164 ?? "Sem nome";
                const initials = name
                  .split(/\s+/)
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <li
                    key={c.id}
                    className="grid grid-cols-1 gap-2 px-4 py-3 transition-colors hover:bg-muted/40 md:grid-cols-[1fr_180px_140px_56px] md:items-center md:gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="flex min-w-0 items-center gap-3 text-left"
                    >
                      <Avatar className="h-9 w-9">
                        {c.profile_pic_url && <AvatarImage src={c.profile_pic_url} />}
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {initials || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{name}</div>
                        <div className="flex flex-wrap gap-1 pt-0.5 md:hidden">
                          {(c.identities ?? []).slice(0, 3).map((i) => {
                            const Icon = IDENTITY_ICON[i.kind];
                            return (
                              <span
                                key={i.id}
                                className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                <Icon className="h-2.5 w-2.5" />
                                <span className="max-w-[120px] truncate">{i.value}</span>
                              </span>
                            );
                          })}
                          {(c.identities ?? []).length === 0 && c.phone_e164 && (
                            <span className="text-[10px] text-muted-foreground">{c.phone_e164}</span>
                          )}
                        </div>
                      </div>
                    </button>

                    <div className="hidden flex-wrap items-center gap-1 md:flex">
                      {(c.identities ?? []).length === 0 ? (
                        <Badge variant="outline" className="text-[10px]">sem canais</Badge>
                      ) : (
                        (c.identities ?? []).map((i) => {
                          const Icon = IDENTITY_ICON[i.kind];
                          return (
                            <span
                              key={i.id}
                              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                              title={`${IDENTITY_LABELS[i.kind]}: ${i.value}`}
                            >
                              <Icon className="h-3 w-3 text-muted-foreground" />
                              <span className="max-w-[140px] truncate">{i.value}</span>
                              {i.is_primary && <span className="text-amber-500">★</span>}
                            </span>
                          );
                        })
                      )}
                    </div>

                    <div className="hidden text-xs text-muted-foreground md:block">
                      {formatDistanceToNow(new Date(c.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </div>

                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(c)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setToArchive(c)}>
                            {c.archived_at ? (
                              <><ArchiveRestore className="mr-2 h-4 w-4" /> Restaurar</>
                            ) : (
                              <><Archive className="mr-2 h-4 w-4" /> Arquivar</>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editing}
      />

      <AlertDialog open={!!toArchive} onOpenChange={(v) => !v && setToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toArchive?.archived_at ? "Restaurar contato?" : "Arquivar contato?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toArchive?.archived_at
                ? "O contato voltará à sua base ativa."
                : "O contato será ocultado das listagens. O histórico permanece intacto e pode ser restaurado a qualquer momento."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmArchive}>
              {toArchive?.archived_at ? "Restaurar" : "Arquivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
