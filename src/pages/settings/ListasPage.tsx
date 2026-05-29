import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, UserPlus, X, List as ListIcon } from "lucide-react";
import {
  useLists, useUpsertList, useDeleteList,
  useListMembers, useAddListMember, useRemoveListMember,
  useContactsLite, type ListWithCount,
} from "@/features/cadastros/hooks";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function ListasPage() {
  const { data: lists = [], isLoading } = useLists();
  const canEdit = useIsManagerOrAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ListWithCount | null>(null);
  const [drawerList, setDrawerList] = useState<ListWithCount | null>(null);
  const [toDelete, setToDelete] = useState<ListWithCount | null>(null);
  const del = useDeleteList();

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Listas</h1>
          <p className="text-sm text-muted-foreground">Organize contatos em listas estáticas ou dinâmicas.</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="h-4 w-4" /> Nova Lista
          </Button>
        )}
      </header>

      <Card>
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : lists.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
            <ListIcon className="h-8 w-8 opacity-40" />
            Nenhuma lista ainda. Crie a primeira para organizar contatos.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Membros</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="w-[120px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lists.map((l) => (
                <TableRow key={l.id} className="cursor-pointer" onClick={() => setDrawerList(l)}>
                  <TableCell className="font-medium">
                    <Badge className="bg-violet-600 text-white hover:bg-violet-700">{l.name}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.description || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={l.is_dynamic ? "default" : "secondary"}>
                      {l.is_dynamic ? "Dinâmica" : "Estática"}
                    </Badge>
                  </TableCell>
                  <TableCell>{l.member_count}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(l.created_at)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(l); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setToDelete(l)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ListDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <ListMembersDrawer list={drawerList} onClose={() => setDrawerList(null)} canEdit={canEdit} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
            <AlertDialogDescription>
              A lista "{toDelete?.name}" será removida. Esta ação pode ser revertida pelo suporte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (toDelete) del.mutate(toDelete.id); setToDelete(null); }}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ListDialog({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: ListWithCount | null;
}) {
  const upsert = useUpsertList();
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [isDynamic, setIsDynamic] = useState(editing?.is_dynamic ?? false);

  // reset when editing changes / dialog opens
  const key = editing?.id ?? "new";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useStateReset(key, () => {
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setIsDynamic(editing?.is_dynamic ?? false);
  });

  const submit = async () => {
    if (!name.trim()) return;
    await upsert.mutateAsync({
      id: editing?.id,
      name: name.trim(),
      description: description.trim() || null,
      is_dynamic: isDynamic,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lista" : "Nova lista"}</DialogTitle>
          <DialogDescription>Configure nome, descrição e tipo da lista.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nome *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Leads quentes" />
          </div>
          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">{isDynamic ? "Dinâmica" : "Estática"}</p>
              <p className="text-xs text-muted-foreground">
                {isDynamic ? "Os membros são definidos por uma consulta." : "Você adiciona contatos manualmente."}
              </p>
            </div>
            <Switch checked={isDynamic} onCheckedChange={setIsDynamic} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!name.trim() || upsert.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListMembersDrawer({ list, onClose, canEdit }: {
  list: ListWithCount | null; onClose: () => void; canEdit: boolean;
}) {
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: members = [], isLoading } = useListMembers(list?.id ?? null);
  const remove = useRemoveListMember();

  return (
    <Sheet open={!!list} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[420px] sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{list?.name}</SheetTitle>
          <SheetDescription>
            {members.length} {members.length === 1 ? "membro" : "membros"}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {canEdit && !list?.is_dynamic && (
            <Button onClick={() => setPickerOpen(true)} variant="outline" className="w-full">
              <UserPlus className="h-4 w-4" /> Adicionar contato
            </Button>
          )}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum contato nesta lista.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {members.map((m) => (
                <li key={m.contact_id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{m.contacts?.name || "(sem nome)"}</p>
                    <p className="text-xs text-muted-foreground">{m.contacts?.phone || m.contacts?.email || "—"}</p>
                  </div>
                  {canEdit && !list?.is_dynamic && (
                    <Button
                      size="icon" variant="ghost"
                      onClick={() => remove.mutate({ listId: list!.id, contactId: m.contact_id })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar contato</DialogTitle>
              <DialogDescription>Busque por nome, telefone ou e-mail.</DialogDescription>
            </DialogHeader>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." />
            <ContactPickerList
              search={search}
              listId={list?.id ?? ""}
              onPicked={() => setPickerOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

function ContactPickerList({ search, listId, onPicked }: { search: string; listId: string; onPicked: () => void }) {
  const { data = [], isLoading } = useContactsLite(search);
  const add = useAddListMember();
  return (
    <div className="max-h-72 overflow-y-auto divide-y rounded-md border">
      {isLoading && <p className="p-3 text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && data.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhum contato.</p>}
      {data.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={async () => { await add.mutateAsync({ listId, contactId: c.id }); onPicked(); }}
          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
        >
          <p className="font-medium">{c.name || "(sem nome)"}</p>
          <p className="text-xs text-muted-foreground">{c.phone || c.email || "—"}</p>
        </button>
      ))}
    </div>
  );
}

// tiny helper to reset state when key changes
import { useEffect } from "react";
function useStateReset(key: string, reset: () => void) {
  useEffect(() => { reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);
}
