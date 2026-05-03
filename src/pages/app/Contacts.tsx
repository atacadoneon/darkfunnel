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
import { useContacts, type Contact } from "@/features/contacts/hooks";
import { ContactDialog } from "@/features/contacts/ContactDialog";
import {
  MoreHorizontal,
  Phone,
  Search,
  Trash2,
  Pencil,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Contacts() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: contacts = [], isLoading } = useContacts(search);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [toDelete, setToDelete] = useState<Contact | null>(null);

  const total = contacts.length;
  const withPhone = useMemo(
    () => contacts.filter((c) => !!c.phone_e164).length,
    [contacts]
  );

  const openEdit = (c: Contact) => {
    setEditing(c);
    setDialogOpen(true);
  };

  const onConfirmDelete = async () => {
    if (!toDelete || !current) return;
    try {
      const { error } = await supabase.from("contacts").delete().eq("id", toDelete.id);
      if (error) throw error;
      toast.success("Contato removido");
      qc.invalidateQueries({ queryKey: ["contacts", current.id] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setToDelete(null);
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
                  {total} contato{total === 1 ? "" : "s"} · {withPhone} com telefone · criados automaticamente pelo atendimento
                </p>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Badge variant="outline" className="text-[11px]">
                Base unificada · Atendimento + CRM
              </Badge>
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
            <span>Telefone</span>
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
                        <div className="truncate text-xs text-muted-foreground md:hidden">
                          {c.phone_e164 ?? "—"}
                        </div>
                      </div>
                    </button>

                    <div className="hidden items-center gap-1.5 text-sm md:flex">
                      {c.phone_e164 ? (
                        <>
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{c.phone_e164}</span>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">sem telefone</Badge>
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
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setToDelete(c)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
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

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As conversas vinculadas perderão a
              referência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onConfirmDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
