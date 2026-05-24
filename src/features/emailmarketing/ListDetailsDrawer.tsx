import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useListMembers, useAddListMembers, type EmailList } from "./hooks";
import { EmptyState } from "@/components/EmptyState";
import { Users, Plus } from "lucide-react";

type Props = { list: EmailList | null; onOpenChange: (v: boolean) => void };

export function ListDetailsDrawer({ list, onOpenChange }: Props) {
  const { current } = useWorkspace();
  const { data: members = [] } = useListMembers(list?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const addMut = useAddListMembers();

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-picker", current?.id],
    enabled: !!current && adding,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id,display_name,email,phone_e164")
        .eq("workspace_id", current!.id)
        .not("email", "is", null)
        .limit(500);
      if (error) throw error;
      return (data ?? []) as { id: string; display_name: string | null; email: string | null; phone_e164: string | null }[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => !q || (c.display_name ?? "").toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q));
  }, [contacts, search]);

  async function doAdd() {
    if (!list) return;
    const existing = new Set(members.map((m) => m.email.toLowerCase()));
    const toAdd = contacts.filter((c) => picked[c.id] && c.email && !existing.has(c.email.toLowerCase()))
      .map((c) => ({ email: c.email!, contact_id: c.id }));
    if (toAdd.length === 0) { setAdding(false); return; }
    await addMut.mutateAsync({ list_id: list.id, members: toAdd });
    setPicked({}); setAdding(false);
  }

  return (
    <Sheet open={!!list} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader><SheetTitle>{list?.name}</SheetTitle></SheetHeader>
        {!list ? null : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{members.length} membros</p>
              <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" />Adicionar contatos</Button>
            </div>

            {adding && (
              <div className="border rounded p-3 space-y-2 bg-muted/30">
                <Input placeholder="Buscar contatos..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {filtered.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-background cursor-pointer">
                      <input type="checkbox" checked={!!picked[c.id]} onChange={(e) => setPicked((p) => ({ ...p, [c.id]: e.target.checked }))} />
                      <div className="flex-1 text-sm"><div>{c.display_name ?? "(sem nome)"}</div><div className="text-xs text-muted-foreground">{c.email}</div></div>
                    </label>
                  ))}
                  {filtered.length === 0 && <p className="text-sm text-muted-foreground p-2">Nenhum contato com email.</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setAdding(false); setPicked({}); }}>Cancelar</Button>
                  <Button size="sm" disabled={addMut.isPending} onClick={doAdd}>Adicionar selecionados</Button>
                </div>
              </div>
            )}

            {members.length === 0 ? <EmptyState icon={Users} title="Lista vazia" description="Adicione contatos para começar a enviar campanhas." />
              : <div className="border rounded divide-y">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-2 text-sm">
                    <span>{m.email}</span>
                    <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
                  </div>
                ))}
              </div>}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
